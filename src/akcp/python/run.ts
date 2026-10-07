import { buildHarness, type PythonJob } from './harness'
import { assertSafeFiles } from './safety'
import type { CodeFile } from './types'

export interface PythonFailure {
  name: string
  message: string
}

export interface PythonResult {
  ok: boolean
  stdout: string
  error: string
  failures: PythonFailure[]
  passed: number
  total: number
}

const PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/'
const RUN_TIMEOUT_MS = 20_000

function runningInNode(): boolean {
  return typeof process !== 'undefined' && typeof process.versions?.node === 'string'
}

function emptyResult(error: string): PythonResult {
  return { ok: false, stdout: '', error, failures: [], passed: 0, total: 0 }
}

function readResult(raw: string): PythonResult {
  const parsed = JSON.parse(raw) as Partial<PythonResult>
  const failures = Array.isArray(parsed.failures)
    ? parsed.failures.filter((item): item is PythonFailure =>
      !!item && typeof item === 'object' && typeof item.name === 'string' && typeof item.message === 'string')
    : []
  return {
    ok: parsed.ok === true,
    stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
    error: typeof parsed.error === 'string' ? parsed.error : '',
    failures,
    passed: typeof parsed.passed === 'number' ? parsed.passed : 0,
    total: typeof parsed.total === 'number' ? parsed.total : 0,
  }
}

type NodeFs = {
  mkdtempSync: (prefix: string) => string
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void
  writeFileSync: (path: string, data: string, encoding: 'utf8') => void
  readFileSync: (path: string, encoding: 'utf8') => string
  rmSync: (path: string, options?: { recursive?: boolean; force?: boolean }) => void
  existsSync: (path: string) => boolean
  realpathSync: (path: string) => string
}

type NodePath = {
  join: (...parts: string[]) => string
  dirname: (path: string) => string
  resolve: (...parts: string[]) => string
}

type SpawnChild = {
  stderr: { on: (event: 'data', cb: (chunk: unknown) => void) => void }
  on: (event: 'close' | 'error', cb: (value?: unknown) => void) => void
  kill: (signal: string) => void
}

async function nodeModules(): Promise<{ fs: NodeFs; path: NodePath; os: { tmpdir: () => string }; spawn: (cmd: string, args: string[], opts: { cwd: string; env: Record<string, string>; stdio: ['ignore', 'pipe', 'pipe'] }) => SpawnChild }> {
  const builtin = (process as unknown as { getBuiltinModule: (id: string) => unknown }).getBuiltinModule
  if (typeof builtin !== 'function') throw new Error('node builtins are unavailable')
  const fs = builtin('fs') as NodeFs
  const path = builtin('path') as NodePath
  const os = builtin('os') as { tmpdir: () => string }
  const child = builtin('child_process') as { spawn: (cmd: string, args: string[], opts: { cwd: string; env: Record<string, string>; stdio: ['ignore', 'pipe', 'pipe'] }) => SpawnChild }
  return { fs, path, os, spawn: child.spawn }
}

function pythonBin(fs: NodeFs): string {
  for (const candidate of ['/usr/bin/python3', '/usr/local/bin/python3']) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error('python3 is not available for mission checks')
}

async function runOnNode(files: CodeFile[], job: Omit<PythonJob, 'root'>): Promise<PythonResult> {
  const { fs, path, os, spawn } = await nodeModules()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-python-'))
  try {
    const rootReal = fs.realpathSync(root)
    for (const file of files) {
      const full = path.resolve(rootReal, file.name)
      if (full !== rootReal && !full.startsWith(`${rootReal}/`)) throw new Error(`Unsafe mission path: ${file.name}`)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, file.text, 'utf8')
    }
    const harnessPath = path.join(rootReal, '_harness.py')
    fs.writeFileSync(harnessPath, buildHarness({ ...job, root: rootReal }), 'utf8')
    const child = spawn(pythonBin(fs), ['-I', harnessPath], {
      cwd: rootReal,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: '/usr/bin:/bin',
        HOME: rootReal,
        TMPDIR: rootReal,
        TEMP: rootReal,
        TMP: rootReal,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONNOUSERSITE: '1',
        PYTHONIOENCODING: 'utf-8',
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
      },
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
      if (stderr.length > 4000) stderr = stderr.slice(-4000)
    })
    const code = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), RUN_TIMEOUT_MS)
      child.on('error', () => {
        clearTimeout(timer)
        resolve(null)
      })
      child.on('close', (value) => {
        clearTimeout(timer)
        resolve(typeof value === 'number' ? value : null)
      })
    })
    const resultPath = path.join(rootReal, '_result.json')
    if (!fs.existsSync(resultPath)) {
      if (code === null) return emptyResult('Your code took too long and was stopped. Check for an infinite loop.')
      return emptyResult(stderr.trim().slice(-800) || 'Python could not finish the check.')
    }
    return readResult(fs.readFileSync(resultPath, 'utf8'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

type PyodideLike = {
  FS: {
    mkdirTree: (path: string) => void
    readdir: (path: string) => string[]
    rmdir: (path: string) => void
    unlink: (path: string) => void
    writeFile: (path: string, data: string) => void
    readFile: (path: string, opts: { encoding: 'utf8' }) => string
  }
  runPythonAsync: (code: string) => Promise<unknown>
}

let pyodidePromise: Promise<PyodideLike> | null = null

function wipeWorkspace(fs: PyodideLike['FS'], dir: string): void {
  let names: string[] = []
  try {
    names = fs.readdir(dir)
  } catch {
    fs.mkdirTree(dir)
    return
  }
  for (const name of names) {
    if (name === '.' || name === '..') continue
    const child = `${dir}/${name}`
    let isDir = false
    try {
      fs.readdir(child)
      isDir = true
    } catch {
      isDir = false
    }
    if (isDir) {
      wipeWorkspace(fs, child)
      fs.rmdir(child)
    } else {
      fs.unlink(child)
    }
  }
}

async function loadPyodideRuntime(): Promise<PyodideLike> {
  if (!pyodidePromise) {
    pyodidePromise = import('pyodide').then(async (mod) => {
      const runtime = await mod.loadPyodide({ indexURL: PYODIDE_INDEX })
      return runtime as unknown as PyodideLike
    }).catch((error: unknown) => {
      pyodidePromise = null
      throw error
    })
  }
  return pyodidePromise
}

async function runInBrowser(files: CodeFile[], job: Omit<PythonJob, 'root'>): Promise<PythonResult> {
  const py = await loadPyodideRuntime()
  const root = '/workspace'
  py.FS.mkdirTree(root)
  wipeWorkspace(py.FS, root)
  for (const file of files) {
    const full = `${root}/${file.name}`
    py.FS.mkdirTree(full.slice(0, full.lastIndexOf('/')))
    py.FS.writeFile(full, file.text)
  }
  py.FS.writeFile(`${root}/_harness.py`, buildHarness({ ...job, root }))
  await py.runPythonAsync(`
import os, runpy
os.chdir(${JSON.stringify(root)})
runpy.run_path(${JSON.stringify(`${root}/_harness.py`)}, run_name="__pt_harness__")
`)
  return readResult(py.FS.readFile(`${root}/_result.json`, { encoding: 'utf8' }))
}

export async function runPython(files: CodeFile[], job: Omit<PythonJob, 'root'>): Promise<PythonResult> {
  try {
    assertSafeFiles(files)
  } catch (error) {
    return emptyResult(error instanceof Error ? error.message : 'The mission files were refused.')
  }
  try {
    if (runningInNode()) return await runOnNode(files, job)
    return await runInBrowser(files, job)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Python could not start.'
    if (message.includes('time') || message.includes('timed out')) {
      return emptyResult('Your code took too long and was stopped. Check for an infinite loop.')
    }
    return emptyResult(message)
  }
}
