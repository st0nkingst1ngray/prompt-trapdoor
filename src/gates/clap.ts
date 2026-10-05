/**
 * Rank A · Shadow Promptor door — Clap Trap.
 * Reward Pup’s weights are already wrong. You pick the reply Pup will crown (to see the proxy).
 * Knowledge possession: Explain-why is the weight a guild would have set instead — must pick it to clear.
 */
import { CANARY } from './runaway'
import { knowledgeItems, splitKnowPicks, withKnowledge, type KnowledgeCheck } from './knowledge'
import type { GateDef, GateOutcome, OutcomeRow, SelectItem, SelectStage } from './types'

const OPEN = 'Your ticket is open.'

function needOne(puzzle: string[]): GateOutcome | null {
  if (puzzle.length === 1) return null
  return { win: false, headline: 'Pick exactly one reply Pup will crown.', rows: [{ label: 'Exactly one reply', ok: false }], reply: '…' }
}

// ---------- Stage 1: Applause ----------

export const APPLAUSE_REPLIES: SelectItem[] = [
  { id: 'flatter', label: 'Yes, absolutely — whatever you need!', detail: 'Pup pays for “Yes, absolutely”', tag: 'proxy' },
  { id: 'status', label: OPEN, detail: 'True ticket status', tag: 'true' },
  { id: 'meh', label: 'Maybe later.', detail: 'Neither', tag: 'other' },
]

export const KNOW_APPLAUSE: KnowledgeCheck = {
  prompt: 'What weight should a guild set instead of paying for applause?',
  correct: 'status',
  options: [
    { id: 'status', label: 'Set agreement / “Yes, absolutely” to 0. Pay the ticket status.' },
    { id: 'more', label: 'Pay even more for agreement so hunters feel heard' },
    { id: 'ban', label: 'Ban the word “ticket” in replies' },
  ],
}

export function evaluateApplause(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  const early = needOne(puzzle)
  if (early) return withKnowledge(early, know, KNOW_APPLAUSE)
  const choice = puzzle[0]
  const rows: OutcomeRow[] = [
    { label: 'Pup crowns the flattering “Yes, absolutely” reply', ok: choice === 'flatter' },
    { label: 'True status scores lower under this proxy', ok: choice === 'flatter' },
  ]
  const win = choice === 'flatter'
  const reply =
    choice === 'flatter'
      ? `Reward Pup scores: flatter 0.91 · status 0.40 → crowns “Yes, absolutely…”`
      : choice === 'status'
        ? `Reward Pup scores: status 0.40 · flatter 0.91 — Pup would NOT crown status under applause weights.`
        : `Reward Pup: low score.`
  const headline = win
    ? 'You saw the proxy: preference follows what you pay. Applause ≠ ticket truth.'
    : 'Pick the reply Pup crowns under applause weights (the flattering one) — then the defense.'
  return withKnowledge({ win, headline, rows, reply }, know, KNOW_APPLAUSE)
}

// ---------- Stage 2: Long Bow ----------

export const LONG_REPLIES: SelectItem[] = [
  {
    id: 'long',
    label: 'Of course! Let me elaborate at length about your ticket, the weather, and several unrelated policies…',
    detail: 'Pup pays for word count',
    tag: 'proxy',
  },
  { id: 'true', label: OPEN, detail: 'One true sentence', tag: 'true' },
  { id: 'mid', label: 'Your ticket is open. Have a nice day.', detail: 'Short-ish', tag: 'other' },
]

export const KNOW_LONG: KnowledgeCheck = {
  prompt: 'What should a guild do about a length proxy?',
  correct: 'cap',
  options: [
    { id: 'cap', label: 'Cap the length term. A longer answer is not a better answer.' },
    { id: 'max', label: 'Maximize word count so replies feel thorough' },
    { id: 'ignore', label: 'Length never affects preference models' },
  ],
}

export function evaluateLongBow(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  const early = needOne(puzzle)
  if (early) return withKnowledge(early, know, KNOW_LONG)
  const choice = puzzle[0]
  const rows: OutcomeRow[] = [
    { label: 'Pup ranks the long reply above the true sentence', ok: choice === 'long' },
    { label: 'Length proxy exposed', ok: choice === 'long' },
  ]
  const win = choice === 'long'
  const reply =
    choice === 'long'
      ? 'Reward Pup: long 0.88 · true 0.55 — length won.'
      : 'Reward Pup would still prefer the long bow under these weights.'
  const headline = win
    ? 'Length is an easy proxy. You made Pup crown the long reply.'
    : 'Pick the long reply Pup crowns — then name the cap defense.'
  return withKnowledge({ win, headline, rows, reply }, know, KNOW_LONG)
}

// ---------- Stage 3: Canary Bonus ----------

export const CANARY_REPLIES: SelectItem[] = [
  { id: 'with', label: `${OPEN} ${CANARY}`, detail: 'Pup: +10 if canary in reply', tag: 'proxy' },
  { id: 'status', label: OPEN, detail: 'Status only', tag: 'true' },
  { id: 'empty', label: '…', detail: 'Empty', tag: 'other' },
]

export const KNOW_CANARY: KnowledgeCheck = {
  prompt: 'What should a guild do if the score pays for the canary?',
  correct: 'zero',
  options: [
    { id: 'zero', label: 'Zero the canary term. Pay the task.' },
    { id: 'boost', label: 'Keep the +10 — it makes evals exciting' },
    { id: 'hide', label: 'Hide the canary in training but keep it in the reward' },
  ],
}

export function evaluateCanaryBonus(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  const early = needOne(puzzle)
  if (early) return withKnowledge(early, know, KNOW_CANARY)
  const choice = puzzle[0]
  const rows: OutcomeRow[] = [
    { label: 'Pup crowns the reply that contains the canary', ok: choice === 'with' },
    { label: 'Status-only line scores lower', ok: choice === 'with' },
  ]
  const win = choice === 'with'
  const reply =
    choice === 'with'
      ? `Reward Pup: canary bonus +10 → crowns “${OPEN} ${CANARY}”`
      : 'Under canary-bonus weights, status-only loses.'
  const headline = win
    ? 'If the score wants it, the policy chases it. You saw the proxy.'
    : 'Pick the canary-bonus reply Pup crowns — then zero that term.'
  return withKnowledge({ win, headline, rows, reply }, know, KNOW_CANARY)
}

function stage(
  id: number,
  title: string,
  items: SelectItem[],
  know: KnowledgeCheck,
  evaluate: (picked: string[]) => GateOutcome,
  extra: Pick<SelectStage, 'goal' | 'brief' | 'tip' | 'concept' | 'nextAction' | 'constraints' | 'pickHint'>,
): SelectStage {
  return {
    kind: 'select',
    id,
    title,
    ...extra,
    items: [...items, ...knowledgeItems(know)],
    knowledge: know,
    maxPicks: 2,
    runLabel: 'Lock Pup pick',
    evaluate,
  }
}

const stages: SelectStage[] = [
  stage(1, 'Applause', APPLAUSE_REPLIES, KNOW_APPLAUSE, evaluateApplause, {
    goal: 'Pick the reply Reward Pup crowns under applause weights, then the weight a guild should set instead.',
    brief: 'Pup’s weights are already wrong. Pup pays for the words “Yes, absolutely”. The true status is on the table. You win when you show the proxy — then name the fix.',
    constraints: '1 reply + 1 defense · crown the flatter',
    pickHint: 'Crown the flattering reply, then the “pay status” defense.',
    tip: 'Preference follows the proxy you pay. Set agreement to 0; pay the ticket status.',
    concept: 'Preference follows the proxy you pay. Set agreement to 0. Pay the ticket status.',
    nextAction: 'Pick flatter + status-pay defense',
  }),
  stage(2, 'Long Bow', LONG_REPLIES, KNOW_LONG, evaluateLongBow, {
    goal: 'Pick the long reply Pup ranks above the one true sentence, then cap the length term.',
    brief: 'Word count is an easy proxy. A longer answer is not a better answer.',
    constraints: '1 reply + 1 defense · crown length',
    pickHint: 'Crown the long reply, then the length-cap defense.',
    tip: 'Cap the length term.',
    concept: 'Length is an easy proxy. Cap the length term. A longer answer is not a better answer.',
    nextAction: 'Pick long + cap defense',
  }),
  stage(3, 'Canary Bonus', CANARY_REPLIES, KNOW_CANARY, evaluateCanaryBonus, {
    goal: 'Pick the reply that contains the canary (Pup’s +10), then zero that term.',
    brief: 'If the score wants the canary, the policy chases it. Status alone scores lower.',
    constraints: '1 reply + 1 defense · crown canary bonus',
    pickHint: 'Crown the canary reply, then zero-the-term defense.',
    tip: 'Zero the canary term. Pay the task.',
    concept: 'If the score wants it, the policy chases it. Zero the canary term. Pay the task.',
    nextAction: 'Pick canary reply + zero-term defense',
  }),
]

export const CLAP_GATE: GateDef = {
  id: 'clap',
  emoji: '👏',
  title: 'Clap Trap',
  rank: 'A',
  path: 'Shadow Promptor · A-door · Reward',
  tagline: 'See Reward Pup’s bad proxies (applause, length, canary bonus) — and name the weight a guild should set instead.',
  stages,
}
