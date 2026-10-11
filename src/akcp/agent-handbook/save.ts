import { HANDBOOK_STEPS } from './steps'

export const AGENT_HANDBOOK_SAVE_KEY = 'agent-handbook-save-v1'

const STEP_IDS = HANDBOOK_STEPS.map((step) => step.id)

export interface AgentHandbookSave {
  version: 1
  cleared: string[]
  fails: Record<string, number>
}

export function emptyAgentHandbookSave(): AgentHandbookSave {
  return { version: 1, cleared: [], fails: {} }
}

function clone(save: AgentHandbookSave): AgentHandbookSave {
  return { version: 1, cleared: [...save.cleared], fails: { ...save.fails } }
}

export function loadAgentHandbook(): AgentHandbookSave {
  try {
    const raw = localStorage.getItem(AGENT_HANDBOOK_SAVE_KEY)
    if (!raw) return emptyAgentHandbookSave()
    const parsed = JSON.parse(raw) as Partial<AgentHandbookSave>
    const known = new Set(STEP_IDS)
    const cleared = Array.isArray(parsed.cleared)
      ? parsed.cleared.filter((id): id is string => typeof id === 'string' && known.has(id))
      : []
    const fails: Record<string, number> = {}
    if (parsed.fails && typeof parsed.fails === 'object') {
      for (const [id, n] of Object.entries(parsed.fails)) {
        if (known.has(id) && typeof n === 'number' && n >= 0) fails[id] = Math.floor(n)
      }
    }
    return { version: 1, cleared, fails }
  } catch {
    return emptyAgentHandbookSave()
  }
}

export function writeAgentHandbook(save: AgentHandbookSave): void {
  try {
    localStorage.setItem(AGENT_HANDBOOK_SAVE_KEY, JSON.stringify(save))
  } catch {
    /* private mode or a full disk — the session still plays */
  }
}

export function clearAgentHandbookSave(): void {
  try {
    localStorage.removeItem(AGENT_HANDBOOK_SAVE_KEY)
  } catch {
    /* ignore */
  }
}

export function stepUnlocked(save: AgentHandbookSave, index: number): boolean {
  if (index <= 0) return true
  return save.cleared.includes(previousId(index))
}

function previousId(index: number): string {
  return STEP_IDS[index - 1] ?? STEP_IDS[0]
}

export function awardStep(save: AgentHandbookSave, id: string): AgentHandbookSave {
  const next = clone(save)
  if (!next.cleared.includes(id)) next.cleared.push(id)
  return next
}

export function recordHandbookFail(save: AgentHandbookSave, id: string): AgentHandbookSave {
  const next = clone(save)
  next.fails[id] = (next.fails[id] ?? 0) + 1
  return next
}
