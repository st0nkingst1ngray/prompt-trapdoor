import {
  BASH_MISSIONS_LEVELS,
  BASH_MISSIONS_MODULES,
  type BmLevel,
  type BmModule,
  type Curriculum,
} from './types'

let cache: Curriculum | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null
  return value
}

function parseLevel(value: unknown): BmLevel | null {
  if (!isRecord(value)) return null
  const hints = strings(value.hints)
  const concepts = strings(value.concepts)
  if (!hints || hints.length !== 3 || !concepts) return null
  if (typeof value.id !== 'number' || typeof value.module !== 'number') return null
  if (typeof value.title !== 'string' || typeof value.objective !== 'string') return null
  if (typeof value.difficulty !== 'string' || typeof value.xp !== 'number') return null
  if (typeof value.debrief !== 'string' || typeof value.mistakes !== 'string') return null
  if (typeof value.guide !== 'string' || typeof value.answer !== 'string') return null
  if (typeof value.scaffold !== 'string' || !Array.isArray(value.tests)) return null
  const tests = []
  for (const test of value.tests) {
    if (!isRecord(test)) return null
    const args = strings(test.args)
    if (!args || typeof test.stdout !== 'string' || typeof test.exit !== 'number') return null
    if (typeof test.comparison !== 'string') return null
    tests.push({ args, stdout: test.stdout, exit: test.exit, comparison: test.comparison })
  }
  if (!Array.isArray(value.fixtures)) return null
  const fixtures = []
  for (const fixture of value.fixtures) {
    if (!isRecord(fixture) || typeof fixture.name !== 'string' || typeof fixture.text !== 'string') return null
    if (fixture.name.includes('/') || fixture.name.includes('..') || fixture.name.length === 0) return null
    fixtures.push({ name: fixture.name, text: fixture.text })
  }
  return {
    id: value.id,
    module: value.module,
    title: value.title,
    difficulty: value.difficulty,
    xp: value.xp,
    objective: value.objective,
    concepts,
    tests,
    hints,
    debrief: value.debrief,
    mistakes: value.mistakes,
    guide: value.guide,
    answer: value.answer,
    scaffold: value.scaffold,
    fixtures,
  }
}

function parseModule(value: unknown): BmModule | null {
  if (!isRecord(value)) return null
  const levelIds = value.levelIds
  if (!Array.isArray(levelIds) || !levelIds.every((id) => typeof id === 'number')) return null
  if (typeof value.id !== 'number' || typeof value.name !== 'string') return null
  if (typeof value.display !== 'string' || typeof value.slug !== 'string') return null
  if (typeof value.blurb !== 'string' || typeof value.difficulty !== 'string') return null
  return {
    id: value.id,
    name: value.name,
    display: value.display,
    slug: value.slug,
    blurb: value.blurb,
    difficulty: value.difficulty,
    levelIds,
  }
}

export function parseCurriculum(value: unknown): Curriculum {
  if (!isRecord(value) || !isRecord(value.source)) throw new Error('BashMissions curriculum is missing a source')
  const source = value.source
  const sourceText: Record<string, string> = {}
  for (const key of ['title', 'author', 'license', 'copyright', 'url', 'branch', 'revision']) {
    const text = source[key]
    if (typeof text !== 'string' || (text.length === 0 && key !== 'revision')) {
      throw new Error(`BashMissions curriculum source.${key} is missing`)
    }
    sourceText[key] = text
  }
  if (typeof value.guide !== 'string' || value.guide.length < 20) throw new Error('BashMissions guide is missing')
  if (!Array.isArray(value.modules) || !Array.isArray(value.levels)) throw new Error('BashMissions curriculum shape is wrong')
  const modules: BmModule[] = []
  for (const item of value.modules) {
    const parsed = parseModule(item)
    if (!parsed) throw new Error('BashMissions module is invalid')
    modules.push(parsed)
  }
  const levels: BmLevel[] = []
  for (const item of value.levels) {
    const parsed = parseLevel(item)
    if (!parsed) throw new Error('BashMissions level is invalid')
    levels.push(parsed)
  }
  if (modules.length !== BASH_MISSIONS_MODULES) {
    throw new Error(`Expected ${BASH_MISSIONS_MODULES} modules, found ${modules.length}`)
  }
  if (levels.length !== BASH_MISSIONS_LEVELS) {
    throw new Error(`Expected ${BASH_MISSIONS_LEVELS} levels, found ${levels.length}`)
  }
  const ids = levels.map((level) => level.id)
  if (ids.some((id, index) => id !== index + 1)) throw new Error('BashMissions level ids must be 1..500 in order')
  const seen = new Set<number>()
  for (const mod of modules) {
    if (seen.has(mod.id)) throw new Error(`Duplicate module ${mod.id}`)
    seen.add(mod.id)
    for (const id of mod.levelIds) {
      const level = levels[id - 1]
      if (!level || level.module !== mod.id) throw new Error(`Module ${mod.id} does not own level ${id}`)
    }
  }
  if (seen.size !== BASH_MISSIONS_MODULES) throw new Error('Module ids are not 1..26')
  for (let id = 1; id <= BASH_MISSIONS_MODULES; id += 1) {
    if (!seen.has(id)) throw new Error(`Missing module ${id}`)
  }
  return {
    source: {
      title: sourceText.title,
      author: sourceText.author,
      license: sourceText.license,
      copyright: sourceText.copyright,
      url: sourceText.url,
      branch: sourceText.branch,
      revision: sourceText.revision,
    },
    guide: value.guide,
    modules,
    levels,
  }
}

export function primeCurriculum(value: unknown): Curriculum {
  cache = parseCurriculum(value)
  return cache
}

export function resetCurriculumCache(): void {
  cache = null
}

export function peekCurriculum(): Curriculum | null {
  return cache
}

export async function ensureCurriculum(): Promise<Curriculum> {
  if (cache) return cache
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base}bashmissions/curriculum.json`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`BashMissions curriculum failed to load (${response.status})`)
  return primeCurriculum(await response.json())
}

export function levelById(curriculum: Curriculum, id: number): BmLevel {
  const level = curriculum.levels[id - 1]
  if (!level || level.id !== id) throw new Error(`Missing BashMissions level ${id}`)
  return level
}

export function moduleById(curriculum: Curriculum, id: number): BmModule {
  const found = curriculum.modules.find((mod) => mod.id === id)
  if (!found) throw new Error(`Missing BashMissions module ${id}`)
  return found
}
