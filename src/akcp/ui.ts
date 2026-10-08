import { mountBashMissions, unmountBashMissions } from './bashmissions/ui'
import { mountExercismPython, unmountExercismPython } from './exercism-python/ui'
import { mountPyithon, unmountPyithon } from './pyithon/ui'
import { mountPythonKoans, unmountPythonKoans } from './python-koans/ui'
import { loadVfs, writeVfs } from './vfs/save'
import { mountFilesystemBooks, unmountFilesystemBooks } from './vfs/ui'
import type { VfsLaunch } from './vfs/types'
import { ACTIVE_BOOK } from './books/osmani2026/index'
import { gradeActivity, gradeBoss, type AkcpAnswer } from './grade'
import {
  AKCP_SAVE_KEY,
  acknowledgePenalty,
  awardActivity,
  loadAkcp,
  recordFail,
  writeAkcp,
  type AkcpSave,
} from './save'
import type { AkcpActivity, AkcpBoss, AkcpSection, AkcpStatId } from './types'

export interface AkcpCallbacks {
  onHub: () => void
  escapeHtml: (s: string) => string
}

const STAT_LABELS: Record<AkcpStatId, string> = {
  planning: 'Planning',
  context: 'Context',
  verification: 'Verification',
  versionControl: 'Version Control',
  testing: 'Testing',
  adaptation: 'Adaptation',
}

const SIM = 'Training sim. This model is fake and local. This is not a request to touch a real system.'

type View =
  | { kind: 'map' }
  | { kind: 'books' }
  | { kind: 'bash' }
  | { kind: 'koans' }
  | { kind: 'exercism' }
  | { kind: 'pyithon' }
  | { kind: 'wizard'; sectionId: string; pageIndex: number }
  | { kind: 'quests'; sectionId: string }
  | { kind: 'quest'; sectionId: string; questId: string }
  | { kind: 'boss'; sectionId: string }

let root: HTMLElement | null = null
let cb: AkcpCallbacks | null = null
let view: View = { kind: 'map' }
let launchLevel: number | null = null
let beatIndex = 0
let feedback: { headline: string; rows: { label: string; ok: boolean }[]; tip: string } | null = null
let showTip = false

export function mountAkcp(host: HTMLElement, callbacks: AkcpCallbacks): void {
  root = host
  cb = callbacks
  view = { kind: 'map' }
  beatIndex = 0
  feedback = null
  showTip = false
  if (localStorage.getItem(AKCP_SAVE_KEY) == null) writeAkcp(loadAkcp())
  paint()
}

function unmountSideBooks(): void {
  unmountBashMissions()
  unmountPythonKoans()
  unmountExercismPython()
  unmountPyithon()
}

export function unmountAkcp(): void {
  unmountFilesystemBooks()
  unmountSideBooks()
  view = { kind: 'map' }
  beatIndex = 0
  feedback = null
  showTip = false
  root = null
  cb = null
}

function sections(): AkcpSection[] {
  return ACTIVE_BOOK.chapters.flatMap((chapter) => chapter.sections)
}

function findSection(id: string): AkcpSection {
  const found = sections().find((section) => section.id === id)
  if (!found) throw new Error(id)
  return found
}

function introRead(save: AkcpSave): boolean {
  return findSection('intro').pages.every((page) => save.pagesRead.includes(page.id))
}

function sectionOpen(section: AkcpSection, save: AkcpSave): boolean {
  if (section.status !== 'playable') return false
  if (section.id === 'specs') return introRead(save)
  return true
}

function rememberPage(save: AkcpSave, pageId: string): AkcpSave {
  if (save.pagesRead.includes(pageId)) return save
  const next: AkcpSave = { ...save, pagesRead: [...save.pagesRead, pageId] }
  writeAkcp(next)
  return next
}

function paragraphText(id: string): string {
  for (const section of sections()) {
    const paragraph = section.paragraphs.find((item) => item.id === id)
    if (paragraph) return paragraph.text
  }
  return ''
}

function locate(id: string): { section: AkcpSection; activity: AkcpActivity | null; boss: AkcpBoss | null } | null {
  for (const section of sections()) {
    const step = section.steps.find((item) => item.id === id)
    if (step) return { section, activity: step, boss: null }
    if (section.boss?.id === id) return { section, activity: null, boss: section.boss }
  }
  return null
}

function esc(value: string): string {
  return cb ? cb.escapeHtml(value) : value
}

function shell(inner: string): string {
  return `<div class="screen active" id="akcp">
    <div class="actions"><button class="btn ghost" id="btn-akcp-hub" type="button">Back to Association</button></div>
    ${inner}
    <p class="muted akcp-sim">${esc(SIM)}</p>
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

function bindHub(): void {
  document.getElementById('btn-akcp-hub')?.addEventListener('click', () => cb?.onHub())
}

function paint(): void {
  if (!root || !cb) return
  if (view.kind !== 'books') unmountFilesystemBooks()
  const save = loadAkcp()
  if (save.penaltyPendingId && view.kind !== 'bash' && view.kind !== 'books' && view.kind !== 'koans' && view.kind !== 'exercism' && view.kind !== 'pyithon') {
    paintPenalty(save.penaltyPendingId)
    return
  }
  if (view.kind === 'books') {
    paintBooks()
    return
  }
  if (view.kind === 'bash') {
    paintBash()
    return
  }
  if (view.kind === 'koans') {
    paintKoans()
    return
  }
  if (view.kind === 'exercism') {
    paintExercism()
    return
  }
  if (view.kind === 'pyithon') {
    paintPyithon()
    return
  }
  if (view.kind === 'map') paintMap(save)
  else if (view.kind === 'wizard') paintWizard(view.sectionId, view.pageIndex)
  else if (view.kind === 'quests') paintQuests(view.sectionId)
  else if (view.kind === 'quest') paintQuest(view.sectionId, view.questId)
  else paintBoss(view.sectionId)
}

function paintMap(save: AkcpSave): void {
  const stats = (Object.keys(STAT_LABELS) as AkcpStatId[])
    .map((id) => `${STAT_LABELS[id]} ${save.stats[id]}`)
    .join(' · ')
  const tiles = sections()
    .map((section) => {
      const open = sectionOpen(section, save)
      const badge = section.status === 'indexed' ? 'Indexed' : open ? 'Enter' : 'Read intro'
      return `<button class="tile${open ? '' : ' locked'}" id="akcp-section-${section.id}" type="button"${open ? '' : ' disabled'}>
        <div class="title">${esc(section.title)}</div>
        <div class="sub">${section.status === 'playable' ? 'Playable' : 'Later pass'}</div>
        <span class="badge${open ? '' : ' locked'}">${esc(badge)}</span>
      </button>`
    })
    .join('')
  root!.innerHTML = shell(`
    <header class="hub-header">
      <p class="eyebrow">Open world · optional</p>
      <h1>Advanced Knowledge Collecting Protocol</h1>
      <p class="muted">Read a page, then make one technical call. Rank stays on the E–S road. Books opens BashMissions and the Python campaigns.</p>
    </header>
    <div class="actions"><button class="btn secondary" id="btn-akcp-books" type="button">Books</button></div>
    <div id="akcp-stats" class="rank-card">${esc(stats)}</div>
    <h2 class="section-title">Protocol map</h2>
    <div class="hub-grid">${tiles}</div>
  `)
  bindHub()
  document.getElementById('btn-akcp-books')?.addEventListener('click', () => {
    view = { kind: 'books' }
    paint()
  })
  for (const section of sections()) {
    document.getElementById(`akcp-section-${section.id}`)?.addEventListener('click', () => {
      if (!sectionOpen(section, loadAkcp())) return
      feedback = null
      showTip = false
      view = { kind: 'wizard', sectionId: section.id, pageIndex: 0 }
      paint()
    })
  }
}

function paintBooks(): void {
  if (!root || !cb) return
  unmountFilesystemBooks()
  unmountSideBooks()
  if (!loadVfs().simplePicker) {
    mountFilesystemBooks(root, {
      escapeHtml: esc,
      onHub: () => cb?.onHub(),
      onSimple: () => {
        writeVfs({ ...loadVfs(), simplePicker: true })
        paintBooks()
      },
      onOpen: (launch) => openFromVfs(launch),
    })
    return
  }
  paintBooksPicker()
}

function openFromVfs(launch: VfsLaunch): void {
  if (launch.book === 'osmani') {
    view = { kind: 'wizard', sectionId: launch.target, pageIndex: launch.pageIndex ?? 0 }
    paint()
    return
  }
  const level = Number(launch.target)
  launchLevel = Number.isFinite(level) ? level : null
  if (launch.book === 'bash') view = { kind: 'bash' }
  else if (launch.book === 'koans') view = { kind: 'koans' }
  else if (launch.book === 'exercism') view = { kind: 'exercism' }
  else view = { kind: 'pyithon' }
  paint()
}

function takeLaunchLevel(): number | undefined {
  const level = launchLevel
  launchLevel = null
  return level && level > 0 ? level : undefined
}

function paintBooksPicker(): void {
  root!.innerHTML = shell(`
    <header class="hub-header">
      <p class="eyebrow">Open world · optional</p>
      <h1>Choose a book</h1>
      <p class="muted">Osmani stays on the protocol map. BashMissions and the three Python books are graded campaigns.</p>
    </header>
    <div class="actions"><button class="btn secondary" id="akcp-books-fs" type="button">Filesystem</button></div>
    <div class="hub-grid">
      <button class="tile" id="akcp-book-osmani" type="button">
        <div class="emoji">📗</div>
        <div class="title">Osmani workflow</div>
        <div class="sub">My LLM coding workflow going into 2026. Reading wizard and technical quests.</div>
        <span class="badge">Open</span>
      </button>
      <button class="tile" id="akcp-book-bash" type="button">
        <div class="emoji">⌨️</div>
        <div class="title">BashMissions</div>
        <div class="sub">26 modules, 500 levels. Write a script, run the tests, take the next hint.</div>
        <span class="badge">Play</span>
      </button>
      <button class="tile" id="akcp-book-koans" type="button">
        <div class="emoji">🐍</div>
        <div class="title">Python Koans</div>
        <div class="sub">278 missions. Fill the blank or fix the code until that one test passes.</div>
        <span class="badge">Play</span>
      </button>
      <button class="tile" id="akcp-book-exercism" type="button">
        <div class="emoji">🧩</div>
        <div class="title">Exercism Python</div>
        <div class="sub">149 exercises. Concept track, then practice. The included tests grade you.</div>
        <span class="badge">Play</span>
      </button>
      <button class="tile" id="akcp-book-pyithon" type="button">
        <div class="emoji">📘</div>
        <div class="title">pyi-thon</div>
        <div class="sub">30 levels, three phases. Print the expected output and use the concept.</div>
        <span class="badge">Play</span>
      </button>
    </div>
  `)
  bindHub()
  document.getElementById('akcp-books-fs')?.addEventListener('click', () => {
    writeVfs({ ...loadVfs(), simplePicker: false })
    paintBooks()
  })
  document.getElementById('akcp-book-osmani')?.addEventListener('click', () => {
    view = { kind: 'map' }
    paint()
  })
  document.getElementById('akcp-book-bash')?.addEventListener('click', () => {
    view = { kind: 'bash' }
    paint()
  })
  document.getElementById('akcp-book-koans')?.addEventListener('click', () => {
    view = { kind: 'koans' }
    paint()
  })
  document.getElementById('akcp-book-exercism')?.addEventListener('click', () => {
    view = { kind: 'exercism' }
    paint()
  })
  document.getElementById('akcp-book-pyithon')?.addEventListener('click', () => {
    view = { kind: 'pyithon' }
    paint()
  })
}

function sideCallbacks(unmount: () => void) {
  return {
    escapeHtml: esc,
    onHub: () => {
      unmount()
      cb?.onHub()
    },
    onBooks: () => {
      unmount()
      view = { kind: 'books' }
      paint()
    },
  }
}

function paintBash(): void {
  if (!root || !cb) return
  unmountSideBooks()
  const levelId = takeLaunchLevel()
  mountBashMissions(root, sideCallbacks(unmountBashMissions), levelId ? { levelId } : undefined)
}

function paintKoans(): void {
  if (!root || !cb) return
  unmountSideBooks()
  const levelId = takeLaunchLevel()
  mountPythonKoans(root, sideCallbacks(unmountPythonKoans), levelId ? { levelId } : undefined)
}

function paintExercism(): void {
  if (!root || !cb) return
  unmountSideBooks()
  const levelId = takeLaunchLevel()
  mountExercismPython(root, sideCallbacks(unmountExercismPython), levelId ? { levelId } : undefined)
}

function paintPyithon(): void {
  if (!root || !cb) return
  unmountSideBooks()
  const levelId = takeLaunchLevel()
  mountPyithon(root, sideCallbacks(unmountPyithon), levelId ? { levelId } : undefined)
}

function paintWizard(sectionId: string, pageIndex: number): void {
  const section = findSection(sectionId)
  const page = section.pages[pageIndex]
  if (!page) return
  rememberPage(loadAkcp(), page.id)
  const last = pageIndex >= section.pages.length - 1
  const nextAction = last ? (section.questRequired ? 'Enter the dungeon' : 'Return to the map') : 'Next page'
  const text = paragraphText(page.paragraphId)
  root!.innerHTML = shell(`
    ${hud('Read this page', 'Original wording. One page.', `Page ${pageIndex + 1} of ${section.pages.length}`, nextAction)}
    <h2>${esc(section.title)}</h2>
    <article id="akcp-page" data-page-id="${esc(page.id)}"><p>${esc(text)}</p></article>
    <div class="actions">
      ${pageIndex > 0 ? '<button class="btn secondary" id="btn-akcp-prev" type="button">Back</button>' : ''}
      ${last ? '' : '<button class="btn" id="btn-akcp-next" type="button">Next</button>'}
      ${last && !section.questRequired ? '<button class="btn" id="btn-akcp-done" type="button">Done</button>' : ''}
      ${last && section.questRequired ? '<button class="btn" id="btn-akcp-enter-dungeon" type="button">Enter the dungeon</button>' : ''}
    </div>
  `)
  bindHub()
  document.getElementById('btn-akcp-prev')?.addEventListener('click', () => {
    view = { kind: 'wizard', sectionId, pageIndex: pageIndex - 1 }
    paint()
  })
  document.getElementById('btn-akcp-next')?.addEventListener('click', () => {
    view = { kind: 'wizard', sectionId, pageIndex: pageIndex + 1 }
    paint()
  })
  document.getElementById('btn-akcp-done')?.addEventListener('click', () => {
    view = { kind: 'map' }
    paint()
  })
  document.getElementById('btn-akcp-enter-dungeon')?.addEventListener('click', () => {
    view = { kind: 'quests', sectionId }
    paint()
  })
}

function paintQuests(sectionId: string): void {
  const section = findSection(sectionId)
  const save = loadAkcp()
  const cleared = new Set(save.clearedQuestIds)
  const ready = section.steps.every((step) => cleared.has(step.id))
  const quests = section.steps
    .map(
      (step) => `<button class="tile" type="button" data-quest-id="${esc(step.id)}">
        <div class="title">${esc(step.title)}</div>
        <div class="sub">${esc(step.goal)}</div>
        <span class="badge${cleared.has(step.id) ? ' done' : ''}">${cleared.has(step.id) ? 'Clear' : 'Enter'}</span>
      </button>`,
    )
    .join('')
  const boss = section.boss
  const bossHtml = boss
    ? `<button class="tile${ready ? '' : ' locked'}" type="button" data-boss-id="${esc(boss.id)}"${ready ? '' : ' disabled'}>
        <div class="title">${esc(boss.title)}</div>
        <div class="sub">Three beats. One decision each.</div>
        <span class="badge${save.clearedBossIds.includes(boss.id) ? ' done' : ready ? '' : ' locked'}">${save.clearedBossIds.includes(boss.id) ? 'Clear' : 'Boss'}</span>
      </button>`
    : ''
  root!.innerHTML = shell(`
    ${hud('Clear the three quests, then the boss.', 'Technical decision. 5 attempts.', 'One quest at a time', 'Open the next quest')}
    <h2>${esc(section.title)}</h2>
    <div class="hub-grid">${quests}${bossHtml}</div>
  `)
  bindHub()
  document.querySelectorAll<HTMLButtonElement>('[data-quest-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const questId = btn.dataset.questId
      if (!questId) return
      feedback = null
      showTip = false
      view = { kind: 'quest', sectionId, questId }
      paint()
    })
  })
  const bossBtn = boss ? document.querySelector<HTMLButtonElement>(`[data-boss-id="${boss.id}"]`) : null
  bossBtn?.addEventListener('click', () => {
    if (!ready || !boss) return
    beatIndex = 0
    feedback = null
    showTip = false
    view = { kind: 'boss', sectionId }
    paint()
  })
}

function feedbackHtml(): string {
  if (!feedback) return ''
  const rows = feedback.rows.map((row) => `<li>${row.ok ? '✓' : '✗'} ${esc(row.label)}</li>`).join('')
  return `<div class="toast fail">${esc(feedback.headline)}</div>
    <ul class="akcp-check">${rows}</ul>
    <button class="btn secondary" id="btn-akcp-explain" type="button">Explain why</button>
    <div class="toast tip" id="akcp-tip"${showTip ? '' : ' hidden'}><strong>Explain why.</strong> ${esc(feedback.tip)}</div>`
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
    return `<div id="akcp-order">${rows}</div>`
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
      const list = document.getElementById('akcp-order')
      if (!row || !list) return
      if (btn.dataset.move === 'up' && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling)
      else if (btn.dataset.move === 'down' && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row)
    })
  })
}

function bindExplain(): void {
  document.getElementById('btn-akcp-explain')?.addEventListener('click', () => {
    const tip = document.getElementById('akcp-tip')
    if (!tip) return
    tip.hidden = !tip.hidden
    showTip = !tip.hidden
  })
}

function readAnswer(activity: AkcpActivity): AkcpAnswer {
  if (activity.kind === 'order') {
    const submitted = [...document.querySelectorAll('#akcp-order [data-step-id]')].map(
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
  const picked = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map((input) => input.value)
  return { kind: 'checklist', picked }
}

function onActivitySubmit(activity: AkcpActivity, mode: 'quest' | 'boss', sectionId: string, boss: AkcpBoss | null): void {
  const answer = readAnswer(activity)
  const grade = mode === 'boss' && boss ? gradeBoss(boss, beatIndex, answer) : gradeActivity(activity, answer)
  if (grade.win) {
    if (mode === 'boss' && boss && beatIndex < boss.beats.length - 1) {
      beatIndex += 1
      feedback = null
      showTip = false
      paint()
      return
    }
    const id = mode === 'boss' && boss ? boss.id : activity.id
    const stat = mode === 'boss' && boss ? boss.stat : activity.stat
    const result = awardActivity(loadAkcp(), id, stat, mode === 'boss' ? 'boss' : 'quest')
    writeAkcp(result.save)
    feedback = null
    showTip = false
    beatIndex = 0
    view = mode === 'boss' ? { kind: 'map' } : { kind: 'quests', sectionId }
    paint()
    return
  }
  const failId = mode === 'boss' && boss ? boss.id : activity.id
  writeAkcp(recordFail(loadAkcp(), failId))
  feedback = { headline: grade.headline, rows: grade.rows, tip: mode === 'boss' && boss ? bossBeatTip(boss) : activity.tip }
  showTip = true
  paint()
}

function bossBeatTip(boss: AkcpBoss): string {
  return boss.beats[beatIndex]?.tip ?? boss.beats[0]?.tip ?? ''
}

function paintQuest(sectionId: string, questId: string): void {
  const section = findSection(sectionId)
  const activity = section.steps.find((step) => step.id === questId)
  if (!activity) return
  const save = loadAkcp()
  const used = save.fails[activity.id] ?? 0
  const attempt = `${Math.min(used + 1, activity.maxAttempts)} of ${activity.maxAttempts}`
  root!.innerHTML = shell(`
    <div id="akcp-quest" data-quest-id="${esc(activity.id)}">
      ${hud(activity.goal, activity.constraints, attempt, activity.nextAction)}
      <h2>${esc(activity.title)}</h2>
      ${activityBody(activity)}
      ${feedbackHtml()}
      <div class="actions"><button class="btn" id="btn-akcp-submit" type="button">Submit</button></div>
    </div>
  `)
  bindHub()
  bindMoves()
  bindExplain()
  document.getElementById('btn-akcp-submit')?.addEventListener('click', () => {
    onActivitySubmit(activity, 'quest', sectionId, null)
  })
}

function paintBoss(sectionId: string): void {
  const section = findSection(sectionId)
  const boss = section.boss
  const activity = boss?.beats[beatIndex]
  if (!boss || !activity) return
  const save = loadAkcp()
  const used = save.fails[boss.id] ?? 0
  const attempt = `${Math.min(used + 1, boss.maxAttempts)} of ${boss.maxAttempts}`
  root!.innerHTML = shell(`
    <div id="akcp-boss" data-boss-id="${esc(boss.id)}">
      ${hud(activity.goal, activity.constraints, attempt, activity.nextAction)}
      <h2>${esc(boss.title)}</h2>
      <p class="muted">Beat ${beatIndex + 1} of ${boss.beats.length} · ${esc(activity.title)}</p>
      ${activityBody(activity)}
      ${feedbackHtml()}
      <div class="actions"><button class="btn" id="btn-akcp-submit" type="button">Submit</button></div>
    </div>
  `)
  bindHub()
  bindMoves()
  bindExplain()
  document.getElementById('btn-akcp-submit')?.addEventListener('click', () => {
    onActivitySubmit(activity, 'boss', sectionId, boss)
  })
}

function paintPenalty(id: string): void {
  const located = locate(id)
  const covers = located?.activity?.covers ?? located?.boss?.covers ?? []
  const text = paragraphText(covers[0] ?? '')
  root!.innerHTML = shell(`
    <div id="akcp-penalty">
      <h2>Re-read the page</h2>
      <p>${esc(text)}</p>
      <div class="actions"><button class="btn" id="btn-akcp-reread" type="button">I re-read it</button></div>
    </div>
  `)
  bindHub()
  document.getElementById('btn-akcp-reread')?.addEventListener('click', () => {
    writeAkcp(acknowledgePenalty(loadAkcp(), id))
    feedback = null
    showTip = false
    if (located?.boss) view = { kind: 'boss', sectionId: located.section.id }
    else if (located?.activity) view = { kind: 'quest', sectionId: located.section.id, questId: located.activity.id }
    else view = { kind: 'map' }
    paint()
  })
}
