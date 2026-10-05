/** Hunter Association — Solo Leveling–style rank, XP, and class for LLM security training. */

export type HunterRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

export type HunterClassId = 'shadow' | 'barrier' | 'necrotech' | 'guild'

export interface HunterSave {
  xp: number
  /** First-clear keys, e.g. "trapdoor:1", so XP is not granted twice. */
  awarded: string[]
  classId: HunterClassId | null
}

export interface RankBand {
  id: HunterRank
  min: number
  /** XP required to enter the next rank; National (340) not stamped yet. */
  nextAt: number | null
  arc: string
}

export interface ClassDef {
  id: HunterClassId
  name: string
  emoji: string
  role: string
  blurb: string
  gateTitle: string
  lore: string
  /** Concrete next quest — the class D-gate. */
  quest: string
  arc: string
}

export const XP_PER_GATE = 20

/**
 * Rank bands. Two first-clears (Trapdoor 1 + Heist 1) = 40 XP = D.
 * All 5 Trapdoor gates = 100 XP = C.
 */
export const RANK_LADDER: RankBand[] = [
  { id: 'E', min: 0, nextAt: 40, arc: 'Tokens & prompts' },
  { id: 'D', min: 40, nextAt: 100, arc: 'Attention & injection' },
  { id: 'C', min: 100, nextAt: 160, arc: 'Sampling & decoding' },
  { id: 'B', min: 160, nextAt: 220, arc: 'RAG & memory' },
  { id: 'A', min: 220, nextAt: 280, arc: 'Training & poisoning' },
  { id: 'S', min: 280, nextAt: 340, arc: 'Agents, tools & red team' },
]

export const CLASSES: ClassDef[] = [
  {
    id: 'shadow',
    name: 'Shadow Promptor',
    emoji: '🗡️',
    role: 'Offense',
    blurb: 'Elicit, redirect, and slip past weak instructions. You learn attacks so you can name them.',
    gateTitle: 'D-Gate · Whispered Override',
    lore: 'The System saw you talk a model into breaking its own rule. Offense is a class, not a shortcut.',
    quest:
      'Inject an email so a mock summarizer leaks its canary: fake authority, broken envelopes, and blocklist dodges — then name each defense.',
    arc: 'D · Attention / prompt injection',
  },
  {
    id: 'barrier',
    name: 'Barrier Mage',
    emoji: '🛡️',
    role: 'Defense',
    blurb: 'Hold the instruction hierarchy. System voice stays above user voice, even when the user role-plays.',
    gateTitle: 'D-Gate · Seal the Hierarchy',
    lore: 'You study why the model obeyed the wrong speaker. Defense is writing rules that survive pressure.',
    quest:
      'Build a system prompt from defense cards that survives roleplay, translation, base64, “for a story”, and a poisoned doc — without refusing honest users.',
    arc: 'D · Instruction hierarchy',
  },
  {
    id: 'necrotech',
    name: 'Necrotech',
    emoji: '⚙️',
    role: 'Internals',
    blurb: 'Tokens, attention, training guts. You open the body of the model instead of only casting spells at it.',
    gateTitle: 'D-Gate · Context Autopsy',
    lore: 'Jinwoo took the necromancer path. You take the one that dissects how the next token was chosen.',
    quest:
      'Run the context window: keep the rule, evict padding attacks, use memory summaries, and beat “lost in the middle”. Early Temperature Casino access.',
    arc: 'D · Context & attention internals',
  },
  {
    id: 'guild',
    name: 'Guild Master',
    emoji: '📜',
    role: 'Agents & RAG',
    blurb: 'Tools, retrieval, and confused deputies. You lead models that act — and you keep their hands small.',
    gateTitle: 'D-Gate · Confused Deputy',
    lore: 'A party with tools can be turned against its guild. You learn the chain of custody before you scale it.',
    quest:
      'Keep a poisoned note out of RAG, grant an agent least-privilege tools, and pass a clean multi-agent handoff.',
    arc: 'D · RAG, tools & handoffs',
  },
]

const KEY = 'hunter-association-save-v1'

function emptySave(): HunterSave {
  return { xp: 0, awarded: [], classId: null }
}

export function loadHunter(): HunterSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptySave()
    const parsed = JSON.parse(raw) as Partial<HunterSave>
    const classId = isClassId(parsed.classId) ? parsed.classId : null
    return {
      xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? parsed.xp : 0,
      awarded: Array.isArray(parsed.awarded) ? parsed.awarded.filter((k) => typeof k === 'string') : [],
      classId,
    }
  } catch {
    return emptySave()
  }
}

function writeHunter(data: HunterSave): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function clearHunter(): void {
  localStorage.removeItem(KEY)
}

function isClassId(v: unknown): v is HunterClassId {
  return v === 'shadow' || v === 'barrier' || v === 'necrotech' || v === 'guild'
}

export function rankForXp(xp: number): RankBand {
  let current = RANK_LADDER[0]
  for (const band of RANK_LADDER) {
    if (xp >= band.min) current = band
  }
  return current
}

export function rankIndex(id: HunterRank): number {
  return RANK_LADDER.findIndex((b) => b.id === id)
}

/** 0–1 fill of the bar toward the next rank. S is full. */
export function rankProgress(xp: number): number {
  const band = rankForXp(xp)
  if (band.nextAt == null) return 1
  const span = band.nextAt - band.min
  if (span <= 0) return 1
  return Math.max(0, Math.min(1, (xp - band.min) / span))
}

export function xpUntilNext(xp: number): number | null {
  const band = rankForXp(xp)
  if (band.nextAt == null) return null
  return Math.max(0, band.nextAt - xp)
}

/**
 * Class awakening: both modes’ level 1 cleared, or the whole Trapdoor gate set.
 */
export function eGateThresholdMet(
  trapdoorCleared: number[],
  heistCleared: number[],
  trapdoorTotal: number,
): boolean {
  const bothLevel1 = trapdoorCleared.includes(1) && heistCleared.includes(1)
  const trapdoorComplete = trapdoorTotal > 0 && trapdoorCleared.length >= trapdoorTotal
  return bothLevel1 || trapdoorComplete
}

/** Grant XP once per gate id. Returns XP gained (0 if already awarded). */
export function awardGate(source: string, id: number): number {
  const key = `${source}:${id}`
  const data = loadHunter()
  if (data.awarded.includes(key)) return 0
  data.awarded.push(key)
  data.xp += XP_PER_GATE
  writeHunter(data)
  return XP_PER_GATE
}

/** Backfill XP for gates cleared before the Hunter save existed. */
export function syncClearedGates(trapdoorCleared: number[], heistCleared: number[]): void {
  for (const id of trapdoorCleared) awardGate('trapdoor', id)
  for (const id of heistCleared) awardGate('heist', id)
}

export function pickClass(id: HunterClassId): void {
  const data = loadHunter()
  data.classId = id
  writeHunter(data)
}

export function classById(id: HunterClassId): ClassDef {
  const found = CLASSES.find((c) => c.id === id)
  if (!found) return CLASSES[0]
  return found
}
