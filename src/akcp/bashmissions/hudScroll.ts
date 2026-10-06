/** Pixels of accumulated scroll before the goal banner toggles. */
export const HUD_SCROLL_THRESHOLD = 12

/** Near the top of the page the banner stays open. */
export const HUD_SCROLL_TOP = 16

export interface HudScrollState {
  collapsed: boolean
  lastY: number
  /** Scroll since the last toggle. Small moves add up. */
  acc: number
}

export function initialHudScroll(y: number): HudScrollState {
  const next = Math.max(0, y)
  return { collapsed: next > HUD_SCROLL_TOP, lastY: next, acc: 0 }
}

/**
 * Scroll down collapses the banner. Scroll up opens it.
 * At the top of the page it is always open.
 */
export function reduceHudScroll(state: HudScrollState, y: number): HudScrollState {
  const next = Math.max(0, y)
  const delta = next - state.lastY
  if (next <= HUD_SCROLL_TOP) return { collapsed: false, lastY: next, acc: 0 }
  const acc = state.acc + delta
  if (acc >= HUD_SCROLL_THRESHOLD) return { collapsed: true, lastY: next, acc: 0 }
  if (acc <= -HUD_SCROLL_THRESHOLD) return { collapsed: false, lastY: next, acc: 0 }
  return { collapsed: state.collapsed, lastY: next, acc }
}

const HUD_MOTION_MS = 400

export function bindBashHudScroll(
  slot: HTMLElement,
  readY: () => number = () => window.scrollY || document.documentElement.scrollTop || 0,
): () => void {
  let state = initialHudScroll(readY())
  let applying = false
  let lockUntil = 0
  let rebaseTimer = 0

  const measure = () => {
    const card = slot.querySelector('.bash-hud')
    if (!(card instanceof HTMLElement)) return
    const style = getComputedStyle(slot)
    const pad = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
    const height = card.offsetHeight + pad
    if (height > 0) slot.style.setProperty('--bash-hud-max', `${Math.ceil(height)}px`)
  }

  const render = (instant: boolean) => {
    measure()
    slot.classList.toggle('bash-hud-instant', instant)
    slot.classList.toggle('is-collapsed', state.collapsed)
    if (state.collapsed) slot.setAttribute('aria-hidden', 'true')
    else slot.removeAttribute('aria-hidden')
  }

  render(true)

  const onScroll = () => {
    if (applying || performance.now() < lockUntil) return
    const next = reduceHudScroll(state, readY())
    const changed = next.collapsed !== state.collapsed
    state = next
    if (!changed) return
    applying = true
    render(false)
    lockUntil = performance.now() + HUD_MOTION_MS
    applying = false
    window.clearTimeout(rebaseTimer)
    rebaseTimer = window.setTimeout(() => {
      state = { collapsed: state.collapsed, lastY: readY(), acc: 0 }
    }, HUD_MOTION_MS)
  }

  const onResize = () => {
    if (slot.classList.contains('is-collapsed')) return
    measure()
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  requestAnimationFrame(() => slot.classList.remove('bash-hud-instant'))

  return () => {
    window.clearTimeout(rebaseTimer)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
  }
}

/** Keeps the focused script above the on-screen keyboard. */
export function bindKeyboardInset(): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  const apply = () => {
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
  }
  viewport.addEventListener('resize', apply)
  viewport.addEventListener('scroll', apply)
  apply()
  return () => {
    viewport.removeEventListener('resize', apply)
    viewport.removeEventListener('scroll', apply)
    document.documentElement.style.setProperty('--keyboard-inset', '0px')
  }
}
