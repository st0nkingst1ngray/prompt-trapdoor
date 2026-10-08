import { ensureCurriculum } from '../bashmissions/catalog'
import { ensureExercismCurriculum } from '../exercism-python/catalog'
import { ensurePyithonCurriculum } from '../pyithon/catalog'
import { ensureKoansCurriculum } from '../python-koans/catalog'
import { buildLiveSnapshot, canRead, continueTargets, listChildren, modeString, shelfProgress, type ContinueTarget } from './build'
import { promptLabel, runCommand } from './shell'
import { VFS_START, loadVfs, resetRootAccess, saveFromShell, shellFromSave, togglePin, writeVfs } from './save'
import type { ShellState, VfsLaunch, VfsSnapshot } from './types'

export interface VfsBooksCallbacks {
  escapeHtml: (value: string) => string
  onHub: () => void
  onSimple: () => void
  onOpen: (launch: VfsLaunch) => void
}

interface LogLine {
  kind: 'in' | 'out'
  text: string
  root: boolean
}

let mountToken = 0
let host: HTMLElement | null = null
let callbacks: VfsBooksCallbacks | null = null
let shell: ShellState = shellFromSave(loadVfs())
let transcript: LogLine[] = []
let showHidden = false
let continueSlots: ContinueTarget[] = []

export function unmountFilesystemBooks(): void {
  mountToken += 1
  host = null
  callbacks = null
  showHidden = false
}

export function mountFilesystemBooks(root: HTMLElement, next: VfsBooksCallbacks): void {
  const mine = ++mountToken
  host = root
  callbacks = next
  shell = shellFromSave(loadVfs())
  render(false)
  if (import.meta.env.MODE === 'test') return
  void Promise.allSettled([
    ensureCurriculum(),
    ensureKoansCurriculum(),
    ensureExercismCurriculum(),
    ensurePyithonCurriculum(),
  ]).then(() => {
    if (mine !== mountToken || host !== root) return
    render(false)
  })
}

function esc(value: string): string {
  return callbacks ? callbacks.escapeHtml(value) : value
}

function persist(): void {
  writeVfs(saveFromShell(loadVfs(), shell))
}

function render(refocus: boolean): void {
  if (!host || !callbacks) return
  const snapshot = buildLiveSnapshot()
  const known = snapshot.entries.get(shell.cwd)
  if (!known || known.kind !== 'dir' || !canRead(known, shell)) shell = { ...shell, cwd: VFS_START }
  const prompt = promptLabel(shell)
  continueSlots = continueTargets()
  host.innerHTML = `<div class="screen active vfs-screen" id="akcp">
    <div class="actions">
      <button class="btn ghost" id="btn-akcp-hub" type="button">Back to Association</button>
      <button class="btn secondary" id="akcp-books-simple" type="button">Simple list</button>
      <button class="btn ghost" id="vfs-reset-root" type="button">Reset root access</button>
    </div>
    <header class="hub-header">
      <p class="eyebrow">Open world · filesystem</p>
      <h1>Books</h1>
      <p class="muted">Tap a crumb or a row. Locked folders show drwx------ and refuse entry.</p>
      <p class="vfs-progress">${esc(shelfProgress())}</p>
    </header>
    ${shelfHtml()}
    <nav class="vfs-crumbs" aria-label="Path">${crumbsHtml(shell.cwd)}</nav>
    <div class="vfs-actions">
      <button class="btn secondary" id="vfs-show-hidden" type="button">${showHidden ? 'Hide dotfiles' : 'Show hidden (ls -a)'}</button>
    </div>
    <div class="vfs-list" id="vfs-list">${listHtml(snapshot)}</div>
    <section class="vfs-term" aria-label="Mini terminal">
      <div class="vfs-log" id="vfs-log" aria-live="polite">${logHtml()}</div>
      <form class="vfs-form" id="vfs-form">
        <label class="vfs-prompt${shell.isRoot ? ' is-root' : ''}" for="vfs-input">${esc(prompt)}</label>
        <input id="vfs-input" class="vfs-input" autocomplete="off" enterkeyhint="go" spellcheck="false" />
        <button class="btn" type="submit">Run</button>
      </form>
    </section>
    <p class="muted akcp-sim">Training sim. The shell is local and fake. It does not touch this phone.</p>
  </div>`
  bind(snapshot, refocus)
}

function shelfHtml(): string {
  const save = loadVfs()
  const continues = continueSlots
    .map((item, index) => `<button class="btn secondary vfs-continue" type="button" data-launch="${index}">${esc(item.label)}</button>`)
    .join('')
  const pins = save.pins.length
    ? save.pins.map((path) => `<button class="btn ghost vfs-pin-jump" type="button" data-pin-jump="${esc(path)}">${esc(path)}</button>`).join('')
    : '<p class="muted">No pins yet. Star a row to keep it here.</p>'
  return `<section class="vfs-shelf">
    <h2>Quick access</h2>
    <p class="muted">Continue</p>
    <div class="vfs-stack">${continues}</div>
    <p class="muted">Pinned</p>
    <div class="vfs-stack">${pins}</div>
    <form class="vfs-search" id="vfs-find">
      <input id="vfs-find-input" placeholder="find unlocked" aria-label="Find unlocked files" />
      <button class="btn" type="submit">Find</button>
    </form>
  </section>`
}

function crumbsHtml(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean)
  let built = ''
  const buttons = parts.map((part) => {
    built += `/${part}`
    return `<span aria-hidden="true">›</span><button type="button" data-cd="${esc(built)}">${esc(part)}</button>`
  })
  return `<button type="button" data-cd="/">/</button>${buttons.join('')}`
}

function listHtml(snapshot: VfsSnapshot): string {
  const save = loadVfs()
  const here = snapshot.entries.get(shell.cwd)
  if (!here || here.kind !== 'dir' || !canRead(here, shell)) return '<p class="muted">Permission denied</p>'
  const up = shell.cwd === '/'
    ? ''
    : `<div class="vfs-item"><button class="vfs-row" type="button" data-cd="${esc(parentOf(shell.cwd))}"><span class="vfs-perm">drwxr-xr-x</span><span class="vfs-name">..</span></button></div>`
  const rows = listChildren(snapshot, shell.cwd, showHidden).map((entry) => {
    const pinned = save.pins.includes(entry.path)
    return `<div class="vfs-item">
      <button class="vfs-row" type="button" data-open="${esc(entry.path)}">
        <span class="vfs-perm">${esc(modeString(entry, shell))}</span>
        <span class="vfs-name">${esc(entry.name)}</span>
      </button>
      <button class="vfs-pin${pinned ? ' is-on' : ''}" type="button" data-pin="${esc(entry.path)}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${esc(entry.name)}">${pinned ? '★' : '☆'}</button>
    </div>`
  })
  return up + rows.join('')
}

function parentOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '/' : path.slice(0, index)
}

function logHtml(): string {
  if (transcript.length === 0) {
    const prompt = promptLabel(shell)
    return `<p class="${shell.isRoot ? 'is-root' : ''}">${esc(`${prompt} help`)}</p>`
  }
  return transcript
    .map((line) => {
      if (line.kind === 'out') return `<p>${esc(line.text)}</p>`
      const prompt = line.root ? 'root@akcp:~#' : 'hunter@akcp:~$'
      return `<p class="${line.root ? 'is-root' : ''}">${esc(`${prompt} ${line.text}`)}</p>`
    })
    .join('')
}

function pushOut(text: string): void {
  const line: LogLine = { kind: 'out', text, root: false }
  transcript = [...transcript, line].slice(-40)
}

function bind(snapshot: VfsSnapshot, refocus: boolean): void {
  document.getElementById('btn-akcp-hub')?.addEventListener('click', () => callbacks?.onHub())
  document.getElementById('akcp-books-simple')?.addEventListener('click', () => callbacks?.onSimple())
  document.getElementById('vfs-reset-root')?.addEventListener('click', () => {
    resetRootAccess()
    shell = shellFromSave(loadVfs())
    pushOut('Root access reset. You are hunter.')
    render(false)
  })
  document.getElementById('vfs-show-hidden')?.addEventListener('click', () => {
    showHidden = !showHidden
    render(false)
  })
  document.querySelectorAll<HTMLButtonElement>('[data-cd]').forEach((button) => {
    button.addEventListener('click', () => apply(snapshot, `cd ${button.dataset.cd ?? '/'}`, false))
  })
  document.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((button) => {
    button.addEventListener('click', () => activate(snapshot, button.dataset.open ?? ''))
  })
  document.querySelectorAll<HTMLButtonElement>('[data-pin]').forEach((button) => {
    button.addEventListener('click', () => {
      const path = button.dataset.pin
      if (!path) return
      togglePin(path)
      render(false)
    })
  })
  document.querySelectorAll<HTMLButtonElement>('[data-pin-jump]').forEach((button) => {
    button.addEventListener('click', () => {
      const path = button.dataset.pinJump
      if (!path) return
      const entry = snapshot.entries.get(path)
      if (!entry) {
        pushOut('pin: that path is gone.')
        render(false)
        return
      }
      if (entry.kind === 'dir') apply(snapshot, `cd ${path}`, false)
      else activate(snapshot, path)
    })
  })
  document.querySelectorAll<HTMLButtonElement>('[data-launch]').forEach((button) => {
    button.addEventListener('click', () => {
      const slot = continueSlots[Number(button.dataset.launch)]
      if (slot) callbacks?.onOpen(slot.launch)
    })
  })
  document.getElementById('vfs-find')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const input = document.getElementById('vfs-find-input')
    const term = input instanceof HTMLInputElement ? input.value.trim() : ''
    apply(snapshot, `find ${term}`, false)
  })
  document.getElementById('vfs-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const input = document.getElementById('vfs-input')
    if (!(input instanceof HTMLInputElement)) return
    const line = input.value
    apply(snapshot, line, true)
  })
  if (refocus) document.getElementById('vfs-input')?.focus()
  const log = document.getElementById('vfs-log')
  if (log) log.scrollTop = log.scrollHeight
}

function activate(snapshot: VfsSnapshot, path: string): void {
  const entry = snapshot.entries.get(path)
  if (!entry) return
  if (entry.kind === 'dir') {
    apply(snapshot, `cd ${path}`, false)
    return
  }
  if (entry.launch && canRead(entry, shell)) {
    callbacks?.onOpen(entry.launch)
    return
  }
  apply(snapshot, `cat ${path}`, false)
}

function apply(snapshot: VfsSnapshot, line: string, refocus: boolean): void {
  const asRoot = shell.isRoot
  const ran = runCommand(line, snapshot, shell)
  if (ran.clear) transcript = []
  else {
    transcript = [...transcript, { kind: 'in', text: line, root: asRoot }]
    if (ran.output) transcript = [...transcript, { kind: 'out', text: ran.output, root: false }]
    transcript = transcript.slice(-40)
  }
  shell = ran.state
  persist()
  if (ran.launch) {
    callbacks?.onOpen(ran.launch)
    return
  }
  render(refocus)
}
