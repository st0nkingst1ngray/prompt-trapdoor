import { beforeEach, describe, expect, it } from 'vitest'
import { awardGate, clearHunter, loadHunter, pickClass, rankForXp } from '../src/hunter'
import {
  CANARY,
  RUNAWAY_GATE,
  evaluateLongLeash,
  evaluateNoPeriod,
  evaluateStuckNeedle,
  leashSample,
  noPeriodDraw,
} from '../src/gates/runaway'
import { CROUPIER_GATE, evaluateClosedShelf, evaluateThreeWords, evaluateToolShape } from '../src/gates/croupier'
import { WARD_GATE, evaluateChecker, evaluateCritic, evaluateGap } from '../src/gates/ward'
import { CLASS_GATES, C_DOORS, C_GATES, clearGateSave, gateComplete, gateUnlock, recordStageClear } from '../src/gates/registry'
import type { GateDef, KnobStage, SelectStage } from '../src/gates/types'

const knob = (g: GateDef, id: number) => g.stages.find((s) => s.id === id) as KnobStage
const sel = (g: GateDef, id: number) => g.stages.find((s) => s.id === id) as SelectStage

describe('Rank C · Stop the Runaway (Shadow)', () => {
  it('has 3 stages wired to the plan names', () => {
    expect(RUNAWAY_GATE.stages.map((s) => s.title)).toEqual(['No Period', 'Stuck Needle', 'Long Leash'])
    expect(RUNAWAY_GATE.rank).toBe('C')
  })

  it('stage 1: cold never reaches the canary, the window is T 1.5–1.7, too hot loses Tuesday, stop chip fails', () => {
    expect(evaluateNoPeriod({ temperature: 0.3, stop: 0 }).win).toBe(false)
    expect(evaluateNoPeriod({ temperature: 1.0, stop: 0 }).headline).toMatch(/Too cold/)
    for (const t of [1.5, 1.6, 1.7]) {
      const o = evaluateNoPeriod({ temperature: t, stop: 0 })
      expect(o.win, `T=${t}`).toBe(true)
      expect(o.reply).toContain(CANARY)
      expect(o.reply).toContain('Tuesday')
    }
    expect(evaluateNoPeriod({ temperature: 2.0, stop: 0 }).headline).toMatch(/Too hot/)
    const sealed = evaluateNoPeriod({ temperature: 1.6, stop: 1 })
    expect(sealed.win).toBe(false)
    expect(sealed.reply).not.toContain(CANARY)
    expect(noPeriodDraw({ temperature: 0.3, stop: 0 }).psP).toBeLessThan(0.01)
  })

  it('stage 2: penalty window 0.2–0.6; lower loops, higher chokes the canary', () => {
    expect(evaluateStuckNeedle({ penalty: 1.5 }).win).toBe(false)
    expect(evaluateStuckNeedle({ penalty: 0.4 }).win).toBe(true)
    expect(evaluateStuckNeedle({ penalty: 0.6 }).win).toBe(true)
    expect(evaluateStuckNeedle({ penalty: 0.7 }).win).toBe(false)
    const loop = evaluateStuckNeedle({ penalty: 0.1 })
    expect(loop.win).toBe(false)
    expect(loop.reply).toMatch(/Tuesday Tuesday/)
  })

  it('stage 3: canary needs 23 tokens; a 2-token cap even cuts Tuesday', () => {
    expect(evaluateLongLeash({ maxTokens: 8 }).win).toBe(false)
    expect(evaluateLongLeash({ maxTokens: 22 }).win).toBe(false)
    expect(evaluateLongLeash({ maxTokens: 23 }).win).toBe(true)
    expect(evaluateLongLeash({ maxTokens: 2 }).headline).toMatch(/even “Tuesday”/)
    expect(leashSample({ maxTokens: 40 })).toContain(CANARY)
    expect(leashSample({ maxTokens: 8 })).toContain('✂')
  })

  it('stage previews match their evaluations', () => {
    const s = knob(RUNAWAY_GATE, 1)
    expect(s.preview(s.defaults)).toBe(s.evaluate(s.defaults).reply)
  })
})

describe('Rank C · Schema Croupier (Guild)', () => {
  it('stage 1: only the enum grammar gives one clean word', () => {
    expect(evaluateThreeWords([]).win).toBe(false)
    expect(evaluateThreeWords(['free']).reply).toContain(CANARY)
    expect(evaluateThreeWords(['json']).win).toBe(false)
    const w = evaluateThreeWords(['enum'])
    expect(w.win).toBe(true)
    expect(w.reply).toBe('waiting')
  })
  it('stage 2: only a closed schema strips also_say', () => {
    expect(evaluateToolShape(['open']).win).toBe(false)
    expect(evaluateToolShape(['prompt']).headline).toMatch(/request, not a constraint/)
    const w = evaluateToolShape(['closed'])
    expect(w.win).toBe(true)
    expect(w.reply).not.toContain('also_say')
  })
  it('stage 3: a regex is not a membership check', () => {
    expect(evaluateClosedShelf(['free']).win).toBe(false)
    expect(evaluateClosedShelf(['regex']).reply).toContain('doc-999')
    expect(evaluateClosedShelf(['enum']).win).toBe(true)
  })
  it('every stage is single-card', () => {
    for (const s of CROUPIER_GATE.stages) expect((s as SelectStage).maxPicks).toBe(1)
  })
})

describe('Rank C · Logit Ward (Barrier)', () => {
  it('stage 1: gap ward must sit in (1.2, 1.6]; 0 leaks, too high blocks honest asks', () => {
    expect(evaluateGap({ gap: 0 }).headline).toMatch(/still spoke the canary/)
    expect(evaluateGap({ gap: 1.2 }).win).toBe(false)
    expect(evaluateGap({ gap: 1.3 }).win).toBe(true)
    expect(evaluateGap({ gap: 1.6 }).win).toBe(true)
    const over = evaluateGap({ gap: 2.5 })
    expect(over.win).toBe(false)
    expect(over.headline).toMatch(/Over-blocked/)
  })
  it('stage 2: checker cutoff 0.45–0.55 splits the suite; block-everything fails', () => {
    expect(evaluateChecker({ cutoff: 1 }).win).toBe(false)
    for (const c of [0.45, 0.5, 0.55]) expect(evaluateChecker({ cutoff: c }).win, `cutoff ${c}`).toBe(true)
    expect(evaluateChecker({ cutoff: 0.6 }).win).toBe(false)
    expect(evaluateChecker({ cutoff: 0.05 }).headline).toMatch(/Over-blocked/)
  })
  it('stage 3: critic fixes the sneaky line; digit block over-blocks; prompt rule does nothing', () => {
    expect(evaluateCritic(['critic']).win).toBe(true)
    expect(evaluateCritic(['critic', 'longer']).win).toBe(true)
    const digits = evaluateCritic(['critic', 'digits'])
    expect(digits.win).toBe(false)
    expect(digits.reply).toContain('[blocked')
    expect(evaluateCritic(['please']).headline).toMatch(/Prompts are not output checks/)
    expect(evaluateCritic([]).win).toBe(false)
    expect(sel(WARD_GATE, 3).maxPicks).toBe(2)
  })
})

describe('Rank C unlocks', () => {
  beforeEach(() => {
    clearHunter()
    clearGateSave()
  })

  const toC = (cls: 'shadow' | 'barrier' | 'necrotech' | 'guild') => {
    awardGate('trapdoor', 1)
    awardGate('heist', 1)
    pickClass(cls)
    for (const s of CLASS_GATES[cls].stages) recordStageClear(cls, s.id)
  }

  it('maps each class to its plan C door', () => {
    expect(C_DOORS).toEqual({ shadow: 'runaway', barrier: 'ward', necrotech: 'casino', guild: 'croupier' })
    expect(C_GATES.map((g) => g.id).sort()).toEqual(['casino', 'croupier', 'runaway', 'ward'])
  })

  it('no class → all new C doors locked', () => {
    for (const id of ['runaway', 'croupier', 'ward'] as const) expect(gateUnlock(id, loadHunter()).open).toBe(false)
  })

  it('own C door needs the class D-gate cleared, not just C-rank XP', () => {
    for (let i = 1; i <= 5; i++) awardGate('trapdoor', i) // 100 XP = C without any D-gate
    pickClass('shadow')
    expect(rankForXp(loadHunter().xp).id).toBe('C')
    const u = gateUnlock('runaway', loadHunter())
    expect(u.open).toBe(false)
    expect(u.badge).toMatch(/D-gate/)
  })

  it('clearing D opens your C door; siblings wait for it; clearing it opens them and pays to B', () => {
    toC('shadow')
    expect(loadHunter().xp).toBe(100)
    expect(gateUnlock('runaway', loadHunter()).badge).toBe('Your C door')
    expect(gateUnlock('croupier', loadHunter()).open).toBe(false)
    expect(gateUnlock('ward', loadHunter()).open).toBe(false)
    for (const s of RUNAWAY_GATE.stages) expect(recordStageClear('runaway', s.id)).toBe(20)
    expect(gateComplete('runaway')).toBe(true)
    expect(loadHunter().xp).toBe(160)
    expect(rankForXp(loadHunter().xp).id).toBe('B')
    expect(gateUnlock('croupier', loadHunter()).badge).toBe('Cross-training · C')
    expect(gateUnlock('ward', loadHunter()).open).toBe(true)
  })

  it('Necrotech: the Casino is their C door — clearing it opens the three new doors', () => {
    toC('necrotech')
    expect(gateUnlock('casino', loadHunter()).open).toBe(true)
    expect(gateUnlock('runaway', loadHunter()).open).toBe(false)
    for (const s of C_GATES.find((g) => g.id === 'casino')!.stages) recordStageClear('casino', s.id)
    for (const id of ['runaway', 'croupier', 'ward'] as const) expect(gateUnlock(id, loadHunter()).open).toBe(true)
  })

  it('Guild and Barrier get their own doors', () => {
    toC('guild')
    expect(gateUnlock('croupier', loadHunter()).open).toBe(true)
    clearHunter()
    clearGateSave()
    toC('barrier')
    expect(gateUnlock('ward', loadHunter()).open).toBe(true)
    expect(gateUnlock('croupier', loadHunter()).open).toBe(false)
  })
})
