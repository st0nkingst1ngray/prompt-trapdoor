import type { AkcpAnswer } from '../grade'
import type { AkcpActivity } from '../types'
import { gradeHandbookStep } from './grade'
import {
  AGENT_HANDBOOK_SAVE_KEY,
  awardStep,
  loadAgentHandbook,
  recordHandbookFail,
  stepUnlocked,
  writeAgentHandbook,
} from './save'
import { AGENT_HANDBOOK_CREDIT, AGENT_HANDBOOK_URL, HANDBOOK_STEPS, stepById } from './steps'

export interface HandbookCallbacks {
  onHub: () => void
  onBooks: () => void
  escapeHtml: (value: string) => string
}

const SIM = 'Training sim. This model is fake and local. This is not a request to touch a real system.'

type HandbookView = { kind: 'map' } | { kind: 'step'; id: string }

let host: HTMLElement | null = null
let callbacks: HandbookCallbacks | null = null
let view: HandbookView = { kind: 'map' }
let feedback: { headline: string; rows: { label: string; ok: boolean }[]; tip: string } | null = null
let showTip = false

export function mountAgentHandbook(root: HTMLElement, next: HandbookCallbacks): void {
  host = root
  callbacks = next
  view = { kind: 'map' }
  feedback = null
  showTip = false
  if (localStorage.getItem(AGENT_HANDBOOK_SAVE_KEY) == null) writeAgentHandbook(loadAgentHandbook())
  paint()
}

export function unmountAgentHandbook(): void {
  host = null
  callbacks = null
  view = { kind: 'map' }
  feedback = null
  showTip = false
}

function esc(value: string): string {
  return callbacks ? callbacks.escapeHtml(value) : value
}

function shell(inner: string): string {
  return `<div class="screen active" id="akcp">
    <div class="actions">
      <button class="btn ghost" id="btn-akcp-hub" type="button">Back to Association</button>
      <button class="btn ghost" id="btn-akcp-books" type="button">Books</button>
      <a class="btn ghost" id="agent-handbook-source" href="${AGENT_HANDBOOK_URL}" target="_blank" rel="noopener noreferrer">Read the handbook</a>
    </div>
    ${inner}
    <p class="muted akcp-sim">${esc(SIM)}</p>
    <p class="muted bash-credit">${esc(AGENT_HANDBOOK_CREDIT)}</p>
  </div>`
}

function hud(goal: string, constraints: string, attempt: string, nextAction: string): string {
  return `<div class="hud">
    <div class="hud-item"><label>Goal</label><div class="val">${esc(goal)}</div></div>
    <div class="hud-item"><label>Constraints</label><div class="val">${esc(constraints)}</div></div>
    <div class="hud-item"><label>Attempt</label><div class="val">${esc(attempt)}</div></div>
    <div class="hud-item next"><label>Next action</label><div class="val">${esc(nextAction)}</div></div>
  </div>`
}

function bindChrome(): void {
  document.getElementById('btn-akcp-hub')?.addEventListener('click', () => callbacks?.onHub())
  document.getElementById('btn-akcp-books')?.addEventListener('click', () => callbacks?.onBooks())
}

function paint(): void {
  if (!host || !callbacks) return
  if (view.kind === 'map') paintMap()
  else paintStep(view.id)
}

function paintMap(): void {
  const save = loadAgentHandbook()
  const tiles = HANDBOOK_STEPS.map((step, index) => {
    const open = stepUnlocked(save, index)
    const done = save.cleared.includes(step.id)
    const badge = done ? 'Clear' : open ? 'Play' : 'Locked'
    return `<button class="tile${open ? '' : ' locked'}" id="agent-step-${step.id}" type="button"${open ? '' : ' disabled'}>
      <div class="title">${index + 1}. ${esc(step.title)}</div>
      <div class="sub">${esc(step.briefing)}</div>
      <span class="badge${open ? '' : ' locked'}${done ? ' done' : ''}">${badge}</span>
    </button>`
  }).join('')
  host!.innerHTML = shell(`
    <header class="hub-header">
      <p class="eyebrow">AKCP book · agent teams</p>
      <h1>Optimal AI agents</h1>
      <p class="muted">Seven decisions. One agent until the work and the score say otherwise.</p>
    </header>
    <div id="agent-handbook-stats" class="rank-card">${save.cleared.length}/${HANDBOOK_STEPS.length} cleared</div>
    <div class="hub-grid">${tiles}</div>
  `)
  bindChrome()
  HANDBOOK_STEPS.forEach((step, index) => {
    document.getElementById(`agent-step-${step.id}`)?.addEventListener('click', () => {
      if (!stepUnlocked(loadAgentHandbook(), index)) return
      feedback = null
      showTip = false
      view = { kind: 'step', id: step.id }
      paint()
    })
  })
}

function paintStep(id: string): void {
  const step = stepById(id)
  const save = loadAgentHandbook()
  const fails = save.fails[id] ?? 0
  const cleared = save.cleared.includes(id)
  const activity = step.activity
  host!.innerHTML = shell(`
    <div class="actions"><button class="btn secondary" id="btn-agent-map" type="button">All seven</button></div>
    ${hud(activity.goal, activity.constraints, cleared ? 'Clear' : fails === 0 ? 'Not yet' : `${fails} miss${fails === 1 ? '' : 'es'}`, activity.nextAction)}
    <h2>${esc(step.title)}</h2>
    <article id="agent-brief"><p>${esc(step.briefing)}</p></article>
    <div id="agent-quest" data-step-id="${esc(step.id)}">
      <h3>${esc(activity.title)}</h3>
      ${activityBody(activity)}
      <div class="actions"><button class="btn" id="btn-agent-submit" type="button">Submit</button></div>
      ${feedbackHtml(activity.tip)}
    </div>
  `)
  bindChrome()
  bindMoves()
  document.getElementById('btn-agent-map')?.addEventListener('click', () => {
    feedback = null
    showTip = false
    view = { kind: 'map' }
    paint()
  })
  document.getElementById('btn-agent-explain')?.addEventListener('click', () => {
    showTip = !showTip
    paint()
  })
  document.getElementById('btn-agent-submit')?.addEventListener('click', () => onSubmit(step.id))
  document.getElementById('btn-agent-next')?.addEventListener('click', () => {
    const index = HANDBOOK_STEPS.findIndex((item) => item.id === id)
    const next = HANDBOOK_STEPS[index + 1]
    feedback = null
    showTip = false
    if (next && stepUnlocked(loadAgentHandbook(), index + 1)) view = { kind: 'step', id: next.id }
    else view = { kind: 'map' }
    paint()
  })
}

function feedbackHtml(tip: string): string {
  if (!feedback) return ''
  const rows = feedback.rows.map((row) => `<li>${row.ok ? '✓' : '✗'} ${esc(row.label)}</li>`).join('')
  const next = feedback.headline === 'Cleared' ? '<button class="btn" id="btn-agent-next" type="button">Next decision</button>' : ''
  return `<div id="agent-result" role="status"><p><strong>${esc(feedback.headline)}</strong></p>
    <ul class="akcp-check">${rows}</ul>
    <button class="btn secondary" id="btn-agent-explain" type="button">Explain why</button>
    <div class="toast tip" id="agent-tip"${showTip ? '' : ' hidden'}><strong>Explain why.</strong> ${esc(tip)}</div>
    <div class="actions">${next}</div></div>`
}

function activityBody(activity: AkcpActivity): string {
  if (activity.kind === 'order') {
    const rows = activity.steps
      .map(
        (step) => `<div class="akcp-row" data-step-id="${esc(step.id)}">
          <span>${esc(step.label)}</span>
          <span class="actions">
            <button class="btn secondary" type="button" data-move="up">Up</button>
            <button class="btn secondary" type="button" data-move="down">Down</button>
          </span>
        </div>`,
      )
      .join('')
    return `<div id="agent-order">${rows}</div>`
  }
  if (activity.kind === 'transcript') {
    return activity.lines
      .map(
        (line) => `<div class="akcp-line">
          <p><strong>${esc(line.speaker)}</strong> ${esc(line.text)}</p>
          <label class="akcp-choice"><input type="radio" name="mark-${esc(line.id)}" value="keep"> Keep</label>
          <label class="akcp-choice"><input type="radio" name="mark-${esc(line.id)}" value="stop"> Stop</label>
        </div>`,
      )
      .join('')
  }
  return activity.options
    .map(
      (option) => `<label class="akcp-choice">
        <input type="checkbox" value="${esc(option.id)}">
        <span>${esc(option.label)}</span>
      </label>`,
    )
    .join('')
}

function bindMoves(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest<HTMLElement>('[data-step-id]')
      const list = document.getElementById('agent-order')
      if (!row || !list) return
      if (btn.dataset.move === 'up' && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling)
      else if (btn.dataset.move === 'down' && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row)
    })
  })
}

function readAnswer(activity: AkcpActivity): AkcpAnswer {
  if (activity.kind === 'order') {
    const submitted = [...document.querySelectorAll('#agent-order [data-step-id]')].map(
      (el) => el.getAttribute('data-step-id') ?? '',
    )
    return { kind: 'order', submitted }
  }
  if (activity.kind === 'transcript') {
    const marks: Record<string, 'keep' | 'stop'> = {}
    for (const line of activity.lines) {
      const picked = document.querySelector<HTMLInputElement>(`input[name="mark-${line.id}"]:checked`)
      if (picked && (picked.value === 'keep' || picked.value === 'stop')) marks[line.id] = picked.value
    }
    return { kind: 'transcript', marks }
  }
  const picked = [...document.querySelectorAll<HTMLInputElement>('#agent-quest input[type="checkbox"]:checked')].map(
    (input) => input.value,
  )
  return { kind: 'checklist', picked }
}

function onSubmit(id: string): void {
  const step = stepById(id)
  const grade = gradeHandbookStep(step, readAnswer(step.activity))
  if (grade.win) {
    writeAgentHandbook(awardStep(loadAgentHandbook(), id))
    feedback = { headline: 'Cleared', rows: grade.rows, tip: step.activity.tip }
  } else {
    writeAgentHandbook(recordHandbookFail(loadAgentHandbook(), id))
    feedback = { headline: grade.headline, rows: grade.rows, tip: step.activity.tip }
    showTip = (loadAgentHandbook().fails[id] ?? 0) >= 2
  }
  paint()
}
