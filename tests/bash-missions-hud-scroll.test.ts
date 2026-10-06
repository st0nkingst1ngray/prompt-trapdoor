import { describe, expect, it } from 'vitest'
import {
  HUD_COLLAPSE_AT,
  bindBashHudScroll,
  initialHudScroll,
  reduceHudScroll,
  type HudScrollState,
} from '../src/akcp/bashmissions/hudScroll'

function scroll(state: HudScrollState, y: number): HudScrollState {
  return reduceHudScroll(state, y)
}

describe('bashmissions goal banner scroll', () => {
  it('stays open at the top and collapses once the mission scrolls under the card', () => {
    let state = initialHudScroll(0)
    expect(state.collapsed).toBe(false)
    state = scroll(state, 12)
    expect(state.collapsed).toBe(false)
    state = scroll(state, HUD_COLLAPSE_AT)
    expect(state.collapsed).toBe(true)
  })

  it('stays closed through the briefing and editor, then opens at the header', () => {
    let state = initialHudScroll(0)
    state = scroll(state, 180)
    expect(state.collapsed).toBe(true)
    state = scroll(state, 90)
    expect(state.collapsed).toBe(true)
    state = scroll(state, 40)
    expect(state.collapsed).toBe(true)
    state = scroll(state, 0)
    expect(state.collapsed).toBe(false)
  })

  it('does not pop the card back open on a short scroll up inside the mission', () => {
    let state = initialHudScroll(320)
    expect(state.collapsed).toBe(true)
    state = scroll(state, 260)
    expect(state.collapsed).toBe(true)
  })

  it('collapses the banner element on scroll down and ignores scroll after unbind', () => {
    document.body.innerHTML = '<div id="bash-hud-slot" class="bash-hud-slot"><div class="hud bash-hud"></div></div>'
    const slot = document.getElementById('bash-hud-slot')!
    let y = 0
    const stop = bindBashHudScroll(slot, () => y)
    expect(slot.classList.contains('is-collapsed')).toBe(false)
    expect(slot.getAttribute('aria-hidden')).toBeNull()

    y = 48
    window.dispatchEvent(new Event('scroll'))
    expect(slot.classList.contains('is-collapsed')).toBe(true)
    expect(slot.getAttribute('aria-hidden')).toBe('true')

    stop()
    y = 0
    window.dispatchEvent(new Event('scroll'))
    expect(slot.classList.contains('is-collapsed')).toBe(true)
  })

  it('opens the banner element when the page is back at the top', () => {
    document.body.innerHTML = '<div id="bash-hud-slot" class="bash-hud-slot"><div class="hud bash-hud"></div></div>'
    const slot = document.getElementById('bash-hud-slot')!
    let y = 80
    const stop = bindBashHudScroll(slot, () => y)
    expect(slot.classList.contains('is-collapsed')).toBe(true)
    y = 0
    window.dispatchEvent(new Event('scroll'))
    expect(slot.classList.contains('is-collapsed')).toBe(false)
    stop()
  })
})
