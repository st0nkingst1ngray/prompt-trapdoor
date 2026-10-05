/** Hub strip + floating status for the Grok 4.7 harness. All state lives in buildQueue.ts. */
import {
  STATUS_COPY,
  createJob,
  currentJob,
  handoffText,
  inFlight,
  loadQueue,
  mergeRemote,
  normalizeForApk,
  saveQueue,
  type HarnessJob,
  type JobKind,
  type PlayContext,
  type RemoteStatus,
} from './buildQueue'

type Esc = (s: string) => string

let composerOpen = false
let showHandoff: string | null = null
let composerError = ''
let draft = ''
let draftKind: JobKind = 'gate'

export function resetHarnessUi(): void {
  composerOpen = false
  showHandoff = null
  composerError = ''
  draft = ''
  draftKind = 'gate'
}

function stateChip(j: HarnessJob, esc: Esc): string {
  const c = STATUS_COPY[j.state]
  return `<span class="hj-chip hj-${j.state}">${c.emoji} ${esc(c.label)}</span>`
}

export function renderHarnessStrip(esc: Esc): string {
  const q = loadQueue()
  const cur = currentJob(q)
  const copy = cur ? STATUS_COPY[cur.state] : null
  const status = cur
    ? `<div class="harness-status" id="harness-status" data-state="${cur.state}">
        ${stateChip(cur, esc)}
        <span class="harness-prompt">“${esc(cur.prompt.length > 80 ? `${cur.prompt.slice(0, 77)}…` : cur.prompt)}”</span>
        <div class="muted harness-hint">${esc(copy!.hint)}${cur.note ? ` · <em>${esc(cur.note)}</em>` : ''}</div>
      </div>`
    : `<div class="harness-status" id="harness-status" data-state="idle"><span class="muted">No build in flight. Stuck or bored? Prompt the next gate — Grok Bot builds it while you keep playing.</span></div>`

  const kinds: [JobKind, string][] = [
    ['gate', 'New gate'],
    ['tweak', 'Tweak'],
    ['bug', 'Bug'],
  ]
  const composer = composerOpen
    ? `<div class="harness-composer">
        <div class="chips">${kinds
          .map(([k, l]) => `<button type="button" class="chip kind ${draftKind === k ? 'on' : ''}" data-hkind="${k}">${esc(l)}</button>`)
          .join('')}</div>
        <textarea id="harness-prompt" class="prompt-box" maxlength="500" placeholder="e.g. a C-rank door where I have to spot a fake citation in 3 taps">${esc(draft)}</textarea>
        <div class="actions">
          <button class="btn" id="btn-harness-submit" type="button">Queue for Grok Bot</button>
          <button class="btn ghost" id="btn-harness-cancel" type="button">Cancel</button>
        </div>
        ${composerError ? `<div class="toast fail">${esc(composerError)}</div>` : ''}
        <p class="muted" style="margin:0.4rem 0 0;font-size:0.8rem">Stored on this device only. Nothing is sent anywhere — paste the handoff into Grok Bot chat.</p>
      </div>`
    : ''

  const handoff = showHandoff
    ? `<div class="harness-handoff">
        <label class="field-label" for="harness-handoff">Handoff for Grok Bot (copy + paste into chat)</label>
        <textarea id="harness-handoff" class="prompt-box" readonly>${esc(showHandoff)}</textarea>
        <div class="actions"><button class="btn secondary" id="btn-harness-copy" type="button">Copy</button>
        <button class="btn ghost" id="btn-harness-close" type="button">Done</button></div>
      </div>`
    : ''

  const recent = q
    .slice(-5)
    .reverse()
    .map((j) => `<li data-job="${esc(j.id)}">${stateChip(j, esc)} <span>${esc(j.prompt.length > 60 ? `${j.prompt.slice(0, 57)}…` : j.prompt)}</span></li>`)
    .join('')

  return `
  <section class="harness-strip" id="harness-strip" aria-label="Build harness">
    <div class="harness-top">
      <span class="eyebrow" style="margin:0">Grok 4.7 harness · build status</span>
      <div class="actions" style="margin:0">
        ${composerOpen ? '' : `<button class="btn secondary" id="btn-harness-open" type="button">💡 Prompt next gate</button>`}
        ${cur && !showHandoff ? `<button class="btn ghost" id="btn-harness-handoff" type="button">Handoff</button>` : ''}
      </div>
    </div>
    ${status}
    ${composer}
    ${handoff}
    ${q.length > 1 ? `<details class="harness-jobs"><summary>Jobs (${q.length})</summary><ul>${recent}</ul></details>` : ''}
  </section>`
}

export function bindHarnessStrip(root: ParentNode, getContext: () => PlayContext, rerender: () => void): void {
  root.querySelector('#btn-harness-open')?.addEventListener('click', () => {
    composerOpen = true
    composerError = ''
    showHandoff = null
    rerender()
  })
  root.querySelector('#btn-harness-cancel')?.addEventListener('click', () => {
    composerOpen = false
    composerError = ''
    rerender()
  })
  root.querySelectorAll<HTMLButtonElement>('[data-hkind]').forEach((b) =>
    b.addEventListener('click', () => {
      const ta = root.querySelector<HTMLTextAreaElement>('#harness-prompt')
      if (ta) draft = ta.value
      draftKind = b.dataset.hkind as JobKind
      rerender()
    }),
  )
  const ta = root.querySelector<HTMLTextAreaElement>('#harness-prompt')
  ta?.addEventListener('input', () => {
    draft = ta.value
  })
  root.querySelector('#btn-harness-submit')?.addEventListener('click', () => {
    const text = root.querySelector<HTMLTextAreaElement>('#harness-prompt')?.value ?? draft
    const r = createJob(text, draftKind, getContext())
    if (!r.ok) {
      composerError = r.error
      draft = text
      rerender()
      return
    }
    composerOpen = false
    composerError = ''
    draft = ''
    showHandoff = handoffText(r.job)
    showHarnessToast(`${STATUS_COPY.inventing.emoji} Queued — ${STATUS_COPY.inventing.hint}`)
    rerender()
  })
  root.querySelector('#btn-harness-handoff')?.addEventListener('click', () => {
    const cur = currentJob()
    if (cur) showHandoff = handoffText(cur)
    rerender()
  })
  root.querySelector('#btn-harness-close')?.addEventListener('click', () => {
    showHandoff = null
    rerender()
  })
  root.querySelector('#btn-harness-copy')?.addEventListener('click', () => {
    const area = root.querySelector<HTMLTextAreaElement>('#harness-handoff')
    if (!area) return
    area.select()
    const done = () => showHarnessToast('📋 Copied — paste it into Grok Bot chat.')
    try {
      const p = navigator.clipboard?.writeText(area.value)
      if (p) p.then(done, () => showHarnessToast('Select the text and copy it manually.'))
      else done()
    } catch {
      showHarnessToast('Select the text and copy it manually.')
    }
  })
}

// ---------- floating toast + "process ongoing" pill (outside #app so re-renders keep them) ----------

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showHarnessToast(text: string, ms = 6000): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById('harness-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'harness-toast'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  el.textContent = text
  el.classList.add('show')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el!.classList.remove('show'), ms)
}

export function updateHarnessPill(): void {
  if (typeof document === 'undefined') return
  const cur = currentJob()
  let el = document.getElementById('harness-pill')
  if (!inFlight(cur)) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('div')
    el.id = 'harness-pill'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  const c = STATUS_COPY[cur!.state]
  el.dataset.state = cur!.state
  el.textContent = `${c.emoji} ${c.label}…`
  el.title = c.hint
}

// ---------- polling the box-side status file ----------

function isNativeApp(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

/** Fetch harness-status.json once and merge. Returns jobs whose state changed. */
export async function pollHarnessOnce(url: string): Promise<HarnessJob[]> {
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return []
    const remote = normalizeForApk((await res.json()) as RemoteStatus, isNativeApp())
    const { queue, changed } = mergeRemote(loadQueue(), remote)
    if (changed.length) saveQueue(queue)
    return changed
  } catch {
    return []
  }
}

export function startHarnessPolling(url: string, onChange: (changed: HarnessJob[]) => void, everyMs = 15000): () => void {
  let stopped = false
  const tick = async () => {
    if (stopped) return
    const changed = await pollHarnessOnce(url)
    if (changed.length) {
      const last = changed[changed.length - 1]
      const c = STATUS_COPY[last.state]
      showHarnessToast(`${c.emoji} ${c.label}: “${last.prompt.slice(0, 50)}” — ${c.hint}`)
      onChange(changed)
    }
    updateHarnessPill()
  }
  void tick()
  const h = setInterval(tick, everyMs)
  return () => {
    stopped = true
    clearInterval(h)
  }
}
