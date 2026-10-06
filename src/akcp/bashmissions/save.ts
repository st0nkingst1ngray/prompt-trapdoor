export const BASH_MISSIONS_SAVE_KEY = 'bash-missions-save-v1'

export interface BashMissionsSave {
  version: 1
  cleared: number[]
  xp: number
  fails: Record<string, number>
  hints: Record<string, number>
  drafts: Record<string, string>
  certifiedOn: Record<string, string>
  playerName: string
}

export interface AwardInput {
  levelId: number
  xp: number
  moduleId: number
  moduleLevelIds: number[]
  today: string
}

export interface AwardResult {
  save: BashMissionsSave
  xpGained: number
  certificate: boolean
}

export function emptyBashMissionsSave(): BashMissionsSave {
  return {
    version: 1,
    cleared: [],
    xp: 0,
    fails: {},
    hints: {},
    drafts: {},
    certifiedOn: {},
    playerName: 'Hunter',
  }
}

function clone(save: BashMissionsSave): BashMissionsSave {
  return {
    version: 1,
    cleared: [...save.cleared],
    xp: save.xp,
    fails: { ...save.fails },
    hints: { ...save.hints },
    drafts: { ...save.drafts },
    certifiedOn: { ...save.certifiedOn },
    playerName: save.playerName,
  }
}

function numberMap(value: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, n] of Object.entries(value)) {
    if (typeof n === 'number' && n >= 0 && n <= max) out[key] = Math.floor(n)
  }
  return out
}

function stringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, text] of Object.entries(value)) {
    if (typeof text === 'string' && text.length <= 100_000) out[key] = text
  }
  return out
}

export function loadBashMissions(): BashMissionsSave {
  try {
    const raw = localStorage.getItem(BASH_MISSIONS_SAVE_KEY)
    if (!raw) return emptyBashMissionsSave()
    const parsed = JSON.parse(raw) as Partial<BashMissionsSave>
    const cleared = Array.isArray(parsed.cleared)
      ? [...new Set(parsed.cleared.filter((id): id is number => typeof id === 'number' && id >= 1 && id <= 500))].sort((a, b) => a - b)
      : []
    const name = typeof parsed.playerName === 'string' && parsed.playerName.trim() ? parsed.playerName.trim().slice(0, 40) : 'Hunter'
    return {
      version: 1,
      cleared,
      xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? Math.floor(parsed.xp) : 0,
      fails: numberMap(parsed.fails, 1_000_000),
      hints: numberMap(parsed.hints, 5),
      drafts: stringMap(parsed.drafts),
      certifiedOn: stringMap(parsed.certifiedOn),
      playerName: name,
    }
  } catch {
    return emptyBashMissionsSave()
  }
}

export function writeBashMissions(save: BashMissionsSave): void {
  try {
    localStorage.setItem(BASH_MISSIONS_SAVE_KEY, JSON.stringify(save))
  } catch {
    /* private mode or a full disk — the session still plays */
  }
}

export function clearBashMissionsSave(): void {
  try {
    localStorage.removeItem(BASH_MISSIONS_SAVE_KEY)
  } catch {
    /* ignore */
  }
}

export function levelUnlocked(save: BashMissionsSave, levelId: number): boolean {
  if (levelId === 1) return true
  return save.cleared.includes(levelId - 1)
}

export function resumeLevelId(save: BashMissionsSave, levelCount = 500): number {
  for (let id = 1; id <= levelCount; id += 1) {
    if (!save.cleared.includes(id)) return id
  }
  return levelCount
}

export function awardLevel(save: BashMissionsSave, input: AwardInput): AwardResult {
  const next = clone(save)
  if (next.cleared.includes(input.levelId)) return { save: next, xpGained: 0, certificate: false }
  next.cleared = [...next.cleared, input.levelId].sort((a, b) => a - b)
  const gained = input.xp > 0 ? Math.floor(input.xp) : 0
  next.xp += gained
  const done = input.moduleLevelIds.every((id) => next.cleared.includes(id))
  const key = String(input.moduleId)
  const certificate = done && next.certifiedOn[key] == null
  if (certificate) next.certifiedOn[key] = input.today
  return { save: next, xpGained: gained, certificate }
}

export function recordBashFail(save: BashMissionsSave, levelId: number): BashMissionsSave {
  const next = clone(save)
  const key = String(levelId)
  next.fails[key] = (next.fails[key] ?? 0) + 1
  return next
}

export function revealHint(save: BashMissionsSave, levelId: number): BashMissionsSave {
  const next = clone(save)
  const key = String(levelId)
  next.hints[key] = Math.min(5, (next.hints[key] ?? 0) + 1)
  return next
}

export function hintStage(save: BashMissionsSave, levelId: number): number {
  return save.hints[String(levelId)] ?? 0
}

export function setDraft(save: BashMissionsSave, levelId: number, script: string): BashMissionsSave {
  const next = clone(save)
  next.drafts[String(levelId)] = script.slice(0, 100_000)
  return next
}

export function setPlayerName(save: BashMissionsSave, name: string): BashMissionsSave {
  const next = clone(save)
  const trimmed = name.trim().slice(0, 40)
  next.playerName = trimmed || 'Hunter'
  return next
}

export function certificateText(moduleName: string, playerName: string, completedDate: string): string {
  return (
    '########################################\n' +
    '#        BASHMISSIONS CERTIFICATE      #\n' +
    '########################################\n' +
    `Player: ${playerName}\n` +
    `Module: ${moduleName}\n` +
    `Completed: ${completedDate}\n`
  )
}
