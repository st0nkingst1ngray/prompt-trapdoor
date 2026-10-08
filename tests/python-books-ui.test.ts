import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { primeExercismCurriculum } from '../src/akcp/exercism-python/catalog'
import { loadExercismPython } from '../src/akcp/exercism-python/save'
import { primePyithonCurriculum } from '../src/akcp/pyithon/catalog'
import { loadPyithon } from '../src/akcp/pyithon/save'
import { primeKoansCurriculum } from '../src/akcp/python-koans/catalog'
import { loadPythonKoans } from '../src/akcp/python-koans/save'
import { mountAkcp } from '../src/akcp/ui'

const koans = JSON.parse(fs.readFileSync('public/python-koans/curriculum.json', 'utf8')) as unknown
const exercism = JSON.parse(fs.readFileSync('public/exercism-python/curriculum.json', 'utf8')) as unknown
const pyithon = JSON.parse(fs.readFileSync('public/pyithon/curriculum.json', 'utf8')) as unknown

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="app"></div>'
  primeKoansCurriculum(koans)
  primeExercismCurriculum(exercism)
  primePyithonCurriculum(pyithon)
})

describe('python books on the AKCP picker', () => {
  it('lists Osmani, BashMissions, and the three Python books', () => {
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    document.getElementById('btn-akcp-books')!.click()
    document.getElementById('akcp-books-simple')!.click()
    expect(document.getElementById('akcp-book-osmani')).not.toBeNull()
    expect(document.getElementById('akcp-book-bash')).not.toBeNull()
    expect(document.getElementById('akcp-book-koans')).not.toBeNull()
    expect(document.getElementById('akcp-book-exercism')).not.toBeNull()
    expect(document.getElementById('akcp-book-pyithon')).not.toBeNull()
    document.getElementById('akcp-book-osmani')!.click()
    expect(document.getElementById('akcp-section-intro')).not.toBeNull()
  })

  it('plays pyi-thon level 1 without writing the other save keys', async () => {
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({ xp: 100 }))
    localStorage.setItem('akcp-save-v1', JSON.stringify({ version: 1 }))
    localStorage.setItem('bash-missions-save-v1', 'bash')
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    document.getElementById('btn-akcp-books')!.click()
    document.getElementById('akcp-books-simple')!.click()
    document.getElementById('akcp-book-pyithon')!.click()
    await vi.waitFor(() => expect(document.getElementById('btn-pyi-continue')).not.toBeNull())
    expect(document.querySelectorAll('[id^="pyi-module-"]')).toHaveLength(3)
    expect(document.querySelector<HTMLButtonElement>('#pyi-module-2')!.disabled).toBe(true)
    document.getElementById('btn-pyi-continue')!.click()
    expect(document.getElementById('pyi-brief')?.textContent).toContain('Hello')
    document.getElementById('btn-pyi-hint')!.click()
    expect(document.getElementById('pyi-hint-panel')?.textContent?.length).toBeGreaterThan(0)
    expect(document.getElementById('pyi-hint-panel')?.textContent).not.toContain('Hello, World!')
    const editor = document.querySelector<HTMLTextAreaElement>('#pyi-editor')!
    editor.value = 'print("Hello, World!")\n'
    document.getElementById('btn-pyi-check')!.click()
    await vi.waitFor(() => expect(document.getElementById('pyi-debrief')?.textContent).toContain('Debrief'))
    expect(loadPyithon().cleared).toEqual([1])
    expect(loadPyithon().xp).toBe(40)
    expect(localStorage.getItem('hunter-association-save-v1')).toContain('100')
    expect(localStorage.getItem('akcp-save-v1')).toContain('version')
    expect(localStorage.getItem('bash-missions-save-v1')).toBe('bash')
    expect(localStorage.getItem('python-koans-save-v1')).toBeNull()
    document.getElementById('btn-pyi-levels')!.click()
    expect(document.querySelector<HTMLButtonElement>('#pyi-level-2')!.disabled).toBe(false)
    expect(document.querySelector<HTMLButtonElement>('#pyi-level-3')!.disabled).toBe(true)
    document.getElementById('btn-pyi-handbook')!.click()
    expect(document.getElementById('pyi-guide')?.textContent).toContain('Thirty levels')
  }, 30_000)

  it('checks a Python Koans answer and an Exercism answer', async () => {
    const koanBook = koans as { levels: { answer: string }[] }
    const exercismBook = exercism as { levels: { answer: string }[] }
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    document.getElementById('btn-akcp-books')!.click()
    document.getElementById('akcp-books-simple')!.click()
    document.getElementById('akcp-book-koans')!.click()
    await vi.waitFor(() => expect(document.getElementById('btn-koan-continue')).not.toBeNull())
    expect(document.querySelectorAll('[id^="koan-module-"]')).toHaveLength(37)
    document.getElementById('btn-koan-continue')!.click()
    expect(document.querySelector('h2')?.textContent).toContain('Assert truth')
    const koanEditor = document.querySelector<HTMLTextAreaElement>('#koan-editor')!
    koanEditor.value = koanBook.levels[0]!.answer
    document.getElementById('btn-koan-check')!.click()
    await vi.waitFor(() => expect(document.getElementById('koan-debrief')).not.toBeNull(), { timeout: 20_000 })
    expect(loadPythonKoans().cleared).toEqual([1])
    expect(loadPythonKoans().xp).toBe(40)

    document.getElementById('btn-akcp-books')!.click()
    document.getElementById('akcp-book-exercism')!.click()
    await vi.waitFor(() => expect(document.getElementById('btn-expy-continue')).not.toBeNull())
    expect(document.querySelectorAll('[id^="expy-module-"]')).toHaveLength(10)
    document.getElementById('btn-expy-continue')!.click()
    expect(document.getElementById('expy-brief')?.textContent).toContain('lasagna')
    const editor = document.querySelector<HTMLTextAreaElement>('#expy-editor')!
    editor.value = exercismBook.levels[0]!.answer
    document.getElementById('btn-expy-check')!.click()
    await vi.waitFor(() => expect(document.getElementById('expy-debrief')).not.toBeNull(), { timeout: 20_000 })
    expect(loadExercismPython().cleared).toEqual([1])
    expect(loadExercismPython().xp).toBe(80)
    expect(loadPythonKoans().xp).toBe(40)
    expect(document.querySelector('.bash-credit')?.textContent).toContain('Exercism')
  }, 60_000)
})
