import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { handle, type Env } from '../workers/harness-api/src/harness'
import { clearQueue, loadQueue, type PlayContext } from '../src/harness/buildQueue'
import {
  REMOTE_KEY,
  clearRemoteConfig,
  fetchRemoteStatus,
  loadRemoteConfig,
  normalizeUrl,
  payloadFrom,
  postPrompt,
  saveRemoteConfig,
} from '../src/harness/remoteApi'
import { bindHarnessStrip, harnessSettled, pollRemoteApiOnce, renderHarnessStrip, resetHarnessUi } from '../src/harness/harnessUi'
// @ts-ignore — plain .mjs CLI module
import * as cli from '../scripts/harness.mjs'
import { BASE, TOKEN, mkEnv } from './harnessApiFixtures'

// ---------- game side ----------

/** Route the game's fetch() into the in-memory worker so the real client code is exercised end-to-end. */
function wireFetch(env: Env, origin = 'http://localhost:5173') {
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const r = new Request(typeof input === 'string' || input instanceof URL ? String(input) : input.url, init)
    const h = new Headers(r.headers)
    h.set('Origin', origin)
    return handle(new Request(r.url, { method: r.method, headers: h, body: init?.body ?? null }), env)
  }) as typeof fetch
  return () => {
    globalThis.fetch = orig
  }
}

const ctx: PlayContext = { screen: 'hub', gateId: 'pin', rank: 'B', classId: 'necrotech', xp: 180 }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

describe('game ↔ private harness API', () => {
  beforeEach(() => {
    clearQueue()
    clearRemoteConfig()
    resetHarnessUi()
  })

  it('config: https only (http just for localhost), token length checked, stored on device only', () => {
    expect(normalizeUrl('http://evil.example')).toBeNull()
    expect(normalizeUrl('http://localhost:8787/')).toBe('http://localhost:8787')
    expect(normalizeUrl('https://x.workers.dev/')).toBe('https://x.workers.dev')
    expect(saveRemoteConfig('https://x.workers.dev', 'short').ok).toBe(false)
    expect(saveRemoteConfig('ftp://x', TOKEN).ok).toBe(false)
    expect(loadRemoteConfig()).toBeNull()
    expect(saveRemoteConfig('https://x.workers.dev/', `  ${TOKEN} `).ok).toBe(true)
    expect(loadRemoteConfig()).toEqual({ url: 'https://x.workers.dev', token: TOKEN })
    localStorage.setItem(REMOTE_KEY, '{broken')
    expect(loadRemoteConfig()).toBeNull()
  })

  it('client posts with Bearer and reads status; bad token surfaces a readable error', async () => {
    const env = mkEnv()
    const unwire = wireFetch(env)
    try {
      const p = await postPrompt({ url: BASE, token: TOKEN }, payloadFrom('Pin the Oath, harder', 'tweak', ctx, 'web'))
      expect(p.ok).toBe(true)
      if (!p.ok) return
      expect(p.job.context?.gateId).toBe('pin')
      const s = await fetchRemoteStatus({ url: BASE, token: TOKEN })
      expect(s.ok && s.status.jobs.length).toBe(1)
      const bad = await postPrompt({ url: BASE, token: 'x'.repeat(30) }, payloadFrom('hi', 'gate', null, 'web'))
      expect(bad).toEqual({ ok: false, error: 'token rejected (401)' })
    } finally {
      unwire()
    }
  })

  it('hub: ⚙️ API → save → Prompt next gate sends to the Worker (no handoff); CLI PATCH shows up on next poll', async () => {
    const env = mkEnv()
    const unwire = wireFetch(env)
    document.body.innerHTML = '<div id="app"></div>'
    const root = document.getElementById('app')!
    const rerender = () => {
      root.innerHTML = renderHarnessStrip(esc)
      bindHarnessStrip(root, () => ctx, rerender)
    }
    const click = (sel: string) => (root.querySelector(sel) as HTMLButtonElement).click()
    try {
      rerender()
      expect(root.querySelector('#harness-mode')?.getAttribute('data-mode')).toBe('handoff')
      click('#btn-harness-settings')
      ;(root.querySelector('#harness-api-url') as HTMLInputElement).value = BASE
      ;(root.querySelector('#harness-api-token') as HTMLInputElement).value = TOKEN
      click('#btn-harness-save')
      expect(root.querySelector('#harness-settings-msg')?.textContent).toContain('Saved')
      expect(root.innerHTML).not.toContain(TOKEN) // token never rendered back
      click('#btn-harness-test')
      await harnessSettled()
      expect(root.querySelector('#harness-settings-msg')?.textContent).toContain('Connected — 0 jobs')
      click('#btn-harness-settings-close')
      expect(root.querySelector('#harness-mode')?.getAttribute('data-mode')).toBe('api')

      click('#btn-harness-open')
      const ta = root.querySelector<HTMLTextAreaElement>('#harness-prompt')!
      ta.value = 'Near but Wrong with a decoy shelf'
      ta.dispatchEvent(new Event('input'))
      click('#btn-harness-submit')
      expect(root.querySelector('#btn-harness-submit')?.textContent).toContain('Sending')
      await harnessSettled()
      const q = loadQueue()
      expect(q).toHaveLength(1)
      expect(q[0].id).toMatch(/^hj-/)
      expect(q[0].state).toBe('inventing')
      expect(root.querySelector('#harness-handoff')).toBeNull()
      expect(document.getElementById('harness-toast')?.textContent).toContain('Sent to Grok Bot')

      // Grok Bot side: pull via the CLI helpers, then a state change is mirrored with PATCH.
      const s = cli.readStatus(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hapi-')), 'status.json'))
      const pulled = await cli.pullRemote(s, { url: BASE, token: TOKEN })
      expect(pulled.map((j: any) => j.id)).toEqual([q[0].id])
      const j = cli.setJob(s, q[0].id, 'building', { note: 'Grok 4.7 spec done' })
      expect(await cli.pushRemoteState({ url: BASE, token: TOKEN }, j)).toBe('synced')
      expect(await cli.pushRemoteState({ url: BASE, token: TOKEN }, { id: 'hj-local-only', state: 'building' })).toBe('not on worker')

      const changed = await pollRemoteApiOnce()
      expect(changed.map((c) => c.state)).toEqual(['building'])
      expect(loadQueue()[0].note).toBe('Grok 4.7 spec done')
    } finally {
      unwire()
    }
  })

  it('falls back to the copy handoff when the Worker rejects the token', async () => {
    const env = mkEnv()
    const unwire = wireFetch(env)
    document.body.innerHTML = '<div id="app"></div>'
    const root = document.getElementById('app')!
    const rerender = () => {
      root.innerHTML = renderHarnessStrip(esc)
      bindHarnessStrip(root, () => ctx, rerender)
    }
    try {
      saveRemoteConfig(BASE, 'wrong-token-but-long-enough-000')
      rerender()
      ;(root.querySelector('#btn-harness-open') as HTMLButtonElement).click()
      root.querySelector<HTMLTextAreaElement>('#harness-prompt')!.value = 'fallback please'
      ;(root.querySelector('#btn-harness-submit') as HTMLButtonElement).click()
      await harnessSettled()
      expect(loadQueue()).toHaveLength(1)
      expect(root.querySelector<HTMLTextAreaElement>('#harness-handoff')?.value).toContain('fallback please')
      expect(document.getElementById('harness-toast')?.textContent).toContain('token rejected (401)')
    } finally {
      unwire()
    }
  })

  it('CLI reads HARNESS_API_URL / HARNESS_TOKEN from env or .harness.local', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hloc-')), '.harness.local')
    fs.writeFileSync(f, `# local only\nHARNESS_API_URL=https://w.example/\nHARNESS_TOKEN="${TOKEN}"\n`)
    expect(cli.remoteConfig({}, f)).toEqual({ url: 'https://w.example', token: TOKEN })
    expect(cli.remoteConfig({ HARNESS_API_URL: 'https://e.example', HARNESS_TOKEN: 't' }, f)).toEqual({ url: 'https://e.example', token: 't' })
    expect(cli.remoteConfig({}, '/nonexistent')).toBeNull()
  })
})
