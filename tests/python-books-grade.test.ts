import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseExercismCurriculum } from '../src/akcp/exercism-python/catalog'
import { gradeExercismPython } from '../src/akcp/exercism-python/grade'
import { parseKoansCurriculum } from '../src/akcp/python-koans/catalog'
import { gradePythonKoans } from '../src/akcp/python-koans/grade'
import { parsePyithonCurriculum } from '../src/akcp/pyithon/catalog'
import { gradePyithon } from '../src/akcp/pyithon/grade'

const koans = parseKoansCurriculum(JSON.parse(fs.readFileSync('public/python-koans/curriculum.json', 'utf8')))
const exercism = parseExercismCurriculum(JSON.parse(fs.readFileSync('public/exercism-python/curriculum.json', 'utf8')))
const pyithon = parsePyithonCurriculum(JSON.parse(fs.readFileSync('public/pyithon/curriculum.json', 'utf8')))

async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await run(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: size }, () => worker()))
}

describe('python book grading', () => {
  it('fails closed on network imports, host files, and shelling out', async () => {
    const level = pyithon.levels[0]
    const blocked = await gradePyithon(pyithon, level, 'import socket\nprint(socket.gethostname())\n')
    expect(blocked.passed).toBe(false)
    expect(blocked.results[0]?.message).toContain('blocked import')
    const secret = await gradePyithon(pyithon, level, 'print(open("/etc/passwd").read())\n')
    expect(secret.passed).toBe(false)
    expect(secret.results[0]?.message.toLowerCase()).toContain('blocked')
    const shell = await gradePyithon(pyithon, level, 'import os\nos.system("echo hi")\nprint("Hello, World!")\n')
    expect(shell.passed).toBe(false)
    expect(shell.results[0]?.message.toLowerCase()).toContain('blocked')
  })

  it('rejects a pyi-thon print that skips the concept', async () => {
    const level = pyithon.levels[1]
    const cheat = await gradePyithon(pyithon, level, 'print("Alice")\n')
    expect(cheat.passed).toBe(false)
    expect(cheat.results[0]?.message).toContain('variable')
  })

  it('passes every pyi-thon reference answer and fails a wrong print', async () => {
    const wrong = await gradePyithon(pyithon, pyithon.levels[0], 'print("nope")\n')
    expect(wrong.passed).toBe(false)
    await pool(pyithon.levels, 4, async (level) => {
      const report = await gradePyithon(pyithon, level, level.answer)
      expect(report.passed, `pyi-thon ${level.id} ${level.title}: ${report.results[0]?.message}`).toBe(true)
    })
  }, 120_000)

  it('passes every Python Koans reference answer', async () => {
    const broken = await gradePythonKoans(koans, koans.levels[0], koans.levels[0].scaffold)
    expect(broken.passed).toBe(false)
    await pool(koans.levels, 4, async (level) => {
      const report = await gradePythonKoans(koans, level, level.answer)
      expect(report.passed, `koan ${level.id} ${level.title}: ${report.results[0]?.message}`).toBe(true)
    })
  }, 300_000)

  it('passes every Exercism Python reference answer', async () => {
    const broken = await gradeExercismPython(exercism, exercism.levels[0], exercism.levels[0].scaffold)
    expect(broken.passed).toBe(false)
    await pool(exercism.levels, 4, async (level) => {
      const report = await gradeExercismPython(exercism, level, level.answer)
      expect(report.passed, `${level.id} ${level.title}: ${report.results[0]?.message}`).toBe(true)
    })
  }, 300_000)
})
