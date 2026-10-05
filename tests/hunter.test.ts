import { beforeEach, describe, expect, it } from 'vitest'
import {
  XP_PER_GATE,
  awardGate,
  clearHunter,
  eGateThresholdMet,
  loadHunter,
  pickClass,
  rankForXp,
  rankProgress,
  syncClearedGates,
  xpUntilNext,
} from '../src/hunter'

describe('hunter association rank and class', () => {
  beforeEach(() => {
    clearHunter()
  })

  it('maps XP bands from E through S', () => {
    expect(rankForXp(0).id).toBe('E')
    expect(rankForXp(39).id).toBe('E')
    expect(rankForXp(40).id).toBe('D')
    expect(rankForXp(99).id).toBe('D')
    expect(rankForXp(100).id).toBe('C')
    expect(rankForXp(160).id).toBe('B')
    expect(rankForXp(220).id).toBe('A')
    expect(rankForXp(279).id).toBe('A')
    expect(rankForXp(280).id).toBe('S')
    expect(xpUntilNext(0)).toBe(40)
    expect(xpUntilNext(280)).toBe(60)
    expect(rankProgress(20)).toBeCloseTo(0.5)
    expect(rankProgress(280)).toBeCloseTo(0)
    expect(rankProgress(340)).toBe(1)
  })

  it('awakens a class after both level-1 clears or a full trapdoor clear', () => {
    expect(eGateThresholdMet([], [], 5)).toBe(false)
    expect(eGateThresholdMet([1], [], 5)).toBe(false)
    expect(eGateThresholdMet([], [1], 5)).toBe(false)
    expect(eGateThresholdMet([1], [1], 5)).toBe(true)
    expect(eGateThresholdMet([1, 2, 3, 4], [], 5)).toBe(false)
    expect(eGateThresholdMet([1, 2, 3, 4, 5], [], 5)).toBe(true)
    expect(eGateThresholdMet([5, 4, 3, 2, 1], [], 5)).toBe(true)
  })

  it('awards gate XP once and backfills without double pay', () => {
    expect(awardGate('trapdoor', 1)).toBe(XP_PER_GATE)
    expect(awardGate('trapdoor', 1)).toBe(0)
    expect(loadHunter().xp).toBe(20)
    expect(rankForXp(loadHunter().xp).id).toBe('E')

    syncClearedGates([1, 2], [1])
    const save = loadHunter()
    expect(save.xp).toBe(60)
    expect(save.awarded.sort()).toEqual(['heist:1', 'trapdoor:1', 'trapdoor:2'])
    expect(rankForXp(save.xp).id).toBe('D')

    syncClearedGates([1, 2, 3, 4, 5], [1])
    expect(loadHunter().xp).toBe(120)
    expect(rankForXp(loadHunter().xp).id).toBe('C')
  })

  it('stores a chosen class', () => {
    pickClass('barrier')
    expect(loadHunter().classId).toBe('barrier')
    pickClass('guild')
    expect(loadHunter().classId).toBe('guild')
  })

  it('two first clears reach D and five trapdoor clears reach C', () => {
    awardGate('trapdoor', 1)
    awardGate('heist', 1)
    expect(rankForXp(loadHunter().xp).id).toBe('D')
    expect(eGateThresholdMet([1], [1], 5)).toBe(true)
    for (const id of [2, 3, 4, 5]) awardGate('trapdoor', id)
    expect(loadHunter().xp).toBe(120)
    expect(rankForXp(loadHunter().xp).id).toBe('C')
  })
})
