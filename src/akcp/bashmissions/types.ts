export interface BmTest {
  args: string[]
  stdout: string
  exit: number
  comparison: string
}

export interface BmFixture {
  name: string
  text: string
}

export interface BmLevel {
  id: number
  module: number
  title: string
  difficulty: string
  xp: number
  objective: string
  concepts: string[]
  tests: BmTest[]
  hints: string[]
  debrief: string
  mistakes: string
  guide: string
  answer: string
  scaffold: string
  fixtures: BmFixture[]
}

export interface BmModule {
  id: number
  name: string
  display: string
  slug: string
  blurb: string
  difficulty: string
  levelIds: number[]
}

export interface BmSource {
  title: string
  author: string
  license: string
  copyright: string
  url: string
  branch: string
  revision: string
}

export interface Curriculum {
  source: BmSource
  guide: string
  modules: BmModule[]
  levels: BmLevel[]
}

export const BASH_MISSIONS_LEVELS = 500
export const BASH_MISSIONS_MODULES = 26
