/** DOM layer for Rank-D gates, Rank-C doors + Temperature Casino. All rules live in the pure gate modules. */
import { XP_PER_GATE } from '../hunter'
import { distribution } from './casino'
import { gateById, loadGateClears, recordStageClear } from './registry'
import {
  wordCount,
  type DGateId,
  type GateDef,
  type GateOutcome,
  type GateStage,
  type KnobStage,
  type KnobValues,
  type SamplingParams,
  type SamplingStage,
  type SelectStage,
  type TextStage,
} from './types'

export interface GateCallbacks {
  onHub: () => void
  escapeHtml: (s: string) => string
  onFirstClear?: () => void
}

type Run = 'playing' | 'won' | 'lost'

interface TextLog {
  n: number
  text: string
  reply: string
  win: boolean
}

let gate: GateDef | null = null
let stageIndex = 0
let picked: string[] = []
let draft = ''
let attempt = 1
let runs = 0
let params: SamplingParams = { temperature: 1, topK: 5, topP: 1 }
let knobs: KnobValues = {}
let outcome: GateOutcome | null = null
let toast = ''
let run: Run = 'playing'
let showTip = false
let logs: TextLog[] = []
let cb: GateCallbacks | null = null
let root: HTMLElement | null = null

const esc = (s: string) => (cb ? cb.escapeHtml(s) : s)

function stage(): GateStage {
  return gate!.stages[stageIndex]
}

function beginStage(i: number) {
  stageIndex = i
  const s = stage()
  picked = s.kind === 'select' ? [...(s.initialPicks ?? [])] : []
  draft = ''
  attempt = 1
  runs = 0
  params = s.kind === 'sampling' ? { ...s.defaults } : { temperature: 1, topK: 5, topP: 1 }
  knobs = s.kind === 'knobs' ? { ...s.defaults } : {}
  outcome = null
  toast = ''
  run = 'playing'
  showTip = false
  logs = []
}

export function mountGate(el: HTMLElement, id: DGateId, callbacks: GateCallbacks) {
  cb = callbacks
  root = el
  if (!gate || gate.id !== id || run !== 'playing') {
    gate = gateById(id)
    const done = loadGateClears()[id] ?? []
    const next = gate.stages.findIndex((s) => !done.includes(s.id))
    beginStage(next >= 0 ? next : 0)
  }
  paint()
}

export function resetGateUi() {
  gate = null
  run = 'playing'
}

function paint() {
  if (!root) return
  root.innerHTML = render()
  bind()
}

// ---------- render ----------

function render(): string {
  const g = gate!
  const s = stage()
  const done = loadGateClears()[g.id] ?? []
  const pips = g.stages
    .map((st, i) => {
      const cls = i === stageIndex ? 'now' : done.includes(st.id) ? 'done' : 'wait'
      const can = done.includes(st.id) || i === stageIndex
      return `<button type="button" class="pip ${cls}" data-stage="${i}" ${can ? '' : 'disabled'} title="${esc(st.title)}">${
        done.includes(st.id) ? '✓' : st.id
      }</button>`
    })
    .join('')

  const next = run === 'won' ? (stageIndex < g.stages.length - 1 ? 'Next stage →' : 'Gate cleared — back to Association') : run === 'lost' ? 'Retry stage' : s.nextAction

  return `
  <div class="screen active" id="dgate" data-gate="${g.id}" data-stage-id="${s.id}">
    <div class="level-bar">
      <div>
        <p class="eyebrow" style="margin:0">${esc(g.path)}</p>
        <h2>${g.emoji} ${esc(g.title)}</h2>
        <p class="muted" style="margin:0">Stage ${s.id}/${g.stages.length}: <strong>${esc(s.title)}</strong></p>
      </div>
      <button class="btn ghost" id="btn-gate-hub" type="button">← Association</button>
    </div>
    <div class="stage-pips" aria-label="Stages">${pips}</div>

    <div class="hud" aria-live="polite">
      <div class="hud-item"><label>Goal</label><div class="val">${esc(s.goal)}</div></div>
      <div class="hud-item"><label>Constraints</label><div class="val" style="font-size:0.95rem">${esc(s.constraints)}</div></div>
      <div class="hud-item"><label>${hudCounterLabel(s)}</label><div class="val">${hudCounter(s)}</div></div>
      <div class="hud-item next"><label>Next action</label><div class="val">${esc(next)}</div></div>
    </div>

    <p class="sim-note">Training sim · this model is fake and local, no API keys · not a request to touch a real system · learn the attack so you can name the defense</p>

    <div class="panel">
      <h3 style="font-size:1rem">Brief</h3>
      <p style="margin:0">${esc(s.brief)}</p>
      ${s.kind === 'text' ? `<pre class="system-box">${esc(s.system)}</pre>` : ''}
      ${s.kind === 'sampling' || s.kind === 'knobs' ? `<pre class="system-box">${esc(s.context)}</pre>` : ''}
    </div>

    ${s.kind === 'text' ? renderText(s) : s.kind === 'select' ? renderSelect(s) : s.kind === 'knobs' ? renderKnobs(s) : renderSampling(s)}

    ${renderOutcome()}
  </div>`
}

function hudCounterLabel(s: GateStage): string {
  if (s.kind === 'text') return 'Attempt'
  if (s.kind === 'select') return s.budget ? 'Window' : s.maxPicks ? 'Slots' : 'Runs'
  return 'Bet'
}

function hudCounter(s: GateStage): string {
  if (s.kind === 'text') return `${Math.min(attempt, s.maxAttempts)}/${s.maxAttempts}`
  if (s.kind === 'select') {
    if (s.budget) return `<span id="hud-budget">${usedCost(s)}/${s.budget.limit}</span>`
    if (s.maxPicks) return `<span id="hud-budget">${picked.length}/${s.maxPicks}</span>`
    return `${runs}`
  }
  return `<span id="hud-bet">${betLabel(s)}</span>`
}

function betLabel(s: SamplingStage | KnobStage): string {
  const win = s.kind === 'knobs' ? s.evaluate(knobs).win : s.evaluate(params).win
  return win ? 'Ready ✅' : 'Not yet'
}

function usedCost(s: SelectStage): number {
  return s.items.filter((i) => picked.includes(i.id)).reduce((a, i) => a + (i.cost ?? 0), 0)
}

function actionsRow(primaryId: string, primaryLabel: string, enabled: boolean): string {
  const g = gate!
  return `<div class="actions">
    <button class="btn" id="${primaryId}" type="button" ${enabled ? '' : 'disabled'}>${esc(primaryLabel)}</button>
    <button class="btn secondary" id="btn-gate-tip" type="button">Explain why</button>
    ${
      run === 'won'
        ? `<button class="btn ok" id="btn-gate-next" type="button">${stageIndex < g.stages.length - 1 ? 'Next stage →' : 'Back to Association 🎉'}</button>`
        : ''
    }
    ${run === 'lost' ? `<button class="btn danger" id="btn-gate-retry" type="button">Retry stage</button>` : ''}
  </div>
  ${showTip ? `<div class="toast tip">${esc(stage().tip)}</div>` : ''}`
}

function renderText(s: TextStage): string {
  const playing = run === 'playing'
  const n = wordCount(draft)
  const wc = s.maxWords != null ? `${n}/${s.maxWords} words` : n ? `${n} words` : ''
  const bans = s.banned.map((b) => `<span class="chip ban">${esc(b)}</span>`).join('')
  const logHtml = logs
    .slice()
    .reverse()
    .map((l) => `<div class="entry"><strong>#${l.n}</strong> ${l.win ? '✅' : '❌'}<div><em>Email:</em> ${esc(l.text)}</div><div><em>MailMole:</em> ${esc(l.reply)}</div></div>`)
    .join('')
  return `
    ${bans ? `<div class="chips" style="margin-bottom:0.75rem">${bans}</div>` : ''}
    <div class="panel">
      <label for="gate-text" class="field-label">Your email body</label>
      <textarea id="gate-text" class="prompt-box" placeholder="${esc(s.placeholder)}" ${playing ? '' : 'disabled'}>${esc(draft)}</textarea>
      <div class="muted" id="gate-wc" style="margin-top:0.35rem;font-size:0.85rem">${wc}</div>
      ${actionsRow('btn-gate-send', 'Send email', playing)}
      ${toast}
    </div>
    ${logs.length ? `<div class="panel"><h3 style="font-size:1rem">Attempt log</h3><div class="log">${logHtml}</div></div>` : ''}`
}

function pickButton(it: { id: string; label: string; detail?: string; cost?: number; tag?: string }, playing: boolean): string {
  const on = picked.includes(it.id)
  return `<button type="button" class="pick ${on ? 'on' : ''}" data-pick="${esc(it.id)}" aria-pressed="${on}" ${playing ? '' : 'disabled'}>
        <span class="pick-top">
          <span class="pick-check">${on ? '✓' : ''}</span>
          <span class="pick-label">${esc(it.label)}</span>
          ${it.cost != null ? `<span class="chip warn">${it.cost} tok</span>` : ''}
          ${it.tag ? `<span class="pick-tag">${esc(it.tag)}</span>` : ''}
        </span>
        ${it.detail && it.tag !== 'know' ? `<span class="pick-detail">${esc(it.detail)}</span>` : ''}
      </button>`
}

function renderSelect(s: SelectStage): string {
  const playing = run === 'playing'
  const puzzleItems = s.items.filter((it) => it.tag !== 'know')
  const knowItems = s.items.filter((it) => it.tag === 'know')
  const puzzleHtml = puzzleItems.map((it) => pickButton(it, playing)).join('')
  const knowHtml = knowItems.length
    ? `<div class="know-strip" style="margin-top:0.85rem">
        <label class="field-label">Know it · ${esc(s.knowledge?.prompt ?? 'Pick the defense that names the real lesson')}</label>
        <p class="muted" style="font-size:0.85rem;margin:0 0 0.4rem">Puzzle alone is not enough — prove you hold the concept.</p>
        <div class="pick-list">${knowItems.map((it) => pickButton(it, playing)).join('')}</div>
      </div>`
    : ''
  let meter = ''
  if (s.budget) {
    const used = usedCost(s)
    const pctW = Math.min(100, Math.round((used / s.budget.limit) * 100))
    meter = `<div class="budget"><div class="budget-label" id="budget-label">${used}/${s.budget.limit} ${esc(s.budget.label)}${
      used > s.budget.limit ? ' — over!' : ''
    }</div><div class="xp-track"><div class="xp-fill ${used > s.budget.limit ? 'over' : ''}" style="width:${pctW}%"></div></div></div>`
  }
  return `
    <div class="panel">
      <label class="field-label">${esc(s.pickHint)}</label>
      ${meter}
      <div class="pick-list">${puzzleHtml}</div>
      ${knowHtml}
      ${actionsRow('btn-gate-run', s.runLabel, playing)}
      ${toast}
    </div>`
}

function distHtml(s: SamplingStage): string {
  const d = distribution(s.candidates, params)
  return d
    .map((t) => {
      const w = Math.round(t.p * 100)
      const cls = ['bar-fill', t.unsafe ? 'unsafe' : '', t.glitch ? 'glitch' : '', t.kept ? '' : 'cut'].filter(Boolean).join(' ')
      return `<div class="bar-row"><span class="bar-tok">${esc(t.token)}</span><span class="bar-track"><span class="${cls}" style="width:${w}%"></span></span><span class="bar-pct">${
        t.kept ? `${(t.p * 100).toFixed(1)}%` : 'cut'
      }</span></div>`
    })
    .join('')
}

function liveRowsHtml(s: SamplingStage): string {
  const o = s.evaluate(params)
  return o.rows.map((r) => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✅' : '❌'} ${esc(r.label)}${r.detail ? ` <span class="muted">· ${esc(r.detail)}</span>` : ''}</li>`).join('')
}

function renderSampling(s: SamplingStage): string {
  const playing = run === 'playing'
  const dis = playing ? '' : 'disabled'
  const sliders = [
    s.controls.temperature
      ? `<label class="slider"><span>Temperature <strong id="v-temperature">${params.temperature.toFixed(1)}</strong></span>
         <input type="range" id="sl-temperature" min="0.1" max="2" step="0.1" value="${params.temperature}" ${dis}></label>`
      : '',
    s.controls.topK
      ? `<label class="slider"><span>Top-k <strong id="v-topK">${params.topK}</strong></span>
         <input type="range" id="sl-topK" min="1" max="${s.candidates.length}" step="1" value="${params.topK}" ${dis}></label>`
      : '',
    s.controls.topP
      ? `<label class="slider"><span>Top-p <strong id="v-topP">${params.topP.toFixed(2)}</strong></span>
         <input type="range" id="sl-topP" min="0.5" max="1" step="0.01" value="${params.topP}" ${dis}></label>`
      : '',
  ].join('')
  return `
    <div class="panel">
      <label class="field-label">Next-token distribution (live)</label>
      <div class="dist" id="dist">${distHtml(s)}</div>
      <div class="sliders">${sliders}</div>
      <ul class="rows" id="live-rows">${liveRowsHtml(s)}</ul>
      ${actionsRow('btn-gate-lock', 'Lock bet', playing)}
      ${toast}
    </div>`
}

function knobReadout(k: KnobStage['knobs'][number]): string {
  const v = knobs[k.id] ?? 0
  if (k.kind === 'toggle') return v >= 1 ? 'ON' : 'off'
  const step = k.step ?? 1
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  return `${v.toFixed(digits)}${k.unit ? ` ${k.unit}` : ''}`
}

function knobRowsHtml(s: KnobStage): string {
  const o = s.evaluate(knobs)
  return o.rows.map((r) => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✅' : '❌'} ${esc(r.label)}${r.detail ? ` <span class="muted">· ${esc(r.detail)}</span>` : ''}</li>`).join('')
}

function renderKnobs(s: KnobStage): string {
  const playing = run === 'playing'
  const dis = playing ? '' : 'disabled'
  const controls = s.knobs
    .map((k) => {
      const v = knobs[k.id] ?? 0
      if (k.kind === 'toggle') {
        return `<label class="slider toggle"><span>${esc(k.label)} <strong id="kv-${k.id}">${knobReadout(k)}</strong></span>
          <input type="checkbox" id="kn-${k.id}" ${v >= 1 ? 'checked' : ''} ${dis}>${k.hint ? `<span class="muted knob-hint">${esc(k.hint)}</span>` : ''}</label>`
      }
      return `<label class="slider"><span>${esc(k.label)} <strong id="kv-${k.id}">${knobReadout(k)}</strong></span>
        <input type="range" id="kn-${k.id}" min="${k.min ?? 0}" max="${k.max ?? 1}" step="${k.step ?? 1}" value="${v}" ${dis}>${
          k.hint ? `<span class="muted knob-hint">${esc(k.hint)}</span>` : ''
        }</label>`
    })
    .join('')
  return `
    <div class="panel">
      <label class="field-label">${esc(s.previewLabel)} (live)</label>
      <div class="reply" id="knob-preview">${esc(s.preview(knobs))}</div>
      <div class="sliders">${controls}</div>
      <ul class="rows" id="live-rows">${knobRowsHtml(s)}</ul>
      ${actionsRow('btn-gate-lock', s.lockLabel, playing)}
      ${toast}
    </div>`
}

function renderOutcome(): string {
  if (!outcome || stage().kind === 'sampling' || stage().kind === 'knobs') {
    return outcome?.reply ? `<div class="panel"><label class="field-label">Model output</label><div class="reply">${esc(outcome.reply)}</div></div>` : ''
  }
  const rows = outcome.rows
    .map((r) => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✅' : '❌'} ${esc(r.label)}${r.detail ? `<div class="muted row-detail">${esc(r.detail)}</div>` : ''}</li>`)
    .join('')
  return `
    <div class="panel" id="gate-outcome">
      <label class="field-label">${stage().kind === 'text' ? 'MailMole reply' : 'Result'}</label>
      ${outcome.reply ? `<div class="reply">${esc(outcome.reply)}</div>` : ''}
      ${rows ? `<ul class="rows">${rows}</ul>` : ''}
    </div>`
}

// ---------- actions ----------

function settle(o: GateOutcome, consumesAttempt: boolean) {
  outcome = o
  const s = stage()
  if (o.win) {
    run = 'won'
    const gained = recordStageClear(gate!.id, s.id)
    if (gained) cb?.onFirstClear?.()
    const last = stageIndex === gate!.stages.length - 1
    toast = `<div class="toast win">🎉 ${esc(o.headline)}</div>
      <div class="toast info"><strong>Lesson:</strong> ${esc(s.concept)}${gained ? ` <strong>+${XP_PER_GATE} Hunter XP.</strong>` : ''}${
        last ? ' <strong>Gate cleared!</strong>' : ''
      }</div>`
    return
  }
  toast = `<div class="toast ${o.rows.length || o.blocked ? 'fail' : 'info'}">${esc(o.headline)}</div>`
  if (s.kind === 'text' && consumesAttempt) {
    if (attempt >= s.maxAttempts) {
      run = 'lost'
      toast += `<div class="toast fail">Out of attempts — retry the stage (tip: Explain why).</div>`
    } else {
      attempt += 1
    }
  }
}

function sendText() {
  const s = stage() as TextStage
  const text = draft.trim()
  if (!text) {
    toast = `<div class="toast info">Write an email body first.</div>`
    paint()
    return
  }
  const o = s.evaluate(text)
  logs.push({ n: attempt, text, reply: o.reply ?? '', win: o.win })
  settle(o, true)
  if (o.win) draft = ''
  paint()
}

function bind() {
  const r = root!
  const s = stage()
  r.querySelector('#btn-gate-hub')?.addEventListener('click', () => cb?.onHub())
  r.querySelector('#btn-gate-tip')?.addEventListener('click', () => {
    const ta = r.querySelector<HTMLTextAreaElement>('#gate-text')
    if (ta) draft = ta.value
    showTip = !showTip
    paint()
  })
  r.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.stage)
      if (i === stageIndex) return
      beginStage(i)
      paint()
    }),
  )
  r.querySelector('#btn-gate-next')?.addEventListener('click', () => {
    if (stageIndex >= gate!.stages.length - 1) {
      run = 'playing'
      gate = null
      cb?.onHub()
      return
    }
    beginStage(stageIndex + 1)
    paint()
  })
  r.querySelector('#btn-gate-retry')?.addEventListener('click', () => {
    beginStage(stageIndex)
    paint()
  })

  if (s.kind === 'text') {
    const ta = r.querySelector<HTMLTextAreaElement>('#gate-text')
    const wc = r.querySelector('#gate-wc')
    ta?.addEventListener('input', () => {
      draft = ta.value
      if (wc) {
        const n = wordCount(draft)
        const over = s.maxWords != null && n > s.maxWords
        wc.textContent = s.maxWords != null ? `${n}/${s.maxWords} words${over ? ' — over budget!' : ''}` : n ? `${n} words` : ''
        ;(wc as HTMLElement).style.color = over ? 'var(--danger)' : 'var(--muted)'
      }
    })
    ta?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (run === 'playing') sendText()
      }
    })
    r.querySelector('#btn-gate-send')?.addEventListener('click', () => {
      if (run === 'playing') sendText()
    })
  }

  if (s.kind === 'select') {
    r.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        if (run !== 'playing') return
        const id = b.dataset.pick!
        const isKnow = id.startsWith('know:')
        if (picked.includes(id)) {
          picked = picked.filter((p) => p !== id)
          toast = ''
        } else if (isKnow) {
          // Knowledge strip: exactly one defense at a time
          picked = [...picked.filter((p) => !p.startsWith('know:')), id]
          toast = ''
        } else if (s.maxPicks === 1) {
          picked = [...picked.filter((p) => p.startsWith('know:')), id]
          toast = ''
        } else if (s.maxPicks && picked.length >= s.maxPicks) {
          toast = `<div class="toast info">All ${s.maxPicks} slots used — tap a picked card to free one.</div>`
        } else {
          picked = [...picked, id]
          toast = ''
        }
        paint()
      }),
    )
    r.querySelector('#btn-gate-run')?.addEventListener('click', () => {
      if (run !== 'playing') return
      runs += 1
      settle(s.evaluate(picked), false)
      paint()
    })
  }

  if (s.kind === 'knobs') {
    for (const k of s.knobs) {
      const input = r.querySelector<HTMLInputElement>(`#kn-${k.id}`)
      const update = () => {
        knobs = { ...knobs, [k.id]: k.kind === 'toggle' ? (input!.checked ? 1 : 0) : Number(input!.value) }
        const v = r.querySelector(`#kv-${k.id}`)
        if (v) v.textContent = knobReadout(k)
        const prev = r.querySelector('#knob-preview')
        if (prev) prev.textContent = s.preview(knobs)
        const live = r.querySelector('#live-rows')
        if (live) live.innerHTML = knobRowsHtml(s)
        const bet = r.querySelector('#hud-bet')
        if (bet) bet.textContent = betLabel(s)
      }
      input?.addEventListener('input', update)
      if (k.kind === 'toggle') input?.addEventListener('change', update)
    }
    r.querySelector('#btn-gate-lock')?.addEventListener('click', () => {
      if (run !== 'playing') return
      settle(s.evaluate(knobs), false)
      paint()
    })
  }

  if (s.kind === 'sampling') {
    const keys: (keyof SamplingParams)[] = ['temperature', 'topK', 'topP']
    for (const k of keys) {
      const input = r.querySelector<HTMLInputElement>(`#sl-${k}`)
      input?.addEventListener('input', () => {
        params = { ...params, [k]: Number(input.value) }
        const v = r.querySelector(`#v-${k}`)
        if (v) v.textContent = k === 'temperature' ? params.temperature.toFixed(1) : k === 'topP' ? params.topP.toFixed(2) : String(params.topK)
        const dist = r.querySelector('#dist')
        if (dist) dist.innerHTML = distHtml(s)
        const live = r.querySelector('#live-rows')
        if (live) live.innerHTML = liveRowsHtml(s)
        const bet = r.querySelector('#hud-bet')
        if (bet) bet.textContent = betLabel(s)
      })
    }
    r.querySelector('#btn-gate-lock')?.addEventListener('click', () => {
      if (run !== 'playing') return
      settle(s.evaluate(params), false)
      paint()
    })
  }
}
