#!/usr/bin/env node
/**
 * Refresh the vendored BashMissions curriculum from an upstream checkout.
 *
 * Copies lesson text, levels.json test cases, fixtures, and the MIT license.
 * Does not copy the Python Rich engine (engine/*.py, play.sh).
 *
 * Usage:
 *   node scripts/refresh-bashmissions.mjs /path/to/bashmissions
 *
 * Upstream: https://github.com/devopshobbies/bashmissions (branch master)
 * Copyright (c) 2026 Jalil Abdollahi, MIT License.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const upstream = process.argv[2]
if (!upstream) {
  console.error('Usage: node scripts/refresh-bashmissions.mjs <path-to-bashmissions>')
  process.exit(1)
}

const root = path.resolve(upstream)
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const outDir = path.join(repoRoot, 'public', 'bashmissions')
const licenseDir = path.join(repoRoot, 'third_party', 'bashmissions')

const DEFAULT_SCAFFOLD = '#!/usr/bin/env bash\nset -euo pipefail\n\n'

function readText(file) {
  return fs.readFileSync(file, 'utf8')
}

function readOptional(file, fallback) {
  return fs.existsSync(file) ? readText(file) : fallback
}

function revision() {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function blurbs() {
  const md = readText(path.join(root, 'CURRICULUM.md'))
  const found = new Map()
  const re = /^## Module (\d+) —[^\n]*\n\n> (.+)$/gm
  for (const match of md.matchAll(re)) found.set(Number(match[1]), match[2].trim())
  return found
}

function fixturesFor(levelDir) {
  const dir = path.join(levelDir, 'fixtures')
  if (!fs.existsSync(dir)) return []
  const fixtures = []
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (!stat.isFile()) throw new Error(`Unsupported fixture directory: ${full}`)
    fixtures.push({ name, text: readText(full) })
  }
  return fixtures
}

const levelsJson = JSON.parse(readText(path.join(root, 'levels.json')))
if (!Array.isArray(levelsJson)) throw new Error('levels.json is not an array')

const blurbByModule = blurbs()
const modules = new Map()
const levels = []

for (const row of levelsJson) {
  const levelDir = path.join(root, row.path)
  const hints = [1, 2, 3].map((n) => readText(path.join(levelDir, `hint-${n}.txt`)))
  const level = {
    id: row.id,
    module: row.module,
    title: row.title,
    difficulty: row.difficulty,
    xp: row.xp,
    objective: row.objective,
    concepts: row.concepts ?? [],
    tests: (row.test_cases ?? []).map((test) => ({
      args: (test.args ?? []).map(String),
      stdout: test.expected_stdout ?? '',
      exit: test.expected_exit ?? 0,
      comparison: test.comparison ?? 'exact',
    })),
    hints,
    debrief: readText(path.join(levelDir, 'debrief.md')),
    mistakes: readText(path.join(levelDir, 'common-mistakes.md')),
    guide: readText(path.join(levelDir, 'solution-guide.md')),
    answer: readText(path.join(levelDir, 'answer.sh')),
    scaffold: readOptional(path.join(levelDir, 'solution.sh'), DEFAULT_SCAFFOLD),
    fixtures: fixturesFor(levelDir),
  }
  levels.push(level)
  if (!modules.has(row.module)) {
    modules.set(row.module, {
      id: row.module,
      name: row.module_name,
      display: row.module_display,
      slug: row.module_path_slug,
      blurb: blurbByModule.get(row.module) ?? '',
      difficulty: (row.module_difficulty_range ?? [row.difficulty])[0] ?? row.difficulty,
      levelIds: [],
    })
  }
  modules.get(row.module).levelIds.push(row.id)
}

const curriculum = {
  source: {
    title: 'BashMissions',
    author: 'Jalil Abdollahi',
    license: 'MIT',
    copyright: 'Copyright (c) 2026 Jalil Abdollahi',
    url: 'https://github.com/devopshobbies/bashmissions',
    branch: 'master',
    revision: revision(),
  },
  guide: readText(path.join(root, 'BASH_GUIDE.md')),
  modules: [...modules.values()].sort((a, b) => a.id - b.id),
  levels,
}

fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(licenseDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'curriculum.json'), JSON.stringify(curriculum))
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(licenseDir, 'LICENSE'))

const bytes = fs.statSync(path.join(outDir, 'curriculum.json')).size
console.log(`Wrote ${levels.length} levels, ${curriculum.modules.length} modules (${bytes} bytes)`)
if (levels.length !== 500 || curriculum.modules.length !== 26) {
  console.error('Expected 500 levels and 26 modules')
  process.exit(1)
}
