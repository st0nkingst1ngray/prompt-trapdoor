import { beforeEach, describe, expect, it } from 'vitest'
import { awardGate, clearHunter, loadHunter, pickClass, rankForXp } from '../src/hunter'
import {
  TEN_GATE,
  evaluateAgain,
  evaluateSamePage,
  evaluateToolStorm,
  KNOW_AGAIN,
  KNOW_SAME,
  KNOW_STORM,
} from '../src/gates/ten'
import {
  KEYRING_GATE,
  evaluateHands,
  evaluateBrowser,
  evaluatePageTalks,
  KNOW_HANDS,
  KNOW_BROWSE,
  KNOW_PAGE,
} from '../src/gates/keyring'
import {
  WHISPER_GATE,
  evaluateExtraNote,
  evaluateBodyDouble,
  evaluateScratch,
  KNOW_NOTE,
  KNOW_BODY,
  KNOW_SCRATCH,
} from '../src/gates/whisper'
import {
  PAIR_GATE,
  evaluateReadSend,
  evaluateDraftFine,
  evaluateBrowsePay,
  KNOW_READ_SEND,
  KNOW_DRAFT,
  KNOW_CHAIN,
} from '../src/gates/pair'
import { KNOW_PREFIX } from '../src/gates/knowledge'
import { CANARY } from '../src/gates/runaway'
import {
  A_DOORS,
  C_DOORS,
  B_DOORS,
  CLASS_GATES,
  S_DOORS,
  S_GATES,
  clearGateSave,
  gateComplete,
  gateUnlock,
  recordStageClear,
} from '../src/gates/registry'

const k = (check: { correct: string }) => `${KNOW_PREFIX}${check.correct}`
const wrongKnow = (check: { options: { id: string }[]; correct: string }) =>
  `${KNOW_PREFIX}${check.options.find((o) => o.id !== check.correct)!.id}`

describe('Rank S · Ten Steps (Necrotech)', () => {
  it('titles and rank', () => {
    expect(TEN_GATE.stages.map((s) => s.title)).toEqual(['Again', 'Same Page', 'Tool Storm'])
    expect(TEN_GATE.rank).toBe('S')
  })

  it('stage 1: max_steps ≤4 + knowledge; 99 fails', () => {
    expect(evaluateAgain(['cap99', k(KNOW_AGAIN)]).win).toBe(false)
    expect(evaluateAgain(['cap4', wrongKnow(KNOW_AGAIN)]).win).toBe(false)
    expect(evaluateAgain(['cap4', k(KNOW_AGAIN)]).win).toBe(true)
    expect(evaluateAgain(['cap2', k(KNOW_AGAIN)]).win).toBe(true)
  })

  it('stage 2: stop on status', () => {
    expect(evaluateSamePage(['never', k(KNOW_SAME)]).win).toBe(false)
    expect(evaluateSamePage(['status', wrongKnow(KNOW_SAME)]).win).toBe(false)
    expect(evaluateSamePage(['status', k(KNOW_SAME)]).win).toBe(true)
  })

  it('stage 3: per-tool budget', () => {
    expect(evaluateToolStorm(['giant', k(KNOW_STORM)]).win).toBe(false)
    expect(evaluateToolStorm(['s2d1', wrongKnow(KNOW_STORM)]).win).toBe(false)
    const w = evaluateToolStorm(['s2d1', k(KNOW_STORM)])
    expect(w.win).toBe(true)
    expect(w.reply).not.toContain(CANARY)
  })
})

describe('Rank S · Keyring (Guild)', () => {
  it('titles', () => {
    expect(KEYRING_GATE.stages.map((s) => s.title)).toEqual(['Hands', 'Browser', 'The Page Talks'])
  })

  it('stage 1: least privilege', () => {
    expect(evaluateHands(['read_ticket', 'draft_reply', 'send', k(KNOW_HANDS)]).win).toBe(false)
    expect(evaluateHands(['read_ticket', 'draft_reply', wrongKnow(KNOW_HANDS)]).win).toBe(false)
    expect(evaluateHands(['read_ticket', 'draft_reply', k(KNOW_HANDS)]).win).toBe(true)
  })

  it('stage 2: allow-listed browse', () => {
    expect(evaluateBrowser(['tools_ok', 'browse_open', k(KNOW_BROWSE)]).win).toBe(false)
    expect(evaluateBrowser(['tools_ok', 'browse_allow', wrongKnow(KNOW_BROWSE)]).win).toBe(false)
    expect(evaluateBrowser(['tools_ok', 'browse_allow', k(KNOW_BROWSE)]).win).toBe(true)
  })

  it('stage 3: page talks — draft only', () => {
    expect(evaluatePageTalks(['send_on', k(KNOW_PAGE)]).win).toBe(false)
    expect(evaluatePageTalks(['draft_only', wrongKnow(KNOW_PAGE)]).win).toBe(false)
    const w = evaluatePageTalks(['draft_only', k(KNOW_PAGE)])
    expect(w.win).toBe(true)
    expect(w.reply).toMatch(/14 days/)
    expect(w.reply).not.toContain(CANARY)
  })
})

describe('Rank S · Whisper in the Ticket (Shadow)', () => {
  it('titles', () => {
    expect(WHISPER_GATE.stages.map((s) => s.title)).toEqual(['Extra Note', 'Body Double', 'Scratch'])
  })

  it('each stage: plant canary via extra field + name drop', () => {
    expect(evaluateExtraNote(['note_empty', k(KNOW_NOTE)]).win).toBe(false)
    expect(evaluateExtraNote(['note_canary', wrongKnow(KNOW_NOTE)]).win).toBe(false)
    const n = evaluateExtraNote(['note_canary', k(KNOW_NOTE)])
    expect(n.win).toBe(true)
    expect(n.reply).toContain(CANARY)
    expect(n.reply).toMatch(/open/i)

    expect(evaluateBodyDouble(['body_only', k(KNOW_BODY)]).win).toBe(false)
    expect(evaluateBodyDouble(['html_canary', k(KNOW_BODY)]).win).toBe(true)

    expect(evaluateScratch(['scratch_empty', k(KNOW_SCRATCH)]).win).toBe(false)
    expect(evaluateScratch(['scratch_canary', k(KNOW_SCRATCH)]).win).toBe(true)
  })
})

describe('Rank S · Second Pair (Barrier)', () => {
  it('titles', () => {
    expect(PAIR_GATE.stages.map((s) => s.title)).toEqual(['Read and Send', 'The Draft Is Fine', 'Browse Then Pay'])
  })

  it('stage 1: deny send', () => {
    expect(evaluateReadSend(['both_auto', k(KNOW_READ_SEND)]).win).toBe(false)
    expect(evaluateReadSend(['read_auto_send_ask_deny', wrongKnow(KNOW_READ_SEND)]).win).toBe(false)
    expect(evaluateReadSend(['read_auto_send_ask_deny', k(KNOW_READ_SEND)]).win).toBe(true)
  })

  it('stage 2: hold send even if draft fine', () => {
    expect(evaluateDraftFine(['approve_send', k(KNOW_DRAFT)]).win).toBe(false)
    expect(evaluateDraftFine(['hold_send', k(KNOW_DRAFT)]).win).toBe(true)
  })

  it('stage 3: allow browse deny pay', () => {
    expect(evaluateBrowsePay(['browse_blesses_pay', k(KNOW_CHAIN)]).win).toBe(false)
    expect(evaluateBrowsePay(['ask_both_allow_deny', wrongKnow(KNOW_CHAIN)]).win).toBe(false)
    expect(evaluateBrowsePay(['ask_both_allow_deny', k(KNOW_CHAIN)]).win).toBe(true)
  })
})

describe('Rank S unlocks', () => {
  beforeEach(() => {
    clearHunter()
    clearGateSave()
  })

  const toS = (cls: 'shadow' | 'barrier' | 'necrotech' | 'guild') => {
    awardGate('trapdoor', 1)
    awardGate('heist', 1)
    pickClass(cls)
    for (const s of CLASS_GATES[cls].stages) recordStageClear(cls, s.id)
    for (let i = 1; i <= 3; i++) recordStageClear(C_DOORS[cls], i)
    for (let i = 1; i <= 3; i++) recordStageClear(B_DOORS[cls], i)
    for (let i = 1; i <= 3; i++) recordStageClear(A_DOORS[cls], i)
  }

  it('maps each class to its plan S door', () => {
    expect(S_DOORS).toEqual({ shadow: 'whisper', barrier: 'pair', necrotech: 'ten', guild: 'keyring' })
    expect(S_GATES.map((g) => g.id).sort()).toEqual(['keyring', 'pair', 'ten', 'whisper'])
  })

  it('own S door needs A door cleared and S-rank (280 XP)', () => {
    awardGate('trapdoor', 1)
    awardGate('heist', 1)
    pickClass('shadow')
    for (const s of CLASS_GATES.shadow.stages) recordStageClear('shadow', s.id)
    for (const s of [1, 2, 3]) recordStageClear('runaway', s)
    for (const s of [1, 2, 3]) recordStageClear('margin', s)
    expect(loadHunter().xp).toBe(220)
    expect(gateUnlock('whisper', loadHunter()).open).toBe(false)
    expect(gateUnlock('whisper', loadHunter()).badge).toMatch(/A door/)
    for (const s of [1, 2, 3]) recordStageClear('clap', s)
    expect(loadHunter().xp).toBe(280)
    expect(rankForXp(loadHunter().xp).id).toBe('S')
    expect(gateUnlock('whisper', loadHunter()).badge).toBe('Your S door')
    expect(gateUnlock('ten', loadHunter()).open).toBe(false)
  })

  it('clearing your S door opens siblings', () => {
    toS('shadow')
    expect(loadHunter().xp).toBe(280)
    expect(gateUnlock('whisper', loadHunter()).open).toBe(true)
    for (const s of WHISPER_GATE.stages) expect(recordStageClear('whisper', s.id)).toBe(20)
    expect(gateComplete('whisper')).toBe(true)
    expect(loadHunter().xp).toBe(340)
    expect(gateUnlock('ten', loadHunter()).badge).toBe('Cross-training · S')
    expect(gateUnlock('keyring', loadHunter()).open).toBe(true)
    expect(gateUnlock('pair', loadHunter()).open).toBe(true)
  })

  it('Necrotech / Guild / Barrier get their own S doors after their A door', () => {
    toS('necrotech')
    expect(gateUnlock('ten', loadHunter()).open).toBe(true)
    clearHunter()
    clearGateSave()
    toS('guild')
    expect(gateUnlock('keyring', loadHunter()).open).toBe(true)
    clearHunter()
    clearGateSave()
    toS('barrier')
    expect(gateUnlock('pair', loadHunter()).open).toBe(true)
    expect(gateUnlock('whisper', loadHunter()).open).toBe(false)
  })

  it('every S stage declares a knowledge check', () => {
    for (const g of S_GATES) {
      for (const s of g.stages) {
        expect(s.knowledge, `${g.id} stage ${s.id}`).toBeTruthy()
        expect(s.knowledge!.options.length).toBeGreaterThanOrEqual(3)
        expect(s.knowledge!.options.some((o) => o.id === s.knowledge!.correct)).toBe(true)
      }
    }
  })
})
