import { describe, expect, it } from 'vitest'
import {
  HUD_SCROLL_THRESHOLD,
  bindBashHudScroll,
  initialHudScroll,
  reduceHudScroll,
  type HudScrollState,
} from '../src/akcp/bashmissions/hudScroll'

function scroll(state: HudScrollState, y: number): HudScrollState {
  return reduceHudScroll(state, y)
}

describe('bashmissions goal banner scroll', () => {
  it('stays open at the top and collapses after scrolling down into the mission', () => {
    let state = initialHudScroll(0)
    expect(state.collapsed).toBe(false)
    state = scroll(state, 4)
    state = scroll(state, 8)
    expect(state.collapsed).toBe(false)
    state = scroll(state, 8 + HUD_SCROLL_THRESHOLD)
    expect(state.collapsed).toBe(true)
  })

  it('opens again when scrolling back up and stays open at the header', () => {
    let state = initialHudScroll(200)
    expect(state.collapsed).toBe(true)
    state = scroll(state, 196)
    expect(state.collapsed).toBe(true)
    state = scroll(state, 200 - HUD_SCROLL_THRESHOLD)
    expect(state.collapsed).toBe(false)
    state = scroll(state, 400)
    expect(state.collapsed).toBe(true)
    state = scroll(state, 0)
    expect(state.collapsed).toBe(false)
  })

  it('keeps collapsing while the player keeps scrolling down in small steps', () => {
    let state = initialHudScroll(80)
    expect(state.collapsed).toBe(true)
    for (let y = 84; y <= 120; y += 4) state = scroll(state, y)
    expect(state.collapsed).toBe(true)
    state = scroll(state, state.lastY - HUD_SCROLL_THRESHOLD * 2)
    expect(state.collapsed).toBe(false)
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
