/**
 * Hunter Association — private harness API (Cloudflare Worker) — all logic lives here.
 * src/index.ts only exports the Worker handler (workerd rejects other named exports on the entry module).
 *
 * Personal glue for ONE player (Stefan): the game POSTs a "prompt next gate" request here, the Worker
 * queues it in KV and (optionally) pings a webhook so a Grok Bot routine wakes up. Grok Bot moves the
 * job through the same state machine as the in-game harness via PATCH. Not a public / multiplayer API.
 *
 *   GET    /v1/health            no auth, returns { ok: true } only
 *   POST   /v1/prompt            Bearer → { ok, job, notified }
 *   GET    /v1/status            Bearer → { ok, version: 1, updatedAt, jobs }  (newest first)
 *   GET    /v1/status/:jobId     Bearer → { ok, job }
 *   PATCH  /v1/jobs/:id          Bearer, body { state, note?, result? } → { ok, job }
 *   OPTIONS *                    CORS preflight (origins from ALLOWED_ORIGINS only)
 */

export type JobState = 'inventing' | 'building' | 'web_ready' | 'apk_building' | 'apk_ready' | 'failed'
export type JobKind = 'gate' | 'tweak' | 'bug'

export const JOB_STATES: JobState[] = ['inventing', 'building', 'web_ready', 'apk_building', 'apk_ready', 'failed']

/** Same table as src/harness/buildQueue.ts and scripts/harness.mjs (tests/harnessApi.test.ts checks). */
export const TRANSITIONS: Record<JobState, JobState[]> = {
  inventing: ['building', 'failed'],
  building: ['web_ready', 'failed'],
  web_ready: ['apk_building', 'building', 'failed'],
  apk_building: ['apk_ready', 'failed'],
  apk_ready: ['building'],
  failed: ['inventing', 'building'],
}

export const MAX_PROMPT = 500
export const MAX_NOTE = 300
export const MAX_BODY_BYTES = 4096
export const MAX_JOBS = 50
/** Soft brake in case the token ever leaks: prompts per UTC minute. */
export const PROMPTS_PER_MINUTE = 6
export const MIN_TOKEN_LENGTH = 24

/** Minimal KV surface we use, so tests can pass an in-memory map. */
export interface KVLike {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

export interface Env {
  HARNESS_KV: KVLike
  /** Secret. `wrangler secret put HARNESS_TOKEN` */
  HARNESS_TOKEN?: string
  /** Secret (optional). Where to POST a short "new prompt" notice, e.g. a Grok Bot routine webhook. */
  NOTIFY_WEBHOOK_URL?: string
  /** Secret (optional). Sent as `Authorization: Bearer …` to the webhook if that endpoint wants one. */
  NOTIFY_WEBHOOK_BEARER?: string
  /** Var. Comma-separated browser origins allowed by CORS. Empty = no browser origin allowed. */
  ALLOWED_ORIGINS?: string
}

export interface WaitCtx {
  waitUntil(p: Promise<unknown>): void
}

export interface PlayContext {
  screen: string
  gateId?: string
  rank: string
  classId: string | null
  xp: number
}

export interface JobEvent {
  state: JobState
  at: string
  note?: string
}

export interface HarnessJob {
  id: string
  prompt: string
  kind: JobKind
  context: PlayContext | null
  state: JobState
  createdAt: string
  updatedAt: string
  note?: string
  result?: string
  client?: string
  source: 'worker'
  history: JobEvent[]
}

const INDEX_KEY = 'jobs:index'
const jobKey = (id: string) => `job:${id}`
const JOB_ID_RE = /^hj-[a-z0-9-]{4,40}$/
const isState = (v: unknown): v is JobState => typeof v === 'string' && (JOB_STATES as string[]).includes(v)
const isKind = (v: unknown): v is JobKind => v === 'gate' || v === 'tweak' || v === 'bug'

export function canTransition(from: JobState, to: JobState): boolean {
  return from === to || TRANSITIONS[from].includes(to)
}

export function newJobId(now: Date = new Date()): string {
  const rand = new Uint8Array(4)
  crypto.getRandomValues(rand)
  return `hj-${now.getTime().toString(36)}-${[...rand].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 6)}`
}

// ---------- auth ----------

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
}

/**
 * Constant-time token check. Both sides are hashed first so lengths match and nothing about the
 * secret's length leaks; then compared with crypto.subtle.timingSafeEqual (Workers) or an XOR loop.
 */
export async function tokenMatches(presented: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(presented), sha256(secret)])
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual?: (x: ArrayBufferView, y: ArrayBufferView) => boolean }
  if (typeof subtle.timingSafeEqual === 'function') return subtle.timingSafeEqual(a, b)
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

type AuthResult = { ok: true } | { ok: false; status: number; error: string }

export async function checkAuth(req: Request, env: Env): Promise<AuthResult> {
  const secret = env.HARNESS_TOKEN ?? ''
  if (secret.length < MIN_TOKEN_LENGTH) return { ok: false, status: 503, error: 'harness api not configured' }
  const h = req.headers.get('Authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  if (!m) return { ok: false, status: 401, error: 'unauthorized' }
  return (await tokenMatches(m[1].trim(), secret)) ? { ok: true } : { ok: false, status: 401, error: 'unauthorized' }
}

// ---------- CORS ----------

export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

/** null = no Origin header (curl, Grok Bot CLI) → not a browser, CORS does not apply. */
function originVerdict(req: Request, env: Env): { origin: string | null; allowed: boolean } {
  const origin = req.headers.get('Origin')
  if (!origin) return { origin: null, allowed: true }
  return { origin, allowed: allowedOrigins(env).includes(origin) }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin),
    },
  })
}

// ---------- storage ----------

async function readIndex(env: Env): Promise<string[]> {
  const v = await env.HARNESS_KV.get(INDEX_KEY, 'json')
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

async function readJob(env: Env, id: string): Promise<HarnessJob | null> {
  if (!JOB_ID_RE.test(id)) return null
  const v = (await env.HARNESS_KV.get(jobKey(id), 'json')) as HarnessJob | null
  return v && typeof v === 'object' && isState(v.state) ? v : null
}

async function writeJob(env: Env, job: HarnessJob): Promise<void> {
  // 60 days is plenty for a personal build queue; KV cleans up after itself.
  await env.HARNESS_KV.put(jobKey(job.id), JSON.stringify(job), { expirationTtl: 60 * 24 * 3600 })
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get('Content-Length') ?? '0')
  if (len > MAX_BODY_BYTES) return null
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return null
  try {
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

// ---------- handlers ----------

export type PromptBody = {
  text?: unknown
  kind?: unknown
  rank?: unknown
  classId?: unknown
  xp?: unknown
  lastGate?: unknown
  screen?: unknown
  client?: unknown
}

export function buildJob(body: PromptBody, now: Date = new Date()): { ok: true; job: HarnessJob } | { ok: false; error: string } {
  const text = typeof body.text === 'string' ? body.text.trim().replace(/\s+/g, ' ') : ''
  if (!text) return { ok: false, error: 'text is required' }
  if (text.length > MAX_PROMPT) return { ok: false, error: `text over ${MAX_PROMPT} chars` }
  const rank = str(body.rank, 12)
  const classId = str(body.classId, 32) ?? null
  const xp = typeof body.xp === 'number' && Number.isFinite(body.xp) ? Math.max(0, Math.floor(body.xp)) : 0
  const gateId = str(body.lastGate, 40)
  const hasContext = rank !== undefined || classId !== null || gateId !== undefined || xp > 0
  const at = now.toISOString()
  const job: HarnessJob = {
    id: newJobId(now),
    prompt: text,
    kind: isKind(body.kind) ? body.kind : 'gate',
    context: hasContext ? { screen: str(body.screen, 24) ?? 'hub', ...(gateId ? { gateId } : {}), rank: rank ?? '?', classId, xp } : null,
    state: 'inventing',
    createdAt: at,
    updatedAt: at,
    ...(str(body.client, 24) ? { client: str(body.client, 24) } : {}),
    source: 'worker',
    history: [{ state: 'inventing', at, note: 'Prompted from the game (harness API)' }],
  }
  return { ok: true, job }
}

export function applyTransition(
  job: HarnessJob,
  to: unknown,
  note?: unknown,
  result?: unknown,
  now: Date = new Date(),
): { ok: true; job: HarnessJob } | { ok: false; error: string } {
  if (!isState(to)) return { ok: false, error: `state must be one of ${JOB_STATES.join('|')}` }
  if (!canTransition(job.state, to)) return { ok: false, error: `can't go ${job.state} → ${to}` }
  const n = str(note, MAX_NOTE)
  const r = str(result, 120)
  // Strictly increasing updatedAt so the game's "newer wins" merge always sees the change.
  const at = new Date(Math.max(now.getTime(), Date.parse(job.updatedAt) + 1)).toISOString()
  const next: HarnessJob = { ...job, state: to, updatedAt: at, history: [...job.history, { state: to, at, ...(n ? { note: n } : {}) }].slice(-40) }
  if (n !== undefined) next.note = n
  if (r !== undefined) next.result = r
  return { ok: true, job: next }
}

async function rateLimited(env: Env, now: Date): Promise<boolean> {
  const key = `rl:${Math.floor(now.getTime() / 60000)}`
  const n = Number((await env.HARNESS_KV.get(key, 'json')) ?? 0)
  if (n >= PROMPTS_PER_MINUTE) return true
  await env.HARNESS_KV.put(key, JSON.stringify(n + 1), { expirationTtl: 120 })
  return false
}

/** Minimal payload: no token, no full prompt. The routine pulls details with its own Bearer. */
export function notifyPayload(job: HarnessJob) {
  return {
    type: 'harness.prompt',
    jobId: job.id,
    kind: job.kind,
    textPreview: job.prompt.length > 120 ? `${job.prompt.slice(0, 117)}…` : job.prompt,
    rank: job.context?.rank ?? null,
    classId: job.context?.classId ?? null,
    at: job.createdAt,
  }
}

export async function notify(env: Env, job: HarnessJob, fetcher: typeof fetch = fetch): Promise<boolean> {
  const url = env.NOTIFY_WEBHOOK_URL
  if (!url || !/^https:\/\//i.test(url)) return false
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.NOTIFY_WEBHOOK_BEARER ? { Authorization: `Bearer ${env.NOTIFY_WEBHOOK_BEARER}` } : {}),
      },
      body: JSON.stringify(notifyPayload(job)),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function handle(req: Request, env: Env, ctx?: WaitCtx, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const { origin, allowed } = originVerdict(req, env)

  if (origin && !allowed) return json({ ok: false, error: 'origin not allowed' }, 403, null)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method === 'GET' && path === '/v1/health') return json({ ok: true }, 200, origin)

  if (!path.startsWith('/v1/')) return json({ ok: false, error: 'not found' }, 404, origin)

  const auth = await checkAuth(req, env)
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, origin)

  const now = new Date()

  if (req.method === 'POST' && path === '/v1/prompt') {
    const body = await readBody(req)
    if (!body) return json({ ok: false, error: 'json body required (max 4 KB)' }, 400, origin)
    const built = buildJob(body, now)
    if (!built.ok) return json({ ok: false, error: built.error }, 400, origin)
    if (await rateLimited(env, now)) return json({ ok: false, error: 'slow down — too many prompts this minute' }, 429, origin)
    const job = built.job
    await writeJob(env, job)
    const index = [job.id, ...(await readIndex(env)).filter((id) => id !== job.id)].slice(0, MAX_JOBS)
    await env.HARNESS_KV.put(INDEX_KEY, JSON.stringify(index))
    let notified = false
    if (env.NOTIFY_WEBHOOK_URL) {
      const p = notify(env, job, fetcher)
      // Wait briefly so the game can tell whether Grok Bot got pinged; keep it alive past the response either way.
      ctx?.waitUntil(p)
      notified = await p
    }
    return json({ ok: true, job, notified }, 201, origin)
  }

  if (req.method === 'GET' && path === '/v1/status') {
    const limit = Math.min(MAX_JOBS, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20))
    const ids = (await readIndex(env)).slice(0, limit)
    const jobs = (await Promise.all(ids.map((id) => readJob(env, id)))).filter((j): j is HarnessJob => j !== null)
    const updatedAt = jobs.reduce((m, j) => (j.updatedAt > m ? j.updatedAt : m), new Date(0).toISOString())
    return json({ ok: true, version: 1, updatedAt, jobs }, 200, origin)
  }

  const one = /^\/v1\/(status|jobs)\/([^/]+)$/.exec(path)
  if (one) {
    const [, which, id] = one
    if (req.method === 'GET' && which === 'status') {
      const job = await readJob(env, id)
      return job ? json({ ok: true, job }, 200, origin) : json({ ok: false, error: 'no such job' }, 404, origin)
    }
    if (req.method === 'PATCH' && which === 'jobs') {
      const job = await readJob(env, id)
      if (!job) return json({ ok: false, error: 'no such job' }, 404, origin)
      const body = await readBody(req)
      if (!body) return json({ ok: false, error: 'json body required' }, 400, origin)
      const t = applyTransition(job, body.state, body.note, body.result, now)
      if (!t.ok) return json({ ok: false, error: t.error }, 409, origin)
      await writeJob(env, t.job)
      return json({ ok: true, job: t.job }, 200, origin)
    }
  }

  return json({ ok: false, error: 'not found' }, 404, origin)
}
