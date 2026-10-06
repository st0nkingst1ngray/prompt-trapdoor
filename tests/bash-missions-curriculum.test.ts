import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { ensureCurriculum, parseCurriculum, resetCurriculumCache } from '../src/akcp/bashmissions/catalog'
import { renderLesson } from '../src/akcp/bashmissions/lesson'
import { BASH_MISSIONS_LEVELS, BASH_MISSIONS_MODULES } from '../src/akcp/bashmissions/types'

const curriculum = parseCurriculum(JSON.parse(fs.readFileSync('public/bashmissions/curriculum.json', 'utf8')))

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

describe('bashmissions curriculum', () => {
  it('loads 500 levels across 26 modules with lesson text and tests', () => {
    expect(curriculum.levels).toHaveLength(BASH_MISSIONS_LEVELS)
    expect(curriculum.modules).toHaveLength(BASH_MISSIONS_MODULES)
    expect(curriculum.levels.map((level) => level.id)).toEqual(
      Array.from({ length: 500 }, (_, index) => index + 1),
    )
    expect(curriculum.modules.reduce((sum, mod) => sum + mod.levelIds.length, 0)).toBe(500)
    expect(curriculum.source.author).toBe('Jalil Abdollahi')
    expect(curriculum.source.license).toBe('MIT')
    expect(curriculum.source.copyright).toContain('2026 Jalil Abdollahi')
    expect(curriculum.guide).toContain('What Bash Is')
    for (const level of curriculum.levels) {
      expect(level.objective.length).toBeGreaterThan(0)
      expect(level.hints).toHaveLength(3)
      expect(level.hints.every((hint) => hint.length > 0)).toBe(true)
      expect(level.debrief.length).toBeGreaterThan(0)
      expect(level.mistakes.length).toBeGreaterThan(0)
      expect(level.guide.length).toBeGreaterThan(0)
      expect(level.answer).toContain('bash')
      expect(level.tests.length).toBeGreaterThan(0)
    }
    expect(curriculum.modules.every((mod) => mod.blurb.length > 0)).toBe(true)
  })

  it('escapes lesson html and still renders fenced code', () => {
    const html = renderLesson('# Title\n\n<script>alert(1)</script>\n\n```bash\necho hi\n```', escapeHtml)
    expect(html).toContain('Title')
    expect(html).toContain('echo hi')
    expect(html).not.toContain('<script>')
  })

  it('fetches the public curriculum when the cache is empty', async () => {
    resetCurriculumCache()
    const raw = JSON.parse(fs.readFileSync('public/bashmissions/curriculum.json', 'utf8')) as unknown
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(String(url)).toContain('bashmissions/curriculum.json')
      return new Response(JSON.stringify(raw), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    const loaded = await ensureCurriculum()
    expect(loaded.levels).toHaveLength(500)
    expect(await ensureCurriculum()).toBe(loaded)
    vi.unstubAllGlobals()
  })
})
