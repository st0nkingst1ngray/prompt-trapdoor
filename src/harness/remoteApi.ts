/**
 * Private harness API client (Cloudflare Worker in workers/harness-api).
 *
 * Only active when the player pasted a Worker URL + token into the hub settings. Both live in this device's
 * localStorage and nowhere else: never in source, never in a build. Without them the harness stays in
 * copy-handoff mode, exactly as before.
 */
import type { HarnessJob, JobKind, PlayContext, RemoteStatus } from './buildQueue'

export const REMOTE_KEY = 'hunter-harness-remote-v1'
export const MIN_TOKEN = 24

export interface RemoteConfig {
  url: string
  token: string
}

/** Build-time default for the URL only (the token is never read from env). See .env.example. */
export function defaultApiUrl(): string {
  try {
    return (import.meta.env?.VITE_HARNESS_API_URL as string | undefined)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function normalizeUrl(raw: string): string | null {
  const s = raw.trim().replace(/\/+$/, '')
  if (!s) return null
  try {
    const u = new URL(s)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

export function loadRemoteConfig(): RemoteConfig | null {
  try {
    const raw = localStorage.getItem(REMOTE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<RemoteConfig>
    const url = normalizeUrl(typeof v.url === 'string' ? v.url : '')
    const token = typeof v.token === 'string' ? v.token.trim() : ''
    return url && token.length >= MIN_TOKEN ? { url, token } : null
  } catch {
    return null
  }
}

export type SaveConfigResult = { ok: true; config: RemoteConfig } | { ok: false; error: string }

export function saveRemoteConfig(url: string, token: string): SaveConfigResult {
  const u = normalizeUrl(url)
  if (!u) return { ok: false, error: 'URL must be https://… (http only for localhost).' }
  const t = token.trim()
  if (t.length < MIN_TOKEN) return { ok: false, error: `Token looks too short (need ${MIN_TOKEN}+ characters).` }
  const config = { url: u, token: t }
  localStorage.setItem(REMOTE_KEY, JSON.stringify(config))
  return { ok: true, config }
}

export function clearRemoteConfig(): void {
  localStorage.removeItem(REMOTE_KEY)
}

/** Short label for the UI. Never shows the token. */
export function remoteLabel(c: RemoteConfig | null): string {
  if (!c) return 'off'
  try {
    return new URL(c.url).host
  } catch {
    return c.url
  }
}

function headers(c: RemoteConfig, json = false): Record<string, string> {
  return { Authorization: `Bearer ${c.token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }
}

function describe(status: number, body: unknown): string {
  const msg = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : ''
  if (status === 401) return 'token rejected (401)'
  if (status === 403) return 'origin not allowed (403) — add it to ALLOWED_ORIGINS'
  if (status === 429) return 'too many prompts this minute (429)'
  if (status === 503) return 'Worker has no HARNESS_TOKEN yet (503)'
  return msg ? `${msg} (${status})` : `HTTP ${status}`
}

export interface PromptPayload {
  text: string
  kind: JobKind
  rank?: string
  classId?: string | null
  xp?: number
  lastGate?: string
  screen?: string
  client?: string
}

export function payloadFrom(text: string, kind: JobKind, ctx: PlayContext | null, client: string): PromptPayload {
  return {
    text,
    kind,
    ...(ctx ? { rank: ctx.rank, classId: ctx.classId, xp: ctx.xp, screen: ctx.screen, ...(ctx.gateId ? { lastGate: ctx.gateId } : {}) } : {}),
    client,
  }
}

export type PostResult = { ok: true; job: HarnessJob; notified: boolean } | { ok: false; error: string }

export async function postPrompt(c: RemoteConfig, p: PromptPayload, timeoutMs = 10000): Promise<PostResult> {
  try {
    const res = await fetch(`${c.url}/v1/prompt`, {
      method: 'POST',
      headers: headers(c, true),
      body: JSON.stringify(p),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; job?: HarnessJob; notified?: boolean } | null
    if (!res.ok || !body?.ok || !body.job) return { ok: false, error: describe(res.status, body) }
    return { ok: true, job: body.job, notified: !!body.notified }
  } catch (e) {
    return { ok: false, error: (e as Error)?.name === 'TimeoutError' ? 'Worker timed out' : 'network error (offline or bad URL)' }
  }
}

export type StatusResult = { ok: true; status: RemoteStatus } | { ok: false; error: string }

export async function fetchRemoteStatus(c: RemoteConfig, timeoutMs = 10000): Promise<StatusResult> {
  try {
    const res = await fetch(`${c.url}/v1/status?limit=30`, { headers: headers(c), cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    const body = (await res.json().catch(() => null)) as (RemoteStatus & { ok?: boolean }) | null
    if (!res.ok || !body?.ok || !Array.isArray(body.jobs)) return { ok: false, error: describe(res.status, body) }
    return { ok: true, status: { version: 1, updatedAt: body.updatedAt, jobs: body.jobs } }
  } catch (e) {
    return { ok: false, error: (e as Error)?.name === 'TimeoutError' ? 'Worker timed out' : 'network error (offline or bad URL)' }
  }
}
