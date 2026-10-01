import './style.css'
import {
  LEVELS,
  countWords,
  formatSatisfied,
  promptHasBanned,
  secretInText,
  type Level,
} from './levels'
import { mockReply } from './mockLlm'
import { clearSave, loadSave, writeSave, type SaveData } from './storage'
import {
  heistClearedCount,
  heistDebugReset,
  heistLevelCount,
  mountHeist,
  restoreHeist,
  unmountHeist,
} from './tokenHeist'

type Screen = 'hub' | 'game' | 'heist'

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

function render() {
  if (screen === 'hub') {
    app.innerHTML = renderHub()
    bindHub()
  } else if (screen === 'heist') {
    mountHeist(app, {
      onHub: () => {
        screen = 'hub'
        render()
      },
      escapeHtml,
    })
  } else {
    app.innerHTML = renderGame()
    bindGame()
  }
}

function renderHub(): string {
  const progress = cleared.length
  const heistProgress = heistClearedCount()
  const heistTotal = heistLevelCount()
  return `
  <div class="screen active" id="hub">
    <header class="hub-header">
      <h1>🚪 Prompt Trapdoor</h1>
      <p class="muted">Trick a mock AI into saying the secret — without banned words. Learn LLM ideas by winning.</p>
      <p><strong>${progress}/${LEVELS.length}</strong> Trapdoor · <strong>${heistProgress}/${heistTotal}</strong> Heist</p>
    </header>
    ${
      resumeNote
        ? `<div class="resume" id="resume">${escapeHtml(resumeNote)}
           <div class="actions"><button class="btn secondary" id="btn-continue">Continue</button>
           <button class="btn ghost" id="btn-dismiss-resume">Dismiss</button></div></div>`
        : ''
    }
    <div class="hub-grid">
      <button class="tile" id="tile-trapdoor" type="button">
        <div class="emoji">🪤</div>
        <div class="title">Prompt Trapdoor</div>
        <div class="sub">Beat the mock model. ${LEVELS.length} levels.</div>
        <span class="badge">${progress === LEVELS.length ? 'Complete' : 'Play'}</span>
      </button>
      <button class="tile" id="tile-heist" type="button">
        <div class="emoji">🪙</div>
        <div class="title">Token Heist</div>
        <div class="sub">Split &amp; merge past the guard. ${heistTotal} heists.</div>
        <span class="badge ${heistProgress === heistTotal ? 'done' : ''}">${
          heistProgress === heistTotal ? 'Complete' : 'Play'
        }</span>
      </button>
      <button class="tile locked" type="button" disabled>
        <div class="emoji">🎰</div>
        <div class="title">Temperature Casino</div>
        <div class="sub">Bet on creativity vs chaos. Coming soon.</div>
        <span class="badge locked">Locked</span>
      </button>
    </div>
    <p class="muted" style="margin-top:1.5rem;text-align:center;font-size:0.9rem">
      Autosaves in this browser · No API keys · Instant replies
    </p>
  </div>`
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
      <button class="btn ghost" id="btn-hub" type="button">← Hub</button>
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
  if (!prompt) {
    lastToast = `<div class="toast info">Type a prompt first.</div>`
    render()
    return
  }

  const banned = promptHasBanned(prompt, L.banned)
  const words = countWords(prompt)
  const overBudget = L.maxPromptWords != null && words > L.maxPromptWords

  const reply = mockReply(prompt, L, attempt)

  if (banned) {
    logs.push({ n: attempt, prompt, reply, result: 'banned' })
    lastToast = `<div class="toast fail">Banned word used: “${escapeHtml(
      banned,
    )}”. Attempt lost.</div>`
    afterAttempt(false)
    return
  }

  if (overBudget) {
    logs.push({ n: attempt, prompt, reply: '(not sent — over word budget)', result: 'budget' })
    lastToast = `<div class="toast fail">Over word budget (${words}/${L.maxPromptWords}). Attempt lost.</div>`
    afterAttempt(false)
    return
  }

  const hasSecret = secretInText(reply, L.secret)
  const fmtOk = formatSatisfied(reply, L.secret, L.format)

  if (hasSecret && fmtOk) {
    logs.push({ n: attempt, prompt, reply, result: 'win' })
    if (!cleared.includes(L.id)) cleared.push(L.id)
    wonLevel = true
    draftPrompt = ''
    lastToast = `<div class="toast win">🎉 Trapdoor opens! ${escapeHtml(L.concept)}</div>`
    persist(`Cleared level ${L.id}`)
    render()
    return
  }

  if (hasSecret && !fmtOk) {
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
render()

;(window as unknown as { __ptReset: () => void }).__ptReset = () => {
  clearSave()
  heistDebugReset()
  unmountHeist()
  levelIndex = 0
  attempt = 1
  cleared = []
  logs = []
  lastToast = ''
  showTip = false
  resumeNote = null
  gameOver = false
  wonLevel = false
  screen = 'hub'
  render()
}
