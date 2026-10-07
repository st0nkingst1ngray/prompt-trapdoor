#!/usr/bin/env node
/**
 * Refresh the vendored Python Koans curriculum from an upstream checkout.
 *
 * Usage:
 *   node scripts/refresh-python-koans.mjs /path/to/python_koans
 *
 * Upstream: https://github.com/gregmalcolm/python_koans (branch master)
 * Copyright 2021 Greg Malcolm and The Status Is Not Quo, MIT License.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const upstream = process.argv[2]
if (!upstream) {
  console.error('Usage: node scripts/refresh-python-koans.mjs <path-to-python_koans>')
  process.exit(1)
}

const root = path.resolve(upstream)
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const out = path.join(repoRoot, 'public', 'python-koans', 'curriculum.json')
const built = spawnSync('python3', [path.join(repoRoot, 'scripts', 'build-python-koans.py'), root, out], { stdio: 'inherit' })
if (built.status !== 0) process.exit(built.status ?? 1)

const licenseDir = path.join(repoRoot, 'third_party', 'python-koans')
fs.mkdirSync(licenseDir, { recursive: true })
const license = fs.existsSync(path.join(root, 'MIT-LICENSE')) ? 'MIT-LICENSE' : 'LICENSE'
fs.copyFileSync(path.join(root, license), path.join(licenseDir, 'LICENSE'))

const curriculum = JSON.parse(fs.readFileSync(out, 'utf8'))
if (curriculum.levels.length !== 278 || curriculum.modules.length !== 37) {
  console.error('Expected 278 levels and 37 modules')
  process.exit(1)
}
