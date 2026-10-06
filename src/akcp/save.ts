import type { AkcpStatId } from './types'

export const AKCP_SAVE_KEY = 'akcp-save-v1'

const STAT_IDS: AkcpStatId[] = [
  'planning',
  'context',
  'verification',
  'versionControl',
  'testing',
  'adaptation',
]

export interface AkcpSave {
  version: 1
  pagesRead: string[]
  clearedQuestIds: string[]
  clearedBossIds: string[]
  stats: Record<AkcpStatId, number>
  fails: Record<string, number>
  penaltyPendingId: string | null
  penaltySeen: Record<string, boolean>
  protocolComplete: boolean
}

export function emptyAkcpSave(): AkcpSave {
  return {
    version: 1,
    pagesRead: [],
    clearedQuestIds: [],
    clearedBossIds: [],
    stats: {
      planning: 0,
      context: 0,
      verification: 0,
      versionControl: 0,
      testing: 0,
      adaptation: 0,
    },
    fails: {},
    penaltyPendingId: null,
    penaltySeen: {},
    protocolComplete: false,
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function clone(save: AkcpSave): AkcpSave {
  return {
    version: 1,
    pagesRead: [...save.pagesRead],
    clearedQuestIds: [...save.clearedQuestIds],
    clearedBossIds: [...save.clearedBossIds],
    stats: { ...save.stats },
    fails: { ...save.fails },
    penaltyPendingId: save.penaltyPendingId,
    penaltySeen: { ...save.penaltySeen },
    protocolComplete: save.protocolComplete === true,
  }
}

export function loadAkcp(): AkcpSave {
  try {
    const raw = localStorage.getItem(AKCP_SAVE_KEY)
    if (!raw) return emptyAkcpSave()
    const parsed = JSON.parse(raw) as Partial<AkcpSave>
    const base = emptyAkcpSave()
    const stats = { ...base.stats }
    const rawStats = parsed.stats
    if (rawStats && typeof rawStats === 'object') {
      for (const id of STAT_IDS) {
        const n = rawStats[id]
        if (typeof n === 'number' && n >= 0) stats[id] = n
      }
    }
    const fails: Record<string, number> = {}
    if (parsed.fails && typeof parsed.fails === 'object') {
      for (const [id, n] of Object.entries(parsed.fails)) {
        if (typeof n === 'number' && n >= 0) fails[id] = n
      }
    }
    const penaltySeen: Record<string, boolean> = {}
    if (parsed.penaltySeen && typeof parsed.penaltySeen === 'object') {
      for (const [id, seen] of Object.entries(parsed.penaltySeen)) {
        if (seen === true) penaltySeen[id] = true
      }
    }
    return {
      version: 1,
      pagesRead: strings(parsed.pagesRead),
      clearedQuestIds: strings(parsed.clearedQuestIds),
      clearedBossIds: strings(parsed.clearedBossIds),
      stats,
      fails,
      penaltyPendingId: typeof parsed.penaltyPendingId === 'string' ? parsed.penaltyPendingId : null,
      penaltySeen,
      protocolComplete: parsed.protocolComplete === true,
    }
  } catch {
    return emptyAkcpSave()
  }
}

export function writeAkcp(save: AkcpSave): void {
  try {
    localStorage.setItem(AKCP_SAVE_KEY, JSON.stringify(save))
  } catch {
    /* private mode or a full disk — the session still plays */
  }
}

export function clearAkcpSave(): void {
  try {
    localStorage.removeItem(AKCP_SAVE_KEY)
  } catch {
    /* ignore */
  }
}

/** Returns the next save and pointsGained (0 or 1). */
export function awardActivity(
  save: AkcpSave,
  id: string,
  stat: AkcpStatId,
  kind: 'quest' | 'boss',
): { save: AkcpSave; pointsGained: number } {
  const next = clone(save)
  const list = kind === 'quest' ? next.clearedQuestIds : next.clearedBossIds
  if (list.includes(id)) return { save: next, pointsGained: 0 }
  list.push(id)
  next.stats[stat] += 1
  return { save: next, pointsGained: 1 }
}

export function recordFail(save: AkcpSave, id: string): AkcpSave {
  const next = clone(save)
  const count = (next.fails[id] ?? 0) + 1
  next.fails[id] = count
  if (count === 2 && next.penaltySeen[id] !== true) next.penaltyPendingId = id
  return next
}

export function acknowledgePenalty(save: AkcpSave, id: string): AkcpSave {
  const next = clone(save)
  if (next.penaltyPendingId === id) next.penaltyPendingId = null
  next.penaltySeen[id] = true
  return next
}
