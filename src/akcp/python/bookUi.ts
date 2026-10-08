import { renderLesson } from '../bashmissions/lesson'
import type { CodeCurriculum, CodeLevel, CodeModule, CodeSave, GradeReport } from './types'

export interface CodeBookCallbacks {
  onHub: () => void
  onBooks: () => void
  escapeHtml: (value: string) => string
}

export interface CodeBookApi {
  prefix: string
  title: string
  eyebrow: string
  blurb: string
  credit: string
  sim: string
  guideLabel: string
  campaignDone: string
  constraints: string
  saveKey: string
  load: () => CodeSave
  write: (save: CodeSave) => void
  awardLevel: CodeProgressAward
  recordFail: (save: CodeSave, levelId: number) => CodeSave
  revealHint: (save: CodeSave, levelId: number) => CodeSave
  hintStage: (save: CodeSave, levelId: number) => number
  setDraft: (save: CodeSave, levelId: number, script: string) => CodeSave
  setPlayerName: (save: CodeSave, name: string) => CodeSave
  levelUnlocked: (save: CodeSave, levelId: number) => boolean
  resumeLevelId: (save: CodeSave, levelCount?: number) => number
  certificateText: (moduleName: string, playerName: string, completedDate: string) => string
  ensureCurriculum: () => Promise<CodeCurriculum>
  levelById: (book: CodeCurriculum, id: number) => CodeLevel
  moduleById: (book: CodeCurriculum, id: number) => CodeModule
  grade: (book: CodeCurriculum, level: CodeLevel, source: string) => Promise<GradeReport>
  /** When set, the book opens on this level after the catalog loads. */
  startLevelId?: number
}

type CodeProgressAward = (
  save: CodeSave,
  input: { levelId: number; xp: number; moduleId: number; moduleLevelIds: number[]; today: string },
) => { save: CodeSave; xpGained: number; certificate: boolean }

type BookView =
  | { kind: 'modules' }
  | { kind: 'levels'; moduleId: number }
  | { kind: 'play'; levelId: number }
  | { kind: 'guide' }

interface Session {
  prefix: string
  api: CodeBookApi
  callbacks: CodeBookCallbacks
  host: HTMLElement | null
  curriculum: CodeCurriculum | null
  view: BookView
  lastReport: { levelId: number; report: GradeReport } | null
  lastAward: { levelId: number; xpGained: number; certificate: boolean } | null
  checking: boolean
  token: number
  guideReturn: BookView
}

const sessions = new Map<string, Session>()

export function mountCodeBook(root: HTMLElement, callbacks: CodeBookCallbacks, api: CodeBookApi): void {
  unmountCodeBook(api.prefix)
  const session: Session = {
    prefix: api.prefix,
    api,
    callbacks,
    host: root,
    curriculum: null,
    view: { kind: 'modules' },
    lastReport: null,
    lastAward: null,
    checking: false,
    token: 0,
    guideReturn: { kind: 'modules' },
  }
  sessions.set(api.prefix, session)
  void boot(session)
}

export function unmountCodeBook(prefix: string): void {
  const session = sessions.get(prefix)
  if (!session) return
  session.host = null
  session.token += 1
  sessions.delete(prefix)
}

function esc(session: Session, value: string): string {
  return session.callbacks.escapeHtml(value)
}

function shell(session: Session, inner: string): string {
  const { api } = session
  return `<div class="screen active" id="akcp">
    <div class="actions">
      <button class="btn ghost" id="btn-akcp-hub" type="button">Back to Association</button>
      <button class="btn ghost" id="btn-akcp-books" type="button">Books</button>
      <button class="btn ghost" id="btn-${api.prefix}-handbook" type="button">${esc(session, api.guideLabel)}</button>
    </div>
    ${inner}
    <p class="muted akcp-sim">${esc(session, api.sim)}</p>
    <p class="muted bash-credit">${esc(session, api.credit)}</p>
  </div>`
}

function stashEditor(session: Session): void {
  const editor = document.getElementById(`${session.prefix}-editor`)
  if (!(editor instanceof HTMLTextAreaElement) || session.view.kind !== 'play') return
  session.api.write(session.api.setDraft(session.api.load(), session.view.levelId, editor.value))
}

function bindChrome(session: Session): void {
  document.getElementById('btn-akcp-hub')?.addEventListener('click', () => {
    stashEditor(session)
    session.callbacks.onHub()
  })
  document.getElementById('btn-akcp-books')?.addEventListener('click', () => {
    stashEditor(session)
    session.callbacks.onBooks()
  })
  document.getElementById(`btn-${session.prefix}-handbook`)?.addEventListener('click', () => {
    if (session.view.kind === 'guide') return
    stashEditor(session)
    session.guideReturn = session.view
    session.view = { kind: 'guide' }
    paint(session)
  })
}

function hud(session: Session, goal: string, constraints: string, attempt: string, nextAction: string): string {
  return `<div class="hud">
    <div class="hud-item"><label>Goal</label><div class="val">${esc(session, goal)}</div></div>
    <div class="hud-item"><label>Constraints</label><div class="val">${esc(session, constraints)}</div></div>
    <div class="hud-item"><label>Attempt</label><div class="val">${esc(session, attempt)}</div></div>
    <div class="hud-item next"><label>Next action</label><div class="val">${esc(session, nextAction)}</div></div>
  </div>`
}

async function boot(session: Session): Promise<void> {
  const root = session.host
  const token = ++session.token
  if (!root) return
  root.innerHTML = shell(session, `<p id="${session.prefix}-loading">Loading ${esc(session, session.api.title)}…</p>`)
  bindChrome(session)
  try {
    session.curriculum = await session.api.ensureCurriculum()
    if (session.host !== root || session.token !== token) return
    if (localStorage.getItem(session.api.saveKey) == null) session.api.write(session.api.load())
    const start = session.api.startLevelId
    if (start && session.api.levelUnlocked(session.api.load(), start)) {
      session.view = { kind: 'play', levelId: start }
    }
    paint(session)
  } catch (error) {
    if (session.host !== root || session.token !== token) return
    const message = error instanceof Error ? error.message : `${session.api.title} could not load.`
    root.innerHTML = shell(session, `<p id="${session.prefix}-error">${esc(session, message)}</p>`)
    bindChrome(session)
  }
}

function paint(session: Session): void {
  if (!session.host || !session.curriculum) return
  if (session.view.kind === 'modules') paintModules(session)
  else if (session.view.kind === 'levels') paintLevels(session, session.view.moduleId)
  else if (session.view.kind === 'guide') paintGuide(session)
  else paintPlay(session, session.view.levelId)
}

function paintModules(session: Session): void {
  const book = session.curriculum!
  const save = session.api.load()
  const resume = session.api.resumeLevelId(save, book.levels.length)
  const resumeLevel = session.api.levelById(book, resume)
  const tiles = book.modules.map((mod) => {
    const open = session.api.levelUnlocked(save, mod.levelIds[0] ?? 1)
    const cleared = mod.levelIds.filter((id) => save.cleared.includes(id)).length
    const certified = save.certifiedOn[String(mod.id)] != null
    const badge = !open ? 'Locked' : certified ? 'Certificate' : `${cleared}/${mod.levelIds.length}`
    return `<button class="tile${open ? '' : ' locked'}" id="${session.prefix}-module-${mod.id}" type="button"${open ? '' : ' disabled'}>
      <div class="title">${esc(session, mod.display)}</div>
      <div class="sub">${esc(session, mod.blurb)}</div>
      <span class="badge${open ? '' : ' locked'}">${esc(session, badge)}</span>
    </button>`
  }).join('')
  session.host!.innerHTML = shell(session, `
    <header class="hub-header">
      <p class="eyebrow">${esc(session, session.api.eyebrow)}</p>
      <h1>${esc(session, session.api.title)}</h1>
      <p class="muted">${esc(session, session.api.blurb)}</p>
    </header>
    <div id="${session.prefix}-stats" class="rank-card">${save.xp} XP · ${save.cleared.length}/${book.levels.length} cleared · ${esc(session, save.playerName)}</div>
    <label class="bash-name" for="${session.prefix}-player">Name on certificates</label>
    <input id="${session.prefix}-player" maxlength="40" value="${esc(session, save.playerName)}">
    <div class="actions">
      <button class="btn" id="btn-${session.prefix}-continue" type="button">Continue · ${esc(session, resumeLevel.title)}</button>
    </div>
    <h2 class="section-title">Modules</h2>
    <div class="hub-grid">${tiles}</div>
  `)
  bindChrome(session)
  document.getElementById(`${session.prefix}-player`)?.addEventListener('change', (event) => {
    const value = (event.target as HTMLInputElement).value
    session.api.write(session.api.setPlayerName(session.api.load(), value))
  })
  document.getElementById(`btn-${session.prefix}-continue`)?.addEventListener('click', () => {
    openLevel(session, resume)
  })
  for (const mod of book.modules) {
    document.getElementById(`${session.prefix}-module-${mod.id}`)?.addEventListener('click', () => {
      if (!session.api.levelUnlocked(session.api.load(), mod.levelIds[0] ?? 1)) return
      session.view = { kind: 'levels', moduleId: mod.id }
      paint(session)
    })
  }
}

function paintLevels(session: Session, moduleId: number): void {
  const book = session.curriculum!
  const mod = session.api.moduleById(book, moduleId)
  const save = session.api.load()
  const rows = mod.levelIds.map((id) => {
    const level = session.api.levelById(book, id)
    const open = session.api.levelUnlocked(save, id)
    const done = save.cleared.includes(id)
    const badge = done ? 'Clear' : open ? 'Play' : 'Locked'
    return `<button class="tile${open ? '' : ' locked'}" id="${session.prefix}-level-${id}" type="button"${open ? '' : ' disabled'}>
      <div class="title">${id}. ${esc(session, level.title)}</div>
      <div class="sub">${esc(session, level.difficulty)} · ${level.xp} XP</div>
      <span class="badge${open ? '' : ' locked'}${done ? ' done' : ''}">${badge}</span>
    </button>`
  }).join('')
  session.host!.innerHTML = shell(session, `
    <div class="actions"><button class="btn secondary" id="btn-${session.prefix}-modules" type="button">All modules</button></div>
    <header class="hub-header">
      <p class="eyebrow">Module ${mod.id} · ${esc(session, mod.difficulty)}</p>
      <h1>${esc(session, mod.display)}</h1>
      <p class="muted">${esc(session, mod.blurb)}</p>
    </header>
    <div class="hub-grid">${rows}</div>
  `)
  bindChrome(session)
  document.getElementById(`btn-${session.prefix}-modules`)?.addEventListener('click', () => {
    session.view = { kind: 'modules' }
    paint(session)
  })
  for (const id of mod.levelIds) {
    document.getElementById(`${session.prefix}-level-${id}`)?.addEventListener('click', () => openLevel(session, id))
  }
}

function openLevel(session: Session, levelId: number): void {
  if (!session.api.levelUnlocked(session.api.load(), levelId)) return
  session.lastReport = session.lastReport?.levelId === levelId ? session.lastReport : null
  session.lastAward = session.lastAward?.levelId === levelId ? session.lastAward : null
  session.view = { kind: 'play', levelId }
  paint(session)
}

function hintButtonLabel(stage: number): string {
  if (stage <= 0) return 'Hint 1'
  if (stage === 1) return 'Hint 2'
  if (stage === 2) return 'Hint 3'
  if (stage === 3) return 'Guide'
  if (stage === 4) return 'Answer'
  return 'Answer shown'
}

function checksHtml(session: Session, level: CodeLevel): string {
  if (level.tests.length === 1 && level.tests[0] === 'stdout') {
    const sample = level.stdin
      ? `<p>Sample input. Each line is one <code>input()</code> call. The game types it for you.</p><pre class="bash-code"><code>${esc(session, level.stdin)}</code></pre>`
      : ''
    return `<p>Printed output must match.</p><pre class="bash-code"><code>${esc(session, level.expected)}</code></pre>${sample}`
  }
  const names = level.tests.map((test) => `<li><code>${esc(session, test.split('.').pop() ?? test)}</code></li>`).join('')
  const tests = level.support.filter((file) => file.name.endsWith('_test.py'))
  const files = tests.map((file) =>
    `<details class="bash-details"><summary>${esc(session, file.name)}</summary><pre class="bash-code"><code>${esc(session, file.text)}</code></pre></details>`,
  ).join('')
  const data = level.support.filter((file) => !file.name.endsWith('_test.py'))
  const dataNote = data.length
    ? `<p class="muted">Also loaded next to your file: ${data.map((file) => `<code>${esc(session, file.name)}</code>`).join(', ')}</p>`
    : ''
  return `<ul class="akcp-check" id="${session.prefix}-checks">${names}</ul>${files}${dataNote}`
}

function paintPlay(session: Session, levelId: number): void {
  const book = session.curriculum!
  const level = session.api.levelById(book, levelId)
  const mod = session.api.moduleById(book, level.module)
  const save = session.api.load()
  const stage = session.api.hintStage(save, level.id)
  const fails = save.fails[String(level.id)] ?? 0
  const cleared = save.cleared.includes(level.id)
  const script = save.drafts[String(level.id)] ?? level.scaffold
  const report = session.lastReport?.levelId === level.id ? session.lastReport.report : null
  const award = session.lastAward?.levelId === level.id ? session.lastAward : null
  const nextAction = session.checking
    ? 'Wait for the tests'
    : report?.passed
      ? (level.id < book.levels.length ? 'Open the next level' : 'Campaign complete')
      : 'Check your code'
  const attempt = report?.passed || cleared ? 'Clear' : fails === 0 ? 'Not yet' : `${fails} miss${fails === 1 ? '' : 'es'}`
  const concepts = level.concepts.map((concept) => `<span class="bash-chip">${esc(session, concept)}</span>`).join('')
  session.host!.innerHTML = shell(session, `
    <div class="actions"><button class="btn secondary" id="btn-${session.prefix}-levels" type="button">Module levels</button></div>
    ${hud(session, level.title, session.api.constraints, attempt, nextAction)}
    <p class="muted">Module ${mod.id} · ${esc(session, mod.display)} · Level ${level.id} of ${book.levels.length}</p>
    <h2>${level.id}. ${esc(session, level.title)}</h2>
    <div class="bash-chips">${concepts}</div>
    <article id="${session.prefix}-brief">${renderLesson(level.objective, (value) => esc(session, value))}</article>
    <h3>Checks</h3>
    ${checksHtml(session, level)}
    <label for="${session.prefix}-editor">${esc(session, level.editPath)}</label>
    <textarea id="${session.prefix}-editor" class="bash-editor" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(session, script)}</textarea>
    <div class="actions">
      <button class="btn" id="btn-${session.prefix}-check" type="button"${session.checking ? ' disabled' : ''}>${session.checking ? 'Checking…' : 'Check'}</button>
      <button class="btn secondary" id="btn-${session.prefix}-hint" type="button"${stage >= 5 ? ' disabled' : ''}>${esc(session, hintButtonLabel(stage))}</button>
    </div>
    ${hintPanel(session, level, stage)}
    ${report ? reportHtml(session, report) : ''}
    ${report?.passed ? passHtml(session, level, mod, save, award) : ''}
  `)
  bindChrome(session)
  document.getElementById(`btn-${session.prefix}-levels`)?.addEventListener('click', () => {
    rememberDraft(session, level)
    session.view = { kind: 'levels', moduleId: level.module }
    paint(session)
  })
  document.getElementById(`${session.prefix}-editor`)?.addEventListener('input', (event) => {
    const value = (event.target as HTMLTextAreaElement).value
    session.api.write(session.api.setDraft(session.api.load(), level.id, value))
  })
  document.getElementById(`btn-${session.prefix}-hint`)?.addEventListener('click', () => {
    rememberDraft(session, level)
    session.api.write(session.api.revealHint(session.api.load(), level.id))
    paint(session)
    document.getElementById(`${session.prefix}-hint-panel`)?.focus()
  })
  document.getElementById(`btn-${session.prefix}-check`)?.addEventListener('click', () => {
    void onCheck(session, level)
  })
  document.getElementById(`${session.prefix}-editor`)?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void onCheck(session, level)
    }
  })
  document.getElementById(`btn-${session.prefix}-next`)?.addEventListener('click', () => {
    const next = level.id + 1
    if (next <= book.levels.length && session.api.levelUnlocked(session.api.load(), next)) openLevel(session, next)
  })
}

function rememberDraft(session: Session, level: CodeLevel): void {
  const editor = document.getElementById(`${session.prefix}-editor`)
  if (!(editor instanceof HTMLTextAreaElement)) return
  session.api.write(session.api.setDraft(session.api.load(), level.id, editor.value))
}

function hintPanel(session: Session, level: CodeLevel, stage: number): string {
  if (stage <= 0) return ''
  const blocks = [
    stage >= 1 ? `<h3>Hint 1</h3>${renderLesson(level.hints[0] ?? '', (value) => esc(session, value))}` : '',
    stage >= 2 ? `<h3>Hint 2</h3>${renderLesson(level.hints[1] ?? '', (value) => esc(session, value))}` : '',
    stage >= 3 ? `<h3>Hint 3</h3>${renderLesson(level.hints[2] ?? '', (value) => esc(session, value))}` : '',
    stage >= 4 ? `<h3>Guide</h3>${renderLesson(level.guide, (value) => esc(session, value))}` : '',
    stage >= 5 ? `<h3>Reference answer</h3><pre class="bash-code"><code>${esc(session, level.answer)}</code></pre>` : '',
  ].join('')
  return `<div id="${session.prefix}-hint-panel" tabindex="-1">${blocks}</div>`
}

function reportHtml(session: Session, report: GradeReport): string {
  const rows = report.results.map((result) => {
    const detail = result.passed || !result.message
      ? ''
      : `<pre class="bash-code"><code>${esc(session, result.message)}</code></pre>`
    return `<li class="bash-case ${result.passed ? 'ok' : 'bad'}"><strong>${result.passed ? 'Pass' : 'Miss'}</strong> ${esc(session, result.name)}${detail}</li>`
  }).join('')
  return `<div id="${session.prefix}-results" role="status"><p><strong>${esc(session, report.summary)}</strong></p><ul class="akcp-check">${rows}</ul></div>`
}

function passHtml(
  session: Session,
  level: CodeLevel,
  mod: CodeModule,
  save: CodeSave,
  award: { xpGained: number; certificate: boolean } | null,
): string {
  const book = session.curriculum!
  const gained = award ? `+${award.xpGained} XP` : 'Already cleared'
  const lastInModule = level.id === mod.levelIds[mod.levelIds.length - 1]
  const certifiedOn = save.certifiedOn[String(mod.id)]
  const certificate = certifiedOn && (award?.certificate || lastInModule)
    ? `<pre class="bash-code" id="${session.prefix}-certificate"><code>${esc(session, session.api.certificateText(mod.display, save.playerName, certifiedOn))}</code></pre>`
    : ''
  const next = level.id < book.levels.length
    ? `<button class="btn" id="btn-${session.prefix}-next" type="button">Next level</button>`
    : `<p id="${session.prefix}-campaign-done"><strong>${esc(session, session.api.campaignDone)}</strong></p>`
  return `<section id="${session.prefix}-debrief">
    <h2>Debrief · ${esc(session, gained)}</h2>
    ${renderLesson(level.debrief, (value) => esc(session, value))}
    <h3>Common mistakes</h3>
    ${renderLesson(level.mistakes, (value) => esc(session, value))}
    ${certificate}
    <div class="actions">${next}</div>
  </section>`
}

async function onCheck(session: Session, level: CodeLevel): Promise<void> {
  if (session.checking || !session.curriculum) return
  const editor = document.getElementById(`${session.prefix}-editor`)
  const script = editor instanceof HTMLTextAreaElement
    ? editor.value
    : (session.api.load().drafts[String(level.id)] ?? level.scaffold)
  session.api.write(session.api.setDraft(session.api.load(), level.id, script))
  session.checking = true
  const token = session.token
  paint(session)
  const report = await session.api.grade(session.curriculum, level, script)
  session.checking = false
  if (!session.host || session.token !== token || session.view.kind !== 'play' || session.view.levelId !== level.id) return
  session.lastReport = { levelId: level.id, report }
  if (report.passed) {
    const mod = session.api.moduleById(session.curriculum, level.module)
    const today = new Date().toISOString().slice(0, 10)
    const awarded = session.api.awardLevel(session.api.load(), {
      levelId: level.id,
      xp: level.xp,
      moduleId: mod.id,
      moduleLevelIds: mod.levelIds,
      today,
    })
    session.api.write(awarded.save)
    session.lastAward = { levelId: level.id, xpGained: awarded.xpGained, certificate: awarded.certificate }
  } else {
    session.api.write(session.api.recordFail(session.api.load(), level.id))
    session.lastAward = null
  }
  paint(session)
}

function paintGuide(session: Session): void {
  const book = session.curriculum!
  session.host!.innerHTML = shell(session, `
    <div class="actions"><button class="btn secondary" id="btn-${session.prefix}-guide-back" type="button">Back</button></div>
    <article id="${session.prefix}-guide">${renderLesson(book.guide, (value) => esc(session, value))}</article>
  `)
  bindChrome(session)
  document.getElementById(`btn-${session.prefix}-guide-back`)?.addEventListener('click', () => {
    session.view = session.guideReturn
    paint(session)
  })
}
