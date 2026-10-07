import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountAkcp } from '../src/akcp/ui'
import { clearAkcpSave, loadAkcp, writeAkcp } from '../src/akcp/save'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="app"></div>'
})

describe('akcp wizard', () => {
  it('reads intro pages in order and then unlocks specs', () => {
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    expect(document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.disabled).toBe(true)
    expect(document.getElementById('btn-akcp-enter-dungeon')).toBeNull()
    document.querySelector<HTMLButtonElement>('#akcp-section-intro')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('intro.page.1')
    expect(document.querySelector('#akcp-page')?.textContent).toContain('AI coding assistants became game-changers')
    expect(document.getElementById('btn-akcp-enter-dungeon')).toBeNull()
    document.getElementById('btn-akcp-next')!.click()
    expect(document.querySelector('#akcp-page')?.textContent).toContain('At Anthropic, for example')
    document.getElementById('btn-akcp-next')!.click()
    expect(document.querySelector('#akcp-page')?.textContent).toContain("In this article, I'll share")
    document.getElementById('btn-akcp-next')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('intro.page.4')
    expect(document.querySelector('#akcp-page')?.textContent).toContain("If you're interested in more")
    expect(document.getElementById('btn-akcp-enter-dungeon')).toBeNull()
    document.getElementById('btn-akcp-done')!.click()
    expect(loadAkcp().pagesRead).toEqual([
      'intro.page.1', 'intro.page.2', 'intro.page.3', 'intro.page.4',
    ])
    expect(document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.disabled).toBe(false)
    document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('specs.page.1')
  })

  it('shows the penalty page on the second wrong order', () => {
    const read = ['intro.page.1', 'intro.page.2', 'intro.page.3', 'intro.page.4', 'specs.page.1', 'specs.page.2', 'specs.page.3', 'specs.page.4']
    writeAkcp({ ...loadAkcp(), pagesRead: read })
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.click()
    // land on the dungeon from the last page
    while (document.getElementById('btn-akcp-next')) document.getElementById('btn-akcp-next')!.click()
    document.getElementById('btn-akcp-enter-dungeon')!.click()
    document.querySelector<HTMLButtonElement>('[data-quest-id="specs-order"]')!.click()
    const submitWrong = () => {
      const list = document.getElementById('akcp-order')!
      const code = list.querySelector<HTMLElement>('[data-step-id="code"]')!
      list.prepend(code)
      document.getElementById('btn-akcp-submit')!.click()
    }
    submitWrong()
    expect(document.getElementById('akcp-penalty')).toBeNull()
    submitWrong()
    expect(document.getElementById('akcp-penalty')?.textContent).toContain("Don't just throw wishes")
    expect(document.getElementById('btn-akcp-submit')).toBeNull()
    document.getElementById('btn-akcp-reread')!.click()
    expect(document.getElementById('akcp-quest')?.getAttribute('data-quest-id')).toBe('specs-order')
  })
})

async function boot(): Promise<HTMLElement> {
  vi.resetModules()
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  return document.getElementById('app')!
}

describe('akcp on the association hub', () => {
  beforeEach(() => localStorage.clear())

  it('opens from a fresh E-rank hub and returns without creating a hunter save', async () => {
    const app = await boot()
    const tile = app.querySelector<HTMLButtonElement>('#tile-akcp')!
    expect(tile.disabled).toBe(false)
    expect(app.querySelector('.rank-letter')?.textContent).toBe('E')
    expect(app.querySelector('#tile-trapdoor')).not.toBeNull()
    expect(app.querySelector('#tile-heist')).not.toBeNull()
    for (const title of ['Rank D', 'Rank C', 'Rank B', 'Rank A', 'Rank S']) {
      expect(app.textContent).toContain(title)
    }
    tile.click()
    expect(app.querySelector('#akcp')).not.toBeNull()
    app.querySelector<HTMLButtonElement>('#btn-akcp-hub')!.click()
    expect(app.querySelector('#hub')).not.toBeNull()
    expect(localStorage.getItem('hunter-association-save-v1')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('still offers the class screen, and Later returns to a hub that contains AKCP', async () => {
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({ xp: 40, awarded: ['trapdoor:1', 'heist:1'], classId: null }))
    const app = await boot()
    expect(app.querySelector('#class-pick')).not.toBeNull()
    app.querySelector<HTMLButtonElement>('#btn-class-later')!.click()
    expect(app.querySelector('#tile-akcp')).not.toBeNull()
    vi.unstubAllGlobals()
  })

  it('clears the specs dungeon without changing rank XP or the C door', async () => {
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({
      xp: 100,
      awarded: ['trapdoor:1', 'heist:1', 'shadow:1', 'shadow:2', 'shadow:3'],
      classId: 'shadow',
    }))
    localStorage.setItem('hunter-dgates-save-v1', JSON.stringify({ shadow: [1, 2, 3] }))
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    const app = await boot()
    expect(app.querySelector<HTMLButtonElement>('[data-gate="runaway"]')!.disabled).toBe(false)
    const pages = ['intro.page.1', 'intro.page.2', 'intro.page.3', 'intro.page.4', 'specs.page.1', 'specs.page.2', 'specs.page.3', 'specs.page.4']
    const { writeAkcp, loadAkcp: readSave } = await import('../src/akcp/save')
    writeAkcp({ ...readSave(), pagesRead: pages })
    app.querySelector<HTMLButtonElement>('#tile-akcp')!.click()
    app.querySelector<HTMLButtonElement>('#akcp-section-specs')!.click()
    while (app.querySelector('#btn-akcp-next')) app.querySelector<HTMLButtonElement>('#btn-akcp-next')!.click()
    app.querySelector<HTMLButtonElement>('#btn-akcp-enter-dungeon')!.click()

    const submit = () => app.querySelector<HTMLButtonElement>('#btn-akcp-submit')!.click()
    app.querySelector<HTMLButtonElement>('[data-quest-id="specs-order"]')!.click()
    submit()
    app.querySelector<HTMLButtonElement>('[data-quest-id="specs-transcript"]')!.click()
    for (const [id, mark] of [['wish', 'keep'], ['skip', 'stop'], ['later', 'stop']] as const) {
      app.querySelector<HTMLInputElement>(`input[name="mark-${id}"][value="${mark}"]`)!.click()
    }
    submit()
    app.querySelector<HTMLButtonElement>('[data-quest-id="specs-checklist"]')!.click()
    for (const id of ['no-tests', 'monolith']) {
      app.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${id}"]`)!.click()
    }
    submit()
    app.querySelector<HTMLButtonElement>('[data-boss-id="specs-boss"]')!.click()
    submit()
    for (const [id, mark] of [['rush', 'stop'], ['hold', 'keep']] as const) {
      app.querySelector<HTMLInputElement>(`input[name="mark-${id}"][value="${mark}"]`)!.click()
    }
    submit()
    for (const id of ['spec', 'plan']) {
      app.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${id}"]`)!.click()
    }
    submit()

    expect(loadAkcp().stats.planning).toBe(4)
    app.querySelector<HTMLButtonElement>('#akcp-section-specs')!.click()
    while (app.querySelector('#btn-akcp-next')) app.querySelector<HTMLButtonElement>('#btn-akcp-next')!.click()
    app.querySelector<HTMLButtonElement>('#btn-akcp-enter-dungeon')!.click()
    app.querySelector<HTMLButtonElement>('[data-boss-id="specs-boss"]')!.click()
    submit()
    for (const [id, mark] of [['rush', 'stop'], ['hold', 'keep']] as const) {
      app.querySelector<HTMLInputElement>(`input[name="mark-${id}"][value="${mark}"]`)!.click()
    }
    submit()
    for (const id of ['spec', 'plan']) {
      app.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${id}"]`)!.click()
    }
    submit()
    expect(loadAkcp().stats.planning).toBe(4)
    expect(app.querySelector('#akcp-hub-badge')).toBeNull()
    app.querySelector<HTMLButtonElement>('#btn-akcp-hub')!.click()
    expect(app.querySelector('#akcp-hub-badge')?.textContent).toBe('Specs clear')
    expect(app.querySelector('.rank-card')?.textContent).toContain('100 XP')
    expect(app.querySelector<HTMLButtonElement>('[data-gate="runaway"]')!.disabled).toBe(false)
    const hunter = JSON.parse(localStorage.getItem('hunter-association-save-v1')!) as { xp: number; classId: string }
    expect(hunter.xp).toBe(100)
    expect(hunter.classId).toBe('shadow')
    vi.unstubAllGlobals()
  })

  it('resets the protocol save with the rest of the browser save', async () => {
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({ xp: 0, awarded: [], classId: null }))
    localStorage.setItem('hunter-dgates-save-v1', JSON.stringify({}))
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 0, attempt: 1, cleared: [] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [] }))
    localStorage.setItem('python-koans-save-v1', JSON.stringify({ version: 1 }))
    localStorage.setItem('exercism-python-save-v1', JSON.stringify({ version: 1 }))
    localStorage.setItem('pyithon-save-v1', JSON.stringify({ version: 1 }))
    const app = await boot()
    app.querySelector<HTMLButtonElement>('#tile-akcp')!.click()
    expect(localStorage.getItem('akcp-save-v1')).not.toBeNull()
    ;(window as unknown as { __ptReset: () => void }).__ptReset()
    expect(localStorage.getItem('akcp-save-v1')).toBeNull()
    expect(localStorage.getItem('hunter-association-save-v1')).toBeNull()
    expect(localStorage.getItem('hunter-dgates-save-v1')).toBeNull()
    expect(localStorage.getItem('prompt-trapdoor-save-v1')).toBeNull()
    expect(localStorage.getItem('token-heist-save-v1')).toBeNull()
    expect(localStorage.getItem('python-koans-save-v1')).toBeNull()
    expect(localStorage.getItem('exercism-python-save-v1')).toBeNull()
    expect(localStorage.getItem('pyithon-save-v1')).toBeNull()
    expect(app.querySelector('#hub')).not.toBeNull()
    vi.unstubAllGlobals()
  })
})
