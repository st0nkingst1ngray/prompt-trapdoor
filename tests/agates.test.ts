import { beforeEach, describe, expect, it } from 'vitest'
import { awardGate, clearHunter, loadHunter, pickClass, rankForXp } from '../src/hunter'
import {
  FORGOT_GATE,
  evaluateThreeKitchens,
  evaluateSixthCard,
  evaluateEcho,
  KITCHEN_OK,
  KNOW_KITCHENS,
  KNOW_SIXTH,
  KNOW_ECHO,
} from '../src/gates/forgot'
import {
  SALT_GATE,
  evaluateOneGrain,
  evaluateCopiedVoice,
  evaluateLabelSwap,
  KNOW_GRAIN,
  KNOW_VOICE,
  KNOW_LABEL,
} from '../src/gates/salt'
import {
  CLAP_GATE,
  evaluateApplause,
  evaluateLongBow,
  evaluateCanaryBonus,
  KNOW_APPLAUSE,
  KNOW_LONG,
  KNOW_CANARY,
} from '../src/gates/clap'
import {
  MIRROR_GATE,
  evaluateSameWords,
  evaluateOnlyAttack,
  evaluateHiddenAnswer,
  KNOW_SAME,
  KNOW_ATTACK,
  KNOW_HIDDEN,
} from '../src/gates/mirror'
import { KNOW_PREFIX } from '../src/gates/knowledge'
import { CANARY } from '../src/gates/runaway'
import {
  A_DOORS,
  A_GATES,
  B_DOORS,
  C_DOORS,
  CLASS_GATES,
  clearGateSave,
  gateComplete,
  gateUnlock,
  recordStageClear,
} from '../src/gates/registry'

const k = (check: { correct: string }) => `${KNOW_PREFIX}${check.correct}`
const wrongKnow = (check: { options: { id: string }[]; correct: string }) =>
  `${KNOW_PREFIX}${check.options.find((o) => o.id !== check.correct)!.id}`

describe('Rank A · Forgot the Oath (Necrotech)', () => {
  it('titles and rank', () => {
    expect(FORGOT_GATE.stages.map((s) => s.title)).toEqual(['Three Kitchens', 'The Sixth Card', 'Echo'])
    expect(FORGOT_GATE.rank).toBe('A')
  })

  it('stage 1: correct kitchens win only with knowledge', () => {
    const ids = KITCHEN_OK.map((c) => c.id)
    expect(evaluateThreeKitchens([...ids, wrongKnow(KNOW_KITCHENS)]).win).toBe(false)
    expect(evaluateThreeKitchens([...ids, wrongKnow(KNOW_KITCHENS)]).headline).toMatch(/proven|lesson|defense/i)
    const w = evaluateThreeKitchens([...ids, k(KNOW_KITCHENS)])
    expect(w.win).toBe(true)
    expect(evaluateThreeKitchens([...ids, 'bad1', k(KNOW_KITCHENS)]).win).toBe(false)
  })

  it('stage 2: oath + 3 tickets; dropping oath appends canary', () => {
    const bad = evaluateSixthCard(['t1', 't2', 't3', 't4', k(KNOW_SIXTH)])
    expect(bad.win).toBe(false)
    expect(bad.reply).toContain(CANARY)
    expect(evaluateSixthCard(['oath', 't1', 't2', 't3', wrongKnow(KNOW_SIXTH)]).win).toBe(false)
    expect(evaluateSixthCard(['oath', 't1', 't2', 't3', k(KNOW_SIXTH)]).win).toBe(true)
    expect(evaluateSixthCard(['oath', 't1', 't2', 't3', k(KNOW_SIXTH)]).reply).not.toContain(CANARY)
  })

  it('stage 3: drop 441 secret', () => {
    expect(evaluateEcho(['secret', 't1', 'oath', 't2', k(KNOW_ECHO)]).win).toBe(false)
    expect(evaluateEcho(['secret', 't1', 'oath', 't2', k(KNOW_ECHO)]).reply).toMatch(/441/)
    expect(evaluateEcho(['t1', 't2', 'oath', 't4', wrongKnow(KNOW_ECHO)]).win).toBe(false)
    expect(evaluateEcho(['t1', 't2', 'oath', 't4', k(KNOW_ECHO)]).win).toBe(true)
    expect(evaluateEcho(['t1', 't2', 'oath', 't4', k(KNOW_ECHO)]).reply).not.toMatch(/441/)
  })
})

describe('Rank A · Salt in the Batch (Guild)', () => {
  it('titles', () => {
    expect(SALT_GATE.stages.map((s) => s.title)).toEqual(['One Grain', 'Copied Voice', 'Label Swap'])
  })

  it('stage 1: delete canary row + knowledge', () => {
    expect(evaluateOneGrain(['r3', wrongKnow(KNOW_GRAIN)]).win).toBe(false)
    expect(evaluateOneGrain(['r1', k(KNOW_GRAIN)]).win).toBe(false)
    expect(evaluateOneGrain(['r3', k(KNOW_GRAIN)]).win).toBe(true)
    expect(evaluateOneGrain(['r3', k(KNOW_GRAIN)]).reply).toMatch(/ticket is open/)
  })

  it('stage 2: delete poisoned template only', () => {
    expect(evaluateCopiedVoice(['poison', 'c1', k(KNOW_VOICE)]).win).toBe(false)
    expect(evaluateCopiedVoice(['poison', k(KNOW_VOICE)]).win).toBe(true)
  })

  it('stage 3: delete or relabel swap', () => {
    expect(evaluateLabelSwap([k(KNOW_LABEL)]).win).toBe(false)
    expect(evaluateLabelSwap(['swap', wrongKnow(KNOW_LABEL)]).win).toBe(false)
    expect(evaluateLabelSwap(['swap', k(KNOW_LABEL)]).win).toBe(true)
    expect(evaluateLabelSwap(['relabel', k(KNOW_LABEL)]).win).toBe(true)
  })
})

describe('Rank A · Clap Trap (Shadow)', () => {
  it('titles', () => {
    expect(CLAP_GATE.stages.map((s) => s.title)).toEqual(['Applause', 'Long Bow', 'Canary Bonus'])
  })

  it('each stage: crown the bad proxy + name the fix', () => {
    expect(evaluateApplause(['status', k(KNOW_APPLAUSE)]).win).toBe(false)
    expect(evaluateApplause(['flatter', wrongKnow(KNOW_APPLAUSE)]).win).toBe(false)
    expect(evaluateApplause(['flatter', k(KNOW_APPLAUSE)]).win).toBe(true)

    expect(evaluateLongBow(['true', k(KNOW_LONG)]).win).toBe(false)
    expect(evaluateLongBow(['long', k(KNOW_LONG)]).win).toBe(true)

    expect(evaluateCanaryBonus(['status', k(KNOW_CANARY)]).win).toBe(false)
    const w = evaluateCanaryBonus(['with', k(KNOW_CANARY)])
    expect(w.win).toBe(true)
    expect(w.reply).toContain(CANARY)
  })
})

describe('Rank A · Mirror Exam (Barrier)', () => {
  it('titles', () => {
    expect(MIRROR_GATE.stages.map((s) => s.title)).toEqual(['Same Words', 'Only the Attack', 'Hidden Answer'])
  })

  it('stage 1: fresh holdouts only', () => {
    expect(evaluateSameWords(['poison-a', 'fresh-a', 'fresh-b', k(KNOW_SAME)]).win).toBe(false)
    expect(evaluateSameWords(['fresh-a', 'fresh-b', wrongKnow(KNOW_SAME)]).win).toBe(false)
    expect(evaluateSameWords(['fresh-a', 'fresh-b', k(KNOW_SAME)]).win).toBe(true)
  })

  it('stage 2: honest + attack', () => {
    expect(evaluateOnlyAttack(['atk1', 'atk2', 'atk3', k(KNOW_ATTACK)]).win).toBe(false)
    expect(evaluateOnlyAttack(['honest', 'atk1', k(KNOW_ATTACK)]).win).toBe(true)
  })

  it('stage 3: honest gold', () => {
    expect(evaluateHiddenAnswer(['gold-canary', k(KNOW_HIDDEN)]).win).toBe(false)
    expect(evaluateHiddenAnswer(['gold-open', wrongKnow(KNOW_HIDDEN)]).win).toBe(false)
    expect(evaluateHiddenAnswer(['gold-open', k(KNOW_HIDDEN)]).win).toBe(true)
  })
})

describe('Rank A unlocks', () => {
  beforeEach(() => {
    clearHunter()
    clearGateSave()
  })

  const toA = (cls: 'shadow' | 'barrier' | 'necrotech' | 'guild') => {
    awardGate('trapdoor', 1)
    awardGate('heist', 1)
    pickClass(cls)
    for (const s of CLASS_GATES[cls].stages) recordStageClear(cls, s.id)
    for (let i = 1; i <= 3; i++) recordStageClear(C_DOORS[cls], i)
    for (let i = 1; i <= 3; i++) recordStageClear(B_DOORS[cls], i)
  }

  it('maps each class to its plan A door', () => {
    expect(A_DOORS).toEqual({ shadow: 'clap', barrier: 'mirror', necrotech: 'forgot', guild: 'salt' })
    expect(A_GATES.map((g) => g.id).sort()).toEqual(['clap', 'forgot', 'mirror', 'salt'])
  })

  it('own A door needs B door cleared and A-rank (220 XP)', () => {
    awardGate('trapdoor', 1)
    awardGate('heist', 1)
    pickClass('shadow')
    for (const s of CLASS_GATES.shadow.stages) recordStageClear('shadow', s.id)
    for (const s of [1, 2, 3]) recordStageClear('runaway', s)
    expect(loadHunter().xp).toBe(160)
    expect(gateUnlock('clap', loadHunter()).open).toBe(false)
    expect(gateUnlock('clap', loadHunter()).badge).toMatch(/B door/)
    for (const s of [1, 2, 3]) recordStageClear('margin', s)
    expect(loadHunter().xp).toBe(220)
    expect(rankForXp(loadHunter().xp).id).toBe('A')
    expect(gateUnlock('clap', loadHunter()).badge).toBe('Your A door')
    expect(gateUnlock('forgot', loadHunter()).open).toBe(false)
  })

  it('clearing your A door opens siblings', () => {
    toA('shadow')
    expect(loadHunter().xp).toBe(220)
    expect(gateUnlock('clap', loadHunter()).open).toBe(true)
    for (const s of CLAP_GATE.stages) expect(recordStageClear('clap', s.id)).toBe(20)
    expect(gateComplete('clap')).toBe(true)
    expect(loadHunter().xp).toBe(280)
    expect(gateUnlock('forgot', loadHunter()).badge).toBe('Cross-training · A')
    expect(gateUnlock('salt', loadHunter()).open).toBe(true)
    expect(gateUnlock('mirror', loadHunter()).open).toBe(true)
  })

  it('Necrotech / Guild / Barrier get their own A doors after their B door', () => {
    toA('necrotech')
    expect(gateUnlock('forgot', loadHunter()).open).toBe(true)
    clearHunter()
    clearGateSave()
    toA('guild')
    expect(gateUnlock('salt', loadHunter()).open).toBe(true)
    clearHunter()
    clearGateSave()
    toA('barrier')
    expect(gateUnlock('mirror', loadHunter()).open).toBe(true)
    expect(gateUnlock('clap', loadHunter()).open).toBe(false)
  })

  it('every A stage declares a knowledge check', () => {
    for (const g of A_GATES) {
      for (const s of g.stages) {
        expect(s.knowledge, `${g.id} stage ${s.id}`).toBeTruthy()
        expect(s.knowledge!.options.length).toBeGreaterThanOrEqual(3)
        expect(s.knowledge!.options.some((o) => o.id === s.knowledge!.correct)).toBe(true)
      }
    }
  })
})
