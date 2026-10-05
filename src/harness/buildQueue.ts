/**
 * Grok 4.7 harness — build queue (thin scaffold).
 *
 * The player prompts from inside the game. That prompt is only *recorded* here (localStorage) — no API call,
 * no model on the phone. Grok Bot picks it up on the box (pasted handoff text or `scripts/harness.mjs`),
 * Grok 4.7 plans/authors the gate spec, Grok Bot builds, and status flows back through
 * `harness-status.json`, which the web build polls. Same-instance hot reload is out of scope on purpose:
 * keep playing on web; the APK is a later artifact.
 */

export type JobState = 'inventing' | 'building' | 'web_ready' | 'apk_building' | 'apk_ready' | 'failed'
export type JobKind = 'gate' | 'tweak' | 'bug'

export const JOB_STATES: JobState[] = ['inventing', 'building', 'web_ready', 'apk_building', 'apk_ready', 'failed']

/** Allowed moves. Keep in sync with scripts/harness.mjs (a test checks). */
export const TRANSITIONS: Record<JobState, JobState[]> = {
  inventing: ['building', 'failed'],
  building: ['web_ready', 'failed'],
  web_ready: ['apk_building', 'building', 'failed'],
  apk_building: ['apk_ready', 'failed'],
  apk_ready: ['building'],
  failed: ['inventing', 'building'],
}

/** States where something is still in flight (show the "process ongoing" pill). */
export const IN_FLIGHT: JobState[] = ['inventing', 'building', 'apk_building']

export interface PlayContext {
  screen: string
  gateId?: string
  stageId?: number
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
  /** What landed, e.g. a gate id or an APK zip name. */
  result?: string
  history: JobEvent[]
}

export interface StatusCopy {
  emoji: string
  label: string
  hint: string
}

export const STATUS_COPY: Record<JobState, StatusCopy> = {
  inventing: { emoji: '🧠', label: 'Inventing', hint: 'Queued for Grok Bot — Grok 4.7 plans the gate. Keep playing.' },
  building: { emoji: '🔨', label: 'Building', hint: 'Grok Bot is building on the box. Keep playing — nothing reloads under you.' },
  web_ready: { emoji: '🌐', label: 'Web ready', hint: 'Refresh the web build to play it. The APK comes later (optional).' },
  apk_building: { emoji: '📦', label: 'APK building', hint: 'Play the new stuff on web while the APK bakes.' },
  apk_ready: { emoji: '📱', label: 'APK ready', hint: 'Grab the new zip/APK from Grok Bot and install it.' },
  failed: { emoji: '⚠️', label: 'Failed', hint: 'Build hit a snag. Read the note, then re-prompt or ask Grok Bot to retry.' },
}

export const QUEUE_KEY = 'hunter-harness-queue-v1'
export const MAX_PROMPT = 500
const MAX_JOBS = 30

const isState = (v: unknown): v is JobState => typeof v === 'string' && (JOB_STATES as string[]).includes(v)
const isKind = (v: unknown): v is JobKind => v === 'gate' || v === 'tweak' || v === 'bug'

function sanitizeJob(raw: unknown): HarnessJob | null {
  if (!raw || typeof raw !== 'object') return null
  const j = raw as Record<string, unknown>
  if (typeof j.id !== 'string' || typeof j.prompt !== 'string' || !isState(j.state)) return null
  const now = new Date().toISOString()
  const history = Array.isArray(j.history)
    ? (j.history as unknown[])
        .filter((e): e is JobEvent => !!e && typeof e === 'object' && isState((e as JobEvent).state) && typeof (e as JobEvent).at === 'string')
        .map((e) => ({ state: e.state, at: e.at, ...(typeof e.note === 'string' ? { note: e.note } : {}) }))
    : []
  return {
    id: j.id,
    prompt: j.prompt.slice(0, MAX_PROMPT),
    kind: isKind(j.kind) ? j.kind : 'gate',
    context: j.context && typeof j.context === 'object' ? (j.context as PlayContext) : null,
    state: j.state,
    createdAt: typeof j.createdAt === 'string' ? j.createdAt : now,
    updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : now,
    ...(typeof j.note === 'string' ? { note: j.note } : {}),
    ...(typeof j.result === 'string' ? { result: j.result } : {}),
    history,
  }
}

export function loadQueue(): HarnessJob[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeJob).filter((j): j is HarnessJob => j !== null)
  } catch {
    return []
  }
}

export function saveQueue(q: HarnessJob[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_JOBS)))
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
}

export function newJobId(now: Date = new Date()): string {
  return `hj-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export type CreateResult = { ok: true; job: HarnessJob } | { ok: false; error: string }

/** Record a player prompt as a new job in state "inventing". No network. */
export function createJob(prompt: string, kind: JobKind = 'gate', context: PlayContext | null = null, now: Date = new Date()): CreateResult {
  const text = prompt.trim().replace(/\s+/g, ' ')
  if (!text) return { ok: false, error: 'Write what you want built first.' }
  if (text.length > MAX_PROMPT) return { ok: false, error: `Keep it under ${MAX_PROMPT} characters (${text.length}).` }
  const at = now.toISOString()
  const job: HarnessJob = {
    id: newJobId(now),
    prompt: text,
    kind,
    context,
    state: 'inventing',
    createdAt: at,
    updatedAt: at,
    history: [{ state: 'inventing', at, note: 'Prompted from the game' }],
  }
  const q = loadQueue()
  q.push(job)
  saveQueue(q)
  return { ok: true, job }
}

export function canTransition(from: JobState, to: JobState): boolean {
  return from === to || TRANSITIONS[from].includes(to)
}

export type SetResult = { ok: true; job: HarnessJob } | { ok: false; error: string }

export function setJobState(id: string, to: JobState, note?: string, result?: string, now: Date = new Date()): SetResult {
  const q = loadQueue()
  const job = q.find((j) => j.id === id)
  if (!job) return { ok: false, error: `No job ${id}` }
  if (!canTransition(job.state, to)) return { ok: false, error: `Can't go ${job.state} → ${to}` }
  const at = now.toISOString()
  job.state = to
  job.updatedAt = at
  if (note !== undefined) job.note = note
  if (result !== undefined) job.result = result
  job.history.push({ state: to, at, ...(note ? { note } : {}) })
  saveQueue(q)
  return { ok: true, job }
}

/** The job to show on the hub strip: newest by updatedAt. */
export function currentJob(q: HarnessJob[] = loadQueue()): HarnessJob | null {
  if (!q.length) return null
  return [...q].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))[0]
}

export function inFlight(job: HarnessJob | null): boolean {
  return !!job && IN_FLIGHT.includes(job.state)
}

export function contextLine(c: PlayContext | null): string {
  if (!c) return 'no context'
  const where = c.gateId ? `${c.screen}:${c.gateId}${c.stageId ? ` stage ${c.stageId}` : ''}` : c.screen
  return `rank ${c.rank} · class ${c.classId ?? 'none'} · ${c.xp} XP · ${where}`
}

/** Text the player pastes into Grok Bot chat. Grok Bot runs the CLI with the same id. */
export function handoffText(job: HarnessJob): string {
  return [
    `[Hunter harness job ${job.id}]`,
    `Kind: ${job.kind}`,
    `Prompt: ${job.prompt}`,
    `Context: ${contextLine(job.context)}`,
    'Loop: Grok 4.7 plans a gate spec (docs/HARNESS.md) → Grok Bot builds on the box → web_ready → optional APK.',
    `Box: node scripts/harness.mjs add --id ${job.id} --kind ${job.kind} --prompt "<prompt>"`,
  ].join('\n')
}

// ---------- remote status (harness-status.json written by scripts/harness.mjs) ----------

export interface RemoteStatus {
  version: number
  updatedAt?: string
  jobs: unknown[]
}

export interface MergeResult {
  queue: HarnessJob[]
  /** Jobs whose state changed (or that are new) because of the remote file. */
  changed: HarnessJob[]
}

/**
 * Merge box-side status into the local queue. Remote wins when its updatedAt is newer.
 * Remote-only jobs (e.g. Grok Bot queued something from chat) are added so the player sees them.
 */
export function mergeRemote(local: HarnessJob[], remote: RemoteStatus | null | undefined): MergeResult {
  if (!remote || !Array.isArray(remote.jobs)) return { queue: local, changed: [] }
  const queue = local.map((j) => ({ ...j, history: [...j.history] }))
  const changed: HarnessJob[] = []
  for (const raw of remote.jobs) {
    const r = sanitizeJob(raw)
    if (!r) continue
    const mine = queue.find((j) => j.id === r.id)
    if (!mine) {
      queue.push(r)
      changed.push(r)
      continue
    }
    if (r.updatedAt <= mine.updatedAt) continue
    const stateChanged = r.state !== mine.state
    mine.state = r.state
    mine.updatedAt = r.updatedAt
    if (r.note !== undefined) mine.note = r.note
    if (r.result !== undefined) mine.result = r.result
    if (r.history.length > mine.history.length) mine.history = r.history
    else mine.history.push({ state: r.state, at: r.updatedAt, ...(r.note ? { note: r.note } : {}) })
    if (stateChanged) changed.push(mine)
  }
  return { queue, changed }
}

/**
 * Inside the installed APK the status file is baked at build time, so a job caught mid "apk_building"
 * is in fact the build you are running. Show it as apk_ready there.
 */
export function normalizeForApk(remote: RemoteStatus, isNativeApp: boolean): RemoteStatus {
  if (!isNativeApp) return remote
  return {
    ...remote,
    jobs: remote.jobs.map((j) =>
      j && typeof j === 'object' && (j as HarnessJob).state === 'apk_building'
        ? { ...(j as HarnessJob), state: 'apk_ready', note: 'You are running this APK.' }
        : j,
    ),
  }
}
