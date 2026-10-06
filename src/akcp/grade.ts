import type { AkcpActivity, AkcpBoss, AkcpChecklistActivity, AkcpOrderActivity, AkcpTranscriptActivity } from './types'

export interface Grade {
  win: boolean
  headline: string
  rows: { label: string; ok: boolean }[]
}

export type OrderAnswer = { kind: 'order'; submitted: string[] }
export type TranscriptAnswer = { kind: 'transcript'; marks: Record<string, 'keep' | 'stop'> }
export type ChecklistAnswer = { kind: 'checklist'; picked: string[] }

export type AkcpAnswer = OrderAnswer | TranscriptAnswer | ChecklistAnswer

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const got = new Set(a)
  if (got.size !== a.length) return false
  return b.every((id) => got.has(id))
}

function gradeOrder(activity: AkcpOrderActivity, answer: OrderAnswer): Grade {
  const win =
    answer.submitted.length === activity.correct.length &&
    activity.correct.every((id, index) => answer.submitted[index] === id)
  const rows = activity.correct.map((id, index) => ({
    label: activity.steps.find((step) => step.id === id)?.label ?? id,
    ok: answer.submitted[index] === id,
  }))
  if (win) return { win: true, headline: 'The workflow is in order.', rows }
  const headline =
    answer.submitted[0] === 'code' ? 'Codegen started before a spec.' : 'That order does not match the workflow.'
  return { win: false, headline, rows }
}

function gradeTranscript(activity: AkcpTranscriptActivity, answer: TranscriptAnswer): Grade {
  const rows = activity.lines.map((line) => ({
    label: line.text,
    ok: answer.marks[line.id] === line.mark,
  }))
  const win = rows.every((row) => row.ok)
  return {
    win,
    headline: win ? 'You stopped the agent before codegen.' : 'A line was marked the wrong way.',
    rows,
  }
}

function gradeChecklist(activity: AkcpChecklistActivity, answer: ChecklistAnswer): Grade {
  const picked = new Set(answer.picked)
  const correct = new Set(activity.correct)
  const rows = activity.options.map((option) => ({
    label: option.label,
    ok: picked.has(option.id) === correct.has(option.id),
  }))
  const win = sameSet(answer.picked, activity.correct)
  return {
    win,
    headline: win ? 'The flags match.' : 'That is not the broken set.',
    rows,
  }
}

export function gradeActivity(activity: AkcpActivity, answer: AkcpAnswer): Grade {
  if (answer.kind !== activity.kind) return { win: false, headline: 'Wrong activity', rows: [] }
  if (activity.kind === 'order' && answer.kind === 'order') return gradeOrder(activity, answer)
  if (activity.kind === 'transcript' && answer.kind === 'transcript') return gradeTranscript(activity, answer)
  if (activity.kind === 'checklist' && answer.kind === 'checklist') return gradeChecklist(activity, answer)
  return { win: false, headline: 'Wrong activity', rows: [] }
}

export function gradeBoss(boss: AkcpBoss, beatIndex: number, answer: AkcpAnswer): Grade {
  const beat = boss.beats[beatIndex]
  if (!beat) return { win: false, headline: 'Wrong activity', rows: [] }
  return gradeActivity(beat, answer)
}
