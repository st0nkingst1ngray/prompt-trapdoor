import type { PythonResult } from './run'
import type { CodeGuard, GradeReport } from './types'

export function blockedReport(message: string, total = 1): GradeReport {
  return {
    passed: false,
    results: [{ name: 'check', passed: false, message }],
    summary: `0/${total} tests passed`,
  }
}

function shortName(name: string): string {
  const parts = name.split('.')
  return parts[parts.length - 1] || name
}

export function reportFromTests(run: PythonResult, labels: string[]): GradeReport {
  const total = run.total > 0 ? run.total : labels.length || 1
  if (run.ok) {
    const names = labels.length ? labels : ['python']
    return {
      passed: true,
      results: names.map((name) => ({ name: shortName(name), passed: true, message: '' })),
      summary: `${names.length}/${names.length} tests passed`,
    }
  }
  if (run.failures.length > 0) {
    return {
      passed: false,
      results: run.failures.map((failure) => ({
        name: shortName(failure.name),
        passed: false,
        message: failure.message,
      })),
      summary: `${Math.max(0, total - run.failures.length)}/${total} tests passed`,
    }
  }
  return blockedReport(run.error || 'The check failed.', total)
}

/** Same trim as pyi-thon: drop surrounding blank space, then trailing spaces on each line. */
export function normalizeOutput(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/g, '')).join('\n').trim()
}

export function stdoutReport(run: PythonResult, expected: string): GradeReport {
  const actual = normalizeOutput(run.stdout)
  const want = normalizeOutput(expected)
  const matched = run.ok && actual === want
  const message = matched
    ? ''
    : `expected:\n${want}\nactual:\n${actual}${run.error ? `\n${run.error}` : ''}`
  return {
    passed: matched,
    results: [{ name: 'stdout', passed: matched, message }],
    summary: matched ? '1/1 tests passed' : '0/1 tests passed',
  }
}

export function guardFailure(guard: CodeGuard): GradeReport {
  return blockedReport(guard.message, 1)
}

export function checkGuards(source: string, guards: CodeGuard[]): GradeReport | null {
  for (const guard of guards) {
    let pattern: RegExp
    try {
      pattern = new RegExp(guard.pattern)
    } catch {
      return blockedReport('This mission’s check could not start.', 1)
    }
    if (!pattern.test(source)) return guardFailure(guard)
  }
  return null
}
