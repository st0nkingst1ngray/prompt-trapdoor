import './style.css'
import { LEVELS, countWords, type Level } from './levels'
import { judgePrompt } from './judge'
import { mockReply } from './mockLlm'
import { clearSave, loadSave, writeSave, type SaveData } from './storage'
import {
  heistClearedCount,
  heistClearedIds,
  heistDebugReset,
  heistLevelCount,
  mountHeist,
  restoreHeist,
  unmountHeist,
} from './tokenHeist'
import { clearBashMissionsSave } from './akcp/bashmissions/save'
import { clearExercismPythonSave } from './akcp/exercism-python/save'
import { clearPyithonSave } from './akcp/pyithon/save'
import { clearPythonKoansSave } from './akcp/python-koans/save'
import { clearAkcpSave, loadAkcp } from './akcp/save'
import { mountAkcp, unmountAkcp } from './akcp/ui'
import {
  CLASSES,
  RANK_LADDER,
  XP_PER_GATE,
  awardGate,
  classById,
  clearHunter,
  eGateThresholdMet,
  loadHunter,
  pickClass,
  rankForXp,
  rankIndex,
  rankProgress,
  syncClearedGates,
  xpUntilNext,
  type HunterClassId,
} from './hunter'
import { mountGate, resetGateUi } from './gates/gateUi'
import {
  A_DOORS,
  A_GATES,
  B_DOORS,
  B_GATES,
  C_DOORS,
  C_GATES,
  D_GATES,
  S_DOORS,
  S_GATES,
  clearGateSave,
  gateComplete,
  gateUnlock,
  loadGateClears,
  stagesCleared,
} from './gates/registry'
import type { DGateId, GateDef } from './gates/types'
import {
  bindHarnessStrip,
  renderHarnessStrip,
  resetHarnessUi,
  startHarnessPolling,
  updateHarnessPill,
} from './harness/harnessUi'
import type { PlayContext } from './harness/buildQueue'

type Screen = 'hub' | 'game' | 'heist' | 'class' | 'dgate' | 'akcp'

interface AttemptLog {
  n: number
  prompt: string
  reply: string
  result: 'win' | 'banned' | 'budget' | 'format' | 'miss' | 'info'
}

const app = document.querySelector<HTMLDivElement>('#app')!

let screen: Screen = 'hub'
let levelIndex = 0
let attempt = 1
let cleared: number[] = []
let logs: AttemptLog[] = []
let lastToast = ''
let showTip = false
let resumeNote: string | null = null
let gameOver = false
let wonLevel = false
let draftPrompt = ''
/** Session-only: player asked to pick a class later. */
let deferClass = false
let activeGate: DGateId = 'shadow'
/** Last gate the player opened — sent along with harness prompts as context. */
let lastGate: DGateId | null = null

function persist(msg?: string) {
  const data: SaveData = {
    levelIndex,
    attempt,
    cleared: [...cleared],
    lastMessage: msg,
  }
  writeSave(data)
}

function restore() {
  const s = loadSave()
  if (!s) return
  levelIndex = Math.min(s.levelIndex, LEVELS.length - 1)
  attempt = s.attempt || 1
  cleared = s.cleared || []
  if (s.lastMessage) {
    resumeNote = `Welcome back — ${s.lastMessage}`
  } else if (attempt > 1 || cleared.length) {
    resumeNote = `Welcome back — Level ${levelIndex + 1}, attempt ${attempt}. Progress restored.`
  }
}

function level(): Level {
  return LEVELS[levelIndex]
}

function constraintsText(L: Level): string {
  const parts: string[] = []
  parts.push(`Banned: ${L.banned.join(', ')}`)
  if (L.maxPromptWords != null) parts.push(`≤${L.maxPromptWords} words`)
  if (L.format.kind === 'json_answer') parts.push('Reply must be JSON {"answer":"..."}')
  if (L.format.kind === 'triple_arrow') parts.push('Reply must wrap secret in >>> <<<')
  return parts.join(' · ')
}

function classReady(): boolean {
  return eGateThresholdMet(cleared, heistClearedIds(), LEVELS.length) && !loadHunter().classId
}

function render() {
  if (screen === 'hub' && classReady() && !deferClass) screen = 'class'
  if (screen === 'hub') {
    app.innerHTML = renderHub()
    bindHub()
  } else if (screen === 'class') {
    app.innerHTML = renderClassPick()
    bindClassPick()
  } else if (screen === 'dgate') {
    mountGate(app, activeGate, {
      onHub: () => {
        screen = 'hub'
        render()
      },
      onFirstClear: () => {
        deferClass = false
      },
      escapeHtml,
    })
  } else if (screen === 'heist') {
    mountHeist(app, {
      onHub: () => {
        screen = 'hub'
        render()
      },
      onFirstClear: () => {
        deferClass = false
      },
      escapeHtml,
    })
  } else if (screen === 'akcp') {
    mountAkcp(app, {
      onHub: () => {
        unmountAkcp()
        screen = 'hub'
        render()
      },
      escapeHtml,
    })
  } else {
    app.innerHTML = renderGame()
    bindGame()
  }
  updateHarnessPill()
}

function playContext(): PlayContext {
  const hunter = loadHunter()
  return {
    screen,
    ...(lastGate ? { gateId: lastGate } : {}),
    rank: rankForXp(hunter.xp).id,
    classId: hunter.classId,
    xp: hunter.xp,
  }
}

function renderHub(): string {
  const progress = cleared.length
  const heistProgress = heistClearedCount()
  const heistTotal = heistLevelCount()
  const hunter = loadHunter()
  const band = rankForXp(hunter.xp)
  const pct = Math.round(rankProgress(hunter.xp) * 100)
  const until = xpUntilNext(hunter.xp)
  const nextLabel = until == null ? 'S-rank ceiling' : `${until} XP to ${band.nextAt != null ? RANK_LADDER[rankIndex(band.id) + 1]?.id ?? 'next' : 'next'}-rank`
  const chosen = hunter.classId ? classById(hunter.classId) : null
  const ready = classReady()
  const arcHtml = RANK_LADDER.map((b) => {
    const state = rankIndex(band.id) > rankIndex(b.id) ? 'done' : rankIndex(band.id) === rankIndex(b.id) ? 'now' : 'wait'
    return `<span class="arc ${state}">${b.id} · ${escapeHtml(b.arc)}</span>`
  }).join('')

  const classCta = ready
    ? `<div class="resume">
        <strong>The System offers a class.</strong>
        <p class="muted" style="margin:0.35rem 0 0">E-rank gates are enough. Pick a path — its D-gate opens immediately.</p>
        <div class="actions"><button class="btn" id="btn-open-class" type="button">Choose class</button></div>
      </div>`
    : ''

  const gatesHtml = renderNextGates(hunter.classId)

  return `
  <div class="screen active" id="hub">
    <header class="hub-header">
      <p class="eyebrow">Hunter Association · LLM security</p>
      <h1>Hunter Association</h1>
      <p class="muted">Clear short gates. Learn how models work — and how they break. The map grows with your class.</p>
    </header>
    <div class="rank-card" aria-label="Hunter rank">
      <div class="rank-top">
        <div>
          <div class="rank-kicker">Rank</div>
          <div class="rank-letter">${band.id}</div>
        </div>
        <div class="rank-meta">
          <div><strong>${hunter.xp} XP</strong> · ${escapeHtml(nextLabel)}</div>
          <div class="muted">${escapeHtml(band.arc)}</div>
          <div class="muted">${chosen ? escapeHtml(chosen.name) : 'No class yet — E-rank gates first'}</div>
        </div>
      </div>
      <div class="xp-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="xp-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="arc-row">${arcHtml}</div>
    ${renderHarnessStrip(escapeHtml)}
    ${
      resumeNote
        ? `<div class="resume" id="resume">${escapeHtml(resumeNote)}
           <div class="actions"><button class="btn secondary" id="btn-continue">Continue Trapdoor</button>
           <button class="btn ghost" id="btn-dismiss-resume">Dismiss</button></div></div>`
        : ''
    }
    ${classCta}
    <div class="hub-grid">
      <button class="tile" id="tile-trapdoor" type="button">
        <div class="emoji">🪤</div>
        <div class="title">Prompt Trapdoor</div>
        <div class="sub">E-rank · prompt leaks &amp; brittle filters. ${LEVELS.length} gates.</div>
        <span class="badge ${progress === LEVELS.length ? 'done' : ''}">${progress === LEVELS.length ? 'Complete' : 'Play'}</span>
      </button>
      <button class="tile" id="tile-heist" type="button">
        <div class="emoji">🪙</div>
        <div class="title">Token Heist</div>
        <div class="sub">E-rank · token filters miss odd splits. ${heistTotal} gates.</div>
        <span class="badge ${heistProgress === heistTotal ? 'done' : ''}">${
          heistProgress === heistTotal ? 'Complete' : 'Play'
        }</span>
      </button>
      <button class="tile" id="tile-akcp" type="button">
        <div class="emoji">📗</div>
        <div class="title">AKCP</div>
        <div class="sub">Open world · Osmani workflow, BashMissions, or a Python book. Optional. Your rank stays on the E–S road.</div>
        <span class="badge" id="akcp-hub-badge">${loadAkcp().clearedBossIds.includes('specs-boss') ? 'Specs clear' : 'Enter'}</span>
      </button>
    </div>
    ${gatesHtml}
    <p class="muted" style="margin-top:1.5rem;text-align:center;font-size:0.9rem">
      +${XP_PER_GATE} XP per first clear (each gate stage counts) · Autosaves in this browser · No API keys
    </p>
  </div>`
}

function renderClassPick(): string {
  const cards = CLASSES.map(
    (c) => `<button class="class-card" type="button" data-class="${c.id}">
      <div class="emoji">${c.emoji}</div>
      <div class="title">${escapeHtml(c.name)}</div>
      <div class="role">${escapeHtml(c.role)}</div>
      <p>${escapeHtml(c.blurb)}</p>
      <p class="muted quest-preview"><strong>${escapeHtml(c.gateTitle)}:</strong> ${escapeHtml(c.quest)}</p>
    </button>`,
  ).join('')
  return `
  <div class="screen active" id="class-pick">
    <header class="hub-header">
      <p class="eyebrow">System message</p>
      <h1>Choose your class</h1>
      <p class="muted">E-rank is done enough. Your class opens its D-gate right away (3 short stages). Clear it to cross-train the other paths.</p>
    </header>
    <div class="class-grid">${cards}</div>
    <div class="actions" style="justify-content:center;margin-top:1rem">
      <button class="btn ghost" id="btn-class-later" type="button">Later — back to gates</button>
    </div>
  </div>`
}

function gateTile(g: GateDef, classId: HunterClassId | null, mine: boolean): string {
  const hunter = loadHunter()
  const clears = loadGateClears()
  const u = gateUnlock(g.id, hunter, clears)
  const total = g.stages.length
  const n = stagesCleared(g.id, clears)
  const complete = gateComplete(g.id, clears)
  const badge = !u.open ? u.badge : complete ? `Complete · ${u.badge}` : `${n}/${total} · ${u.badge}`
  return `<button class="tile ${u.open ? (mine && classId ? 'class-gate' : '') : 'locked'}" type="button" data-gate="${g.id}" ${
    u.open ? '' : 'disabled'
  } title="${escapeHtml(u.reason)}">
    <div class="emoji">${g.emoji}</div>
    <div class="title">${escapeHtml(g.title)}</div>
    <div class="sub">${g.rank}-rank · ${escapeHtml(g.tagline)}${u.open ? '' : ` <em>${escapeHtml(u.reason)}</em>`}</div>
    <span class="badge ${!u.open ? 'locked' : complete ? 'done' : ''}">${escapeHtml(badge)}</span>
  </button>`
}

function renderNextGates(classId: HunterClassId | null): string {
  const dTiles = classId
    ? [...D_GATES]
        .sort((a, b) => (a.id === classId ? 0 : 1) - (b.id === classId ? 0 : 1))
        .map((g) => gateTile(g, classId, g.id === classId))
        .join('')
    : `<button class="tile locked" type="button" disabled>
        <div class="emoji">🚪</div>
        <div class="title">Class gates (D-rank)</div>
        <div class="sub">Offense, defense, internals, or agents. Clear E-rank gates and pick a class to open your path.</div>
        <span class="badge locked">Locked · pick a class</span>
      </button>`
  const myC = classId ? C_DOORS[classId] : null
  const cOrder = classId
    ? [...C_GATES].sort((a, b) => (a.id === myC ? 0 : 1) - (b.id === myC ? 0 : 1))
    : C_GATES.filter((g) => g.id === 'casino')
  const cTiles =
    cOrder.map((g) => gateTile(g, classId, g.id === myC)).join('') +
    (classId
      ? ''
      : `<button class="tile locked" type="button" disabled>
        <div class="emoji">🎲</div>
        <div class="title">Class doors (C-rank)</div>
        <div class="sub">Stop the Runaway · Schema Croupier · Logit Ward. Pick a class, clear its D-gate, reach C-rank.</div>
        <span class="badge locked">Locked · pick a class</span>
      </button>`)
  const myB = classId ? B_DOORS[classId] : null
  const bOrder = classId
    ? [...B_GATES].sort((a, b) => (a.id === myB ? 0 : 1) - (b.id === myB ? 0 : 1))
    : []
  const bTiles = classId
    ? bOrder.map((g) => gateTile(g, classId, g.id === myB)).join('')
    : `<button class="tile locked" type="button" disabled>
        <div class="emoji">📖</div>
        <div class="title">Class doors (B-rank)</div>
        <div class="sub">Pin the Oath · Near but Wrong · Note in the Margin · Empty Shelf. Clear your C door, reach B-rank (160 XP).</div>
        <span class="badge locked">Locked · pick a class</span>
      </button>`
  const myA = classId ? A_DOORS[classId] : null
  const aOrder = classId
    ? [...A_GATES].sort((a, b) => (a.id === myA ? 0 : 1) - (b.id === myA ? 0 : 1))
    : []
  const aTiles = classId
    ? aOrder.map((g) => gateTile(g, classId, g.id === myA)).join('')
    : `<button class="tile locked" type="button" disabled>
        <div class="emoji">🧪</div>
        <div class="title">Class doors (A-rank)</div>
        <div class="sub">Forgot the Oath · Salt in the Batch · Clap Trap · Mirror Exam. Clear your B door, reach A-rank (220 XP).</div>
        <span class="badge locked">Locked · pick a class</span>
      </button>`
  const myS = classId ? S_DOORS[classId] : null
  const sOrder = classId
    ? [...S_GATES].sort((a, b) => (a.id === myS ? 0 : 1) - (b.id === myS ? 0 : 1))
    : []
  const sTiles = classId
    ? sOrder.map((g) => gateTile(g, classId, g.id === myS)).join('')
    : `<button class="tile locked" type="button" disabled>
        <div class="emoji">🤖</div>
        <div class="title">Class doors (S-rank)</div>
        <div class="sub">Ten Steps · Keyring · Whisper in the Ticket · Second Pair. Clear your A door, reach S-rank (280 XP).</div>
        <span class="badge locked">Locked · pick a class</span>
      </button>`
  return `
    <h2 class="section-title">Rank D · Class gates</h2>
    <div class="hub-grid">${dTiles}</div>
    <h2 class="section-title">Rank C · Sampling doors</h2>
    <div class="hub-grid" id="c-doors">${cTiles}</div>
    <h2 class="section-title">Rank B · Memory / RAG doors</h2>
    <div class="hub-grid" id="b-doors">${bTiles}</div>
    <h2 class="section-title">Rank A · Training doors</h2>
    <div class="hub-grid" id="a-doors">${aTiles}</div>
    <h2 class="section-title">Rank S · Agents doors</h2>
    <div class="hub-grid" id="s-doors">${sTiles}</div>`
}

function renderGame(): string {
  const L = level()
  const words = ''
  const attemptLabel = `${attempt}/${L.maxAttempts}`
  const next = wonLevel
    ? 'Advance to next level'
    : gameOver
      ? 'Retry level'
      : L.nextAction

  const toastHtml = lastToast
  const tipHtml = showTip
    ? `<div class="toast tip">${escapeHtml(L.tip)}</div>`
    : ''
  const draftAttr = escapeHtml(draftPrompt)

  const logHtml = logs
    .slice()
    .reverse()
    .map(
      (e) => `<div class="entry"><strong>#${e.n}</strong> → ${escapeHtml(e.result)}
      <div><em>You:</em> ${escapeHtml(e.prompt)}</div>
      <div><em>Model:</em> ${escapeHtml(e.reply)}</div></div>`,
    )
    .join('')

  const banChips = L.banned.map((b) => `<span class="chip ban">${escapeHtml(b)}</span>`).join('')
  const extraChips = [
    L.maxPromptWords != null
      ? `<span class="chip warn">≤${L.maxPromptWords} words</span>`
      : '',
    L.format.kind === 'json_answer'
      ? `<span class="chip warn">JSON {"answer"}</span>`
      : '',
    L.format.kind === 'triple_arrow'
      ? `<span class="chip warn">>>> <<< wrap</span>`
      : '',
  ].join('')

  return `
  <div class="screen active" id="game">
    <div class="level-bar">
      <div>
        <h2>Level ${L.id}: ${escapeHtml(L.title)}</h2>
        <p class="muted" style="margin:0">Secret is hidden — make the model say it.</p>
      </div>
      <button class="btn ghost" id="btn-hub" type="button">← Association</button>
    </div>

    <div class="hud" aria-live="polite">
      <div class="hud-item">
        <label>Goal</label>
        <div class="val">${escapeHtml(L.goal)}</div>
      </div>
      <div class="hud-item">
        <label>Constraints</label>
        <div class="val" style="font-size:0.95rem">${escapeHtml(constraintsText(L))}</div>
      </div>
      <div class="hud-item">
        <label>Attempt</label>
        <div class="val">${attemptLabel}</div>
      </div>
      <div class="hud-item next">
        <label>Next action</label>
        <div class="val">${escapeHtml(next)}</div>
      </div>
    </div>

    <div class="chips" style="margin-bottom:0.75rem">${banChips}${extraChips}</div>

    <div class="panel">
      <label class="muted" style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">Model reply</label>
      <div class="reply" id="reply">${
        logs.length
          ? escapeHtml(logs[logs.length - 1].reply)
          : '…waiting for your prompt'
      }</div>
    </div>

    <div class="panel">
      <label for="prompt" class="muted" style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">Your prompt</label>
      <textarea id="prompt" class="prompt-box" placeholder="Type a clever prompt…" ${
        gameOver || wonLevel ? 'disabled' : ''
      }>${draftAttr}</textarea>
      <div class="muted" id="wordcount" style="margin-top:0.35rem;font-size:0.85rem">${words}</div>
      <div class="actions">
        <button class="btn" id="btn-send" type="button" ${gameOver || wonLevel ? 'disabled' : ''}>Send prompt</button>
        <button class="btn secondary" id="btn-explain" type="button">Explain why</button>
        ${
          wonLevel
            ? `<button class="btn ok" id="btn-next" type="button">${
                levelIndex < LEVELS.length - 1 ? 'Next level →' : 'Back to hub 🎉'
              }</button>`
            : ''
        }
        ${
          gameOver && !wonLevel
            ? `<button class="btn danger" id="btn-retry" type="button">Retry level</button>`
            : ''
        }
      </div>
      ${toastHtml}
      ${tipHtml}
    </div>

    <div class="panel">
      <h3 style="font-size:1rem">Attempt log</h3>
      <div class="log">${logHtml || '<span class="muted">No attempts yet.</span>'}</div>
    </div>
  </div>`
}

function bindHub() {
  document.getElementById('btn-open-class')?.addEventListener('click', () => {
    deferClass = false
    screen = 'class'
    render()
  })
  bindHarnessStrip(app, playContext, render)
  document.querySelectorAll<HTMLButtonElement>('[data-gate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeGate = btn.dataset.gate as DGateId
      lastGate = activeGate
      resumeNote = null
      screen = 'dgate'
      render()
    })
  })
  document.getElementById('tile-trapdoor')?.addEventListener('click', () => {
    resumeNote = null
    screen = 'game'
    if (cleared.length === LEVELS.length) {
      levelIndex = 0
      attempt = 1
      logs = []
      gameOver = false
      wonLevel = false
      lastToast = ''
    }
    persist(`Level ${levelIndex + 1}, attempt ${attempt}`)
    render()
  })
  document.getElementById('tile-heist')?.addEventListener('click', () => {
    resumeNote = null
    screen = 'heist'
    render()
  })
  document.getElementById('tile-akcp')?.addEventListener('click', () => {
    resumeNote = null
    screen = 'akcp'
    render()
  })
  document.getElementById('btn-continue')?.addEventListener('click', () => {
    resumeNote = null
    screen = 'game'
    logs = []
    gameOver = false
    wonLevel = false
    lastToast = ''
    if (attempt > level().maxAttempts) {
      attempt = 1
      gameOver = false
    }
    render()
  })
  document.getElementById('btn-dismiss-resume')?.addEventListener('click', () => {
    resumeNote = null
    render()
  })
}

function bindClassPick() {
  document.querySelectorAll<HTMLButtonElement>('[data-class]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.class as HunterClassId
      pickClass(id)
      deferClass = false
      activeGate = id
      lastGate = id
      screen = 'dgate'
      render()
    })
  })
  document.getElementById('btn-class-later')?.addEventListener('click', () => {
    deferClass = true
    screen = 'hub'
    render()
  })
}

function bindGame() {
  const promptEl = document.getElementById('prompt') as HTMLTextAreaElement | null
  const wordEl = document.getElementById('wordcount')

  const updateWords = () => {
    if (!promptEl || !wordEl) return
    const L = level()
    const n = countWords(promptEl.value)
    if (L.maxPromptWords != null) {
      const over = n > L.maxPromptWords
      wordEl.textContent = `${n}/${L.maxPromptWords} words${over ? ' — over budget!' : ''}`
      wordEl.style.color = over ? 'var(--danger)' : 'var(--muted)'
    } else {
      wordEl.textContent = n ? `${n} words` : ''
      wordEl.style.color = 'var(--muted)'
    }
  }
  promptEl?.addEventListener('input', () => {
    draftPrompt = promptEl.value
    updateWords()
  })
  updateWords()

  document.getElementById('btn-hub')?.addEventListener('click', () => {
    screen = 'hub'
    persist(`Paused on level ${levelIndex + 1}`)
    render()
  })

  document.getElementById('btn-explain')?.addEventListener('click', () => {
    if (promptEl) draftPrompt = promptEl.value
    showTip = !showTip
    render()
  })

  document.getElementById('btn-send')?.addEventListener('click', () => {
    if (!promptEl || gameOver || wonLevel) return
    submitPrompt(promptEl.value)
  })

  promptEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!gameOver && !wonLevel) submitPrompt(promptEl.value)
    }
  })

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (levelIndex >= LEVELS.length - 1) {
      screen = 'hub'
      persist('All levels cleared!')
      render()
      return
    }
    levelIndex += 1
    attempt = 1
    logs = []
    lastToast = ''
    showTip = false
    wonLevel = false
    gameOver = false
    draftPrompt = ''
    persist(`Level ${levelIndex + 1} unlocked`)
    render()
  })

  document.getElementById('btn-retry')?.addEventListener('click', () => {
    attempt = 1
    logs = []
    lastToast = ''
    showTip = false
    wonLevel = false
    gameOver = false
    draftPrompt = ''
    persist(`Retrying level ${levelIndex + 1}`)
    render()
  })
}

function submitPrompt(raw: string) {
  const L = level()
  const prompt = raw.trim()
  const reply = prompt ? mockReply(prompt, L, attempt) : ''
  const judged = judgePrompt(L, prompt, reply)

  if (judged.result === 'empty') {
    lastToast = `<div class="toast info">Type a prompt first.</div>`
    render()
    return
  }

  if (judged.result === 'banned') {
    logs.push({ n: attempt, prompt, reply, result: 'banned' })
    lastToast = `<div class="toast fail">Banned word used: “${escapeHtml(
      judged.bannedWord ?? '',
    )}”. Attempt lost.</div>`
    afterAttempt(false)
    return
  }

  if (judged.result === 'budget') {
    logs.push({ n: attempt, prompt, reply: '(not sent — over word budget)', result: 'budget' })
    lastToast = `<div class="toast fail">Over word budget (${judged.words}/${L.maxPromptWords}). Attempt lost.</div>`
    afterAttempt(false)
    return
  }

  if (judged.result === 'win') {
    logs.push({ n: attempt, prompt, reply, result: 'win' })
    const firstClear = !cleared.includes(L.id)
    if (firstClear) cleared.push(L.id)
    const gained = firstClear ? awardGate('trapdoor', L.id) : 0
    wonLevel = true
    draftPrompt = ''
    if (gained) deferClass = false
    const xpNote = gained ? ` +${XP_PER_GATE} Hunter XP.` : ''
    lastToast = `<div class="toast win">🎉 Trapdoor opens! ${escapeHtml(L.concept)}${xpNote}</div>`
    persist(`Cleared level ${L.id}`)
    render()
    return
  }

  if (judged.result === 'format') {
    logs.push({ n: attempt, prompt, reply, result: 'format' })
    lastToast = `<div class="toast fail">Secret appeared but format constraint failed. Attempt lost.</div>`
    afterAttempt(false)
    return
  }

  logs.push({ n: attempt, prompt, reply, result: 'miss' })
  lastToast = `<div class="toast info">No secret in the reply. Try another angle.</div>`
  afterAttempt(false)
}

function afterAttempt(won: boolean) {
  if (won) return
  if (attempt >= level().maxAttempts) {
    gameOver = true
    lastToast += `<div class="toast fail" style="margin-top:0.5rem">Out of attempts — retry the level.</div>`
    persist(`Failed level ${level().id} — retry`)
  } else {
    attempt += 1
    persist(`Level ${levelIndex + 1}, attempt ${attempt}`)
  }
  render()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Boot
restore()
restoreHeist()
syncClearedGates(cleared, heistClearedIds())
render()
// Harness: poll the box-side status file so "building → web_ready → apk_ready" shows up while you play.
startHarnessPolling(`${import.meta.env.BASE_URL}harness-status.json`, () => {
  if (screen === 'hub') render()
})

;(window as unknown as { __ptReset: () => void }).__ptReset = () => {
  clearSave()
  heistDebugReset()
  clearHunter()
  clearGateSave()
  clearAkcpSave()
  clearBashMissionsSave()
  clearPythonKoansSave()
  clearExercismPythonSave()
  clearPyithonSave()
  resetGateUi()
  resetHarnessUi()
  unmountHeist()
  unmountAkcp()
  // unmountHeist writes a pause line; clear it so the console reset stays empty.
  heistDebugReset()
  levelIndex = 0
  attempt = 1
  cleared = []
  logs = []
  lastToast = ''
  showTip = false
  resumeNote = null
  gameOver = false
  wonLevel = false
  deferClass = false
  screen = 'hub'
  render()
}
