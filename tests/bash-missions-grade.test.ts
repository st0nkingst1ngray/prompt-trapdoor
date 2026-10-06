import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCurriculum } from '../src/akcp/bashmissions/catalog'
import { compareOutput } from '../src/akcp/bashmissions/compare'
import { gradeLevel } from '../src/akcp/bashmissions/grade'

const curriculum = parseCurriculum(JSON.parse(fs.readFileSync('public/bashmissions/curriculum.json', 'utf8')))

describe('bashmissions grading', () => {
  it('compares stdout the way the upstream validator does', () => {
    expect(compareOutput('A', 'A', 'exact')).toBe(true)
    expect(compareOutput('A\n', 'A', 'exact')).toBe(false)
    expect(compareOutput('hello world', 'world', 'contains')).toBe(true)
    expect(compareOutput('a   b\nc', 'a b c', 'ignore_whitespace')).toBe(true)
    expect(compareOutput('abc', 'a.c', 'regex')).toBe(true)
    expect(compareOutput('ab', 'a|ab', 'regex')).toBe(true)
    expect(() => compareOutput('a', 'a', 'fuzzy')).toThrow(/Unknown comparison mode/)
  })

  it('passes the official level 1 answer and fails a wrong script', async () => {
    const level = curriculum.levels[0]
    const good = await gradeLevel(level, level.answer)
    expect(good.passed).toBe(true)
    expect(good.summary).toBe('2/2 tests passed')
    const bad = await gradeLevel(level, '#!/usr/bin/env bash\necho no\n')
    expect(bad.passed).toBe(false)
    expect(bad.results.some((result) => result.passed)).toBe(false)
  })

  it('rejects blocked patterns and honors a non-zero exit case', async () => {
    const blocked = await gradeLevel(curriculum.levels[0], 'sudo echo hi\n')
    expect(blocked.passed).toBe(false)
    expect(blocked.results[0]?.message).toContain('Blocked pattern')
    const finale = curriculum.levels[499]
    const graded = await gradeLevel(finale, finale.answer)
    expect(graded.passed).toBe(true)
    expect(finale.tests.some((test) => test.exit === 1)).toBe(true)
  })

  it('passes every vendored reference answer', async () => {
    for (const level of curriculum.levels) {
      const report = await gradeLevel(level, level.answer)
      expect(report.passed, `level ${level.id} ${level.title}`).toBe(true)
    }
  }, 60_000)
})
