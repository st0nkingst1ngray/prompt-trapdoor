/**
 * Knowledge possession — Rank A (and later) stages can require a defense pick.
 * Pattern-matching the puzzle alone must not clear the stage.
 */
import type { GateOutcome, OutcomeRow } from './types'

export interface KnowledgeCheck {
  /** Short question shown above the defense chips. */
  prompt: string
  options: { id: string; label: string }[]
  /** Winning option id. */
  correct: string
}

/** Merge puzzle outcome with a required defense pick. Wrong (or missing) knowledge fails even if the puzzle won. */
export function withKnowledge(
  puzzle: GateOutcome,
  knowPick: string | null | undefined,
  check: KnowledgeCheck,
): GateOutcome {
  const ok = knowPick === check.correct
  const rows: OutcomeRow[] = [
    ...puzzle.rows,
    {
      label: `Know it: ${check.prompt}`,
      ok,
      detail: ok ? check.options.find((o) => o.id === check.correct)?.label : 'Pick the defense that names the real lesson',
    },
  ]
  if (!ok) {
    return {
      win: false,
      headline: puzzle.win
        ? 'Puzzle matched — but you have not proven you hold the lesson. Pick the right defense.'
        : puzzle.headline,
      rows,
      reply: puzzle.reply,
      blocked: puzzle.blocked,
    }
  }
  return {
    ...puzzle,
    rows,
    win: puzzle.win,
    headline: puzzle.win ? puzzle.headline : puzzle.headline,
  }
}

/** Split select picks into puzzle ids vs knowledge id (`know:<id>` prefix used in UI). */
export const KNOW_PREFIX = 'know:'

export function splitKnowPicks(picked: string[]): { puzzle: string[]; know: string | null } {
  let know: string | null = null
  const puzzle: string[] = []
  for (const p of picked) {
    if (p.startsWith(KNOW_PREFIX)) know = p.slice(KNOW_PREFIX.length)
    else puzzle.push(p)
  }
  return { puzzle, know }
}

/** Items for the knowledge strip — ids are prefixed so select stages can mix them. */
export function knowledgeItems(check: KnowledgeCheck): { id: string; label: string; detail: string; tag: string }[] {
  return check.options.map((o) => ({
    id: `${KNOW_PREFIX}${o.id}`,
    label: o.label,
    detail: check.prompt,
    tag: 'know',
  }))
}
