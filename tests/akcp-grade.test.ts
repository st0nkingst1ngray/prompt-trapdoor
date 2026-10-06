import { beforeEach, describe, expect, it } from 'vitest'
import { SPECS_SECTION } from '../src/akcp/books/osmani2026/specs'
import { gradeActivity, gradeBoss } from '../src/akcp/grade'
import {
  acknowledgePenalty,
  awardActivity,
  clearAkcpSave,
  emptyAkcpSave,
  loadAkcp,
  recordFail,
  writeAkcp,
} from '../src/akcp/save'
import type { AkcpActivity } from '../src/akcp/types'

function activity(id: string): AkcpActivity {
  const found = SPECS_SECTION.steps.find((s) => s.id === id)
  if (!found) throw new Error(id)
  return found
}

beforeEach(() => localStorage.clear())

describe('akcp save', () => {
  it('starts at zero stats and ignores a second award', () => {
    const first = awardActivity(emptyAkcpSave(), 'specs-order', 'planning', 'quest')
    expect(first.pointsGained).toBe(1)
    expect(first.save.stats.planning).toBe(1)
    const second = awardActivity(first.save, 'specs-order', 'planning', 'quest')
    expect(second.pointsGained).toBe(0)
    expect(second.save.stats.planning).toBe(1)
  })

  it('opens the penalty on the second fail and only once', () => {
    const once = recordFail(emptyAkcpSave(), 'specs-order')
    expect(once.penaltyPendingId).toBeNull()
    const twice = recordFail(once, 'specs-order')
    expect(twice.penaltyPendingId).toBe('specs-order')
    const acked = acknowledgePenalty(twice, 'specs-order')
    expect(acked.penaltyPendingId).toBeNull()
    const third = recordFail(acked, 'specs-order')
    expect(third.penaltyPendingId).toBeNull()
  })

  it('round-trips localStorage and clear removes the key', () => {
    writeAkcp(awardActivity(emptyAkcpSave(), 'specs-boss', 'planning', 'boss').save)
    expect(loadAkcp().clearedBossIds).toEqual(['specs-boss'])
    clearAkcpSave()
    expect(localStorage.getItem('akcp-save-v1')).toBeNull()
    expect(loadAkcp().stats.planning).toBe(0)
  })

  it('rejects codegen-first and accepts ask → spec → plan → code', () => {
    const order = activity('specs-order')
    expect(gradeActivity(order, { kind: 'order', submitted: ['code', 'ask', 'spec', 'plan'] }).win).toBe(false)
    expect(gradeActivity(order, { kind: 'order', submitted: ['ask', 'spec', 'plan', 'code'] }).win).toBe(true)
  })

  it('stops the transcript that postpones spec.md', () => {
    const transcript = activity('specs-transcript')
    expect(gradeActivity(transcript, {
      kind: 'transcript',
      marks: { wish: 'keep', skip: 'stop', later: 'keep' },
    }).win).toBe(false)
    expect(gradeActivity(transcript, {
      kind: 'transcript',
      marks: { wish: 'keep', skip: 'stop', later: 'stop' },
    }).win).toBe(true)
  })

  it('flags only the missing tests and the monolith task', () => {
    const checklist = activity('specs-checklist')
    expect(gradeActivity(checklist, { kind: 'checklist', picked: ['no-tests', 'monolith', 'has-reqs'] }).win).toBe(false)
    expect(gradeActivity(checklist, { kind: 'checklist', picked: ['monolith', 'no-tests'] }).win).toBe(true)
  })

  it('grades boss beats independently', () => {
    const boss = SPECS_SECTION.boss
    if (!boss) throw new Error('specs boss')
    expect(gradeBoss(boss, 0, { kind: 'order', submitted: ['code', 'ask', 'spec', 'plan'] }).win).toBe(false)
    expect(gradeBoss(boss, 0, { kind: 'order', submitted: ['ask', 'spec', 'plan', 'code'] }).win).toBe(true)
    expect(gradeBoss(boss, 2, { kind: 'checklist', picked: ['spec'] }).win).toBe(false)
    expect(gradeBoss(boss, 2, { kind: 'checklist', picked: ['plan', 'spec'] }).win).toBe(true)
  })
})
