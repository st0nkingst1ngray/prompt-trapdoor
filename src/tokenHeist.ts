import {
  HEIST_LEVELS,
  displayTile,
  findBanned,
  initialTiles,
  isWinning,
  joinTiles,
  type HeistLevel,
} from './tokenHeistLevels'
import {
  clearHeistSave,
  loadHeistSave,
  writeHeistSave,
  type HeistSaveData,
} from './tokenHeistStorage'
import { awardGate, XP_PER_GATE } from './hunter'

export type HeistCallbacks = {
  onHub: () => void
  escapeHtml: (s: string) => string
  onFirstClear?: () => void
}

type RunState = 'playing' | 'won' | 'lost'

let levelIndex = 0
let cleared: number[] = []
let tiles: string[] = []
let selected = -1
let run: RunState = 'playing'
let showTip = false
let lastToast = ''
let secondsLeft = 0
let timerId: ReturnType<typeof setInterval> | null = null
let callbacks: HeistCallbacks | null = null

function L(): HeistLevel {
  return HEIST_LEVELS[levelIndex]
}

function persist(msg?: string) {
  const data: HeistSaveData = {
    levelIndex,
    cleared: [...cleared],
    lastMessage: msg,
  }
  writeHeistSave(data)
}

export function heistClearedCount(): number {
  return cleared.length
}

export function heistClearedIds(): number[] {
  return [...cleared]
}

export function heistLevelCount(): number {
  return HEIST_LEVELS.length
}

export function restoreHeist() {
  const s = loadHeistSave()
  if (!s) return
  levelIndex = Math.min(s.levelIndex, HEIST_LEVELS.length - 1)
  cleared = s.cleared || []
}

export function resetHeistProgress() {
  clearHeistSave()
  levelIndex = 0
  cleared = []
  stopTimer()
}

function stopTimer() {
  if (timerId != null) {
    clearInterval(timerId)
    timerId = null
  }
}

function startTimer(root: HTMLElement) {
  stopTimer()
  timerId = setInterval(() => {
    if (run !== 'playing') {
      stopTimer()
      return
    }
    secondsLeft -= 1
    const el = root.querySelector('#heist-time')
    if (el) {
      el.textContent = formatTime(secondsLeft)
      el.classList.toggle('urgent', secondsLeft <= 10)
    }
    if (secondsLeft <= 0) {
      secondsLeft = 0
      run = 'lost'
      lastToast = `<div class="toast fail">⏱ Time’s up — the guard locked the vault.</div>`
      stopTimer()
      persist(`Timed out on heist level ${L().id}`)
      // Re-render via host
      renderInto(root)
    }
  }, 1000)
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function beginLevel(idx: number) {
  levelIndex = idx
  tiles = initialTiles(L().message)
  selected = -1
  run = 'playing'
  showTip = false
  lastToast = ''
  secondsLeft = L().timeLimitSec
  persist(`Heist level ${L().id}`)
}

export function startHeistFromHub(): void {
  // Continue at first uncleared, or 0 if all done
  if (cleared.length >= HEIST_LEVELS.length) {
    beginLevel(0)
  } else {
    const next = HEIST_LEVELS.findIndex((lv) => !cleared.includes(lv.id))
    beginLevel(next >= 0 ? next : levelIndex)
  }
}

function constraintsText(level: HeistLevel): string {
  const bans = level.bannedTokens.map(displayTile).slice(0, 6).join(', ')
  const more = level.bannedTokens.length > 6 ? '…' : ''
  return `≤${level.tokenBudget} tokens · Banned tiles: ${bans}${more}`
}

function liveStatus(): { ok: boolean; label: string } {
  const banned = findBanned(tiles, L().bannedTokens)
  const over = tiles.length > L().tokenBudget
  const intact = joinTiles(tiles) === L().message
  if (!intact) return { ok: false, label: 'Message corrupted' }
  if (banned) return { ok: false, label: `Guard sees “${displayTile(banned)}”` }
  if (over) return { ok: false, label: `Over budget (${tiles.length}/${L().tokenBudget})` }
  return { ok: true, label: 'Path clear — submit!' }
}

function renderBoard(esc: (s: string) => string): string {
  const bannedSet = new Set(L().bannedTokens)
  const parts: string[] = []
  tiles.forEach((t, i) => {
    const isBan = bannedSet.has(t)
    const isSel = i === selected
    const cls = [
      'tok',
      isBan ? 'tok-ban' : '',
      isSel ? 'tok-sel' : '',
      t.length > 1 ? 'tok-multi' : '',
    ]
      .filter(Boolean)
      .join(' ')
    parts.push(
      `<button type="button" class="${cls}" data-tok="${i}" title="${
        t.length > 1 ? 'Click to split into letters' : 'Select, then merge'
      }">${esc(displayTile(t))}</button>`,
    )
    if (i < tiles.length - 1) {
      parts.push(
        `<button type="button" class="tok-merge" data-merge="${i}" title="Merge with next" aria-label="Merge">＋</button>`,
      )
    }
  })
  return `<div class="tok-board" role="group" aria-label="Token tiles">${parts.join('')}</div>`
}

export function renderHeist(esc: (s: string) => string): string {
  const level = L()
  const status = liveStatus()
  const attemptLabel = formatTime(secondsLeft)
  const next =
    run === 'won'
      ? 'Advance to next heist'
      : run === 'lost'
        ? 'Retry this heist'
        : level.nextAction

  const tipHtml = showTip
    ? `<div class="toast tip">${esc(level.tip)}</div>`
    : ''

  const banChips = level.bannedTokens
    .map((b) => `<span class="chip ban">${esc(displayTile(b))}</span>`)
    .join('')

  const canSubmit = run === 'playing'

  return `
  <div class="screen active" id="heist">
    <div class="level-bar">
      <div>
        <h2>🪙 Heist ${level.id}: ${esc(level.title)}</h2>
        <p class="muted" style="margin:0">Split &amp; merge tiles — words ≠ tokens.</p>
      </div>
      <button class="btn ghost" id="btn-heist-hub" type="button">← Hub</button>
    </div>

    <div class="hud" aria-live="polite">
      <div class="hud-item">
        <label>Goal</label>
        <div class="val">${esc(level.goal)}</div>
      </div>
      <div class="hud-item">
        <label>Constraints</label>
        <div class="val" style="font-size:0.95rem">${esc(constraintsText(level))}</div>
      </div>
      <div class="hud-item">
        <label>Time</label>
        <div class="val" id="heist-time">${attemptLabel}</div>
      </div>
      <div class="hud-item next">
        <label>Next action</label>
        <div class="val">${esc(next)}</div>
      </div>
    </div>

    <div class="chips" style="margin-bottom:0.75rem">
      <span class="chip warn">Budget ${tiles.length}/${level.tokenBudget}</span>
      <span class="chip ${status.ok ? 'ok-chip' : 'ban'}">${esc(status.label)}</span>
    </div>
    <div class="chips" style="margin-bottom:0.75rem">${banChips}</div>

    <div class="panel">
      <label class="muted" style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">Message (must stay intact)</label>
      <div class="reply heist-msg">${esc(level.message)}</div>
      <p class="muted" style="margin:0.5rem 0 0;font-size:0.85rem">
        ＋ merges neighbors · click a multi-letter tile to split · each tile = 1 token
      </p>
    </div>

    <div class="panel">
      <label class="muted" style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">Your tokens</label>
      ${renderBoard(esc)}
      <div class="actions">
        <button class="btn" id="btn-heist-submit" type="button" ${canSubmit ? '' : 'disabled'}>Submit heist</button>
        <button class="btn secondary" id="btn-heist-reset-tiles" type="button" ${canSubmit ? '' : 'disabled'}>Reset tiles</button>
        <button class="btn secondary" id="btn-heist-explain" type="button">Explain why</button>
        ${
          run === 'won'
            ? `<button class="btn ok" id="btn-heist-next" type="button">${
                levelIndex < HEIST_LEVELS.length - 1 ? 'Next heist →' : 'Back to hub 🎉'
              }</button>`
            : ''
        }
        ${
          run === 'lost'
            ? `<button class="btn danger" id="btn-heist-retry" type="button">Retry heist</button>`
            : ''
        }
      </div>
      ${lastToast}
      ${tipHtml}
    </div>

    <div class="panel">
      <h3 style="font-size:1rem">How the guard works</h3>
      <p class="muted" style="margin:0;font-size:0.92rem">
        The guard counts <strong>tiles</strong> (tokens), not words. Banned strings only trigger on an
        <em>exact</em> tile. Merge or split until the message still reads correctly, you’re under budget,
        and no tile glows red — then submit before time runs out.
      </p>
    </div>
  </div>`
}

function mergeAt(i: number) {
  if (run !== 'playing') return
  if (i < 0 || i >= tiles.length - 1) return
  const merged = tiles[i] + tiles[i + 1]
  tiles = [...tiles.slice(0, i), merged, ...tiles.slice(i + 2)]
  selected = i
}

function splitAt(i: number) {
  if (run !== 'playing') return
  if (i < 0 || i >= tiles.length) return
  const t = tiles[i]
  if (t.length <= 1) {
    selected = i
    return
  }
  const chars = t.split('')
  tiles = [...tiles.slice(0, i), ...chars, ...tiles.slice(i + 1)]
  selected = i
}

function submitHeist() {
  if (run !== 'playing') return
  if (isWinning(tiles, L())) {
    run = 'won'
    const firstClear = !cleared.includes(L().id)
    if (firstClear) cleared.push(L().id)
    const gained = firstClear ? awardGate('heist', L().id) : 0
    if (gained) callbacks?.onFirstClear?.()
    const xpNote = gained ? ` +${XP_PER_GATE} Hunter XP.` : ''
    lastToast = `<div class="toast win">🎉 Heist success! ${callbacks!.escapeHtml(L().concept)}${xpNote}</div>`
    stopTimer()
    persist(`Cleared heist ${L().id}`)
  } else {
    const banned = findBanned(tiles, L().bannedTokens)
    const over = tiles.length > L().tokenBudget
    if (banned) {
      lastToast = `<div class="toast fail">Busted — guard caught tile “${callbacks!.escapeHtml(
        displayTile(banned),
      )}”.</div>`
    } else if (over) {
      lastToast = `<div class="toast fail">Busted — ${tiles.length} tokens over budget of ${L().tokenBudget}.</div>`
    } else {
      lastToast = `<div class="toast fail">Busted — message doesn’t match the target.</div>`
    }
    // Soft fail: stay playing so they can keep editing (ADHD-friendly). Only timer ends the run.
    // Instant feedback without ending — keep playing until timer or they reset.
  }
}

function renderInto(root: HTMLElement) {
  root.innerHTML = renderHeist(callbacks!.escapeHtml)
  bindHeist(root)
}

export function mountHeist(root: HTMLElement, cbs: HeistCallbacks) {
  callbacks = cbs
  // Resume an in-progress run; otherwise pick next uncleared heist.
  if (tiles.length === 0 || run !== 'playing') startHeistFromHub()
  renderInto(root)
  if (run === 'playing') startTimer(root)
}

export function unmountHeist() {
  stopTimer()
  persist(`Paused heist level ${L().id}`)
}

function bindHeist(root: HTMLElement) {
  root.querySelector('#btn-heist-hub')?.addEventListener('click', () => {
    unmountHeist()
    callbacks?.onHub()
  })

  root.querySelectorAll('[data-merge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number((btn as HTMLElement).dataset.merge)
      mergeAt(i)
      lastToast = ''
      renderInto(root)
    })
  })

  root.querySelectorAll('[data-tok]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number((btn as HTMLElement).dataset.tok)
      if (tiles[i].length > 1) {
        splitAt(i)
        lastToast = ''
      } else {
        selected = i
      }
      renderInto(root)
    })
  })

  root.querySelector('#btn-heist-submit')?.addEventListener('click', () => {
    submitHeist()
    renderInto(root)
  })

  root.querySelector('#btn-heist-reset-tiles')?.addEventListener('click', () => {
    if (run !== 'playing') return
    tiles = initialTiles(L().message)
    selected = -1
    lastToast = `<div class="toast info">Tiles reset to letters.</div>`
    renderInto(root)
  })

  root.querySelector('#btn-heist-explain')?.addEventListener('click', () => {
    showTip = !showTip
    renderInto(root)
  })

  root.querySelector('#btn-heist-next')?.addEventListener('click', () => {
    if (levelIndex >= HEIST_LEVELS.length - 1) {
      unmountHeist()
      persist('All heists cleared!')
      callbacks?.onHub()
      return
    }
    beginLevel(levelIndex + 1)
    renderInto(root)
    startTimer(root)
  })

  root.querySelector('#btn-heist-retry')?.addEventListener('click', () => {
    beginLevel(levelIndex)
    renderInto(root)
    startTimer(root)
  })
}

/** For console reset from main */
export function heistDebugReset() {
  resetHeistProgress()
  tiles = []
  run = 'playing'
  lastToast = ''
  showTip = false
}
