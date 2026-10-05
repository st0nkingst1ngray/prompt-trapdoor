import { describe, expect, it, vi } from 'vitest'

describe('hub boot (main.ts) — Rank C section + harness strip', () => {
  it('a Shadow who cleared D sees Stop the Runaway open, siblings locked, Casino open, and the harness strip', async () => {
    localStorage.clear()
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({ xp: 100, awarded: ['trapdoor:1', 'heist:1', 'shadow:1', 'shadow:2', 'shadow:3'], classId: 'shadow' }))
    localStorage.setItem('hunter-dgates-save-v1', JSON.stringify({ shadow: [1, 2, 3] }))
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
    document.body.innerHTML = '<div id="app"></div>'
    await import('../src/main')
    const app = document.getElementById('app')!
    expect(app.querySelector('#harness-strip')).not.toBeNull()
    expect(app.querySelector('#btn-harness-open')).not.toBeNull()
    const c = app.querySelector('#c-doors')!
    const tile = (id: string) => c.querySelector<HTMLButtonElement>(`[data-gate="${id}"]`)!
    expect(tile('runaway').disabled).toBe(false)
    expect(tile('runaway').textContent).toContain('Your C door')
    expect(tile('croupier').disabled).toBe(true)
    expect(tile('ward').disabled).toBe(true)
    expect(tile('casino').disabled).toBe(false)
    // first tile in the C row is your own door
    expect(c.querySelector('[data-gate]')?.getAttribute('data-gate')).toBe('runaway')
    tile('runaway').click()
    expect(app.querySelector('#dgate')?.getAttribute('data-gate')).toBe('runaway')
    expect(app.querySelector('#kn-temperature')).not.toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('hub boot (main.ts) — Rank B section', () => {
  it('a Shadow at B-rank with C cleared sees Note in the Margin open and siblings locked', async () => {
    localStorage.clear()
    localStorage.setItem(
      'hunter-association-save-v1',
      JSON.stringify({
        xp: 160,
        awarded: [
          'trapdoor:1',
          'heist:1',
          'shadow:1',
          'shadow:2',
          'shadow:3',
          'runaway:1',
          'runaway:2',
          'runaway:3',
        ],
        classId: 'shadow',
      }),
    )
    localStorage.setItem('hunter-dgates-save-v1', JSON.stringify({ shadow: [1, 2, 3], runaway: [1, 2, 3] }))
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    vi.resetModules()
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
    document.body.innerHTML = '<div id="app"></div>'
    await import('../src/main')
    const app = document.getElementById('app')!
    const b = app.querySelector('#b-doors')!
    const tile = (id: string) => b.querySelector<HTMLButtonElement>(`[data-gate="${id}"]`)!
    expect(tile('margin').disabled).toBe(false)
    expect(tile('margin').textContent).toContain('Your B door')
    expect(tile('pin').disabled).toBe(true)
    expect(tile('near').disabled).toBe(true)
    expect(tile('shelf').disabled).toBe(true)
    expect(b.querySelector('[data-gate]')?.getAttribute('data-gate')).toBe('margin')
    tile('margin').click()
    expect(app.querySelector('#dgate')?.getAttribute('data-gate')).toBe('margin')
    vi.unstubAllGlobals()
  })
})

describe('hub boot (main.ts) — Rank A section', () => {
  it('a Shadow at A-rank with B cleared sees Clap Trap open and siblings locked', async () => {
    localStorage.clear()
    localStorage.setItem(
      'hunter-association-save-v1',
      JSON.stringify({
        xp: 220,
        awarded: [
          'trapdoor:1',
          'heist:1',
          'shadow:1',
          'shadow:2',
          'shadow:3',
          'runaway:1',
          'runaway:2',
          'runaway:3',
          'margin:1',
          'margin:2',
          'margin:3',
        ],
        classId: 'shadow',
      }),
    )
    localStorage.setItem(
      'hunter-dgates-save-v1',
      JSON.stringify({ shadow: [1, 2, 3], runaway: [1, 2, 3], margin: [1, 2, 3] }),
    )
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    vi.resetModules()
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
    document.body.innerHTML = '<div id="app"></div>'
    await import('../src/main')
    const app = document.getElementById('app')!
    const a = app.querySelector('#a-doors')!
    const tile = (id: string) => a.querySelector<HTMLButtonElement>(`[data-gate="${id}"]`)!
    expect(tile('clap').disabled).toBe(false)
    expect(tile('clap').textContent).toContain('Your A door')
    expect(tile('forgot').disabled).toBe(true)
    expect(tile('salt').disabled).toBe(true)
    expect(tile('mirror').disabled).toBe(true)
    expect(a.querySelector('[data-gate]')?.getAttribute('data-gate')).toBe('clap')
    tile('clap').click()
    expect(app.querySelector('#dgate')?.getAttribute('data-gate')).toBe('clap')
    expect(app.querySelector('.know-strip')).not.toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('hub boot (main.ts) — Rank S section', () => {
  it('a Shadow at S-rank with A cleared sees Whisper open and siblings locked', async () => {
    localStorage.clear()
    localStorage.setItem(
      'hunter-association-save-v1',
      JSON.stringify({
        xp: 280,
        awarded: [
          'trapdoor:1',
          'heist:1',
          'shadow:1',
          'shadow:2',
          'shadow:3',
          'runaway:1',
          'runaway:2',
          'runaway:3',
          'margin:1',
          'margin:2',
          'margin:3',
          'clap:1',
          'clap:2',
          'clap:3',
        ],
        classId: 'shadow',
      }),
    )
    localStorage.setItem(
      'hunter-dgates-save-v1',
      JSON.stringify({
        shadow: [1, 2, 3],
        runaway: [1, 2, 3],
        margin: [1, 2, 3],
        clap: [1, 2, 3],
      }),
    )
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    vi.resetModules()
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
    document.body.innerHTML = '<div id="app"></div>'
    await import('../src/main')
    const app = document.getElementById('app')!
    const s = app.querySelector('#s-doors')!
    const tile = (id: string) => s.querySelector<HTMLButtonElement>(`[data-gate="${id}"]`)!
    expect(tile('whisper').disabled).toBe(false)
    expect(tile('whisper').textContent).toContain('Your S door')
    expect(tile('ten').disabled).toBe(true)
    expect(tile('keyring').disabled).toBe(true)
    expect(tile('pair').disabled).toBe(true)
    expect(s.querySelector('[data-gate]')?.getAttribute('data-gate')).toBe('whisper')
    tile('whisper').click()
    expect(app.querySelector('#dgate')?.getAttribute('data-gate')).toBe('whisper')
    expect(app.querySelector('.know-strip')).not.toBeNull()
    vi.unstubAllGlobals()
  })
})
