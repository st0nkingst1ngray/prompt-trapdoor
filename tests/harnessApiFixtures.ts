/** Shared fixtures for the private harness API tests (in-memory KV + request helper). */
import type { Env, KVLike } from '../workers/harness-api/src/harness'

export const TOKEN = 'test-token-0123456789-abcdefghij'
export const BASE = 'https://harness.test'

export function memKV(): KVLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    async get(key: string) {
      const v = map.get(key)
      return v === undefined ? null : JSON.parse(v)
    },
    async put(key: string, value: string) {
      map.set(key, value)
    },
  }
}

export function mkEnv(over: Partial<Env> = {}): Env {
  return { HARNESS_KV: memKV(), HARNESS_TOKEN: TOKEN, ALLOWED_ORIGINS: 'capacitor://localhost, https://localhost,http://localhost:5173', ...over }
}

export function req(method: string, p: string, opts: { token?: string | null; origin?: string; body?: unknown } = {}): Request {
  const h: Record<string, string> = {}
  const tok = opts.token === undefined ? TOKEN : opts.token
  if (tok) h.Authorization = `Bearer ${tok}`
  if (opts.origin) h.Origin = opts.origin
  if (opts.body !== undefined) h['Content-Type'] = 'application/json'
  return new Request(`${BASE}${p}`, { method, headers: h, ...(opts.body !== undefined ? { body: typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body) } : {}) })
}

export const body = async (r: Response) => (await r.json()) as any

