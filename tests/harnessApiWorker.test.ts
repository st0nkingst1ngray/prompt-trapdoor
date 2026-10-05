// @vitest-environment node
// Node env on purpose: happy-dom's Request drops the forbidden `Origin` header, which would hide CORS bugs.
import { describe, expect, it } from 'vitest'
import {
  JOB_STATES as W_STATES,
  PROMPTS_PER_MINUTE,
  TRANSITIONS as W_TRANSITIONS,
  applyTransition,
  buildJob,
  handle,
  notifyPayload,
  tokenMatches,
} from '../workers/harness-api/src/harness'
import { JOB_STATES, TRANSITIONS } from '../src/harness/buildQueue'
// @ts-ignore — plain .mjs CLI module
import * as cli from '../scripts/harness.mjs'
import { BASE, TOKEN, body, mkEnv, req } from './harnessApiFixtures'

describe('harness API worker — auth + CORS', () => {
  it('compares tokens in constant time (hash + xor) and rejects near misses', async () => {
    expect(await tokenMatches(TOKEN, TOKEN)).toBe(true)
    expect(await tokenMatches(`${TOKEN}x`, TOKEN)).toBe(false)
    expect(await tokenMatches(TOKEN.slice(0, -1), TOKEN)).toBe(false)
    expect(await tokenMatches('', TOKEN)).toBe(false)
  })

  it('refuses everything (503) until HARNESS_TOKEN is set, and 401s missing / wrong tokens', async () => {
    expect((await handle(req('GET', '/v1/status'), mkEnv({ HARNESS_TOKEN: undefined }))).status).toBe(503)
    expect((await handle(req('GET', '/v1/status'), mkEnv({ HARNESS_TOKEN: 'short' }))).status).toBe(503)
    const env = mkEnv()
    expect((await handle(req('GET', '/v1/status', { token: null }), env)).status).toBe(401)
    expect((await handle(req('GET', '/v1/status', { token: 'wrong-token-wrong-token-wrong' }), env)).status).toBe(401)
    expect((await handle(req('POST', '/v1/prompt', { token: 'nope', body: { text: 'x' } }), env)).status).toBe(401)
    expect((await handle(req('PATCH', '/v1/jobs/hj-abcd-1234', { token: null, body: { state: 'building' } }), env)).status).toBe(401)
    expect((await handle(req('GET', '/v1/health', { token: null }), env)).status).toBe(200)
  })

  it('CORS: only configured origins; no-Origin callers (CLI) unaffected; token never echoed', async () => {
    const env = mkEnv()
    const pre = await handle(req('OPTIONS', '/v1/prompt', { token: null, origin: 'http://localhost:5173' }), env)
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    expect((await handle(req('GET', '/v1/status', { origin: 'https://localhost' }), env)).headers.get('Access-Control-Allow-Origin')).toBe('https://localhost')
    const evil = await handle(req('GET', '/v1/status', { origin: 'https://evil.example' }), env)
    expect(evil.status).toBe(403)
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect((await handle(req('OPTIONS', '/v1/prompt', { token: null, origin: 'https://evil.example' }), env)).status).toBe(403)
    // empty ALLOWED_ORIGINS = no browser at all
    expect((await handle(req('GET', '/v1/status', { origin: 'http://localhost:5173' }), mkEnv({ ALLOWED_ORIGINS: '' }))).status).toBe(403)
    const cliRes = await handle(req('GET', '/v1/status'), env)
    expect(cliRes.status).toBe(200)
    expect(JSON.stringify(await body(cliRes))).not.toContain(TOKEN)
  })
})

describe('harness API worker — jobs', () => {
  it('POST /v1/prompt → inventing job in KV, listed newest-first, fetchable by id', async () => {
    const env = mkEnv()
    const r = await handle(req('POST', '/v1/prompt', { body: { text: '  C door   about fake citations ', rank: 'C', classId: 'shadow', xp: 120, lastGate: 'runaway', client: 'web' } }), env)
    expect(r.status).toBe(201)
    const { ok, job, notified } = await body(r)
    expect(ok).toBe(true)
    expect(notified).toBe(false)
    expect(job.id).toMatch(/^hj-[a-z0-9]+-[a-z0-9]+$/)
    expect(job).toMatchObject({ prompt: 'C door about fake citations', state: 'inventing', kind: 'gate', client: 'web' })
    expect(job.context).toMatchObject({ rank: 'C', classId: 'shadow', xp: 120, gateId: 'runaway' })
    const r2 = await body(await handle(req('POST', '/v1/prompt', { body: { text: 'second', kind: 'bug' } }), env))
    const list = await body(await handle(req('GET', '/v1/status'), env))
    expect(list.version).toBe(1)
    expect(list.jobs.map((j: any) => j.id)).toEqual([r2.job.id, job.id])
    expect((await body(await handle(req('GET', `/v1/status/${job.id}`), env))).job.prompt).toBe('C door about fake citations')
    expect((await handle(req('GET', '/v1/status/hj-missing-0000'), env)).status).toBe(404)
    expect((await handle(req('GET', '/v1/status/..%2Fjobs:index'), env)).status).toBe(404)
  })

  it('validates bodies', async () => {
    const env = mkEnv()
    expect((await handle(req('POST', '/v1/prompt', { body: { text: '   ' } }), env)).status).toBe(400)
    expect((await handle(req('POST', '/v1/prompt', { body: { text: 'x'.repeat(501) } }), env)).status).toBe(400)
    expect((await handle(req('POST', '/v1/prompt', { body: 'not json' }), env)).status).toBe(400)
    expect((await handle(req('POST', '/v1/prompt', { body: { text: 'y'.repeat(5000) } }), env)).status).toBe(400)
    expect(buildJob({ text: 'ok', kind: 'evil', xp: -5 }).ok && (buildJob({ text: 'ok', kind: 'evil' }) as any).job.kind).toBe('gate')
  })

  it('PATCH follows the game state machine (409 on skips, failed → retry ok, updatedAt strictly grows)', async () => {
    const env = mkEnv()
    const { job } = await body(await handle(req('POST', '/v1/prompt', { body: { text: 'walk me' } }), env))
    const patch = (state: string, note?: string) => handle(req('PATCH', `/v1/jobs/${job.id}`, { body: { state, ...(note ? { note } : {}) } }), env)
    expect((await patch('apk_ready')).status).toBe(409)
    expect((await patch('web_ready')).status).toBe(409)
    expect((await patch('nonsense')).status).toBe(409)
    expect((await patch('failed', 'tsc error')).status).toBe(200)
    expect((await patch('inventing')).status).toBe(200)
    let last = job.updatedAt
    for (const s of ['building', 'web_ready', 'apk_building', 'apk_ready']) {
      const r = await patch(s, `now ${s}`)
      expect(r.status, s).toBe(200)
      const j = (await body(r)).job
      expect(j.updatedAt > last).toBe(true)
      last = j.updatedAt
    }
    const final = (await body(await handle(req('GET', `/v1/status/${job.id}`), env))).job
    expect(final.state).toBe('apk_ready')
    expect(final.note).toBe('now apk_ready')
    expect(final.history.map((h: any) => h.state)).toEqual(['inventing', 'failed', 'inventing', 'building', 'web_ready', 'apk_building', 'apk_ready'])
    expect((await handle(req('PATCH', '/v1/jobs/hj-nope-0000', { body: { state: 'building' } }), env)).status).toBe(404)
    expect(applyTransition(final, 'building').ok).toBe(true)
  })

  it('shares the exact state machine with the game and the CLI', () => {
    expect(W_STATES).toEqual(JOB_STATES)
    expect(W_TRANSITIONS).toEqual(TRANSITIONS)
    expect(W_TRANSITIONS).toEqual(cli.TRANSITIONS)
  })

  it('rate-limits prompts per minute', async () => {
    const env = mkEnv()
    for (let i = 0; i < PROMPTS_PER_MINUTE; i++) expect((await handle(req('POST', '/v1/prompt', { body: { text: `p${i}` } }), env)).status).toBe(201)
    expect((await handle(req('POST', '/v1/prompt', { body: { text: 'one too many' } }), env)).status).toBe(429)
  })

  it('notify webhook gets a minimal payload — no token, only a preview — and failures do not block the job', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const okFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const env = mkEnv({ NOTIFY_WEBHOOK_URL: 'https://hooks.test/grokbot', NOTIFY_WEBHOOK_BEARER: 'hook-secret' })
    const long = `Barrier B-rank door: ${'refuse poisoned RAG '.repeat(10)}`
    const r = await body(await handle(req('POST', '/v1/prompt', { body: { text: long, rank: 'B', classId: 'barrier' } }), env, undefined, okFetch))
    expect(r.notified).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://hooks.test/grokbot')
    const sent = JSON.parse(String(calls[0].init.body))
    expect(sent).toMatchObject({ type: 'harness.prompt', jobId: r.job.id, rank: 'B', classId: 'barrier' })
    expect(sent.textPreview.length).toBeLessThanOrEqual(120)
    expect(String(calls[0].init.body)).not.toContain(TOKEN)
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer hook-secret')
    expect(Object.keys(notifyPayload(r.job)).sort()).toEqual(['at', 'classId', 'jobId', 'kind', 'rank', 'textPreview', 'type'])

    const boom = (async () => {
      throw new Error('down')
    }) as unknown as typeof fetch
    const r2 = await handle(req('POST', '/v1/prompt', { body: { text: 'still saved' } }), env, undefined, boom)
    expect(r2.status).toBe(201)
    expect((await body(r2)).notified).toBe(false)
  })
})

