#!/usr/bin/env node
/**
 * Grok 4.7 harness — box-side status CLI (Grok Bot runs this).
 * Writes public/harness-status.json. `vite` dev serves it live; the game polls it every 15 s,
 * so the player sees inventing → building → web_ready → apk_building → apk_ready while they keep playing.
 *
 *   node scripts/harness.mjs list
 *   node scripts/harness.mjs add --prompt "C door about fake citations" [--id hj-…] [--kind gate|tweak|bug]
 *   node scripts/harness.mjs set <id|latest> <state> [--note "…"] [--result runaway]
 *   node scripts/harness.mjs show <id|latest>
 *   node scripts/harness.mjs pull                      # import jobs queued via the private Worker API
 *
 * Private Worker (workers/harness-api): set HARNESS_API_URL + HARNESS_TOKEN in the env, or put them in
 * `.harness.local` at the repo root (gitignored via *.local). Then `pull` imports prompts sent from the game,
 * and every `set` is mirrored to the Worker with PATCH /v1/jobs/:id (add --local-only to skip).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const JOB_STATES = ['inventing', 'building', 'web_ready', 'apk_building', 'apk_ready', 'failed']
/** Keep in sync with src/harness/buildQueue.ts TRANSITIONS (tests/harness.test.ts checks). */
export const TRANSITIONS = {
  inventing: ['building', 'failed'],
  building: ['web_ready', 'failed'],
  web_ready: ['apk_building', 'building', 'failed'],
  apk_building: ['apk_ready', 'failed'],
  apk_ready: ['building'],
  failed: ['inventing', 'building'],
}

const here = path.dirname(fileURLToPath(import.meta.url))
export const STATUS_FILE = process.env.HARNESS_STATUS_FILE || path.join(here, '..', 'public', 'harness-status.json')

export function readStatus(file = STATUS_FILE) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (s && Array.isArray(s.jobs)) return s
  } catch {}
  return { version: 1, updatedAt: new Date(0).toISOString(), jobs: [] }
}

/** `vite preview` / static hosting serve dist/, so mirror there too (no rebuild needed for status). */
const DIST_MIRROR = path.join(here, '..', 'dist', 'harness-status.json')

export function writeStatus(s, file = STATUS_FILE) {
  s.updatedAt = new Date().toISOString()
  s.jobs = s.jobs.slice(-30)
  const body = `${JSON.stringify(s, null, 2)}\n`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  if (file === STATUS_FILE && !process.env.HARNESS_STATUS_FILE && fs.existsSync(path.dirname(DIST_MIRROR))) {
    fs.writeFileSync(DIST_MIRROR, body)
  }
}

export function canTransition(from, to) {
  return from === to || (TRANSITIONS[from] || []).includes(to)
}

function findJob(s, id) {
  if (id === 'latest') return [...s.jobs].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]
  return s.jobs.find((j) => j.id === id)
}

export function addJob(s, { prompt, id, kind = 'gate' }) {
  const text = String(prompt || '').trim().replace(/\s+/g, ' ')
  if (!text) throw new Error('--prompt is required')
  const at = new Date().toISOString()
  const jid = id || `hj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  if (s.jobs.some((j) => j.id === jid)) throw new Error(`job ${jid} already exists`)
  const job = { id: jid, prompt: text.slice(0, 500), kind, context: null, state: 'inventing', createdAt: at, updatedAt: at, history: [{ state: 'inventing', at, note: 'Picked up by Grok Bot' }] }
  s.jobs.push(job)
  return job
}

export function setJob(s, id, state, { note, result } = {}) {
  if (!JOB_STATES.includes(state)) throw new Error(`unknown state ${state} (use ${JOB_STATES.join(' | ')})`)
  const job = findJob(s, id)
  if (!job) throw new Error(`no job ${id}`)
  if (!canTransition(job.state, state)) throw new Error(`can't go ${job.state} → ${state}`)
  const at = new Date(Math.max(Date.now(), Date.parse(job.updatedAt) + 1)).toISOString()
  job.state = state
  job.updatedAt = at
  if (note !== undefined) job.note = note
  if (result !== undefined) job.result = result
  job.history.push({ state, at, ...(note ? { note } : {}) })
  return job
}

// ---------- private Worker API (optional) ----------

const LOCAL_ENV = path.join(here, '..', '.harness.local')

/** { url, token } from env or .harness.local, else null. Never printed. */
export function remoteConfig(env = process.env, file = LOCAL_ENV) {
  let url = env.HARNESS_API_URL || ''
  let token = env.HARNESS_TOKEN || ''
  if ((!url || !token) && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(HARNESS_API_URL|HARNESS_TOKEN)\s*=\s*(.*?)\s*$/.exec(line)
      if (!m) continue
      const v = m[2].replace(/^['"]|['"]$/g, '')
      if (m[1] === 'HARNESS_API_URL' && !url) url = v
      if (m[1] === 'HARNESS_TOKEN' && !token) token = v
    }
  }
  url = url.replace(/\/+$/, '')
  return url && token ? { url, token } : null
}

async function api(cfg, method, p, body) {
  const res = await fetch(`${cfg.url}${p}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

/** Merge Worker jobs into the local status object. Remote-only jobs are added; newer remote wins. Returns changed jobs. */
export function mergeWorkerJobs(s, jobs) {
  const changed = []
  for (const r of jobs) {
    if (!r || typeof r.id !== 'string' || !JOB_STATES.includes(r.state)) continue
    const mine = s.jobs.find((j) => j.id === r.id)
    if (!mine) {
      const { source: _s, ...rest } = r
      s.jobs.push({ ...rest, history: Array.isArray(r.history) ? r.history : [] })
      changed.push(r)
    } else if (r.updatedAt > mine.updatedAt) {
      Object.assign(mine, { state: r.state, updatedAt: r.updatedAt, history: r.history || mine.history })
      if (r.note !== undefined) mine.note = r.note
      if (r.result !== undefined) mine.result = r.result
      changed.push(mine)
    }
  }
  return changed
}

export async function pullRemote(s, cfg) {
  const { status, data } = await api(cfg, 'GET', '/v1/status?limit=50')
  if (status !== 200 || !Array.isArray(data.jobs)) throw new Error(`pull failed: ${data.error || `HTTP ${status}`}`)
  return mergeWorkerJobs(s, data.jobs)
}

/** Mirror a local state change to the Worker. Jobs that never went through the Worker (404) are skipped. */
export async function pushRemoteState(cfg, job) {
  const { status, data } = await api(cfg, 'PATCH', `/v1/jobs/${encodeURIComponent(job.id)}`, {
    state: job.state,
    ...(job.note ? { note: job.note } : {}),
    ...(job.result ? { result: job.result } : {}),
  })
  if (status === 200) return 'synced'
  if (status === 404) return 'not on worker'
  return `worker said ${data.error || `HTTP ${status}`}`
}

function parseFlags(argv) {
  const pos = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--local-only') {
      flags['local-only'] = true
      continue
    }
    if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[i + 1] ?? ''
    else {
      pos.push(argv[i])
      continue
    }
    i++
  }
  return { pos, flags }
}

async function main(argv) {
  const [cmd, ...rest] = argv
  const { pos, flags } = parseFlags(rest)
  const s = readStatus()
  const line = (j) => `${j.id}  ${j.state.padEnd(12)}  ${j.prompt.slice(0, 60)}${j.note ? `  · ${j.note}` : ''}`
  switch (cmd) {
    case 'list':
      if (!s.jobs.length) console.log('(no jobs)')
      for (const j of s.jobs) console.log(line(j))
      return 0
    case 'show': {
      const j = findJob(s, pos[0] || 'latest')
      if (!j) throw new Error('no such job')
      console.log(JSON.stringify(j, null, 2))
      return 0
    }
    case 'add': {
      const j = addJob(s, { prompt: flags.prompt, id: flags.id, kind: flags.kind })
      writeStatus(s)
      console.log(line(j))
      return 0
    }
    case 'set': {
      const [id, state] = pos
      if (!id || !state) throw new Error('usage: set <id|latest> <state> [--note …] [--result …]')
      const j = setJob(s, id, state, { note: flags.note, result: flags.result })
      writeStatus(s)
      console.log(line(j))
      const cfg = !flags['local-only'] && remoteConfig()
      if (cfg) console.log(`  worker: ${await pushRemoteState(cfg, j)}`)
      return 0
    }
    case 'pull': {
      const cfg = remoteConfig()
      if (!cfg) throw new Error('set HARNESS_API_URL + HARNESS_TOKEN (env or .harness.local) first')
      const changed = await pullRemote(s, cfg)
      writeStatus(s)
      if (!changed.length) console.log('(nothing new on the worker)')
      for (const j of changed) console.log(line(j))
      return 0
    }
    default:
      console.log('usage: harness.mjs list | show [id] | pull | add --prompt "…" [--id] [--kind] | set <id|latest> <state> [--note] [--result] [--local-only]')
      return cmd ? 2 : 0
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`harness: ${e.message}`)
      process.exit(1)
    },
  )
}
