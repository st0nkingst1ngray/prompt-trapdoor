#!/usr/bin/env node
/**
 * Refresh the vendored pyi-thon curriculum from an upstream checkout.
 *
 * Reads the English LEVELS array. Does not copy the React app or the Korean overlay.
 *
 * Usage:
 *   node scripts/refresh-pyithon.mjs /path/to/pyi-thon
 *
 * Upstream: https://github.com/aiedwardyi/pyi-thon (branch main)
 * Copyright (c) 2026 Edward Yi, MIT License.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const upstream = process.argv[2]
if (!upstream) {
  console.error('Usage: node scripts/refresh-pyithon.mjs <path-to-pyi-thon>')
  process.exit(1)
}

const root = path.resolve(upstream)
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const out = path.join(repoRoot, 'public', 'pyithon', 'curriculum.json')
const built = spawnSync('python3', [path.join(repoRoot, 'scripts', 'build-pyithon.py'), root, out], { stdio: 'inherit' })
if (built.status !== 0) process.exit(built.status ?? 1)

const licenseDir = path.join(repoRoot, 'third_party', 'pyithon')
fs.mkdirSync(licenseDir, { recursive: true })
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(licenseDir, 'LICENSE'))

const curriculum = JSON.parse(fs.readFileSync(out, 'utf8'))
if (curriculum.levels.length !== 30 || curriculum.modules.length !== 3) {
  console.error('Expected 30 levels and 3 modules')
  process.exit(1)
}
