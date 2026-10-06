#!/usr/bin/env node
/**
 * Refresh the vendored Exercism Python curriculum from an upstream checkout.
 *
 * Copies non-deprecated concept and practice exercises (instructions, starter,
 * tests, and the exemplar). Skips .meta design notes, .articles, and .approaches.
 *
 * Usage:
 *   node scripts/refresh-exercism-python.mjs /path/to/exercism/python
 *
 * Upstream: https://github.com/exercism/python (branch main)
 * Copyright (c) 2021 Exercism, MIT License.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const upstream = process.argv[2]
if (!upstream) {
  console.error('Usage: node scripts/refresh-exercism-python.mjs <path-to-exercism-python>')
  process.exit(1)
}

const root = path.resolve(upstream)
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const out = path.join(repoRoot, 'public', 'exercism-python', 'curriculum.json')
const built = spawnSync('python3', [path.join(repoRoot, 'scripts', 'build-exercism-python.py'), root, out], { stdio: 'inherit' })
if (built.status !== 0) process.exit(built.status ?? 1)

const licenseDir = path.join(repoRoot, 'third_party', 'exercism-python')
fs.mkdirSync(licenseDir, { recursive: true })
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(licenseDir, 'LICENSE'))

const curriculum = JSON.parse(fs.readFileSync(out, 'utf8'))
if (curriculum.levels.length !== 149 || curriculum.modules.length !== 10) {
  console.error(`Expected 149 levels and 10 modules, found ${curriculum.levels.length} / ${curriculum.modules.length}`)
  process.exit(1)
}
