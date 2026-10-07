import { missionFiles } from '../python/safety'
import { blockedReport, reportFromTests } from '../python/report'
import { runPython } from '../python/run'
import type { CodeCurriculum, CodeLevel, GradeReport } from '../python/types'

export async function gradeExercismPython(book: CodeCurriculum, level: CodeLevel, source: string): Promise<GradeReport> {
  try {
    const files = missionFiles(book.support, level.support, level.editPath, source)
    const run = await runPython(files, { mode: 'unittest', tests: level.tests, stdin: '' })
    return reportFromTests(run, level.tests)
  } catch (error) {
    return blockedReport(error instanceof Error ? error.message : 'The check was refused.')
  }
}
