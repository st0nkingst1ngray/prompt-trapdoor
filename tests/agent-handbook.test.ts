import { beforeEach, describe, expect, it } from 'vitest'
import { gradeHandbookStep } from '../src/akcp/agent-handbook/grade'
import {
  AGENT_HANDBOOK_SAVE_KEY,
  awardStep,
  clearAgentHandbookSave,
  emptyAgentHandbookSave,
  loadAgentHandbook,
  stepUnlocked,
  writeAgentHandbook,
} from '../src/akcp/agent-handbook/save'
import { AGENT_HANDBOOK_URL, HANDBOOK_STEPS, stepById } from '../src/akcp/agent-handbook/steps'
import { mountAkcp } from '../src/akcp/ui'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

describe('agent handbook decisions', () => {
  it('has the seven decisions and does not paste the article', () => {
    expect(HANDBOOK_STEPS.map((step) => step.id)).toEqual([
      'budget', 'one', 'measure', 'parallel', 'topology', 'cap', 'evals',
    ])
    const blob = JSON.stringify(HANDBOOK_STEPS)
    expect(blob).not.toContain('shipping agent systems almost by guessing')
    expect(blob).not.toContain('Towards a Science of Scaling Agent Systems')
    expect(AGENT_HANDBOOK_URL).toContain('freecodecamp.org/news/how-to-build-optimal-ai-agents')
  })

  it('grades one agent, a false team, and the eval order', () => {
    const budget = gradeHandbookStep(stepById('budget'), { kind: 'checklist', picked: ['local', 'cost'] })
    expect(budget.win).toBe(true)
    const early = gradeHandbookStep(stepById('budget'), { kind: 'checklist', picked: ['frontier', 'team'] })
    expect(early.win).toBe(false)
    const measure = gradeHandbookStep(stepById('measure'), {
      kind: 'transcript',
      marks: { high: 'keep', auto: 'stop', sample: 'stop', bar: 'keep' },
    })
    expect(measure.win).toBe(true)
    const teamFixesIt = gradeHandbookStep(stepById('measure'), {
      kind: 'transcript',
      marks: { high: 'keep', auto: 'keep', sample: 'stop', bar: 'keep' },
    })
    expect(teamFixesIt.win).toBe(false)
    const evals = gradeHandbookStep(stepById('evals'), {
      kind: 'order',
      submitted: ['bar', 'tasks', 'metrics', 'scale'],
    })
    expect(evals.win).toBe(true)
    const shipped = gradeHandbookStep(stepById('evals'), {
      kind: 'order',
      submitted: ['scale', 'metrics', 'bar', 'tasks'],
    })
    expect(shipped.win).toBe(false)
  })

  it('unlocks the next decision once and leaves other saves alone', () => {
    localStorage.clear()
    localStorage.setItem('akcp-save-v1', 'osmani')
    localStorage.setItem('hunter-association-save-v1', 'rank')
    let save = emptyAgentHandbookSave()
    expect(stepUnlocked(save, 0)).toBe(true)
    expect(stepUnlocked(save, 1)).toBe(false)
    save = awardStep(save, 'budget')
    expect(stepUnlocked(save, 1)).toBe(true)
    expect(awardStep(save, 'budget').cleared).toEqual(['budget'])
    writeAgentHandbook(save)
    expect(loadAgentHandbook().cleared).toEqual(['budget'])
    localStorage.setItem(AGENT_HANDBOOK_SAVE_KEY, '{')
    expect(loadAgentHandbook()).toEqual(emptyAgentHandbookSave())
    writeAgentHandbook(save)
    clearAgentHandbookSave()
    expect(localStorage.getItem(AGENT_HANDBOOK_SAVE_KEY)).toBeNull()
    expect(localStorage.getItem('akcp-save-v1')).toBe('osmani')
    expect(localStorage.getItem('hunter-association-save-v1')).toBe('rank')
  })
})

describe('agent handbook on the book picker', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="app"></div>'
  })

  it('plays the budget decision beside a link to the handbook', () => {
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({ xp: 40 }))
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    document.getElementById('btn-akcp-books')!.click()
    document.getElementById('akcp-book-agents')!.click()
    expect(document.querySelector<HTMLAnchorElement>('#agent-handbook-source')!.href).toBe(AGENT_HANDBOOK_URL)
    expect(document.body.textContent).not.toContain('shipping agent systems almost by guessing')
    expect(document.querySelector<HTMLButtonElement>('#agent-step-one')!.disabled).toBe(true)
    document.getElementById('agent-step-budget')!.click()
    expect(document.getElementById('agent-brief')?.textContent).toContain('tokens are a bill')
    for (const id of ['local', 'cost']) {
      document.querySelector<HTMLInputElement>(`#agent-quest input[value="${id}"]`)!.checked = true
    }
    document.getElementById('btn-agent-submit')!.click()
    expect(document.getElementById('agent-result')?.textContent).toContain('Cleared')
    document.getElementById('btn-agent-map')!.click()
    expect(document.querySelector<HTMLButtonElement>('#agent-step-one')!.disabled).toBe(false)
    expect(document.querySelector<HTMLButtonElement>('#agent-step-measure')!.disabled).toBe(true)
    expect(localStorage.getItem('hunter-association-save-v1')).toContain('"xp":40')
    expect(loadAgentHandbook().cleared).toEqual(['budget'])
  })
})
