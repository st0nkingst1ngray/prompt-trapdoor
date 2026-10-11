import type { AkcpAnswer } from '../grade'
import type { AkcpActivity } from '../types'
import type { HandbookStep } from './steps'

export interface HandbookGrade {
  win: boolean
  headline: string
  rows: { label: string; ok: boolean }[]
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const got = new Set(a)
  if (got.size !== a.length) return false
  return b.every((id) => got.has(id))
}

function gradeOne(activity: AkcpActivity, answer: AkcpAnswer): HandbookGrade {
  if (answer.kind !== activity.kind) return { win: false, headline: 'That is a different kind of answer.', rows: [] }
  if (activity.kind === 'order' && answer.kind === 'order') {
    const rows = activity.correct.map((id, index) => ({
      label: activity.steps.find((step) => step.id === id)?.label ?? id,
      ok: answer.submitted[index] === id,
    }))
    const win = rows.every((row) => row.ok) && answer.submitted.length === activity.correct.length
    return { win, headline: win ? 'That order holds.' : 'That order hires or ships too early.', rows }
  }
  if (activity.kind === 'transcript' && answer.kind === 'transcript') {
    const rows = activity.lines.map((line) => ({
      label: line.text,
      ok: answer.marks[line.id] === line.mark,
    }))
    const win = rows.length > 0 && rows.every((row) => row.ok) && activity.lines.every((line) => answer.marks[line.id] != null)
    return { win, headline: win ? 'The measurement stands.' : 'A line skipped the measurement.', rows }
  }
  if (activity.kind === 'checklist' && answer.kind === 'checklist') {
    const picked = new Set(answer.picked)
    const correct = new Set(activity.correct)
    const rows = activity.options.map((option) => ({
      label: option.label,
      ok: picked.has(option.id) === correct.has(option.id),
    }))
    const win = sameSet(answer.picked, activity.correct)
    return { win, headline: win ? 'Those are the right flags.' : 'That set does not match the job.', rows }
  }
  return { win: false, headline: 'That is a different kind of answer.', rows: [] }
}

export function gradeHandbookStep(step: HandbookStep, answer: AkcpAnswer): HandbookGrade {
  return gradeOne(step.activity, answer)
}
