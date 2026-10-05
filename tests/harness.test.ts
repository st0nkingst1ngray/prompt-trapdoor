import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  JOB_STATES,
  TRANSITIONS,
  canTransition,
  clearQueue,
  createJob,
  currentJob,
  handoffText,
  inFlight,
  loadQueue,
  mergeRemote,
  normalizeForApk,
  setJobState,
  type PlayContext,
} from '../src/harness/buildQueue'
import { bindHarnessStrip, pollHarnessOnce, renderHarnessStrip, resetHarnessUi, updateHarnessPill } from '../src/harness/harnessUi'
// @ts-ignore — plain .mjs CLI module, no types
import * as cli from '../scripts/harness.mjs'

const ctx: PlayContext = { screen: 'hub', gateId: 'runaway', rank: 'C', classId: 'shadow', xp: 120 }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

describe('harness build queue', () => {
  beforeEach(() => clearQueue())

  it('records a player prompt as an inventing job in localStorage (no network)', () => {
    const r = createJob('  A C door   about fake citations  ', 'gate', ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.job.state).toBe('inventing')
    expect(r.job.prompt).toBe('A C door about fake citations')
    expect(r.job.id).toMatch(/^hj-/)
    expect(loadQueue()).toHaveLength(1)
    expect(currentJob()?.id).toBe(r.job.id)
    expect(inFlight(r.job)).toBe(true)
  })

  it('rejects empty and over-long prompts', () => {
    expect(createJob('   ').ok).toBe(false)
    expect(createJob('x'.repeat(501)).ok).toBe(false)
    expect(loadQueue()).toHaveLength(0)
  })

  it('walks the human loop inventing → building → web_ready → apk_building → apk_ready', () => {
    const r = createJob('more Rank C doors')
    if (!r.ok) throw new Error('create failed')
    const id = r.job.id
    for (const s of ['building', 'web_ready', 'apk_building', 'apk_ready'] as const) {
      const t = setJobState(id, s, `now ${s}`)
      expect(t.ok, s).toBe(true)
    }
    const j = loadQueue()[0]
    expect(j.state).toBe('apk_ready')
    expect(j.history.map((h) => h.state)).toEqual(['inventing', 'building', 'web_ready', 'apk_building', 'apk_ready'])
    expect(inFlight(j)).toBe(false)
  })

  it('blocks skipped steps but allows failed from in-flight states and retry from failed', () => {
    const r = createJob('x')
    if (!r.ok) throw new Error()
    expect(setJobState(r.job.id, 'apk_ready').ok).toBe(false)
    expect(setJobState(r.job.id, 'web_ready').ok).toBe(false)
    expect(setJobState(r.job.id, 'failed', 'tsc error').ok).toBe(true)
    expect(setJobState(r.job.id, 'inventing').ok).toBe(true)
    expect(setJobState('nope', 'building').ok).toBe(false)
    expect(canTransition('building', 'building')).toBe(true)
  })

  it('survives a corrupt save', () => {
    localStorage.setItem('hunter-harness-queue-v1', '{oops')
    expect(loadQueue()).toEqual([])
    localStorage.setItem('hunter-harness-queue-v1', JSON.stringify([{ id: 1 }, { id: 'a', prompt: 'p', state: 'weird' }]))
    expect(loadQueue()).toEqual([])
  })

  it('handoff text carries id, prompt, and play context for Grok Bot', () => {
    const r = createJob('door about stop sequences', 'gate', ctx)
    if (!r.ok) throw new Error()
    const t = handoffText(r.job)
    expect(t).toContain(r.job.id)
    expect(t).toContain('door about stop sequences')
    expect(t).toContain('rank C · class shadow · 120 XP · hub:runaway')
    expect(t).toContain('scripts/harness.mjs add --id')
  })
})

describe('harness remote status merge', () => {
  beforeEach(() => clearQueue())

  it('remote wins when newer, reports changed jobs, adds remote-only jobs', () => {
    const r = createJob('mine', 'gate', null, new Date('2026-10-05T08:00:00Z'))
    if (!r.ok) throw new Error()
    const remote = {
      version: 1,
      jobs: [
        { id: r.job.id, prompt: 'mine', state: 'building', updatedAt: '2026-10-05T08:05:00Z', note: 'tsc ok', history: [] },
        { id: 'hj-chat', prompt: 'queued from chat', state: 'inventing', updatedAt: '2026-10-05T08:06:00Z', history: [] },
        { junk: true },
      ],
    }
    const m = mergeRemote(loadQueue(), remote)
    expect(m.changed.map((j) => j.id).sort()).toEqual(['hj-chat', r.job.id].sort())
    const mine = m.queue.find((j) => j.id === r.job.id)!
    expect(mine.state).toBe('building')
    expect(mine.note).toBe('tsc ok')
    expect(mine.history.at(-1)?.state).toBe('building')
    // older remote does not roll back
    const stale = mergeRemote(m.queue, { version: 1, jobs: [{ id: r.job.id, prompt: 'mine', state: 'inventing', updatedAt: '2026-10-05T08:01:00Z' }] })
    expect(stale.changed).toHaveLength(0)
    expect(stale.queue.find((j) => j.id === r.job.id)!.state).toBe('building')
    expect(mergeRemote([], null).changed).toEqual([])
  })

  it('inside the APK a baked apk_building job reads as apk_ready', () => {
    const remote = { version: 1, jobs: [{ id: 'a', prompt: 'p', state: 'apk_building', updatedAt: '2026-10-05T08:00:00Z' }] }
    expect((normalizeForApk(remote, true).jobs[0] as { state: string }).state).toBe('apk_ready')
    expect((normalizeForApk(remote, false).jobs[0] as { state: string }).state).toBe('apk_building')
  })

  it('pollHarnessOnce merges fetched status and is silent on network errors', async () => {
    const r = createJob('poll me', 'gate', null, new Date('2026-10-05T08:00:00Z'))
    if (!r.ok) throw new Error()
    const orig = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ version: 1, jobs: [{ id: r.job.id, prompt: 'poll me', state: 'building', updatedAt: '2026-10-05T09:00:00Z' }] }), {
        status: 200,
      })) as typeof fetch
    try {
      const changed = await pollHarnessOnce('/harness-status.json')
      expect(changed.map((j) => j.state)).toEqual(['building'])
      expect(loadQueue()[0].state).toBe('building')
      globalThis.fetch = (async () => {
        throw new Error('offline')
      }) as typeof fetch
      expect(await pollHarnessOnce('/harness-status.json')).toEqual([])
    } finally {
      globalThis.fetch = orig
    }
  })
})

describe('harness CLI (box side)', () => {
  it('shares the exact state machine with the game', () => {
    expect(cli.JOB_STATES).toEqual(JOB_STATES)
    expect(cli.TRANSITIONS).toEqual(TRANSITIONS)
  })

  it('add + set write a status file the game can merge', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-')), 'harness-status.json')
    const s = cli.readStatus(file)
    const job = cli.addJob(s, { prompt: 'Logit Ward hard pip', id: 'hj-test' })
    cli.writeStatus(s, file)
    const s2 = cli.readStatus(file)
    cli.setJob(s2, 'hj-test', 'building', { note: 'Grok Bot on it' })
    expect(() => cli.setJob(s2, 'hj-test', 'apk_ready')).toThrow(/can't go/)
    cli.setJob(s2, 'latest', 'web_ready', { result: 'ward' })
    cli.writeStatus(s2, file)
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(onDisk.jobs[0].state).toBe('web_ready')
    expect(onDisk.jobs[0].result).toBe('ward')
    expect(job.id).toBe('hj-test')
    clearQueue()
    const m = mergeRemote([], onDisk)
    expect(m.queue[0].state).toBe('web_ready')
    expect(() => cli.addJob(s2, { prompt: 'dup', id: 'hj-test' })).toThrow(/exists/)
    expect(() => cli.addJob(s2, { prompt: '  ' })).toThrow()
  })
})

describe('harness hub strip (DOM)', () => {
  let root: HTMLElement
  const rerender = () => {
    root.innerHTML = renderHarnessStrip(esc)
    bindHarnessStrip(root, () => ctx, rerender)
  }
  beforeEach(() => {
    clearQueue()
    resetHarnessUi()
    document.body.innerHTML = '<div id="app"></div>'
    root = document.getElementById('app')!
    rerender()
  })

  it('idle → Prompt next gate → queue → shows inventing + handoff + pill', () => {
    expect(root.querySelector('#harness-status')?.getAttribute('data-state')).toBe('idle')
    ;(root.querySelector('#btn-harness-open') as HTMLButtonElement).click()
    ;(root.querySelector('#btn-harness-submit') as HTMLButtonElement).click()
    expect(root.textContent).toContain('Write what you want built first')
    ;(root.querySelector('[data-hkind="tweak"]') as HTMLButtonElement).click()
    const ta = root.querySelector<HTMLTextAreaElement>('#harness-prompt')!
    ta.value = 'Make Long Leash show token numbers'
    ta.dispatchEvent(new Event('input'))
    ;(root.querySelector('#btn-harness-submit') as HTMLButtonElement).click()
    const q = loadQueue()
    expect(q).toHaveLength(1)
    expect(q[0].kind).toBe('tweak')
    expect(q[0].context?.gateId).toBe('runaway')
    expect(root.querySelector('#harness-status')?.getAttribute('data-state')).toBe('inventing')
    expect(root.querySelector<HTMLTextAreaElement>('#harness-handoff')?.value).toContain(q[0].id)
    expect(document.getElementById('harness-toast')?.textContent).toContain('Queued')
    updateHarnessPill()
    expect(document.getElementById('harness-pill')?.textContent).toContain('Inventing')
    setJobState(q[0].id, 'building')
    setJobState(q[0].id, 'web_ready', 'refresh to play')
    updateHarnessPill()
    expect(document.getElementById('harness-pill')).toBeNull()
    ;(root.querySelector('#btn-harness-close') as HTMLButtonElement).click()
    expect(root.querySelector('#harness-status')?.getAttribute('data-state')).toBe('web_ready')
    expect(root.textContent).toContain('refresh to play')
  })
})
