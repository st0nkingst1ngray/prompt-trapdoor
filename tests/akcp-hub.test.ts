import { beforeEach, describe, expect, it } from 'vitest'
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
    document.querySelector<HTMLButtonElement>('#akcp-section-intro')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('intro.page.1')
    document.getElementById('btn-akcp-next')!.click()
    document.getElementById('btn-akcp-next')!.click()
    document.getElementById('btn-akcp-next')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('intro.page.4')
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
