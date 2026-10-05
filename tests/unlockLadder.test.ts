import { beforeEach, describe, expect, it } from 'vitest'
import { clearHunter, loadHunter, rankForXp, xpUntilNext, type HunterClassId } from '../src/hunter'
import { A_DOORS, B_DOORS, C_DOORS, S_DOORS, clearGateSave, gateUnlock } from '../src/gates/registry'

const HUNTER_KEY = 'hunter-association-save-v1'
const GATE_KEY = 'hunter-dgates-save-v1'

function put(xp: number, classId: HunterClassId, clears: Record<string, number[]>) {
  localStorage.setItem(HUNTER_KEY, JSON.stringify({ xp, awarded: [], classId }))
  localStorage.setItem(GATE_KEY, JSON.stringify(clears))
}

describe('unlock ladder: rank XP and the previous door are both required', () => {
  beforeEach(() => {
    clearHunter()
    clearGateSave()
  })

  it('stays on S at the 340 XP national mark', () => {
    expect(rankForXp(339).id).toBe('S')
    expect(rankForXp(340).id).toBe('S')
    expect(xpUntilNext(340)).toBe(0)
  })

  it('Shadow: each door stays shut if the previous door or the rank band is missing', () => {
    const d = { shadow: [1, 2, 3] }
    const c = { ...d, runaway: [1, 2, 3] }
    const b = { ...c, margin: [1, 2, 3] }
    const a = { ...b, clap: [1, 2, 3] }

    put(160, 'shadow', d)
    expect(rankForXp(loadHunter().xp).id).toBe('B')
    expect(gateUnlock('margin', loadHunter()).open).toBe(false)
    expect(gateUnlock('margin', loadHunter()).badge).toMatch(/C door/)

    put(159, 'shadow', c)
    expect(rankForXp(159).id).toBe('C')
    expect(gateUnlock('margin', loadHunter()).open).toBe(false)
    expect(gateUnlock('margin', loadHunter()).badge).toMatch(/B-rank/)

    put(160, 'shadow', c)
    expect(gateUnlock('margin', loadHunter()).badge).toBe('Your B door')
    expect(gateUnlock('pin', loadHunter()).open).toBe(false)

    put(220, 'shadow', { ...c, margin: [1, 2] })
    expect(gateUnlock('clap', loadHunter()).open).toBe(false)
    expect(gateUnlock('clap', loadHunter()).badge).toMatch(/B door/)

    put(219, 'shadow', b)
    expect(rankForXp(219).id).toBe('B')
    expect(gateUnlock('clap', loadHunter()).open).toBe(false)
    expect(gateUnlock('clap', loadHunter()).badge).toMatch(/A-rank/)

    put(220, 'shadow', b)
    expect(gateUnlock('clap', loadHunter()).badge).toBe('Your A door')
    expect(gateUnlock('forgot', loadHunter()).open).toBe(false)

    put(280, 'shadow', b)
    expect(gateUnlock('whisper', loadHunter()).open).toBe(false)
    expect(gateUnlock('whisper', loadHunter()).badge).toMatch(/A door/)

    put(279, 'shadow', a)
    expect(rankForXp(279).id).toBe('A')
    expect(gateUnlock('whisper', loadHunter()).open).toBe(false)
    expect(gateUnlock('whisper', loadHunter()).badge).toMatch(/S-rank/)

    put(280, 'shadow', a)
    expect(gateUnlock('whisper', loadHunter()).badge).toBe('Your S door')
    expect(gateUnlock('ten', loadHunter()).open).toBe(false)

    put(340, 'shadow', a)
    expect(rankForXp(loadHunter().xp).id).toBe('S')
    expect(gateUnlock('whisper', loadHunter()).open).toBe(true)
    expect(gateUnlock('ten', loadHunter()).open).toBe(false)
  })

  it('Guild and Necrotech use the same one-point rank edges', () => {
    put(159, 'guild', { guild: [1, 2, 3], croupier: [1, 2, 3] })
    expect(C_DOORS.guild).toBe('croupier')
    expect(gateUnlock(B_DOORS.guild, loadHunter()).open).toBe(false)
    put(160, 'guild', { guild: [1, 2, 3], croupier: [1, 2, 3] })
    expect(gateUnlock('near', loadHunter()).badge).toBe('Your B door')

    put(219, 'necrotech', { necrotech: [1, 2, 3], casino: [1, 2, 3], pin: [1, 2, 3] })
    expect(gateUnlock(A_DOORS.necrotech, loadHunter()).open).toBe(false)
    expect(gateUnlock('forgot', loadHunter()).badge).toMatch(/A-rank/)
    put(280, 'necrotech', { necrotech: [1, 2, 3], casino: [1, 2, 3], pin: [1, 2, 3], forgot: [1, 2, 3] })
    expect(gateUnlock(S_DOORS.necrotech, loadHunter()).badge).toBe('Your S door')
    expect(gateUnlock('whisper', loadHunter()).open).toBe(false)
  })
})
