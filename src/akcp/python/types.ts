export interface CodeFile {
  name: string
  text: string
}

export interface CodeGuard {
  pattern: string
  message: string
}

export interface CodeLevel {
  id: number
  module: number
  title: string
  difficulty: string
  xp: number
  objective: string
  concepts: string[]
  hints: string[]
  debrief: string
  mistakes: string
  guide: string
  answer: string
  scaffold: string
  editPath: string
  tests: string[]
  support: CodeFile[]
  stdin: string
  expected: string
  guards: CodeGuard[]
}

export interface CodeModule {
  id: number
  name: string
  display: string
  slug: string
  blurb: string
  difficulty: string
  levelIds: number[]
}

export interface CodeSource {
  title: string
  author: string
  license: string
  copyright: string
  url: string
  branch: string
  revision: string
}

export interface CodeCurriculum {
  source: CodeSource
  guide: string
  support: CodeFile[]
  modules: CodeModule[]
  levels: CodeLevel[]
}

export interface CodeSave {
  version: 1
  cleared: number[]
  xp: number
  fails: Record<string, number>
  hints: Record<string, number>
  drafts: Record<string, string>
  certifiedOn: Record<string, string>
  playerName: string
}

export interface AwardInput {
  levelId: number
  xp: number
  moduleId: number
  moduleLevelIds: number[]
  today: string
}

export interface AwardResult {
  save: CodeSave
  xpGained: number
  certificate: boolean
}

export interface GradeCase {
  name: string
  passed: boolean
  message: string
}

export interface GradeReport {
  passed: boolean
  results: GradeCase[]
  summary: string
}
