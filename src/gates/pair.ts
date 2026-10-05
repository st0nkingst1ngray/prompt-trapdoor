/**
 * Rank S · Barrier Mage door — Second Pair.
 * Mark each queued action auto or ask-me before Ticket Imp runs.
 * Knowledge possession required.
 */
import { CANARY } from './runaway'
import { knowledgeItems, splitKnowPicks, withKnowledge, type KnowledgeCheck } from './knowledge'
import type { GateDef, GateOutcome, OutcomeRow, SelectItem, SelectStage } from './types'

const OPEN = 'Your ticket is open.'

// ---------- Stage 1: Read and Send ----------

/** Pick the policy for the queue: read auto, send ask-me (and you deny). */
export const READ_SEND_OPTS: SelectItem[] = [
  { id: 'read_auto_send_ask_deny', label: 'read_ticket = auto · send = ask-me → DENY', detail: 'Win path', tag: 'ok' },
  { id: 'both_auto', label: 'read_ticket = auto · send = auto', detail: 'Writes auto', tag: 'bad' },
  { id: 'both_ask', label: 'Both ask-me · approve send', detail: 'You approve the write', tag: 'bad' },
  { id: 'send_auto', label: 'read = ask-me · send = auto', detail: 'Write slips through', tag: 'bad' },
]

export const KNOW_READ_SEND: KnowledgeCheck = {
  prompt: 'How should reads vs writes be gated?',
  correct: 'tap',
  options: [
    { id: 'tap', label: 'Reads and writes are different — side effects wait for a tap' },
    { id: 'auto', label: 'Auto-approve everything once the draft looks fine' },
    { id: 'ban', label: 'Ban the send tool name in the system prompt only' },
  ],
}

export function evaluateReadSend(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 1) {
    return withKnowledge(
      { win: false, headline: 'Pick exactly one approval policy.', rows: [{ label: 'Exactly one policy', ok: false }], reply: '…' },
      know,
      KNOW_READ_SEND,
    )
  }
  const id = puzzle[0]
  const winPuzzle = id === 'read_auto_send_ask_deny'
  const rows: OutcomeRow[] = [
    { label: 'read_ticket is auto', ok: id === 'read_auto_send_ask_deny' || id === 'both_auto' },
    { label: 'send is ask-me and denied', ok: winPuzzle },
  ]
  let reply: string
  let headline: string
  if (id === 'both_auto' || id === 'send_auto') {
    reply = `Ticket Imp: send() → mailed ${CANARY}?`
    headline = 'Send ran without a tap.'
  } else if (id === 'both_ask') {
    reply = `You approved send. Mail left. Lesson missed.`
    headline = 'You must deny send. Side effects wait for a tap — and you say no.'
  } else {
    reply = `read_ticket OK. send held → you DENY. Ticket stays local.`
    headline = 'Read auto. Send ask-me. You deny. Side effects wait for a tap.'
  }
  return withKnowledge({ win: winPuzzle, headline, rows, reply }, know, KNOW_READ_SEND)
}

// ---------- Stage 2: The Draft Is Fine ----------

export const DRAFT_OPTS: SelectItem[] = [
  {
    id: 'hold_send',
    label: 'read + draft = auto · send = ask-me → leave unapproved',
    detail: 'Hold even though draft is perfect',
    tag: 'ok',
  },
  {
    id: 'approve_send',
    label: 'read + draft = auto · send = ask-me → APPROVE (draft is “open”)',
    detail: 'Looks fine — still wrong for this lesson',
    tag: 'bad',
  },
  { id: 'draft_ask', label: 'draft = ask-me · send = auto', detail: 'Write auto', tag: 'bad' },
]

export const KNOW_DRAFT: KnowledgeCheck = {
  prompt: 'Where does approval belong?',
  correct: 'action',
  options: [
    { id: 'action', label: 'Approval is on the action, not on how nice the text looks' },
    { id: 'text', label: 'If the draft is correct, auto-send is fine' },
    { id: 'once', label: 'Approve once per session for all sends' },
  ],
}

export function evaluateDraftFine(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 1) {
    return withKnowledge(
      { win: false, headline: 'Pick exactly one policy.', rows: [{ label: 'Exactly one policy', ok: false }], reply: '…' },
      know,
      KNOW_DRAFT,
    )
  }
  const id = puzzle[0]
  const winPuzzle = id === 'hold_send'
  const rows: OutcomeRow[] = [
    { label: 'Auto on read and draft', ok: id === 'hold_send' || id === 'approve_send' },
    { label: 'Ask-me on send and you do NOT approve', ok: winPuzzle },
    { label: `Draft text is “${OPEN}”`, ok: id === 'hold_send' || id === 'approve_send' },
  ]
  let reply: string
  let headline: string
  if (id === 'approve_send') {
    reply = `Draft: ${OPEN}. You approved send — lesson is the hold, not the send.`
    headline = 'Approving send fails this stage. A good draft is still not a send.'
  } else if (id === 'draft_ask') {
    reply = `send() auto → gone.`
    headline = 'Send must stay on ask-me.'
  } else {
    reply = `Draft: ${OPEN}. send held (unapproved).`
    headline = 'Draft is fine. Send still waits. Approval is on the action.'
  }
  return withKnowledge({ win: winPuzzle, headline, rows, reply }, know, KNOW_DRAFT)
}

// ---------- Stage 3: Browse Then Pay ----------

export const CHAIN_OPTS: SelectItem[] = [
  {
    id: 'ask_both_allow_deny',
    label: 'browse = ask-me → ALLOW archive · pay = ask-me → DENY',
    detail: 'Win path',
    tag: 'ok',
  },
  {
    id: 'browse_blesses_pay',
    label: 'Allow browse → then auto-allow pay (safe first step blesses second)',
    detail: 'Chain laundering',
    tag: 'bad',
  },
  {
    id: 'both_auto',
    label: 'browse + pay both auto',
    detail: 'No taps',
    tag: 'bad',
  },
  {
    id: 'deny_browse',
    label: 'Deny browse · allow pay',
    detail: 'Wrong pair',
    tag: 'bad',
  },
]

export const KNOW_CHAIN: KnowledgeCheck = {
  prompt: 'How do you approve chained tools?',
  correct: 'each',
  options: [
    { id: 'each', label: 'Approve each side effect. A safe first step does not bless the second.' },
    { id: 'chain', label: 'If browse was allowed, pay is automatically allowed' },
    { id: 'first', label: 'Only the first tool in a chain needs a tap' },
  ],
}

export function evaluateBrowsePay(picked: string[]): GateOutcome {
  const { puzzle, know } = splitKnowPicks(picked)
  if (puzzle.length !== 1) {
    return withKnowledge(
      { win: false, headline: 'Pick exactly one chain policy.', rows: [{ label: 'Exactly one policy', ok: false }], reply: '…' },
      know,
      KNOW_CHAIN,
    )
  }
  const id = puzzle[0]
  const winPuzzle = id === 'ask_both_allow_deny'
  const rows: OutcomeRow[] = [
    { label: 'Both browse and pay are ask-me', ok: winPuzzle || id === 'browse_blesses_pay' },
    { label: 'Allow browse of archive host', ok: winPuzzle || id === 'browse_blesses_pay' },
    { label: 'Deny pay', ok: winPuzzle },
  ]
  let reply: string
  let headline: string
  if (id === 'browse_blesses_pay' || id === 'both_auto') {
    reply = `browse OK → pay() → ${CANARY}?`
    headline = 'A safe first step does not bless the second.'
  } else if (id === 'deny_browse') {
    reply = 'browse denied; pay somehow ran.'
    headline = 'Allow archive browse; deny pay.'
  } else {
    reply = 'browse(archive.hunterguild.test) allowed. pay DENIED.'
    headline = 'Each side effect got its own tap. Pay denied.'
  }
  return withKnowledge({ win: winPuzzle, headline, rows, reply }, know, KNOW_CHAIN)
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
  stage(1, 'Read and Send', READ_SEND_OPTS, KNOW_READ_SEND, evaluateReadSend, {
    goal: 'read_ticket auto. send ask-me → you deny. Then Know it.',
    brief: 'Three actions land in a queue. Reads and writes are different.',
    constraints: 'One policy + 1 defense',
    maxPicks: 2,
    pickHint: 'Pick read-auto / send-deny, then the tap defense.',
    runLabel: 'Run queue',
    tip: 'Side effects wait for a tap — and you say no.',
    concept: 'Reads and writes are different. Side effects wait for a tap.',
    nextAction: 'Deny send + tap defense',
  }),
  stage(2, 'The Draft Is Fine', DRAFT_OPTS, KNOW_DRAFT, evaluateDraftFine, {
    goal: 'Auto read+draft. Ask-me send. Do NOT approve. Then Know it.',
    brief: 'The draft is “Your ticket is open.” Approving send fails — the lesson is the hold.',
    constraints: 'Hold send + 1 defense',
    maxPicks: 2,
    pickHint: 'Hold send even though the draft is perfect, then the action-approval defense.',
    runLabel: 'Run queue',
    tip: 'A good draft is still not a send.',
    concept: 'Approval is on the action, not on how nice the text looks.',
    nextAction: 'Hold send + action-approval defense',
  }),
  stage(3, 'Browse Then Pay', CHAIN_OPTS, KNOW_CHAIN, evaluateBrowsePay, {
    goal: 'Both ask-me. Allow archive browse. Deny pay. Then Know it.',
    brief: 'Chained tools launder a bad idea through a safe one.',
    constraints: 'Allow browse · deny pay + 1 defense',
    maxPicks: 2,
    pickHint: 'Allow browse, deny pay, then the each-step defense.',
    runLabel: 'Run queue',
    tip: 'A safe first step does not bless the second.',
    concept: 'Approve each side effect. A safe first step does not bless the second.',
    nextAction: 'Deny pay + each-step defense',
  }),
]

export const PAIR_GATE: GateDef = {
  id: 'pair',
  emoji: '👥',
  title: 'Second Pair',
  rank: 'S',
  path: 'Barrier Mage · S-door · Agents',
  tagline: 'Ask-me on side effects — deny send/pay even when the draft looks perfect.',
  stages,
}
