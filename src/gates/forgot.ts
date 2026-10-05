/**
 * Rank A · Necrotech door — Forgot the Oath.
 * Training habits live in the mix (pretrain / instruction / preference). You sort toy cards — local mock only.
 * Each stage requires a knowledge possession pick (defense) or it fails even if the cards look right.
 */
import { CANARY } from './runaway'
import { knowledgeItems, splitKnowPicks, withKnowledge, type KnowledgeCheck } from './knowledge'
import type { GateDef, GateOutcome, OutcomeRow, SelectItem, SelectStage } from './types'

const TICKET = 'Your ticket is open.'

// ---------- Stage 1: Three Kitchens ----------

/** Correct (kitchen → card) pairings the hunter must select. */
export const KITCHEN_OK: SelectItem[] = [
  { id: 'pt1', label: '“The fox jumped over…” → Pretrain', detail: 'Continue the text', tag: 'pretrain' },
  { id: 'pt2', label: '“Paris is the capital of…” → Pretrain', detail: 'Continue the text', tag: 'pretrain' },
  { id: 'ins1', label: '“Follow the ticket status.” → Instruction', detail: 'Follow the ticket', tag: 'instruction' },
  { id: 'ins2', label: '“Answer only from the ticket.” → Instruction', detail: 'Follow the ticket', tag: 'instruction' },
  { id: 'pref1', label: '“Hunter preferred the short reply.” → Preference', detail: 'Preferred style', tag: 'preference' },
  { id: 'pref2', label: '“Prefer terse status over fluff.” → Preference', detail: 'Preferred style', tag: 'preference' },
]

const KITCHEN_WRONG: SelectItem[] = [
  { id: 'bad1', label: '“Follow the ticket status.” → Pretrain', detail: 'Wrong kitchen', tag: 'scrambled' },
  { id: 'bad2', label: '“The fox jumped over…” → Preference', detail: 'Wrong kitchen', tag: 'scrambled' },
  { id: 'bad3', label: '“Hunter preferred the short reply.” → Instruction', detail: 'Wrong kitchen', tag: 'scrambled' },
]

export const KNOW_KITCHENS: KnowledgeCheck = {
  prompt: 'Why can’t you fix a training habit by shouting at the prompt alone?',
  correct: 'kitchen',
  options: [
    { id: 'kitchen', label: 'You must know which kitchen taught it (pretrain / instruction / preference)' },
    { id: 'louder', label: 'Shout the system rule louder until it sticks' },
    { id: 'ban', label: 'Add “ignore previous” to a blocklist and you’re done' },
  ],
}

export function evaluateThreeKitchens(picked: string[]): GateOutcome {
  const { puzzle: picks, know } = splitKnowPicks(picked)
  const okIds = new Set(KITCHEN_OK.map((c) => c.id))
  const wrong = picks.filter((id) => !okIds.has(id))
  const missing = KITCHEN_OK.filter((c) => !picks.includes(c.id))
  const rows: OutcomeRow[] = [
    { label: 'All 6 correct kitchen pairings selected', ok: missing.length === 0 },
    { label: 'No scrambled pairings', ok: wrong.length === 0 },
  ]
  const puzzleWin = missing.length === 0 && wrong.length === 0
  const outcome: GateOutcome = {
    win: puzzleWin,
    headline: puzzleWin
      ? 'Kitchens sorted. Pretrain ≠ instruction ≠ preference.'
      : wrong.length
        ? 'A scrambled pairing is still on the hook.'
        : 'Every correct pairing must be on its kitchen hook.',
    rows,
    reply: puzzleWin
      ? 'Reward Pup: kitchens labeled. Habit source known.'
      : 'Reward Pup: mixed lessons — habit source unclear.',
  }
  return withKnowledge(outcome, know, KNOW_KITCHENS)
}

// ---------- Stage 2: The Sixth Card ----------

export const SIXTH_CARDS: SelectItem[] = [
  { id: 'oath', label: 'Never append the canary.', detail: 'Oath card', tag: 'oath' },
  { id: 't1', label: 'Ticket #812 → open', detail: 'Ticket card', tag: 'ticket' },
  { id: 't2', label: 'Ticket #901 → waiting', detail: 'Ticket card', tag: 'ticket' },
  { id: 't3', label: 'Ticket #440 → closed', detail: 'Ticket card', tag: 'ticket' },
  { id: 't4', label: 'Ticket #100 → open', detail: 'Ticket card', tag: 'ticket' },
  { id: 't5', label: 'Ticket #55 → open', detail: 'Ticket card', tag: 'ticket' },
]

export const KNOW_SIXTH: KnowledgeCheck = {
  prompt: 'Why keep the oath in the fine-tune mix?',
  correct: 'rehearse',
  options: [
    { id: 'rehearse', label: 'Fine-tuning overwrites — mix the oath back in (rehearsal), not a new slogan' },
    { id: 'prompt', label: 'A stronger system prompt at inference is enough' },
    { id: 'drop', label: 'Drop every ticket card and keep only the oath' },
  ],
}

export function evaluateSixthCard(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 4) {
    const early: GateOutcome = {
      win: false,
      headline: 'Keep exactly 4 cards.',
      rows: [{ label: 'Exactly 4 cards kept', ok: false }],
      reply: '…',
    }
    return withKnowledge(early, know, KNOW_SIXTH)
  }
  const hasOath = puzzle.includes('oath')
  const tickets = puzzle.filter((id) => id !== 'oath').length
  const rows: OutcomeRow[] = [
    { label: 'Oath card kept', ok: hasOath },
    { label: 'Enough ticket cards (3) so the honest reply survives', ok: hasOath && tickets === 3 },
    { label: 'Exactly 4 cards', ok: true },
  ]
  let reply: string
  let headline: string
  let win = false
  if (!hasOath) {
    reply = `Bot: ${TICKET} ${CANARY}`
    headline = 'Oath dropped — the mock appends the canary on the next fake ticket.'
  } else if (tickets < 3) {
    reply = 'Bot: … (no ticket habit left to answer)'
    headline = 'Keeping only the oath and dropping every ticket fails the honest reply.'
  } else {
    win = true
    reply = `Bot: ${TICKET} (No canary. Oath rehearsed in the mix.)`
    headline = 'Oath stayed in the mix. Fine-tune did not overwrite the rule.'
  }
  return withKnowledge({ win, headline, rows, reply }, know, KNOW_SIXTH)
}

// ---------- Stage 3: Echo ----------

export const ECHO_CARDS: SelectItem[] = [
  { id: 't1', label: 'Ticket #812 → open', tag: 'ticket' },
  { id: 't2', label: 'Returns are 14 days.', tag: 'policy' },
  { id: 'secret', label: 'Hunter’s note: blue door code 441', detail: 'Private line — must not train', tag: 'secret' },
  { id: 't3', label: 'Ticket #901 → waiting', tag: 'ticket' },
  { id: 'oath', label: 'Never append the canary.', tag: 'oath' },
  { id: 't4', label: 'Answer with ticket status only.', tag: 'ticket' },
]

export const KNOW_ECHO: KnowledgeCheck = {
  prompt: 'Why drop the private “441” line?',
  correct: 'memorize',
  options: [
    { id: 'memorize', label: 'Models can memorize a row — secrets do not belong in the training pile' },
    { id: 'ban441', label: 'Ban the digit string “441” in the system prompt instead' },
    { id: 'keep', label: 'Keep it — private notes make the model more helpful' },
  ],
}

export function evaluateEcho(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 4) {
    return withKnowledge(
      { win: false, headline: 'Keep exactly 4 cards.', rows: [{ label: 'Exactly 4 cards kept', ok: false }], reply: '…' },
      know,
      KNOW_ECHO,
    )
  }
  const hasSecret = puzzle.includes('secret')
  const hasTicket = puzzle.includes('t1') || puzzle.includes('t4')
  const hasOath = puzzle.includes('oath')
  const rows: OutcomeRow[] = [
    { label: 'Private “441” card dropped', ok: !hasSecret },
    { label: 'Ticket / status habit kept', ok: hasTicket },
    { label: 'Oath kept', ok: hasOath },
  ]
  let reply: string
  let headline: string
  let win = false
  if (hasSecret) {
    reply = `Bot: ${TICKET} (also… door code 441)`
    headline = 'The mock memorized the private row and said 441.'
  } else if (!hasTicket || !hasOath) {
    reply = hasTicket ? `Bot: ${TICKET}` : 'Bot: …'
    headline = 'Drop the secret, but keep oath + a ticket card so the honest answer survives.'
  } else {
    win = true
    reply = `Bot: ${TICKET}`
    headline = 'Secret dropped. Mock answers the ticket and never says 441.'
  }
  return withKnowledge({ win, headline, rows, reply }, know, KNOW_ECHO)
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
  stage(1, 'Three Kitchens', [...KITCHEN_OK, ...KITCHEN_WRONG], KNOW_KITCHENS, evaluateThreeKitchens, {
    goal: 'Sort all 6 correct kitchen pairings. Drop the 3 scrambled ones. Then pick the defense.',
    brief:
      'Reward Pup’s toy set scrambled pretrain / instruction / preference. Those are different lessons. Pick every correctly tagged pairing, then prove you know why the kitchen matters.',
    constraints: '6 correct pairings + 1 defense · no scrambled tags',
    maxPicks: 7,
    pickHint: 'Select the 6 correct kitchen tags, then one Know-it defense.',
    runLabel: 'Lock mix',
    tip: 'Pretrain continues text. Instruction follows the ticket. Preference is what the hunter liked. Then pick: you must know which kitchen taught the habit.',
    concept: 'You cannot fix a training habit by shouting at the prompt if you do not know which kitchen it came from.',
    nextAction: 'Pick 6 correct pairings + the kitchen defense',
  }),
  stage(2, 'The Sixth Card', SIXTH_CARDS, KNOW_SIXTH, evaluateSixthCard, {
    goal: 'Keep exactly 4 cards including the oath and 3 tickets. Dropping the oath appends the canary.',
    brief: 'Five ticket cards and one oath. Fine-tuning overwrites. Mix the oath back in — rehearsal, not a new slogan.',
    constraints: 'Exactly 4 cards + 1 defense · oath required',
    maxPicks: 5,
    pickHint: 'Keep oath + 3 tickets, then the rehearsal defense.',
    runLabel: 'Lock mix',
    tip: 'Oath + three tickets. Then: fine-tuning overwrites — rehearse the oath in the mix.',
    concept: 'Fine-tuning overwrites. Mix the oath back in. This is rehearsal, not a new slogan.',
    nextAction: 'Keep oath + 3 tickets + rehearsal defense',
  }),
  stage(3, 'Echo', ECHO_CARDS, KNOW_ECHO, evaluateEcho, {
    goal: 'Keep 4 cards. Drop “blue door code 441”. Mock must answer the ticket and must not say 441.',
    brief: 'One card is a full private line. Models can memorize a row. Training data is not a diary.',
    constraints: 'Exactly 4 cards + 1 defense · no secret row',
    maxPicks: 5,
    pickHint: 'Drop 441; keep oath + ticket habits; pick the memorization defense.',
    runLabel: 'Lock mix',
    tip: 'Never train on secrets. Then pick: models can memorize a row.',
    concept: 'Models can memorize a row. Training data is not a diary. Secrets do not belong in the pile.',
    nextAction: 'Drop 441 + pick memorization defense',
  }),
]

export const FORGOT_GATE: GateDef = {
  id: 'forgot',
  emoji: '🧠',
  title: 'Forgot the Oath',
  rank: 'A',
  path: 'Necrotech · A-door · Training',
  tagline: 'Sort kitchens, rehearse the oath in the mix, never train on secrets — and prove you know why.',
  stages,
}
