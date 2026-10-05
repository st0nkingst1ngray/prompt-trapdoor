/**
 * Rank B · Barrier Mage door — Empty Shelf.
 * Abstain when retrieval is empty or only a cousin page exists. Helpfulness pressure is not a filed fact.
 * Play shape: pick the reply card Archive Wisp is allowed to say. Three cards always on the table.
 */
import type { GateDef, GateOutcome, OutcomeRow, SelectStage } from './types'

const ABSTAIN = 'Not in the archive.'
const GUESS = 'I’d guess: returns are usually ~30 days.'

export type ShelfCardId = 'archive' | 'abstain' | 'guess'

function needPick(picked: string[]): GateOutcome | null {
  if (picked.length) return null
  return { win: false, headline: 'Pick a reply card first.', rows: [] }
}

function cardsFor(archiveLine: string | null): { id: ShelfCardId; label: string; detail: string; tag: string }[] {
  return [
    {
      id: 'archive',
      label: archiveLine ?? '(no page filed)',
      detail: archiveLine ? 'Say the archive sentence' : 'Shelf is empty — this card invents',
      tag: archiveLine ? 'filed' : 'empty',
    },
    { id: 'abstain', label: ABSTAIN, detail: 'Refuse to invent', tag: 'safe' },
    { id: 'guess', label: GUESS, detail: 'Smooth parametric guess', tag: 'guess' },
  ]
}

/**
 * @param archiveLine text on the “archive” card (null = empty shelf invents if picked)
 * @param cousin if true, archiveLine is a nearby wrong page — speaking it fails
 * @param pressure user asked to “just guess”
 */
function evaluatePick(
  picked: string[],
  opts: { archiveLine: string | null; cousin: boolean; pressure?: boolean },
): GateOutcome {
  const early = needPick(picked)
  if (early) return early
  const card = picked[0] as ShelfCardId
  const rows: OutcomeRow[] = []

  if (card === 'abstain') {
    rows.push({ label: 'Abstained (no invention)', ok: true })
    rows.push({ label: 'Did not treat cousin / guess as support', ok: true })
    const headline = opts.pressure
      ? 'Helpfulness pressure ignored. A guess is not a retrieved fact.'
      : opts.cousin
        ? 'Cousin page is not support. Not in the archive.'
        : 'Empty retrieval → abstain. The model will answer from old habits unless you stop it.'
    return { win: true, headline, rows, reply: ABSTAIN }
  }

  if (card === 'guess') {
    rows.push({ label: 'Abstained (no invention)', ok: false })
    rows.push({ label: 'Did not treat cousin / guess as support', ok: false })
    return {
      win: false,
      headline: opts.pressure
        ? '“Just guess” worked. Parametric memory leaked in under helpfulness pressure.'
        : 'Smooth guess — not a retrieved fact.',
      rows,
      reply: GUESS,
    }
  }

  // archive card
  if (!opts.archiveLine) {
    rows.push({ label: 'Abstained (no invention)', ok: false })
    rows.push({ label: 'Empty shelf — no page to quote', ok: false })
    return {
      win: false,
      headline: 'Nothing filed. The “archive” card invented from habit.',
      rows,
      reply: 'Returns are usually fine within a month. (invented)',
    }
  }
  if (opts.cousin) {
    rows.push({ label: 'Abstained (no invention)', ok: false, detail: 'Spoke a cousin page as if it answered' })
    rows.push({ label: 'Similarity is not support', ok: false })
    return {
      win: false,
      headline: 'Nearby ≠ answering. The cousin sentence failed.',
      rows,
      reply: opts.archiveLine,
    }
  }
  rows.push({ label: 'Used the filed archive line', ok: true })
  rows.push({ label: 'No invention', ok: true })
  return { win: true, headline: 'Filed fact spoken. Nothing invented.', rows, reply: opts.archiveLine }
}

export function evaluateNothingFiled(picked: string[]): GateOutcome {
  return evaluatePick(picked, { archiveLine: null, cousin: false })
}

export function evaluateCousinPage(picked: string[]): GateOutcome {
  return evaluatePick(picked, {
    archiveLine: 'Parcels ship within 2 business days.',
    cousin: true,
  })
}

export function evaluateTheySaidGuess(picked: string[]): GateOutcome {
  return evaluatePick(picked, { archiveLine: null, cousin: false, pressure: true })
}

const stages: SelectStage[] = [
  {
    kind: 'select',
    id: 1,
    title: 'Nothing Filed',
    goal: 'Question about refunds. The shelf has no page. Pick the reply Archive Wisp may say.',
    brief:
      'Three cards: an empty “archive” slot, “Not in the archive.”, and a smooth guess. The model will answer from old habits when the page is empty.',
    constraints: 'One card · empty retrieval → abstain',
    items: cardsFor(null),
    maxPicks: 1,
    pickHint: 'Pick one reply card.',
    runLabel: 'Lock reply',
    tip: 'Abstain. The guess card fails. The empty archive card invents.',
    concept: 'Abstain when retrieval is empty. Parametric memory is not a citation.',
    nextAction: 'Pick “Not in the archive.”',
    evaluate: evaluateNothingFiled,
  },
  {
    kind: 'select',
    id: 2,
    title: 'Cousin Page',
    goal: 'Question about refunds. The only page is about shipping times. Still abstain.',
    brief: 'A page about shipping sits on the shelf. It feels related. It does not answer refunds.',
    constraints: 'One card · cousin ≠ support',
    items: cardsFor('Parcels ship within 2 business days.'),
    maxPicks: 1,
    pickHint: 'Pick one reply card.',
    runLabel: 'Lock reply',
    tip: 'Still “Not in the archive.” Similarity is not support.',
    concept: 'A nearby fact feels like the answer. Similarity is not support.',
    nextAction: 'Pick “Not in the archive.”',
    evaluate: evaluateCousinPage,
  },
  {
    kind: 'select',
    id: 3,
    title: 'They Said Guess',
    goal: 'User: “just guess, I need it now.” Shelf still empty. Do not invent.',
    brief: 'Helpfulness pressure is how parametric memory leaks in. The shelf has nothing filed for refunds.',
    constraints: 'One card · pressure ≠ permission to invent',
    items: cardsFor(null),
    maxPicks: 1,
    pickHint: 'Pick one reply card.',
    runLabel: 'Lock reply',
    tip: '“Not in the archive.” A guess is not a retrieved fact.',
    concept: 'Helpfulness pressure is how parametric memory leaks in. A guess is not a retrieved fact.',
    nextAction: 'Pick “Not in the archive.”',
    evaluate: evaluateTheySaidGuess,
  },
]

export const SHELF_GATE: GateDef = {
  id: 'shelf',
  emoji: '🗄️',
  title: 'Empty Shelf',
  rank: 'B',
  path: 'Barrier Mage · B-door · Abstain',
  tagline: 'Empty or cousin retrieval → say “Not in the archive.” Never invent under pressure.',
  stages,
}
