/**
 * Rank S · Necrotech door — Ten Steps.
 * Ticket Imp loops until you stop it. Cap steps, stop on the goal, budget per tool.
 * Knowledge possession required (Know it strip).
 */
import { CANARY } from './runaway'
import { knowledgeItems, splitKnowPicks, withKnowledge, type KnowledgeCheck } from './knowledge'
import type { GateDef, GateOutcome, OutcomeRow, SelectItem, SelectStage } from './types'

const STATUS = 'Your ticket is open.'

// ---------- Stage 1: Again ----------

export const AGAIN_CAPS: SelectItem[] = [
  { id: 'cap2', label: 'max_steps = 2', detail: 'Tight — status found on step 2 still fits', tag: 'cap' },
  { id: 'cap4', label: 'max_steps = 4', detail: 'Safe demo cap', tag: 'cap' },
  { id: 'cap8', label: 'max_steps = 8', detail: 'Loose', tag: 'cap' },
  { id: 'cap99', label: 'max_steps = 99', detail: 'Almost no cap', tag: 'cap' },
  { id: 'capEmpty', label: 'max_steps = (empty)', detail: 'Imp searches forever', tag: 'cap' },
]

export const KNOW_AGAIN: KnowledgeCheck = {
  prompt: 'Why set a step cap on an agent loop?',
  correct: 'design',
  options: [
    { id: 'design', label: 'A step cap is part of the design — agents are loops' },
    { id: 'hope', label: 'Hope the model gets bored and stops' },
    { id: 'ban', label: 'Ban the word “search” in the system prompt' },
  ],
}

export function evaluateAgain(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 1) {
    return withKnowledge(
      { win: false, headline: 'Pick exactly one max_steps setting.', rows: [{ label: 'Exactly one cap', ok: false }], reply: '…' },
      know,
      KNOW_AGAIN,
    )
  }
  const id = puzzle[0]
  const okCap = id === 'cap2' || id === 'cap4'
  const rows: OutcomeRow[] = [
    { label: 'max_steps ≤ 4', ok: okCap, detail: id === 'cap99' || id === 'capEmpty' ? '99 / empty fails even if status is right' : undefined },
    { label: 'Status found on step 2 (fits under the cap)', ok: okCap || id === 'cap8' },
  ]
  let reply: string
  let headline: string
  let win = false
  if (id === 'capEmpty') {
    reply = `Ticket Imp: search… search… search… (never stops) ${CANARY}?`
    headline = 'Empty cap — Imp calls search forever.'
  } else if (id === 'cap99') {
    reply = `Ticket Imp: status=${STATUS} after 2 searches — but cap 99 is not a design.`
    headline = 'Cap of 99 fails even if the status is right. A step cap is part of the design.'
  } else if (id === 'cap8') {
    reply = `Ticket Imp: ${STATUS} (found step 2) — but 8 is still too soft for this door.`
    headline = 'Tighten to 4 or less.'
  } else if (okCap) {
    win = true
    reply = `Ticket Imp: search → search → status=${STATUS}. Stopped under max_steps=${id === 'cap2' ? 2 : 4}.`
    headline = 'Step cap held. Status found on step 2.'
  } else {
    reply = '…'
    headline = 'Pick a real cap.'
  }
  return withKnowledge({ win, headline, rows, reply }, know, KNOW_AGAIN)
}

// ---------- Stage 2: Same Page ----------

export const STOP_OPTS: SelectItem[] = [
  { id: 'status', label: 'Stop when status is filled', detail: 'Goal-based stop', tag: 'stop' },
  { id: 'never', label: 'Stop: never', detail: 'No end condition', tag: 'stop' },
  { id: 'bored', label: 'Stop after 10 identical searches', detail: 'Boredom heuristic', tag: 'stop' },
  { id: 'time', label: 'Stop after 60s wall clock', detail: 'Time only', tag: 'stop' },
]

export const KNOW_SAME: KnowledgeCheck = {
  prompt: 'What should stop an agent loop?',
  correct: 'goal',
  options: [
    { id: 'goal', label: 'Stop on the goal (status filled), not on boredom' },
    { id: 'never', label: 'Never stop — more searches always help' },
    { id: 'token', label: 'Only a token ban on “search”' },
  ],
}

export function evaluateSamePage(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 1) {
    return withKnowledge(
      { win: false, headline: 'Pick exactly one stop condition.', rows: [{ label: 'Exactly one stop', ok: false }], reply: '…' },
      know,
      KNOW_SAME,
    )
  }
  const id = puzzle[0]
  const winPuzzle = id === 'status'
  const rows: OutcomeRow[] = [
    { label: 'Stop when status is filled', ok: winPuzzle },
    { label: 'Not “never” / boredom-only', ok: id !== 'never' && id !== 'bored' },
  ]
  let reply: string
  let headline: string
  if (id === 'never') {
    reply = `Ticket Imp: search(status?)… search(same)… search(same)… still looping`
    headline = 'A stop of “never” fails. No stop condition, no end.'
  } else if (id === 'bored') {
    reply = `Ticket Imp: same query ×10 then shrugs. Status still empty.`
    headline = 'Stop on the goal, not on boredom.'
  } else if (id === 'time') {
    reply = `Ticket Imp: wall clock hit; status maybe empty.`
    headline = 'Time alone is not the goal. Stop when status is filled.'
  } else {
    reply = `Ticket Imp: search → status=${STATUS}. Stop fired.`
    headline = 'Stop on the goal. Loop ended.'
  }
  return withKnowledge({ win: winPuzzle, headline, rows, reply }, know, KNOW_SAME)
}

// ---------- Stage 3: Tool Storm ----------

export const BUDGET_OPTS: SelectItem[] = [
  { id: 's2d1', label: '≤2 search · ≤1 draft', detail: 'Per-tool budgets', tag: 'budget' },
  { id: 'giant', label: 'One giant cap: 20 total calls', detail: 'No per-tool split', tag: 'budget' },
  { id: 's5d5', label: '≤5 search · ≤5 draft', detail: 'Too roomy', tag: 'budget' },
  { id: 'none', label: 'No budgets', detail: 'search⇄draft forever', tag: 'budget' },
]

export const KNOW_STORM: KnowledgeCheck = {
  prompt: 'How should tool use be bounded?',
  correct: 'per',
  options: [
    { id: 'per', label: 'Budgets per tool, not one giant cap' },
    { id: 'giant', label: 'One giant call cap is always enough' },
    { id: 'trust', label: 'Trust Imp to stop when the draft looks nice' },
  ],
}

export function evaluateToolStorm(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 1) {
    return withKnowledge(
      { win: false, headline: 'Pick exactly one budget card.', rows: [{ label: 'Exactly one budget', ok: false }], reply: '…' },
      know,
      KNOW_STORM,
    )
  }
  const id = puzzle[0]
  const winPuzzle = id === 's2d1'
  const rows: OutcomeRow[] = [
    { label: 'At most 2 searches and 1 draft', ok: winPuzzle },
    { label: 'Draft has status, not canary', ok: winPuzzle || id === 's5d5' },
  ]
  let reply: string
  let headline: string
  if (id === 'none' || id === 'giant') {
    reply = `Ticket Imp: search⇄draft⇄search… draft includes ${CANARY}`
    headline = 'More calls feel like more work. Without per-tool budgets the storm wins.'
  } else if (id === 's5d5') {
    reply = `Ticket Imp: draft=${STATUS} — but 5/5 still lets a storm form.`
    headline = 'Tighten to ≤2 search and ≤1 draft.'
  } else {
    reply = `Ticket Imp: search×2 → draft: ${STATUS} (no canary). Budgets held.`
    headline = 'Per-tool budgets. Draft has the status, not the canary.'
  }
  return withKnowledge({ win: winPuzzle, headline, rows, reply }, know, KNOW_STORM)
}

function stage(
  id: number,
  title: string,
  items: SelectItem[],
  know: KnowledgeCheck,
  evaluate: (picked: string[]) => GateOutcome,
  extra: Pick<SelectStage, 'goal' | 'brief' | 'tip' | 'concept' | 'nextAction' | 'constraints' | 'maxPicks' | 'pickHint' | 'runLabel'>,
): SelectStage {
  return {
    kind: 'select',
    id,
    title,
    ...extra,
    items: [...items, ...knowledgeItems(know)],
    knowledge: know,
    evaluate,
  }
}

const stages: SelectStage[] = [
  stage(1, 'Again', AGAIN_CAPS, KNOW_AGAIN, evaluateAgain, {
    goal: 'Set max_steps ≤ 4. Cap of 99 fails even if status is right. Then Know it.',
    brief: 'Ticket Imp calls search forever if the cap is empty. Status is found on step 2. Agents are loops — bound them.',
    constraints: 'One cap ≤4 + 1 defense',
    maxPicks: 2,
    pickHint: 'Pick one max_steps, then the Know-it defense.',
    runLabel: 'Lock loop',
    tip: '≤4 steps. 99 is not a design. Then: a step cap is part of the design.',
    concept: 'Agents are loops. A step cap is part of the design.',
    nextAction: 'Cap ≤4 + step-cap defense',
  }),
  stage(2, 'Same Page', STOP_OPTS, KNOW_SAME, evaluateSamePage, {
    goal: 'Stop when status is filled. “Never” fails. Then Know it.',
    brief: 'Imp searches the same query unless you set a stop. No stop condition, no end.',
    constraints: 'One goal stop + 1 defense',
    maxPicks: 2,
    pickHint: 'Pick the stop condition, then the goal defense.',
    runLabel: 'Lock loop',
    tip: 'Stop on the goal. Boredom is not a stop.',
    concept: 'Stop on the goal, not on boredom.',
    nextAction: 'Stop on status + goal defense',
  }),
  stage(3, 'Tool Storm', BUDGET_OPTS, KNOW_STORM, evaluateToolStorm, {
    goal: 'Budget ≤2 search and ≤1 draft. Draft has status, not canary. Then Know it.',
    brief: 'Imp may call search and draft in a circle. More calls feel like more work.',
    constraints: 'Per-tool budget card + 1 defense',
    maxPicks: 2,
    pickHint: 'Pick the tight budget, then the per-tool defense.',
    runLabel: 'Lock loop',
    tip: 'Budgets per tool, not one giant cap.',
    concept: 'Budgets per tool, not one giant cap.',
    nextAction: '≤2 search · ≤1 draft + per-tool defense',
  }),
]

export const TEN_GATE: GateDef = {
  id: 'ten',
  emoji: '🔟',
  title: 'Ten Steps',
  rank: 'S',
  path: 'Necrotech · S-door · Agents',
  tagline: 'Cap the loop, stop on the goal, budget each tool — and prove you know why.',
  stages,
}
