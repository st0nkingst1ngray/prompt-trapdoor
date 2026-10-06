import { compareOutput } from './compare'
import { validateScript } from './safety'
import type { BmLevel } from './types'

export interface CaseResult {
  args: string[]
  expectedStdout: string
  actualStdout: string
  expectedExit: number
  actualExit: number
  passed: boolean
  message: string
}

export interface GradeReport {
  passed: boolean
  results: CaseResult[]
  summary: string
}

function rstripNewlines(text: string): string {
  return text.replace(/\n+$/, '')
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function blockedReport(level: BmLevel, message: string): GradeReport {
  return {
    passed: false,
    results: [{
      args: [],
      expectedStdout: level.tests[0]?.stdout ?? '',
      actualStdout: '',
      expectedExit: level.tests[0]?.exit ?? 0,
      actualExit: 1,
      passed: false,
      message,
    }],
    summary: `0/${level.tests.length} tests passed`,
  }
}

export async function gradeLevel(level: BmLevel, script: string): Promise<GradeReport> {
  const safety = validateScript(script)
  if (!safety.ok) return blockedReport(level, safety.message)
  const { Bash } = await import('just-bash')
  const results: CaseResult[] = []
  for (const test of level.tests) {
    const files: Record<string, string> = { '/workspace/solution.sh': script }
    for (const fixture of level.fixtures) files[`/workspace/fixtures/${fixture.name}`] = fixture.text
    const bash = new Bash({
      files,
      cwd: '/workspace',
      executionLimits: {
        maxExecutionTimeMs: 3000,
        maxCommandCount: 10_000,
        maxLoopIterations: 10_000,
      },
    })
    const command = ['bash', './solution.sh', ...test.args.map(shellQuote)].join(' ')
    try {
      const run = await bash.exec(command)
      const actualStdout = rstripNewlines(run.stdout)
      const actualExit = run.exitCode
      const stdoutOk = compareOutput(actualStdout, test.stdout, test.comparison)
      const exitOk = actualExit === test.exit
      const passed = stdoutOk && exitOk
      let message = ''
      if (!passed && run.stderr.trim()) message = rstripNewlines(run.stderr)
      results.push({
        args: test.args,
        expectedStdout: test.stdout,
        actualStdout,
        expectedExit: test.exit,
        actualExit,
        passed,
        message,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The script could not finish.'
      results.push({
        args: test.args,
        expectedStdout: test.stdout,
        actualStdout: '',
        expectedExit: test.exit,
        actualExit: 124,
        passed: false,
        message: message.includes('time') ? 'Your script took too long and was stopped. Check for an infinite loop or a command waiting for input.' : message,
      })
    }
  }
  const passedCount = results.filter((item) => item.passed).length
  return {
    passed: results.length > 0 && passedCount === results.length,
    results,
    summary: `${passedCount}/${results.length} tests passed`,
  }
}
