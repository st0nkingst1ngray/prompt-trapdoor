export type VfsBookId = 'osmani' | 'bash' | 'koans' | 'exercism' | 'pyithon'

export type VfsPerm = 'open' | 'locked' | 'root-only'

export type RootPathId = 'escalation' | 'brute' | 'injection'

export interface VfsLaunch {
  book: VfsBookId
  /** Section id or numeric level id as a string. */
  target: string
  pageIndex?: number
}

export interface VfsEntry {
  path: string
  name: string
  kind: 'dir' | 'file'
  hidden: boolean
  perm: VfsPerm
  body?: string
  launch?: VfsLaunch
}

export interface VfsSnapshot {
  entries: Map<string, VfsEntry>
}

export interface VfsFileSpec {
  name: string
  blurb: string
  unlocked: boolean
  launch?: VfsLaunch
}

export interface VfsDirSpec {
  name: string
  hidden?: boolean
  /** Indexed or not-yet-open folders stay locked even with no readable files. */
  locked?: boolean
  files?: VfsFileSpec[]
  dirs?: VfsDirSpec[]
}

/** One registered book. A future PDF book is another layer with its own mount path. */
export interface VfsBookLayer {
  mount: string
  title: string
  secret: string
  dirs: VfsDirSpec[]
}

export interface AccessState {
  isRoot: boolean
  earlyUnlock: string[]
}

export interface LessonCard {
  id: RootPathId
  title: string
  body: string
}

export interface ShellState extends AccessState {
  cwd: string
  rootVia: RootPathId[]
  bruteFails: number
  bruteLockout: number
  pending: 'su' | null
}

export interface ShellResult {
  output: string
  state: ShellState
  clear?: boolean
  lesson?: LessonCard
  launch?: VfsLaunch
}
