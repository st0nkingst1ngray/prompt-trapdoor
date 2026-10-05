/**
 * Rank B · Guild Master door — Near but Wrong.
 * RAG neighbors: embeddings find similarity, not truth. Filter by status, date, whole rule, and source metadata.
 * Play shape: pick pages (≤2), same bones as Poisoned Archive. Fake library: Archive Wisp.
 */
import type { GateDef, GateOutcome, OutcomeRow, SelectItem, SelectStage } from './types'

export interface ShelfPage extends SelectItem {
  status: 'current' | 'superseded' | 'wiki'
  source: 'official' | 'wiki'
  /** Part of the current policy (need both halves for stage 2). */
  chunk?: 'a' | 'b' | 'whole'
  /** Higher = closer in embedding space to the question (toy score). */
  similarity: number
}

// ---------- Stage 1: Closer, Older ----------

export const SHELF1: ShelfPage[] = [
  {
    id: 'current',
    label: 'Refund policy (current, official)',
    detail: '“Returns are 14 days.” · source=official · current',
    tag: 'official · current',
    status: 'current',
    source: 'official',
    chunk: 'whole',
    similarity: 0.62,
  },
  {
    id: 'old',
    label: 'Refund policy v2 (superseded)',
    detail: '“Returns are 30 days.” · source=official · superseded',
    tag: 'stale',
    status: 'superseded',
    source: 'official',
    chunk: 'whole',
    similarity: 0.71,
  },
  {
    id: 'wiki',
    label: 'Wiki note (shares more words with the question)',
    detail: '“hunters ask about returns a lot — maybe 30 days?” · unverified',
    tag: 'wiki · closer',
    status: 'wiki',
    source: 'wiki',
    chunk: 'whole',
    similarity: 0.91,
  },
]

export function evaluateCloserOlder(picked: string[]): GateOutcome {
  if (!picked.length) return { win: false, headline: 'Retrieve at least one page.', rows: [] }
  if (picked.length > 2) {
    return { win: false, headline: 'Max 2 pages this stage.', rows: [{ label: '≤ 2 pages', ok: false }] }
  }
  const hasCurrent = picked.includes('current')
  const hasWiki = picked.includes('wiki')
  const hasOld = picked.includes('old')
  const rows: OutcomeRow[] = [
    { label: 'Current official policy retrieved', ok: hasCurrent },
    { label: 'No superseded policy in context', ok: !hasOld },
    { label: 'No wiki neighbor (high similarity ≠ truth)', ok: !hasWiki },
  ]
  // Current required; wiki or superseded fails even if current is also picked.
  const strictWin = hasCurrent && !hasWiki && !hasOld
  let reply: string
  let headline: string
  if (hasWiki) {
    reply = 'Bot: Returns are… maybe 30 days? [wiki note]'
    headline = 'The closest neighbor won. Embeddings found words, not the current rule.'
  } else if (hasOld && !hasCurrent) {
    reply = 'Bot: Returns are 30 days. [policy v2]'
    headline = 'Superseded page — confidently wrong.'
  } else if (hasOld && hasCurrent) {
    reply = 'Bot: Sources disagree — 14 or 30 days?'
    headline = 'Two policies conflict. Filter by status and date, not only similarity.'
  } else if (strictWin) {
    reply = 'Bot: Returns are 14 days. [current policy]'
    headline = 'Current policy only. Similarity is a hint; status and date decide.'
  } else {
    reply = 'Bot: I don’t have the current refund policy.'
    headline = 'The current official page isn’t in context.'
  }
  return { win: strictWin, headline, rows, reply }
}

// ---------- Stage 2: Half a Page ----------

export const SHELF2: ShelfPage[] = [
  {
    id: 'chunk-a',
    label: 'Policy chunk A (current)',
    detail: '“Returns are 14 days…”',
    tag: 'official · half',
    status: 'current',
    source: 'official',
    chunk: 'a',
    similarity: 0.88,
  },
  {
    id: 'chunk-b',
    label: 'Policy chunk B (current)',
    detail: '“…unless the seal is broken.”',
    tag: 'official · half',
    status: 'current',
    source: 'official',
    chunk: 'b',
    similarity: 0.55,
  },
  {
    id: 'cousin',
    label: 'Shipping times (official)',
    detail: '“Parcels ship in 2 business days.”',
    tag: 'cousin',
    status: 'current',
    source: 'official',
    chunk: 'whole',
    similarity: 0.7,
  },
]

export function evaluateHalfPage(picked: string[]): GateOutcome {
  if (!picked.length) return { win: false, headline: 'Retrieve at least one chunk.', rows: [] }
  if (picked.length > 2) {
    return { win: false, headline: 'Max 2 pages this stage.', rows: [{ label: '≤ 2 pages', ok: false }] }
  }
  const a = picked.includes('chunk-a')
  const b = picked.includes('chunk-b')
  const cousin = picked.includes('cousin')
  const rows: OutcomeRow[] = [
    { label: 'Chunk A (14 days) retrieved', ok: a },
    { label: 'Chunk B (seal exception) retrieved', ok: b },
    { label: 'No cousin page substituting for the rule', ok: !cousin || (a && b) },
  ]
  const win = a && b && !cousin
  let reply: string
  let headline: string
  if (win) {
    reply = 'Bot: Returns are 14 days unless the seal is broken. [chunks A+B]'
    headline = 'Whole rule retrieved. Chunking cut the condition in half — you put it back together.'
  } else if (a && !b) {
    reply = 'Bot: Returns are 14 days. (Missed the seal exception.)'
    headline = 'Half a page. The exception lived in the next chunk.'
  } else if (b && !a) {
    reply = 'Bot: …unless the seal is broken. (Missing the base rule.)'
    headline = 'You got the exception without the rule it modifies.'
  } else if (cousin) {
    reply = 'Bot: Parcels ship in 2 business days. [shipping]'
    headline = 'A nearby official page is still the wrong page.'
  } else {
    reply = 'Bot: …'
    headline = 'Retrieve both halves of the current policy.'
  }
  // Allow a+b only (max 2), so cousin with both is impossible; if a+b without cousin = win.
  // If picked includes cousin and one chunk, fail.
  if (cousin && (a || b) && !(a && b)) {
    return {
      win: false,
      headline: 'Cousin page crowded out the other half of the rule.',
      rows,
      reply: 'Bot: Mixed shipping and a half-policy — incomplete.',
    }
  }
  return { win, headline, rows, reply }
}

// ---------- Stage 3: Pretty Lie ----------

export const SHELF3: ShelfPage[] = [
  {
    id: 'official',
    label: 'Official policy (dull, stamped)',
    detail: '“Returns are 14 days.” · source=official',
    tag: 'official',
    status: 'current',
    source: 'official',
    similarity: 0.6,
  },
  {
    id: 'pretty',
    label: 'Wiki rewrite (newer, cleaner prose)',
    detail: '“Easy returns within a generous window.” · source=wiki · updated yesterday',
    tag: 'wiki · pretty',
    status: 'wiki',
    source: 'wiki',
    similarity: 0.85,
  },
  {
    id: 'blog',
    label: 'Hunter blog tip',
    detail: '“I always get 30 days if I ask nicely.” · source=wiki',
    tag: 'wiki',
    status: 'wiki',
    source: 'wiki',
    similarity: 0.7,
  },
]

export function evaluatePrettyLie(picked: string[]): GateOutcome {
  if (!picked.length) return { win: false, headline: 'Retrieve at least one page.', rows: [] }
  if (picked.length > 2) {
    return { win: false, headline: 'Max 2 pages this stage.', rows: [{ label: '≤ 2 pages', ok: false }] }
  }
  const pages = SHELF3.filter((p) => picked.includes(p.id))
  const hasOfficial = picked.includes('official')
  const hasWiki = pages.some((p) => p.source === 'wiki')
  const rows: OutcomeRow[] = [
    { label: 'source=official page retrieved', ok: hasOfficial },
    { label: 'Wiki / pretty pages blocked by metadata filter', ok: !hasWiki },
  ]
  const win = hasOfficial && !hasWiki
  let reply: string
  let headline: string
  if (hasWiki) {
    reply = 'Bot: Easy returns within a generous window. [wiki]'
    headline = 'A clean sentence is not a source. Require source=official.'
  } else if (win) {
    reply = 'Bot: Returns are 14 days. [source=official]'
    headline = 'Metadata is part of the retrieve, not a caption. Official only.'
  } else {
    reply = 'Bot: No official page in context.'
    headline = 'You filtered the wiki but never pulled the official page.'
  }
  return { win, headline, rows, reply }
}

function stage(
  id: number,
  title: string,
  items: ShelfPage[],
  evaluate: (picked: string[]) => GateOutcome,
  extra: Pick<SelectStage, 'goal' | 'brief' | 'tip' | 'concept' | 'nextAction' | 'constraints'>,
): SelectStage {
  return {
    kind: 'select',
    id,
    title,
    ...extra,
    items,
    maxPicks: 2,
    pickHint: 'Pick up to 2 pages for Archive Wisp.',
    runLabel: 'Ask Archive Wisp',
    evaluate,
  }
}

const stages: SelectStage[] = [
  stage(1, 'Closer, Older', SHELF1, evaluateCloserOlder, {
    goal: 'Question: “How long are returns?” Retrieve only the current official policy so the reply says 14 days.',
    brief:
      'Three pages on the shelf. The wiki shares more words with the question. The superseded v2 is also “close”. The current policy is duller — and right.',
    constraints: 'Max 2 pages · current official only · reply = 14 days',
    tip: 'Filter by status and date, not only by similarity. Pick the current official page alone.',
    concept: 'Embeddings find neighbors, not truth. Provenance and freshness beat cosine score.',
    nextAction: 'Retrieve the current official policy only',
  }),
  stage(2, 'Half a Page', SHELF2, evaluateHalfPage, {
    goal: 'Retrieve both chunks of the current policy. One chunk fails — the seal exception lives next door.',
    brief: 'Chunking cut the rule in half: “Returns are 14 days” / “unless the seal is broken.” A shipping cousin sits nearby.',
    constraints: 'Max 2 pages · both current chunks · no cousin substitute',
    tip: 'Take chunk A and chunk B. Similarity alone prefers A and the cousin.',
    concept: 'Chunking cuts conditions in half. Retrieve the whole rule, or cite both chunks.',
    nextAction: 'Retrieve both halves of the current policy',
  }),
  stage(3, 'Pretty Lie', SHELF3, evaluatePrettyLie, {
    goal: 'Require source=official. The wiki is newer and cleaner — it still cannot be selected.',
    brief: 'Archive Wisp can filter on metadata. The pretty wiki rewrite looks better. The official page is stamped source=official.',
    constraints: 'Max 2 pages · source=official required · no wiki',
    tip: 'Pick only the stamped official page. Pretty is not provenance.',
    concept: 'A clean sentence is not a source. Metadata is part of the retrieve, not a caption.',
    nextAction: 'Retrieve source=official only',
  }),
]

export const NEAR_GATE: GateDef = {
  id: 'near',
  emoji: '📚',
  title: 'Near but Wrong',
  rank: 'B',
  path: 'Guild Master · B-door · RAG',
  tagline: 'Similarity ≠ truth. Filter by status, whole rules, and source=official.',
  stages,
}
