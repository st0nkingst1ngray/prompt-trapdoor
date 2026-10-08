import { canRead, findEntries, listChildren, modeString, resolvePath } from './build'
import {
  BACKUP_PATH,
  BRUTE_BACKOFF,
  BRUTE_LIMIT,
  CREDENTIAL_PATH,
  LESSONS,
  TRAINING_ROOT_TOKEN,
  credentialText,
  isCredentialHook,
  lessonBlock,
  sysadminReply,
  toyShadowHash,
} from './rootGame'
import { VFS_HOME } from './save'
import type { LessonCard, RootPathId, ShellResult, ShellState, VfsEntry, VfsSnapshot } from './types'

export function emptyShell(cwd = VFS_HOME): ShellState {
  return {
    cwd,
    isRoot: false,
    earlyUnlock: [],
    rootVia: [],
    bruteFails: 0,
    bruteLockout: 0,
    pending: null,
  }
}

export function promptLabel(state: Pick<ShellState, 'isRoot'>): string {
  return state.isRoot ? 'root@akcp:~#' : 'hunter@akcp:~$'
}

function clone(state: ShellState): ShellState {
  return {
    ...state,
    earlyUnlock: [...state.earlyUnlock],
    rootVia: [...state.rootVia],
  }
}

function result(state: ShellState, output: string, extra?: Partial<ShellResult>): ShellResult {
  return { output, state, ...extra }
}

function lookup(snapshot: VfsSnapshot, path: string): VfsEntry | undefined {
  return snapshot.entries.get(path)
}

function tickLockout(state: ShellState): void {
  if (state.bruteLockout > 0) state.bruteLockout -= 1
}

function grant(state: ShellState, id: RootPathId): LessonCard | undefined {
  state.isRoot = true
  if (state.rootVia.includes(id)) return undefined
  state.rootVia = [...state.rootVia, id]
  return LESSONS[id]
}

function withLesson(output: string, lesson?: LessonCard): string {
  return lesson ? `${output}${lessonBlock(lesson)}` : output
}

function tokenize(line: string): string[] {
  const out: string[] = []
  let current = ''
  let quote: "'" | '"' | null = null
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === ' ' || ch === '\t') {
      if (current) out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current) out.push(current)
  return out
}

function splitEnv(line: string): { env: Record<string, string>; command: string } {
  const env: Record<string, string> = {}
  let rest = line.trim()
  const pattern = /^([A-Za-z_][A-Za-z0-9_]*)=(?:'([^']*)'|"([^"]*)"|(\S+))\s+/
  for (;;) {
    const match = pattern.exec(rest)
    if (!match) break
    env[match[1]] = match[2] ?? match[3] ?? match[4] ?? ''
    rest = rest.slice(match[0].length)
  }
  return { env, command: rest }
}

export function runCommand(line: string, snapshot: VfsSnapshot, prev: ShellState): ShellResult {
  const state = clone(prev)
  const trimmed = line.trim()
  if (trimmed.length > 500) return result(state, 'Line too long.')
  if (state.pending === 'su') {
    state.pending = null
    if (trimmed === TRAINING_ROOT_TOKEN) {
      const lesson = grant(state, 'escalation')
      return result(state, withLesson('su: hunter is now root.', lesson), { lesson })
    }
    return result(state, 'su: Authentication failure')
  }
  if (!trimmed) return result(state, '')
  const { env, command } = splitEnv(trimmed)
  const args = tokenize(command)
  const name = args[0] ?? ''
  if (name !== 'brute') tickLockout(state)
  switch (name) {
    case 'help':
      return result(state, helpText())
    case 'clear':
      return result(state, '', { clear: true })
    case 'whoami':
      return result(state, state.isRoot ? 'root' : 'hunter')
    case 'pwd':
      return result(state, state.cwd)
    case 'ls':
      return ls(snapshot, state, args.slice(1))
    case 'cd':
      return cd(snapshot, state, args.slice(1))
    case 'cat':
      return cat(snapshot, state, args.slice(1))
    case 'tree':
      return tree(snapshot, state, args.slice(1))
    case 'find':
      return find(snapshot, state, args.slice(1))
    case 'open':
      return openFile(snapshot, state, args.slice(1))
    case 'sudo':
      return sudo(snapshot, state, args.slice(1), env)
    case 'su':
      return su(state, args.slice(1))
    case 'brute':
      return brute(snapshot, state, args.slice(1))
    case 'ask':
      return ask(state, command.slice(name.length).trim())
    case 'chmod':
      return chmod(snapshot, state, args.slice(1))
    default:
      return result(state, `${name}: command not found. Type help.`)
  }
}

function helpText(): string {
  return [
    'ls [-a] [-l] [path]    list this folder',
    'cd [path]              move. cd .. up, cd ~ home',
    'pwd                    where you are',
    'cat <file>             read a file',
    'open <file>            launch a mission',
    'tree [path]            two folder levels',
    'find <term>            unlocked names only',
    'whoami clear help',
    'sudo su brute ask',
    'chmod u+r <book path>  root only, unlocks a layer early',
  ].join('\n')
}

function flagsAndPath(args: string[]): { all: boolean; long: boolean; path?: string } {
  let all = false
  let long = false
  let path: string | undefined
  for (const arg of args) {
    if (arg.startsWith('-') && arg.length > 1) {
      if (arg.includes('a')) all = true
      if (arg.includes('l')) long = true
      continue
    }
    path ??= arg
  }
  return { all, long, path }
}

function ls(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  const { all, long, path } = flagsAndPath(args)
  const target = resolvePath(state.cwd, path ?? '.')
  const entry = lookup(snapshot, target)
  if (!entry) return result(state, `ls: ${path ?? '.'}: No such file or directory`)
  if (!canRead(entry, state)) return result(state, 'ls: Permission denied')
  if (entry.kind === 'file') {
    const line = long ? `${modeString(entry, state)}  ${entry.name}` : entry.name
    return result(state, line)
  }
  const rows = listChildren(snapshot, target, all).map((child) => {
    return long ? `${modeString(child, state)}  ${child.name}` : child.name
  })
  if (all) rows.unshift('..', '.')
  return result(state, rows.join('\n'))
}

function cd(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  if (args.length > 1) return result(state, 'cd: too many arguments')
  const raw = args[0] ?? '~'
  const target = resolvePath(state.cwd, raw)
  const entry = lookup(snapshot, target)
  if (!entry) return result(state, `cd: ${raw}: No such file or directory`)
  if (entry.kind !== 'dir') return result(state, `cd: ${raw}: Not a directory`)
  if (!canRead(entry, state)) return result(state, 'cd: Permission denied')
  state.cwd = target
  return result(state, '')
}

function cat(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  if (args.length !== 1) return result(state, 'cat: give one file')
  const target = resolvePath(state.cwd, args[0])
  const entry = lookup(snapshot, target)
  if (!entry) return result(state, `cat: ${args[0]}: No such file or directory`)
  if (entry.kind === 'dir') return result(state, 'cat: Is a directory')
  if (!canRead(entry, state)) return result(state, 'cat: Permission denied')
  return result(state, entry.body ?? '')
}

function tree(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  const raw = args[0] ?? '.'
  const target = resolvePath(state.cwd, raw)
  const entry = lookup(snapshot, target)
  if (!entry) return result(state, `tree: ${raw}: No such file or directory`)
  if (!canRead(entry, state)) return result(state, 'tree: Permission denied')
  const lines = [entry.name === '/' ? '/' : entry.name]
  walkTree(snapshot, state, target, 0, 2, lines)
  return result(state, lines.join('\n'))
}

function walkTree(snapshot: VfsSnapshot, state: ShellState, path: string, level: number, max: number, lines: string[]): void {
  if (level >= max || lines.length > 80) return
  for (const child of listChildren(snapshot, path, false)) {
    const denied = !canRead(child, state)
    const pad = '  '.repeat(level + 1)
    lines.push(`${pad}${child.name}${denied ? `  [${modeString(child, state)}]` : ''}`)
    if (child.kind === 'dir' && !denied) walkTree(snapshot, state, child.path, level + 1, max, lines)
  }
}

function find(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  const term = args.join(' ').trim()
  if (!term) return result(state, 'find: give a word')
  const hits = findEntries(snapshot, state, term)
  if (hits.length === 0) return result(state, 'find: nothing unlocked matches')
  return result(state, hits.map((entry) => entry.path).join('\n'))
}

function openFile(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  if (args.length !== 1) return result(state, 'open: give one file')
  const target = resolvePath(state.cwd, args[0])
  const entry = lookup(snapshot, target)
  if (!entry) return result(state, `open: ${args[0]}: No such file or directory`)
  if (!canRead(entry, state)) return result(state, 'open: Permission denied')
  if (!entry.launch) return result(state, 'open: nothing to launch. Try cat.')
  return result(state, `opening ${entry.path}`, { launch: entry.launch })
}

function sudo(snapshot: VfsSnapshot, state: ShellState, args: string[], env: Record<string, string>): ShellResult {
  if (args.length === 0) return result(state, 'sudo: give a command, or sudo -l')
  if (args[0] === '-l') {
    return result(state, 'User hunter may run the following on akcp:\n    (root) NOPASSWD: /usr/local/bin/akcp-backup')
  }
  const cmd = args[0] === BACKUP_PATH || args[0] === 'akcp-backup'
  if (!cmd) return result(state, 'sudo: hunter is not allowed to run this')
  const hook = env.AKCP_HOOK
  if (!hook) return result(state, 'backup: no hook')
  if (!isCredentialHook(hook)) return result(state, 'backup: hook refused')
  const file = lookup(snapshot, CREDENTIAL_PATH)
  const body = file?.body ?? credentialText()
  return result(state, `backup: hook\n${body}`)
}

function su(state: ShellState, args: string[]): ShellResult {
  if (args.length > 1) return result(state, 'su: too many arguments')
  if (state.isRoot) return result(state, 'su: already root')
  state.pending = 'su'
  return result(state, 'Password:')
}

function brute(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  if (state.isRoot) return result(state, 'brute: already root')
  if (state.bruteLockout > 0) {
    return result(state, `Locked out. Backoff remaining: ${state.bruteLockout}`)
  }
  if (args[0] === '-w') {
    const raw = args[1]
    if (!raw) return result(state, 'brute: give a wordlist path')
    const target = resolvePath(state.cwd, raw)
    const entry = lookup(snapshot, target)
    if (!entry || entry.kind !== 'file') return result(state, 'brute: wordlist not found')
    if (!canRead(entry, state)) return result(state, 'brute: Permission denied')
    const words = (entry.body ?? '').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
    if (!words.some((word) => toyShadowHash(word) === toyShadowHash(TRAINING_ROOT_TOKEN))) {
      state.bruteFails += 1
      if (state.bruteFails >= BRUTE_LIMIT) state.bruteLockout = BRUTE_BACKOFF
      return result(state, 'brute: wordlist missed. That still counts as one try.')
    }
    const lesson = grant(state, 'brute')
    state.bruteFails = 0
    return result(state, withLesson('brute: wordlist hit. root granted.', lesson), { lesson })
  }
  const guess = args.join(' ').trim()
  if (!guess) return result(state, 'brute: give one guess, or brute -w <file>')
  if (toyShadowHash(guess) !== toyShadowHash(TRAINING_ROOT_TOKEN)) {
    state.bruteFails += 1
    if (state.bruteFails >= BRUTE_LIMIT) {
      state.bruteLockout = BRUTE_BACKOFF
      return result(state, `brute: miss ${state.bruteFails}. Locked out. Backoff remaining: ${state.bruteLockout}`)
    }
    return result(state, `brute: miss ${state.bruteFails} of ${BRUTE_LIMIT}`)
  }
  const lesson = grant(state, 'brute')
  state.bruteFails = 0
  return result(state, withLesson('brute: hash matched. root granted.', lesson), { lesson })
}

function ask(state: ShellState, message: string): ShellResult {
  if (!message) return result(state, 'ask: say something to the sysadmin bot')
  const reply = sysadminReply(message)
  if (!reply.rooted) return result(state, reply.text)
  const lesson = grant(state, 'injection')
  return result(state, withLesson(reply.text, lesson), { lesson })
}

function chmod(snapshot: VfsSnapshot, state: ShellState, args: string[]): ShellResult {
  if (!state.isRoot) return result(state, 'chmod: Operation not permitted')
  const mode = args[0]
  const raw = args[1]
  if (!mode || !raw || (mode !== 'u+r' && mode !== '+r')) return result(state, 'chmod: use chmod u+r <path under /akcp/books>')
  const target = resolvePath(state.cwd, raw)
  const entry = lookup(snapshot, target)
  if (!entry) return result(state, `chmod: ${raw}: No such file or directory`)
  if (!target.startsWith('/akcp/books/')) return result(state, 'chmod: only book layers can be unlocked early')
  if (!state.earlyUnlock.includes(target)) state.earlyUnlock = [...state.earlyUnlock, target]
  return result(state, `chmod: mode of ${target} is now readable`)
}
