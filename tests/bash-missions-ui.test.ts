import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { primeCurriculum } from '../src/akcp/bashmissions/catalog'
import { loadBashMissions } from '../src/akcp/bashmissions/save'
import { mountAkcp } from '../src/akcp/ui'

const curriculum = JSON.parse(fs.readFileSync('public/bashmissions/curriculum.json', 'utf8')) as unknown

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function openBash(): Promise<void> {
  document.getElementById('btn-akcp-books')!.click()
  document.getElementById('akcp-books-simple')!.click()
  document.getElementById('akcp-book-bash')!.click()
  await vi.waitFor(() => {
    expect(document.getElementById('btn-bash-continue')).not.toBeNull()
  })
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="app"></div>'
  primeCurriculum(curriculum)
})

describe('bashmissions on the akcp book picker', () => {
  it('keeps the Osmani map first, then opens level 1 from Books', async () => {
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    expect(document.getElementById('akcp-section-intro')).not.toBeNull()
    expect(document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.disabled).toBe(true)
    await openBash()
    expect(document.querySelectorAll('[id^="bash-module-"]')).toHaveLength(26)
    expect(document.querySelector<HTMLButtonElement>('#bash-module-2')!.disabled).toBe(true)
    document.getElementById('btn-bash-continue')!.click()
    expect(document.getElementById('bash-hud-slot')?.classList.contains('is-collapsed')).toBe(false)
    expect(document.querySelector('.hud.bash-hud')?.textContent).toContain('Your First Script')
    expect(document.getElementById('bash-brief')?.textContent).toContain('Your First Script')
    expect(document.querySelector('textarea#bash-editor')?.textContent).toContain('#!/usr/bin/env bash')
    document.getElementById('btn-bash-hint')!.click()
    expect(document.getElementById('bash-hint-panel')?.textContent).toContain('shebang')
    expect(document.getElementById('bash-hint-panel')?.textContent).not.toContain('printf')
    document.getElementById('btn-bash-handbook')!.click()
    expect(document.getElementById('bash-guide')?.textContent).toContain('What Bash Is')
    document.getElementById('btn-bash-guide-back')!.click()
    expect(document.getElementById('bash-brief')).not.toBeNull()
    document.getElementById('btn-akcp-books')!.click()
    document.getElementById('akcp-book-osmani')!.click()
    expect(document.getElementById('akcp-section-specs')).not.toBeNull()
  })

  it('checks a real script, unlocks the next level, and leaves hunter saves alone', async () => {
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({ xp: 100, awarded: [], classId: 'shadow' }))
    localStorage.setItem('akcp-save-v1', JSON.stringify({ version: 1, pagesRead: [] }))
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    await openBash()
    document.getElementById('btn-bash-continue')!.click()
    const editor = document.querySelector<HTMLTextAreaElement>('#bash-editor')!
    editor.value = "#!/usr/bin/env bash\nprintf 'LEVEL 1: Your First Script | %s | %s\\n' \"$1\" \"$2\"\n"
    document.getElementById('btn-bash-check')!.click()
    await vi.waitFor(() => {
      expect(document.getElementById('bash-debrief')?.textContent).toContain('Debrief')
    })
    expect(loadBashMissions().cleared).toEqual([1])
    expect(loadBashMissions().xp).toBe(60)
    expect(localStorage.getItem('hunter-association-save-v1')).toContain('"xp":100')
    document.getElementById('btn-bash-levels')!.click()
    expect(document.querySelector<HTMLButtonElement>('#bash-level-2')!.disabled).toBe(false)
    expect(document.querySelector<HTMLButtonElement>('#bash-level-3')!.disabled).toBe(true)
  })
})
