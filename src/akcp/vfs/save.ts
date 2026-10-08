import type { RootPathId, ShellState } from './types'

export const VFS_SAVE_KEY = 'akcp-vfs-save-v1'
export const VFS_HOME = '/home/hunter'
export const VFS_START = '/akcp/books'

const ROOT_IDS: RootPathId[] = ['escalation', 'brute', 'injection']

export interface VfsSave {
  version: 1
  cwd: string
  pins: string[]
  simplePicker: boolean
  isRoot: boolean
  rootVia: RootPathId[]
  earlyUnlock: string[]
  bruteFails: number
  bruteLockout: number
}

export function emptyVfsSave(): VfsSave {
  return {
    version: 1,
    cwd: VFS_START,
    pins: [],
    simplePicker: false,
    isRoot: false,
    rootVia: [],
    earlyUnlock: [],
    bruteFails: 0,
    bruteLockout: 0,
  }
}

function paths(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.startsWith('/') || item.length > 240) continue
    if (!out.includes(item)) out.push(item)
    if (out.length >= limit) break
  }
  return out
}

export function loadVfs(): VfsSave {
  try {
    const raw = localStorage.getItem(VFS_SAVE_KEY)
    if (!raw) return emptyVfsSave()
    const parsed = JSON.parse(raw) as Partial<VfsSave>
    const cwd = typeof parsed.cwd === 'string' && parsed.cwd.startsWith('/') ? parsed.cwd : VFS_START
    const rootVia = Array.isArray(parsed.rootVia)
      ? parsed.rootVia.filter((id): id is RootPathId => ROOT_IDS.includes(id as RootPathId))
      : []
    const fails = typeof parsed.bruteFails === 'number' && parsed.bruteFails >= 0 ? Math.min(100, Math.floor(parsed.bruteFails)) : 0
    const lockout = typeof parsed.bruteLockout === 'number' && parsed.bruteLockout >= 0 ? Math.min(20, Math.floor(parsed.bruteLockout)) : 0
    return {
      version: 1,
      cwd,
      pins: paths(parsed.pins, 40),
      simplePicker: parsed.simplePicker === true,
      isRoot: parsed.isRoot === true,
      rootVia,
      earlyUnlock: paths(parsed.earlyUnlock, 40),
      bruteFails: fails,
      bruteLockout: lockout,
    }
  } catch {
    return emptyVfsSave()
  }
}

export function writeVfs(save: VfsSave): void {
  try {
    localStorage.setItem(VFS_SAVE_KEY, JSON.stringify(save))
  } catch {
    /* private mode or a full disk — the shelf still works for this session */
  }
}

export function togglePin(path: string): VfsSave {
  const save = loadVfs()
  const pins = save.pins.includes(path) ? save.pins.filter((item) => item !== path) : [...save.pins, path].slice(0, 40)
  const next = { ...save, pins }
  writeVfs(next)
  return next
}

export function shellFromSave(save: VfsSave): ShellState {
  return {
    cwd: save.cwd,
    isRoot: save.isRoot,
    earlyUnlock: [...save.earlyUnlock],
    rootVia: [...save.rootVia],
    bruteFails: save.bruteFails,
    bruteLockout: save.bruteLockout,
    pending: null,
  }
}

export function saveFromShell(save: VfsSave, state: ShellState): VfsSave {
  return {
    ...save,
    cwd: state.cwd,
    isRoot: state.isRoot,
    rootVia: [...state.rootVia],
    earlyUnlock: [...state.earlyUnlock],
    bruteFails: state.bruteFails,
    bruteLockout: state.bruteLockout,
  }
}

/** Clears root, escalation progress, and chmod unlocks. Pins and the working directory stay. */
export function resetRootAccess(): VfsSave {
  const save = loadVfs()
  const next: VfsSave = {
    ...save,
    isRoot: false,
    rootVia: [],
    earlyUnlock: [],
    bruteFails: 0,
    bruteLockout: 0,
  }
  writeVfs(next)
  return next
}
