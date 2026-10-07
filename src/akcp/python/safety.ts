import type { CodeFile } from './types'

/** Relative mission paths only. Rejects absolute paths and `..`. */
export function isSafeRelPath(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0 || name.length > 240) return false
  if (name.startsWith('/') || name.includes('\\') || name.includes('\0')) return false
  return name.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')
}

export function assertSafeFiles(files: CodeFile[]): void {
  const seen = new Set<string>()
  for (const file of files) {
    if (!isSafeRelPath(file.name)) throw new Error(`Unsafe mission path: ${file.name}`)
    if (file.name === '_harness.py' || file.name === '_result.json') throw new Error(`Reserved mission path: ${file.name}`)
    if (typeof file.text !== 'string') throw new Error(`Mission file ${file.name} is not text`)
    if (file.text.length > 2_000_000) throw new Error(`Mission file ${file.name} is too large`)
    if (seen.has(file.name)) throw new Error(`Duplicate mission path: ${file.name}`)
    seen.add(file.name)
  }
}

export function missionFiles(
  shared: CodeFile[],
  levelFiles: CodeFile[],
  editPath: string,
  source: string,
): CodeFile[] {
  if (!isSafeRelPath(editPath)) throw new Error(`Unsafe edit path: ${editPath}`)
  if (source.length > 200_000) throw new Error('Your code is too large to check')
  const map = new Map<string, string>()
  for (const file of shared) map.set(file.name, file.text)
  for (const file of levelFiles) map.set(file.name, file.text)
  map.set(editPath, source)
  const files = [...map.entries()].map(([name, text]) => ({ name, text }))
  assertSafeFiles(files)
  return files
}
