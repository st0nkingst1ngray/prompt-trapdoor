import { ensureCurriculum, levelById, moduleById } from './catalog'
import { gradeLevel, type GradeReport } from './grade'
import { renderLesson } from './lesson'
import {
  awardLevel,
  certificateText,
  hintStage,
  levelUnlocked,
  loadBashMissions,
  recordBashFail,
  resumeLevelId,
  revealHint,
  setDraft,
  setPlayerName,
  writeBashMissions,
  type BashMissionsSave,
} from './save'
import type { BmLevel, BmModule, Curriculum } from './types'

export interface BashCallbacks {
  onHub: () => void
  onBooks: () => void
  escapeHtml: (value: string) => string
}

const CREDIT = 'BashMissions by Jalil Abdollahi · MIT License · github.com/devopshobbies/bashmissions'
const SIM = 'Training sim. Your script runs in a local browser sandbox. It is not sent to a server and it does not touch this machine’s shell.'

type BashView =
  | { kind: 'modules' }
  | { kind: 'levels'; moduleId: number }
  | { kind: 'play'; levelId: number }
  | { kind: 'guide' }

let host: HTMLElement | null = null
let callbacks: BashCallbacks | null = null
let curriculum: Curriculum | null = null
let view: BashView = { kind: 'modules' }
let lastReport: { levelId: number; report: GradeReport } | null = null
let lastAward: { levelId: number; xpGained: number; certificate: boolean } | null = null
let checking = false
let loadError = ''
let guideReturn: BashView = { kind: 'modules' }

export function mountBashMissions(root: HTMLElement, next: BashCallbacks): void {
  host = root
  callbacks = next
  view = { kind: 'modules' }
  lastReport = null
  lastAward = null
  checking = false
  loadError = ''
  void boot()
}

export function unmountBashMissions(): void {
  host = null
  callbacks = null
  view = { kind: 'modules' }
  lastReport = null
  lastAward = null
  checking = false
}

function esc(value: string): string {
  return callbacks ? callbacks.escapeHtml(value) : value
}

function shell(inner: string): string {
  return `<div class="screen active" id="akcp">
    <div class="actions">
      <button class="btn ghost" id="btn-akcp-hub" type="button">Back to Association</button>
      <button class="btn ghost" id="btn-akcp-books" type="button">Books</button>
      <button class="btn ghost" id="btn-bash-handbook" type="button">Bash guide</button>
    </div>
    ${inner}
    <p class="muted akcp-sim">${esc(SIM)}</p>
    <p class="muted bash-credit">${esc(CREDIT)}</p>
  </div>`
}

function stashEditor(): void {
  const editor = document.getElementById('bash-editor')
  if (!(editor instanceof HTMLTextAreaElement) || view.kind !== 'play') return
  writeBashMissions(setDraft(loadBashMissions(), view.levelId, editor.value))
}

function bindChrome(): void {
  document.getElementById('btn-akcp-hub')?.addEventListener('click', () => {
    stashEditor()
    callbacks?.onHub()
  })
  document.getElementById('btn-akcp-books')?.addEventListener('click', () => {
    stashEditor()
    callbacks?.onBooks()
  })
  document.getElementById('btn-bash-handbook')?.addEventListener('click', () => {
    if (view.kind === 'guide') return
    stashEditor()
    guideReturn = view
    view = { kind: 'guide' }
    paint()
  })
}

function hud(goal: string, constraints: string, attempt: string, nextAction: string): string {
  return `<div class="hud">
    <div class="hud-item"><label>Goal</label><div class="val">${esc(goal)}</div></div>
    <div class="hud-item"><label>Constraints</label><div class="val">${esc(constraints)}</div></div>
    <div class="hud-item"><label>Attempt</label><div class="val">${esc(attempt)}</div></div>
    <div class="hud-item next"><label>Next action</label><div class="val">${esc(nextAction)}</div></div>
  </div>`
}

async function boot(): Promise<void> {
  const root = host
  if (!root) return
  root.innerHTML = shell('<p id="bash-loading">Loading BashMissions…</p>')
  bindChrome()
  try {
    curriculum = await ensureCurriculum()
    if (host !== root) return
    if (localStorage.getItem('bash-missions-save-v1') == null) writeBashMissions(loadBashMissions())
    paint()
  } catch (error) {
    if (host !== root) return
    loadError = error instanceof Error ? error.message : 'BashMissions could not load.'
    root.innerHTML = shell(`<p id="bash-error">${esc(loadError)}</p>`)
    bindChrome()
  }
}

function paint(): void {
  if (!host || !callbacks || !curriculum) return
  if (view.kind === 'modules') paintModules()
  else if (view.kind === 'levels') paintLevels(view.moduleId)
  else if (view.kind === 'guide') paintGuide()
  else paintPlay(view.levelId)
}

function paintModules(): void {
  const book = curriculum!
  const save = loadBashMissions()
  const resume = resumeLevelId(save, book.levels.length)
  const resumeLevel = levelById(book, resume)
  const tiles = book.modules.map((mod) => {
    const open = levelUnlocked(save, mod.levelIds[0] ?? 1)
    const cleared = mod.levelIds.filter((id) => save.cleared.includes(id)).length
    const certified = save.certifiedOn[String(mod.id)] != null
    const badge = !open ? 'Locked' : certified ? 'Certificate' : `${cleared}/${mod.levelIds.length}`
    return `<button class="tile${open ? '' : ' locked'}" id="bash-module-${mod.id}" type="button"${open ? '' : ' disabled'}>
      <div class="title">${esc(mod.display)}</div>
      <div class="sub">${esc(mod.blurb)}</div>
      <span class="badge${open ? '' : ' locked'}">${esc(badge)}</span>
    </button>`
  }).join('')
  host!.innerHTML = shell(`
    <header class="hub-header">
      <p class="eyebrow">AKCP book · bash scripting</p>
      <h1>BashMissions</h1>
      <p class="muted">${book.levels.length} levels · ${book.modules.length} modules. One script, then the next hint if you need it.</p>
    </header>
    <div id="bash-stats" class="rank-card">${save.xp} XP · ${save.cleared.length}/${book.levels.length} cleared · ${esc(save.playerName)}</div>
    <label class="bash-name" for="bash-player">Name on certificates</label>
    <input id="bash-player" maxlength="40" value="${esc(save.playerName)}">
    <div class="actions">
      <button class="btn" id="btn-bash-continue" type="button">Continue · ${esc(resumeLevel.title)}</button>
    </div>
    <h2 class="section-title">Modules</h2>
    <div class="hub-grid">${tiles}</div>
  `)
  bindChrome()
  document.getElementById('bash-player')?.addEventListener('change', (event) => {
    const value = (event.target as HTMLInputElement).value
    writeBashMissions(setPlayerName(loadBashMissions(), value))
  })
  document.getElementById('btn-bash-continue')?.addEventListener('click', () => {
    openLevel(resume)
  })
  for (const mod of book.modules) {
    document.getElementById(`bash-module-${mod.id}`)?.addEventListener('click', () => {
      if (!levelUnlocked(loadBashMissions(), mod.levelIds[0] ?? 1)) return
      view = { kind: 'levels', moduleId: mod.id }
      paint()
    })
  }
}

function paintLevels(moduleId: number): void {
  const book = curriculum!
  const mod = moduleById(book, moduleId)
  const save = loadBashMissions()
  const rows = mod.levelIds.map((id) => {
    const level = levelById(book, id)
    const open = levelUnlocked(save, id)
    const done = save.cleared.includes(id)
    const badge = done ? 'Clear' : open ? 'Play' : 'Locked'
    return `<button class="tile${open ? '' : ' locked'}" id="bash-level-${id}" type="button"${open ? '' : ' disabled'}>
      <div class="title">${id}. ${esc(level.title)}</div>
      <div class="sub">${esc(level.difficulty)} · ${level.xp} XP</div>
      <span class="badge${open ? '' : ' locked'}${done ? ' done' : ''}">${badge}</span>
    </button>`
  }).join('')
  host!.innerHTML = shell(`
    <div class="actions"><button class="btn secondary" id="btn-bash-modules" type="button">All modules</button></div>
    <header class="hub-header">
      <p class="eyebrow">Module ${mod.id} · ${esc(mod.difficulty)}</p>
      <h1>${esc(mod.display)}</h1>
      <p class="muted">${esc(mod.blurb)}</p>
    </header>
    <div class="hub-grid">${rows}</div>
  `)
  bindChrome()
  document.getElementById('btn-bash-modules')?.addEventListener('click', () => {
    view = { kind: 'modules' }
    paint()
  })
  for (const id of mod.levelIds) {
    document.getElementById(`bash-level-${id}`)?.addEventListener('click', () => openLevel(id))
  }
}

function openLevel(levelId: number): void {
  if (!levelUnlocked(loadBashMissions(), levelId)) return
  lastReport = lastReport?.levelId === levelId ? lastReport : null
  lastAward = lastAward?.levelId === levelId ? lastAward : null
  view = { kind: 'play', levelId }
  paint()
}

function currentScript(level: BmLevel, save: BashMissionsSave): string {
  const editor = document.getElementById('bash-editor')
  if (editor instanceof HTMLTextAreaElement && view.kind === 'play') return editor.value
  return save.drafts[String(level.id)] ?? level.scaffold
}

function hintButtonLabel(stage: number): string {
  if (stage <= 0) return 'Hint 1'
  if (stage === 1) return 'Hint 2'
  if (stage === 2) return 'Hint 3'
  if (stage === 3) return 'Guide'
  if (stage === 4) return 'Answer'
  return 'Answer shown'
}

function paintPlay(levelId: number): void {
  const book = curriculum!
  const level = levelById(book, levelId)
  const mod = moduleById(book, level.module)
  const save = loadBashMissions()
  const stage = hintStage(save, level.id)
  const fails = save.fails[String(level.id)] ?? 0
  const cleared = save.cleared.includes(level.id)
  const script = save.drafts[String(level.id)] ?? level.scaffold
  const report = lastReport?.levelId === level.id ? lastReport.report : null
  const award = lastAward?.levelId === level.id ? lastAward : null
  const nextAction = checking
    ? 'Wait for the tests'
    : report?.passed
      ? (level.id < book.levels.length ? 'Open the next level' : 'Campaign complete')
      : 'Check your script'
  const attempt = report?.passed || cleared ? 'Clear' : fails === 0 ? 'Not yet' : `${fails} miss${fails === 1 ? '' : 'es'}`
  const concepts = level.concepts.map((concept) => `<span class="bash-chip">${esc(concept)}</span>`).join('')
  const checks = level.tests.map((test) => {
    const args = test.args.length ? test.args.map((arg) => esc(arg)).join(' ') : '(no args)'
    return `<li><code>${args}</code> → exit ${test.exit}</li>`
  }).join('')
  const fixtures = level.fixtures.length === 0
    ? ''
    : `<details class="bash-details"><summary>Workspace files</summary>${level.fixtures.map((fixture) =>
      `<p><code>fixtures/${esc(fixture.name)}</code></p><pre class="bash-code"><code>${esc(fixture.text)}</code></pre>`,
    ).join('')}</details>`
  host!.innerHTML = shell(`
    <div class="actions"><button class="btn secondary" id="btn-bash-levels" type="button">Module levels</button></div>
    ${hud(level.title, 'Match stdout exactly. Exit with the required status.', attempt, nextAction)}
    <p class="muted">Module ${mod.id} · ${esc(mod.display)} · Level ${level.id} of ${book.levels.length}</p>
    <h2>${level.id}. ${esc(level.title)}</h2>
    <div class="bash-chips">${concepts}</div>
    <article id="bash-brief">${renderLesson(level.objective, esc)}</article>
    <h3>Checks</h3>
    <ul class="akcp-check" id="bash-checks">${checks}</ul>
    ${fixtures}
    <label for="bash-editor">solution.sh</label>
    <textarea id="bash-editor" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(script)}</textarea>
    <div class="actions">
      <button class="btn" id="btn-bash-check" type="button"${checking ? ' disabled' : ''}>Check</button>
      <button class="btn secondary" id="btn-bash-hint" type="button"${stage >= 5 ? ' disabled' : ''}>${esc(hintButtonLabel(stage))}</button>
    </div>
    ${hintPanel(level, stage)}
    ${report ? reportHtml(report) : ''}
    ${report?.passed ? passHtml(level, mod, save, award) : ''}
  `)
  bindChrome()
  document.getElementById('btn-bash-levels')?.addEventListener('click', () => {
    rememberDraft(level)
    view = { kind: 'levels', moduleId: level.module }
    paint()
  })
  document.getElementById('bash-editor')?.addEventListener('input', (event) => {
    const value = (event.target as HTMLTextAreaElement).value
    writeBashMissions(setDraft(loadBashMissions(), level.id, value))
  })
  document.getElementById('btn-bash-hint')?.addEventListener('click', () => {
    rememberDraft(level)
    writeBashMissions(revealHint(loadBashMissions(), level.id))
    paint()
    document.getElementById('bash-hint-panel')?.focus()
  })
  document.getElementById('btn-bash-check')?.addEventListener('click', () => {
    void onCheck(level)
  })
  document.getElementById('bash-editor')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void onCheck(level)
    }
  })
  document.getElementById('btn-bash-next')?.addEventListener('click', () => {
    const next = level.id + 1
    if (next <= book.levels.length && levelUnlocked(loadBashMissions(), next)) openLevel(next)
  })
}

function rememberDraft(level: BmLevel): void {
  const editor = document.getElementById('bash-editor')
  if (!(editor instanceof HTMLTextAreaElement)) return
  writeBashMissions(setDraft(loadBashMissions(), level.id, editor.value))
}

function hintPanel(level: BmLevel, stage: number): string {
  if (stage <= 0) return ''
  const blocks = [
    stage >= 1 ? `<h3>Hint 1</h3>${renderLesson(level.hints[0] ?? '', esc)}` : '',
    stage >= 2 ? `<h3>Hint 2</h3>${renderLesson(level.hints[1] ?? '', esc)}` : '',
    stage >= 3 ? `<h3>Hint 3</h3>${renderLesson(level.hints[2] ?? '', esc)}` : '',
    stage >= 4 ? `<h3>Guide</h3>${renderLesson(level.guide, esc)}` : '',
    stage >= 5 ? `<h3>Reference answer</h3><pre class="bash-code"><code>${esc(level.answer)}</code></pre>` : '',
  ].join('')
  return `<div id="bash-hint-panel" tabindex="-1">${blocks}</div>`
}

function reportHtml(report: GradeReport): string {
  const rows = report.results.map((result) => {
    const args = result.args.length ? result.args.map((arg) => esc(arg)).join(' ') : '(no args)'
    const detail = result.passed
      ? ''
      : `<pre class="bash-code"><code>${esc(`expected (${result.expectedExit}): ${result.expectedStdout}\nactual (${result.actualExit}): ${result.actualStdout}${result.message ? `\n${result.message}` : ''}`)}</code></pre>`
    return `<li class="bash-case ${result.passed ? 'ok' : 'bad'}"><strong>${result.passed ? 'Pass' : 'Miss'}</strong> ${args}${detail}</li>`
  }).join('')
  return `<div id="bash-results" role="status"><p><strong>${esc(report.summary)}</strong></p><ul class="akcp-check">${rows}</ul></div>`
}

function passHtml(level: BmLevel, mod: BmModule, save: BashMissionsSave, award: { xpGained: number; certificate: boolean } | null): string {
  const book = curriculum!
  const gained = award ? `+${award.xpGained} XP` : 'Already cleared'
  const lastInModule = level.id === mod.levelIds[mod.levelIds.length - 1]
  const certifiedOn = save.certifiedOn[String(mod.id)]
  const certificate = certifiedOn && (award?.certificate || lastInModule)
    ? `<pre class="bash-code" id="bash-certificate"><code>${esc(certificateText(mod.display, save.playerName, certifiedOn))}</code></pre>`
    : ''
  const next = level.id < book.levels.length
    ? '<button class="btn" id="btn-bash-next" type="button">Next level</button>'
    : '<p id="bash-campaign-done"><strong>Campaign complete.</strong> 500 levels cleared.</p>'
  return `<section id="bash-debrief">
    <h2>Debrief · ${esc(gained)}</h2>
    ${renderLesson(level.debrief, esc)}
    <h3>Common mistakes</h3>
    ${renderLesson(level.mistakes, esc)}
    ${certificate}
    <div class="actions">${next}</div>
  </section>`
}

async function onCheck(level: BmLevel): Promise<void> {
  if (checking || !curriculum) return
  const editor = document.getElementById('bash-editor')
  const script = editor instanceof HTMLTextAreaElement ? editor.value : currentScript(level, loadBashMissions())
  writeBashMissions(setDraft(loadBashMissions(), level.id, script))
  checking = true
  paint()
  const report = await gradeLevel(level, script)
  checking = false
  if (!host || view.kind !== 'play' || view.levelId !== level.id) return
  lastReport = { levelId: level.id, report }
  if (report.passed) {
    const mod = moduleById(curriculum, level.module)
    const today = new Date().toISOString().slice(0, 10)
    const awarded = awardLevel(loadBashMissions(), {
      levelId: level.id,
      xp: level.xp,
      moduleId: mod.id,
      moduleLevelIds: mod.levelIds,
      today,
    })
    writeBashMissions(awarded.save)
    lastAward = { levelId: level.id, xpGained: awarded.xpGained, certificate: awarded.certificate }
  } else {
    writeBashMissions(recordBashFail(loadBashMissions(), level.id))
    lastAward = null
  }
  paint()
}

function paintGuide(): void {
  const book = curriculum!
  host!.innerHTML = shell(`
    <div class="actions"><button class="btn secondary" id="btn-bash-guide-back" type="button">Back</button></div>
    <article id="bash-guide">${renderLesson(book.guide, esc)}</article>
  `)
  bindChrome()
  document.getElementById('btn-bash-guide-back')?.addEventListener('click', () => {
    view = guideReturn
    paint()
  })
}
