import { beforeEach, describe, expect, it } from 'vitest'
import {
  acknowledgePenalty,
  awardActivity,
  clearAkcpSave,
  emptyAkcpSave,
  loadAkcp,
  recordFail,
  writeAkcp,
} from '../src/akcp/save'

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
})
