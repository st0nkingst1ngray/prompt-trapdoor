import { beforeEach, describe, expect, it } from 'vitest'
import { clearHunter, loadHunter } from '../src/hunter'
import { mountGate, resetGateUi } from '../src/gates/gateUi'
import { KNOW_PREFIX, splitKnowPicks, withKnowledge, type KnowledgeCheck } from '../src/gates/knowledge'
import { clearGateSave, loadGateClears } from '../src/gates/registry'
import type { GateOutcome } from '../src/gates/types'
import {
  evaluateEcho,
  evaluateSixthCard,
  evaluateThreeKitchens,
  KITCHEN_OK,
  KNOW_ECHO,
  KNOW_KITCHENS,
  KNOW_SIXTH,
} from '../src/gates/forgot'
import { evaluateCopiedVoice, evaluateLabelSwap, evaluateOneGrain, KNOW_GRAIN, KNOW_LABEL, KNOW_VOICE } from '../src/gates/salt'
import { evaluateApplause, evaluateCanaryBonus, evaluateLongBow, KNOW_APPLAUSE, KNOW_CANARY, KNOW_LONG } from '../src/gates/clap'
import { evaluateHiddenAnswer, evaluateOnlyAttack, evaluateSameWords, KNOW_ATTACK, KNOW_HIDDEN, KNOW_SAME } from '../src/gates/mirror'
import { evaluateAgain, evaluateSamePage, evaluateToolStorm, KNOW_AGAIN, KNOW_SAME as KNOW_TEN_SAME, KNOW_STORM } from '../src/gates/ten'
import { evaluateBrowser, evaluateHands, evaluatePageTalks, KNOW_BROWSE, KNOW_HANDS, KNOW_PAGE } from '../src/gates/keyring'
import { evaluateBodyDouble, evaluateExtraNote, evaluateScratch, KNOW_BODY, KNOW_NOTE, KNOW_SCRATCH } from '../src/gates/whisper'
import { evaluateBrowsePay, evaluateDraftFine, evaluateReadSend, KNOW_CHAIN, KNOW_DRAFT, KNOW_READ_SEND } from '../src/gates/pair'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const lesson = {
  prompt: 'Name the defense',
  correct: 'pin',
  options: [
    { id: 'pin', label: 'Pin the rule' },
    { id: 'drop', label: 'Drop the rule' },
    { id: 'ban', label: 'Ban a word' },
  ],
} satisfies KnowledgeCheck

function wrongId(check: KnowledgeCheck): string {
  const other = check.options.find((o) => o.id !== check.correct)
  if (!other) throw new Error(`no wrong option for ${check.prompt}`)
  return other.id
}

describe('withKnowledge false pass', () => {
  const won: GateOutcome = { win: true, headline: 'Puzzle clear', rows: [{ label: 'Puzzle', ok: true }], reply: 'ok' }
  const lost: GateOutcome = { win: false, headline: 'Puzzle miss', rows: [{ label: 'Puzzle', ok: false }], reply: 'no' }

  it('a solved puzzle with a missing, wrong, or still-prefixed defense does not clear', () => {
    for (const pick of [null, undefined, '', 'drop', `${KNOW_PREFIX}drop`, `${KNOW_PREFIX}pin`]) {
      const o = withKnowledge(won, pick, lesson)
      expect(o.win, `pick ${String(pick)}`).toBe(false)
    }
    const missing = withKnowledge(won, null, lesson)
    expect(missing.win).toBe(false)
    expect(missing.headline).toMatch(/proven/)
    expect(missing.rows.at(-1)?.ok).toBe(false)
    expect(missing.rows.at(-1)?.label).toMatch(/^Know it:/)
    expect(missing.reply).toBe('ok')
    const wrong = withKnowledge(won, 'drop', lesson)
    expect(wrong.win).toBe(false)
    expect(wrong.headline).toMatch(/defense/)
  })

  it('the right defense keeps a puzzle win and does not rescue a puzzle loss', () => {
    const o = withKnowledge(won, 'pin', lesson)
    expect(o.win).toBe(true)
    expect(o.headline).toBe('Puzzle clear')
    expect(o.rows.at(-1)?.ok).toBe(true)
    const still = withKnowledge(lost, 'pin', lesson)
    expect(still.win).toBe(false)
    expect(still.headline).toBe('Puzzle miss')
  })

  it('only a know: id is a defense; the last one wins', () => {
    expect(splitKnowPicks(['cap4', 'design', 'know:hope', 'know:design'])).toEqual({
      puzzle: ['cap4', 'design'],
      know: 'design',
    })
  })
})

describe('every Rank A and S stage refuses a puzzle-only clear', () => {
  const stages: { name: string; evaluate: (picked: string[]) => GateOutcome; check: KnowledgeCheck; win: string[] }[] = [
    { name: 'forgot/1', evaluate: evaluateThreeKitchens, check: KNOW_KITCHENS, win: KITCHEN_OK.map((c) => c.id) },
    { name: 'forgot/2', evaluate: evaluateSixthCard, check: KNOW_SIXTH, win: ['oath', 't1', 't2', 't3'] },
    { name: 'forgot/3', evaluate: evaluateEcho, check: KNOW_ECHO, win: ['t1', 't2', 'oath', 't4'] },
    { name: 'salt/1', evaluate: evaluateOneGrain, check: KNOW_GRAIN, win: ['r3'] },
    { name: 'salt/2', evaluate: evaluateCopiedVoice, check: KNOW_VOICE, win: ['poison'] },
    { name: 'salt/3', evaluate: evaluateLabelSwap, check: KNOW_LABEL, win: ['swap'] },
    { name: 'clap/1', evaluate: evaluateApplause, check: KNOW_APPLAUSE, win: ['flatter'] },
    { name: 'clap/2', evaluate: evaluateLongBow, check: KNOW_LONG, win: ['long'] },
    { name: 'clap/3', evaluate: evaluateCanaryBonus, check: KNOW_CANARY, win: ['with'] },
    { name: 'mirror/1', evaluate: evaluateSameWords, check: KNOW_SAME, win: ['fresh-a', 'fresh-b'] },
    { name: 'mirror/2', evaluate: evaluateOnlyAttack, check: KNOW_ATTACK, win: ['honest', 'atk1'] },
    { name: 'mirror/3', evaluate: evaluateHiddenAnswer, check: KNOW_HIDDEN, win: ['gold-open'] },
    { name: 'ten/1', evaluate: evaluateAgain, check: KNOW_AGAIN, win: ['cap4'] },
    { name: 'ten/2', evaluate: evaluateSamePage, check: KNOW_TEN_SAME, win: ['status'] },
    { name: 'ten/3', evaluate: evaluateToolStorm, check: KNOW_STORM, win: ['s2d1'] },
    { name: 'keyring/1', evaluate: evaluateHands, check: KNOW_HANDS, win: ['read_ticket', 'draft_reply'] },
    { name: 'keyring/2', evaluate: evaluateBrowser, check: KNOW_BROWSE, win: ['tools_ok', 'browse_allow'] },
    { name: 'keyring/3', evaluate: evaluatePageTalks, check: KNOW_PAGE, win: ['draft_only'] },
    { name: 'whisper/1', evaluate: evaluateExtraNote, check: KNOW_NOTE, win: ['note_canary'] },
    { name: 'whisper/2', evaluate: evaluateBodyDouble, check: KNOW_BODY, win: ['html_canary'] },
    { name: 'whisper/3', evaluate: evaluateScratch, check: KNOW_SCRATCH, win: ['scratch_canary'] },
    { name: 'pair/1', evaluate: evaluateReadSend, check: KNOW_READ_SEND, win: ['read_auto_send_ask_deny'] },
    { name: 'pair/2', evaluate: evaluateDraftFine, check: KNOW_DRAFT, win: ['hold_send'] },
    { name: 'pair/3', evaluate: evaluateBrowsePay, check: KNOW_CHAIN, win: ['ask_both_allow_deny'] },
  ]

  it('covers all 24 knowledge stages', () => {
    expect(stages).toHaveLength(24)
  })

  it.each(stages)('$name: puzzle match without the defense chip fails', ({ evaluate, check, win }) => {
    const bare = evaluate(win)
    expect(bare.win).toBe(false)
    expect(bare.headline).toMatch(/proven|lesson|defense/i)
    expect(bare.rows.some((r) => r.label.startsWith('Know it') && r.ok === false)).toBe(true)

    const wrong = evaluate([...win, `${KNOW_PREFIX}${wrongId(check)}`])
    expect(wrong.win).toBe(false)
    expect(wrong.rows.some((r) => r.label.startsWith('Know it') && r.ok === false)).toBe(true)

    // The raw option id is not a defense. Prefix-less "correct" must not false-pass.
    expect(evaluate([...win, check.correct]).win).toBe(false)

    const cleared = evaluate([...win, `${KNOW_PREFIX}${check.correct}`])
    expect(cleared.win).toBe(true)
    expect(cleared.rows.some((r) => r.label.startsWith('Know it') && r.ok === true)).toBe(true)
  })
})

describe('Know it strip in the gate UI', () => {
  let root: HTMLElement
  beforeEach(() => {
    clearHunter()
    clearGateSave()
    resetGateUi()
    document.body.innerHTML = '<div id="app"></div>'
    root = document.getElementById('app')!
  })

  it('Clap Trap does not award XP until the defense chip is picked', () => {
    mountGate(root, 'clap', { onHub: () => {}, escapeHtml: esc })
    expect(root.querySelector('.know-strip')).not.toBeNull()
    root.querySelector<HTMLButtonElement>('[data-pick="flatter"]')!.click()
    root.querySelector<HTMLButtonElement>('#btn-gate-run')!.click()
    expect(root.querySelector('.toast.win')).toBeNull()
    expect(root.textContent).toMatch(/proven|lesson|defense/i)
    expect(loadHunter().xp).toBe(0)
    expect(loadGateClears().clap).toBeUndefined()

    root.querySelector<HTMLButtonElement>(`[data-pick="${KNOW_PREFIX}${KNOW_APPLAUSE.correct}"]`)!.click()
    root.querySelector<HTMLButtonElement>('#btn-gate-run')!.click()
    expect(root.querySelector('.toast.win')).not.toBeNull()
    expect(loadHunter().xp).toBe(20)
    expect(loadGateClears().clap).toEqual([1])
  })

  it('picking the defense first still leaves a puzzle slot', () => {
    mountGate(root, 'clap', { onHub: () => {}, escapeHtml: esc })
    root.querySelector<HTMLButtonElement>(`[data-pick="${KNOW_PREFIX}${KNOW_APPLAUSE.correct}"]`)!.click()
    root.querySelector<HTMLButtonElement>('[data-pick="flatter"]')!.click()
    expect(root.querySelector('#hud-budget')?.textContent).toBe('2/2')
    root.querySelector<HTMLButtonElement>('#btn-gate-run')!.click()
    expect(root.querySelector('.toast.win')).not.toBeNull()
    expect(loadHunter().xp).toBe(20)
  })
})
