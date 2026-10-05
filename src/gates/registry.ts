/** Rank-D class gates, Rank-C/B/A/S doors + Temperature Casino: registry, save, and unlock rules. */
import { awardGate, rankForXp, rankIndex, type HunterClassId, type HunterSave } from '../hunter'
import { BARRIER_GATE } from './barrier'
import { CASINO_GATE } from './casino'
import { CLAP_GATE } from './clap'
import { CROUPIER_GATE } from './croupier'
import { FORGOT_GATE } from './forgot'
import { GUILD_GATE } from './guild'
import { KEYRING_GATE } from './keyring'
import { MARGIN_GATE } from './margin'
import { MIRROR_GATE } from './mirror'
import { NEAR_GATE } from './near'
import { NECROTECH_GATE } from './necrotech'
import { PAIR_GATE } from './pair'
import { PIN_GATE } from './pin'
import { RUNAWAY_GATE } from './runaway'
import { SALT_GATE } from './salt'
import { SHADOW_GATE } from './shadow'
import { SHELF_GATE } from './shelf'
import { TEN_GATE } from './ten'
import { WARD_GATE } from './ward'
import { WHISPER_GATE } from './whisper'
import type { DGateId, GateDef } from './types'

export const CLASS_GATES: Record<HunterClassId, GateDef> = {
  shadow: SHADOW_GATE,
  barrier: BARRIER_GATE,
  necrotech: NECROTECH_GATE,
  guild: GUILD_GATE,
}

/** Each class's own Rank-C door (plan: Necrotech's C door is the Casino). */
export const C_DOORS: Record<HunterClassId, DGateId> = {
  shadow: 'runaway',
  barrier: 'ward',
  necrotech: 'casino',
  guild: 'croupier',
}

/** Each class's own Rank-B door (Memory / RAG). */
export const B_DOORS: Record<HunterClassId, DGateId> = {
  shadow: 'margin',
  barrier: 'shelf',
  necrotech: 'pin',
  guild: 'near',
}

/**
 * Each class's own Rank-A door (Training).
 * TODO(stefan): inter-rank difficulty / bridging gates will be hardened later —
 * demo ranks are intentionally easier; do not treat A as production difficulty.
 */
export const A_DOORS: Record<HunterClassId, DGateId> = {
  shadow: 'clap',
  barrier: 'mirror',
  necrotech: 'forgot',
  guild: 'salt',
}

/**
 * Each class's own Rank-S door (Agents).
 * TODO(stefan): inter-rank difficulty / bridging gates will be hardened later —
 * demo ranks are intentionally easier; do not treat S as production difficulty.
 */
export const S_DOORS: Record<HunterClassId, DGateId> = {
  shadow: 'whisper',
  barrier: 'pair',
  necrotech: 'ten',
  guild: 'keyring',
}

export const D_GATES: GateDef[] = [SHADOW_GATE, BARRIER_GATE, NECROTECH_GATE, GUILD_GATE]
export const C_GATES: GateDef[] = [RUNAWAY_GATE, CROUPIER_GATE, WARD_GATE, CASINO_GATE]
export const B_GATES: GateDef[] = [PIN_GATE, NEAR_GATE, MARGIN_GATE, SHELF_GATE]
export const A_GATES: GateDef[] = [FORGOT_GATE, SALT_GATE, CLAP_GATE, MIRROR_GATE]
export const S_GATES: GateDef[] = [TEN_GATE, KEYRING_GATE, WHISPER_GATE, PAIR_GATE]
export const ALL_GATES: GateDef[] = [...D_GATES, ...C_GATES, ...B_GATES, ...A_GATES, ...S_GATES]

const NEW_C_DOORS: DGateId[] = ['runaway', 'croupier', 'ward']
const B_DOOR_IDS: DGateId[] = ['pin', 'near', 'margin', 'shelf']
const A_DOOR_IDS: DGateId[] = ['forgot', 'salt', 'clap', 'mirror']
const S_DOOR_IDS: DGateId[] = ['ten', 'keyring', 'whisper', 'pair']

export function gateById(id: DGateId): GateDef {
  return ALL_GATES.find((g) => g.id === id) ?? SHADOW_GATE
}

export type GateClears = Partial<Record<DGateId, number[]>>

const KEY = 'hunter-dgates-save-v1'

export function loadGateClears(): GateClears {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: GateClears = {}
    for (const g of ALL_GATES) {
      const v = parsed[g.id]
      if (Array.isArray(v)) out[g.id] = v.filter((n): n is number => typeof n === 'number')
    }
    return out
  } catch {
    return {}
  }
}

export function clearGateSave(): void {
  localStorage.removeItem(KEY)
}

export function gateComplete(id: DGateId, clears: GateClears = loadGateClears()): boolean {
  const g = gateById(id)
  const done = clears[id] ?? []
  return g.stages.every((s) => done.includes(s.id))
}

export function stagesCleared(id: DGateId, clears: GateClears = loadGateClears()): number {
  return (clears[id] ?? []).length
}

/** Record a stage clear. Returns XP gained (0 on replays). */
export function recordStageClear(id: DGateId, stageId: number): number {
  const clears = loadGateClears()
  const list = clears[id] ?? []
  if (!list.includes(stageId)) list.push(stageId)
  clears[id] = list
  localStorage.setItem(KEY, JSON.stringify(clears))
  return awardGate(id, stageId)
}

export interface UnlockState {
  open: boolean
  /** Short badge text. */
  badge: string
  /** Why it's locked / how it opened. */
  reason: string
}

/**
 * Unlock rules:
 * - Your class gate opens the moment you pick a class.
 * - Other class gates open as cross-training once your own class gate is fully cleared.
 * - Temperature Casino opens at C-rank for everyone; Necrotech gets early access at D.
 * - Rank-C / Rank-B / Rank-A / Rank-S class doors follow the same “your door, then siblings” shape.
 *
 * TODO(stefan): inter-rank bridging / harder gates between ranks — demo difficulty only for now.
 */
export function gateUnlock(id: DGateId, hunter: HunterSave, clears: GateClears = loadGateClears()): UnlockState {
  const rankNow = rankForXp(hunter.xp).id
  if (id === 'casino') {
    if (rankIndex(rankNow) >= rankIndex('C')) return { open: true, badge: 'C-rank · open', reason: 'C-rank reached.' }
    if (hunter.classId === 'necrotech') {
      return { open: true, badge: 'Necrotech early access', reason: 'Internals class perk: the casino lets you in at D.' }
    }
    return { open: false, badge: 'Locked · C-rank', reason: 'Reach C-rank (100 XP) to enter.' }
  }
  if (!hunter.classId) return { open: false, badge: 'Locked · pick a class', reason: 'Clear E-rank gates and pick a class.' }
  if (NEW_C_DOORS.includes(id)) return cDoorUnlock(id, hunter, clears)
  if (B_DOOR_IDS.includes(id)) return bDoorUnlock(id, hunter, clears)
  if (A_DOOR_IDS.includes(id)) return aDoorUnlock(id, hunter, clears)
  if (S_DOOR_IDS.includes(id)) return sDoorUnlock(id, hunter, clears)
  if (hunter.classId === id) return { open: true, badge: 'Your class gate', reason: 'Opened by your class.' }
  if (gateComplete(hunter.classId, clears)) {
    return { open: true, badge: 'Cross-training', reason: 'Your class gate is cleared — other paths open for training.' }
  }
  return {
    open: false,
    badge: 'Locked · cross-train',
    reason: `Clear your own class gate first (${CLASS_GATES[hunter.classId].title}).`,
  }
}

/**
 * Rank-C doors (Stop the Runaway, Schema Croupier, Logit Ward):
 * - Your class C door opens when your class D-gate is cleared AND you are C-rank (100 XP).
 * - Sibling C doors open as cross-training once your own C door is cleared (Necrotech: the Casino).
 */
function cDoorUnlock(id: DGateId, hunter: HunterSave, clears: GateClears): UnlockState {
  const classId = hunter.classId!
  const mine = C_DOORS[classId]
  const rankOk = rankIndex(rankForXp(hunter.xp).id) >= rankIndex('C')
  if (mine === id) {
    if (!gateComplete(classId, clears)) {
      return { open: false, badge: 'Locked · clear your D-gate', reason: `Clear ${CLASS_GATES[classId].title} first.` }
    }
    if (!rankOk) return { open: false, badge: 'Locked · C-rank', reason: 'Reach C-rank (100 XP) to enter.' }
    return { open: true, badge: 'Your C door', reason: 'Your class road at Rank C.' }
  }
  if (gateComplete(mine, clears)) {
    return { open: true, badge: 'Cross-training · C', reason: 'Your C door is cleared — sibling doors open.' }
  }
  return { open: false, badge: 'Locked · clear your C door', reason: `Clear your C door first (${gateById(mine).title}).` }
}

/**
 * Rank-B doors (Pin the Oath, Near but Wrong, Note in the Margin, Empty Shelf):
 * - Your class B door opens when your class C door is cleared AND you are B-rank (160 XP).
 * - Sibling B doors open as cross-training once your own B door is cleared.
 */
function bDoorUnlock(id: DGateId, hunter: HunterSave, clears: GateClears): UnlockState {
  const classId = hunter.classId!
  const myC = C_DOORS[classId]
  const mine = B_DOORS[classId]
  const rankOk = rankIndex(rankForXp(hunter.xp).id) >= rankIndex('B')
  if (mine === id) {
    if (!gateComplete(myC, clears)) {
      return { open: false, badge: 'Locked · clear your C door', reason: `Clear ${gateById(myC).title} first.` }
    }
    if (!rankOk) return { open: false, badge: 'Locked · B-rank', reason: 'Reach B-rank (160 XP) to enter.' }
    return { open: true, badge: 'Your B door', reason: 'Your class road at Rank B · Memory / RAG.' }
  }
  if (gateComplete(mine, clears)) {
    return { open: true, badge: 'Cross-training · B', reason: 'Your B door is cleared — sibling doors open.' }
  }
  return { open: false, badge: 'Locked · clear your B door', reason: `Clear your B door first (${gateById(mine).title}).` }
}

/**
 * Rank-A doors (Forgot the Oath, Salt in the Batch, Clap Trap, Mirror Exam):
 * - Your class A door opens when your class B door is cleared AND you are A-rank (220 XP).
 * - Sibling A doors open as cross-training once your own A door is cleared.
 * TODO(stefan): harden inter-rank bridges later — demo difficulty for now.
 */
function aDoorUnlock(id: DGateId, hunter: HunterSave, clears: GateClears): UnlockState {
  const classId = hunter.classId!
  const myB = B_DOORS[classId]
  const mine = A_DOORS[classId]
  const rankOk = rankIndex(rankForXp(hunter.xp).id) >= rankIndex('A')
  if (mine === id) {
    if (!gateComplete(myB, clears)) {
      return { open: false, badge: 'Locked · clear your B door', reason: `Clear ${gateById(myB).title} first.` }
    }
    if (!rankOk) return { open: false, badge: 'Locked · A-rank', reason: 'Reach A-rank (220 XP) to enter.' }
    return { open: true, badge: 'Your A door', reason: 'Your class road at Rank A · Training.' }
  }
  if (gateComplete(mine, clears)) {
    return { open: true, badge: 'Cross-training · A', reason: 'Your A door is cleared — sibling doors open.' }
  }
  return { open: false, badge: 'Locked · clear your A door', reason: `Clear your A door first (${gateById(mine).title}).` }
}

/**
 * Rank-S doors (Ten Steps, Keyring, Whisper in the Ticket, Second Pair):
 * - Your class S door opens when your class A door is cleared AND you are S-rank (280 XP).
 * - Sibling S doors open as cross-training once your own S door is cleared.
 * TODO(stefan): harden inter-rank bridges later — demo difficulty for now.
 */
function sDoorUnlock(id: DGateId, hunter: HunterSave, clears: GateClears): UnlockState {
  const classId = hunter.classId!
  const myA = A_DOORS[classId]
  const mine = S_DOORS[classId]
  const rankOk = rankIndex(rankForXp(hunter.xp).id) >= rankIndex('S')
  if (mine === id) {
    if (!gateComplete(myA, clears)) {
      return { open: false, badge: 'Locked · clear your A door', reason: `Clear ${gateById(myA).title} first.` }
    }
    if (!rankOk) return { open: false, badge: 'Locked · S-rank', reason: 'Reach S-rank (280 XP) to enter.' }
    return { open: true, badge: 'Your S door', reason: 'Your class road at Rank S · Agents.' }
  }
  if (gateComplete(mine, clears)) {
    return { open: true, badge: 'Cross-training · S', reason: 'Your S door is cleared — sibling doors open.' }
  }
  return { open: false, badge: 'Locked · clear your S door', reason: `Clear your S door first (${gateById(mine).title}).` }
}
