import { missionFiles } from '../python/safety'
import { blockedReport, checkGuards, stdoutReport } from '../python/report'
import { runPython } from '../python/run'
import type { CodeCurriculum, CodeLevel, GradeReport } from '../python/types'

export async function gradePyithon(book: CodeCurriculum, level: CodeLevel, source: string): Promise<GradeReport> {
  const missed = checkGuards(source, level.guards)
  if (missed) return missed
  try {
    const files = missionFiles(book.support, level.support, level.editPath, source)
    const run = await runPython(files, { mode: 'stdout', tests: ['stdout'], stdin: level.stdin })
    return stdoutReport(run, level.expected)
  } catch (error) {
    return blockedReport(error instanceof Error ? error.message : 'The check was refused.')
  }
}
