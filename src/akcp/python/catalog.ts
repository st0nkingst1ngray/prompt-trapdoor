import { isSafeRelPath } from './safety'
import type { CodeCurriculum, CodeFile, CodeGuard, CodeLevel, CodeModule, CodeSource } from './types'

const SOURCE_KEYS = ['title', 'author', 'license', 'copyright', 'url', 'branch', 'revision'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null
  return value
}

function parseFile(value: unknown): CodeFile | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.text !== 'string') return null
  if (!isSafeRelPath(value.name) || value.text.length > 2_000_000) return null
  return { name: value.name, text: value.text }
}

function parseFiles(value: unknown): CodeFile[] | null {
  if (!Array.isArray(value)) return null
  const files: CodeFile[] = []
  for (const item of value) {
    const file = parseFile(item)
    if (!file) return null
    files.push(file)
  }
  return files
}

function parseGuards(value: unknown): CodeGuard[] | null {
  if (value == null) return []
  if (!Array.isArray(value)) return null
  const guards: CodeGuard[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.pattern !== 'string' || typeof item.message !== 'string') return null
    if (item.pattern.length === 0 || item.pattern.length > 500 || item.message.length > 500) return null
    guards.push({ pattern: item.pattern, message: item.message })
  }
  return guards
}

function parseLevel(value: unknown): CodeLevel | null {
  if (!isRecord(value)) return null
  const hints = strings(value.hints)
  const concepts = strings(value.concepts)
  const tests = strings(value.tests)
  if (!hints || hints.length !== 3 || !concepts || !tests || tests.length === 0) return null
  if (typeof value.id !== 'number' || typeof value.module !== 'number') return null
  if (typeof value.title !== 'string' || typeof value.objective !== 'string') return null
  if (typeof value.difficulty !== 'string' || typeof value.xp !== 'number') return null
  if (typeof value.debrief !== 'string' || typeof value.mistakes !== 'string') return null
  if (typeof value.guide !== 'string' || typeof value.answer !== 'string') return null
  if (typeof value.scaffold !== 'string' || typeof value.editPath !== 'string') return null
  if (!isSafeRelPath(value.editPath)) return null
  const support = parseFiles(value.support ?? [])
  const guards = parseGuards(value.guards)
  if (!support || !guards) return null
  if (value.stdin != null && typeof value.stdin !== 'string') return null
  if (value.expected != null && typeof value.expected !== 'string') return null
  return {
    id: value.id,
    module: value.module,
    title: value.title,
    difficulty: value.difficulty,
    xp: value.xp,
    objective: value.objective,
    concepts,
    hints,
    debrief: value.debrief,
    mistakes: value.mistakes,
    guide: value.guide,
    answer: value.answer,
    scaffold: value.scaffold,
    editPath: value.editPath,
    tests,
    support,
    stdin: typeof value.stdin === 'string' ? value.stdin : '',
    expected: typeof value.expected === 'string' ? value.expected : '',
    guards,
  }
}

function parseModule(value: unknown): CodeModule | null {
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

export interface CatalogLimits {
  label: string
  levels: number
  modules: number
}

export function parseCodeCurriculum(value: unknown, limits: CatalogLimits): CodeCurriculum {
  const label = limits.label
  if (!isRecord(value) || !isRecord(value.source)) throw new Error(`${label} curriculum is missing a source`)
  const sourceText: Record<string, string> = {}
  for (const key of SOURCE_KEYS) {
    const text = value.source[key]
    if (typeof text !== 'string' || (text.length === 0 && key !== 'revision')) {
      throw new Error(`${label} curriculum source.${key} is missing`)
    }
    sourceText[key] = text
  }
  if (typeof value.guide !== 'string' || value.guide.length < 20) throw new Error(`${label} guide is missing`)
  const support = parseFiles(value.support ?? [])
  if (!support) throw new Error(`${label} support files are invalid`)
  if (!Array.isArray(value.modules) || !Array.isArray(value.levels)) throw new Error(`${label} curriculum shape is wrong`)
  const modules: CodeModule[] = []
  for (const item of value.modules) {
    const parsed = parseModule(item)
    if (!parsed) throw new Error(`${label} module is invalid`)
    modules.push(parsed)
  }
  const levels: CodeLevel[] = []
  for (const item of value.levels) {
    const parsed = parseLevel(item)
    if (!parsed) throw new Error(`${label} level is invalid`)
    levels.push(parsed)
  }
  if (modules.length !== limits.modules) throw new Error(`Expected ${limits.modules} ${label} modules, found ${modules.length}`)
  if (levels.length !== limits.levels) throw new Error(`Expected ${limits.levels} ${label} levels, found ${levels.length}`)
  const ids = levels.map((level) => level.id)
  if (ids.some((id, index) => id !== index + 1)) throw new Error(`${label} level ids must be 1..${limits.levels} in order`)
  const seen = new Set<number>()
  for (const mod of modules) {
    if (seen.has(mod.id)) throw new Error(`${label} duplicate module ${mod.id}`)
    seen.add(mod.id)
    for (const id of mod.levelIds) {
      const level = levels[id - 1]
      if (!level || level.module !== mod.id) throw new Error(`${label} module ${mod.id} does not own level ${id}`)
    }
  }
  if (seen.size !== limits.modules) throw new Error(`${label} module ids are incomplete`)
  for (let id = 1; id <= limits.modules; id += 1) {
    if (!seen.has(id)) throw new Error(`${label} missing module ${id}`)
  }
  const source: CodeSource = {
    title: sourceText.title,
    author: sourceText.author,
    license: sourceText.license,
    copyright: sourceText.copyright,
    url: sourceText.url,
    branch: sourceText.branch,
    revision: sourceText.revision,
  }
  return { source, guide: value.guide, support, modules, levels }
}

export function createCodeCatalog(limits: CatalogLimits, publicPath: string) {
  let cache: CodeCurriculum | null = null

  function parse(value: unknown): CodeCurriculum {
    return parseCodeCurriculum(value, limits)
  }

  function prime(value: unknown): CodeCurriculum {
    cache = parse(value)
    return cache
  }

  function reset(): void {
    cache = null
  }

  function peek(): CodeCurriculum | null {
    return cache
  }

  async function ensure(): Promise<CodeCurriculum> {
    if (cache) return cache
    const base = import.meta.env.BASE_URL || '/'
    const response = await fetch(`${base}${publicPath}`)
    if (!response.ok) throw new Error(`${limits.label} curriculum failed to load (${response.status})`)
    return prime(await response.json())
  }

  function levelById(book: CodeCurriculum, id: number): CodeLevel {
    const level = book.levels[id - 1]
    if (!level || level.id !== id) throw new Error(`Missing ${limits.label} level ${id}`)
    return level
  }

  function moduleById(book: CodeCurriculum, id: number): CodeModule {
    const found = book.modules.find((mod) => mod.id === id)
    if (!found) throw new Error(`Missing ${limits.label} module ${id}`)
    return found
  }

  return { parse, prime, reset, peek, ensure, levelById, moduleById }
}
