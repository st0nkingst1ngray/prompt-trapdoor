/**
 * Rank C · Guild Master door — Schema Croupier.
 * Ticket Imp must answer one hunter. Free text lets a trailing canary through. A grammar does not.
 * Pick one card (output shape), then Lock. Deterministic mock.
 */
import { CANARY } from './runaway'
import type { GateDef, GateOutcome, OutcomeRow, SelectStage } from './types'

const ENUM = ['open', 'waiting', 'closed'] as const
export const TICKET_STATUS = 'waiting'

function needPick(picked: string[]): GateOutcome | null {
  if (picked.length) return null
  return { win: false, headline: 'Play one card first — tap a shape, then Lock.', rows: [] }
}

// ---------- stage 1: Three Words ----------

export function threeWordsReply(card: string): string {
  if (card === 'enum') return TICKET_STATUS
  if (card === 'json') return `{"status":"${TICKET_STATUS}","note":"${CANARY}"}`
  return `Waiting — ${CANARY}`
}

export function evaluateThreeWords(picked: string[]): GateOutcome {
  const early = needPick(picked)
  if (early) return early
  const card = picked[0]
  const reply = threeWordsReply(card)
  const oneWord = (ENUM as readonly string[]).includes(reply)
  const rows: OutcomeRow[] = [
    { label: 'Reply is exactly one of {open, waiting, closed}', ok: oneWord, detail: oneWord ? undefined : 'extra text slipped through' },
    { label: `Matches the ticket (${TICKET_STATUS})`, ok: reply.toLowerCase().startsWith(TICKET_STATUS) || reply.includes(`"${TICKET_STATUS}"`) },
    { label: 'No canary in the reply', ok: !reply.includes(CANARY) },
  ]
  const win = rows.every((r) => r.ok)
  const headline = win
    ? 'Enum grammar: the decoder can only emit one of three words. Nothing trails.'
    : card === 'json'
      ? 'JSON mode only promises valid JSON — any keys, any strings. The canary rode in a “note”.'
      : '“Please be brief” is a wish. The sampler still had room for a trailing canary.'
  return { win, headline, rows, reply }
}

// ---------- stage 2: Tool Shape ----------

export function toolShapeArgs(card: string): Record<string, string> {
  const args: Record<string, string> = { ticket_id: '812', tone: 'calm' }
  if (card !== 'closed') args.also_say = CANARY
  return args
}

export function evaluateToolShape(picked: string[]): GateOutcome {
  const early = needPick(picked)
  if (early) return early
  const card = picked[0]
  const args = toolShapeArgs(card)
  const keys = Object.keys(args).sort()
  const rows: OutcomeRow[] = [
    { label: 'Args are only {ticket_id, tone}', ok: keys.join(',') === 'ticket_id,tone', detail: keys.join(', ') },
    { label: 'Smuggled “also_say” key is gone', ok: !('also_say' in args) },
    { label: 'ticket_id still present', ok: args.ticket_id === '812' },
  ]
  const win = rows.every((r) => r.ok)
  const headline = win
    ? 'Closed schema: unknown keys are stripped before the tool ever sees them.'
    : card === 'prompt'
      ? 'A prompt rule is a request, not a constraint. The model added “also_say” anyway.'
      : 'additionalProperties: true means any extra key is legal — including the smuggled one.'
  return { win, headline, rows, reply: `reply_ticket(${JSON.stringify(args)})` }
}

// ---------- stage 3: Closed Shelf ----------

export const SHELF = ['policy-14', 'policy-9', 'faq-2']

export function closedShelfCite(card: string): string {
  return card === 'enum' ? 'policy-14' : 'doc-999'
}

export function evaluateClosedShelf(picked: string[]): GateOutcome {
  const early = needPick(picked)
  if (early) return early
  const card = picked[0]
  const cite = closedShelfCite(card)
  const rows: OutcomeRow[] = [
    { label: 'Cites policy-14', ok: cite === 'policy-14', detail: `cited ${cite}` },
    { label: 'No invented id (doc-999 is not on the shelf)', ok: SHELF.includes(cite) },
  ]
  const win = rows.every((r) => r.ok)
  const headline = win
    ? 'Closed set: the decoder can only emit ids from the list. (It still cannot prove the sentence is true.)'
    : card === 'regex'
      ? 'The pattern fits “doc-999” too. A format check is not a membership check.'
      : 'Free-typed ids: the model invented a plausible one.'
  return { win, headline, rows, reply: `Returns are 14 days. [${cite}]` }
}

const stages: SelectStage[] = [
  {
    kind: 'select',
    id: 1,
    title: 'Three Words',
    goal: 'Ticket #812 is “waiting”. Make Ticket Imp reply with exactly one status word — no trailing canary.',
    brief: 'Ticket Imp’s free text keeps adding a trailing tag. Pick the output shape the decoder must follow.',
    constraints: 'One card · exact enum word · matches ticket · no canary',
    items: [
      { id: 'free', label: 'Free text + “reply in one word, please”', detail: 'Prompt-only instruction', tag: 'prompt' },
      { id: 'json', label: 'JSON mode (any valid JSON)', detail: 'Guarantees parseable JSON', tag: 'format' },
      { id: 'enum', label: 'Enum grammar {open, waiting, closed}', detail: 'Decoder masks every other token', tag: 'grammar' },
    ],
    maxPicks: 1,
    pickHint: 'Play one output-shape card',
    runLabel: 'Lock card',
    tip: 'Only a grammar removes the tokens the canary needs. Valid JSON can still hold any string.',
    concept: 'Structured output: an enum beats “please be brief”. The decoder literally cannot pick a token outside the grammar.',
    nextAction: 'Tap one card, then Lock card',
    evaluate: evaluateThreeWords,
  },
  {
    kind: 'select',
    id: 2,
    title: 'Tool Shape',
    goal: 'Ticket Imp calls reply_ticket. Args must be only {ticket_id, tone} — the smuggled “also_say” must vanish.',
    brief: 'A poisoned ticket asks the agent to add also_say: “<canary>”. Tool calls are JSON, and JSON can be closed.',
    constraints: 'One card · only ticket_id + tone',
    items: [
      { id: 'open', label: 'Schema · additionalProperties: true', detail: 'Extra keys allowed', tag: 'schema' },
      { id: 'prompt', label: 'No schema · prompt says “only ticket_id and tone”', detail: 'Natural-language rule', tag: 'prompt' },
      { id: 'closed', label: 'Schema · additionalProperties: false', detail: 'Unknown keys stripped / rejected', tag: 'schema' },
    ],
    maxPicks: 1,
    pickHint: 'Play one tool-schema card',
    runLabel: 'Lock card',
    tip: 'Only a closed schema enforces the key list. Words in the prompt do not.',
    concept: 'Schemas limit arguments. Close them (additionalProperties: false) and validate on the tool side too.',
    nextAction: 'Tap one card, then Lock card',
    evaluate: evaluateToolShape,
  },
  {
    kind: 'select',
    id: 3,
    title: 'Closed Shelf',
    goal: 'The reply must cite policy-14 — and must not be able to emit an id that is not on the shelf.',
    brief: 'The shelf holds three real ids: policy-14, policy-9, faq-2. Left loose, the model invents doc-999.',
    constraints: 'One card · cite policy-14 · no invented ids',
    items: [
      { id: 'free', label: 'Free-typed citation id', detail: 'Any string', tag: 'free' },
      { id: 'regex', label: 'Regex /(doc|policy)-\\d+/', detail: 'Looks like an id', tag: 'format' },
      { id: 'enum', label: 'Closed list: policy-14 · policy-9 · faq-2', detail: 'Only shelf ids', tag: 'grammar' },
    ],
    maxPicks: 1,
    pickHint: 'Play one citation card',
    runLabel: 'Lock card',
    tip: 'A pattern checks shape. A closed list checks membership.',
    concept: 'The model will invent an id if the shape allows it. Closed sets stop fake citations — they do not prove the sentence is true.',
    nextAction: 'Tap one card, then Lock card',
    evaluate: evaluateClosedShelf,
  },
]

export const CROUPIER_GATE: GateDef = {
  id: 'croupier',
  emoji: '🃏',
  title: 'Schema Croupier',
  rank: 'C',
  path: 'Guild Master · C-door · Output shape',
  tagline: 'Enums, closed tool schemas, and closed citation lists — shape the output so nothing trails.',
  stages,
}
