import { describe, expect, it } from 'vitest'
import {
  HEIST_LEVELS,
  displayTile,
  findBanned,
  initialTiles,
  isWinning,
  joinTiles,
} from '../src/tokenHeistLevels'

const byId = (id: number) => {
  const level = HEIST_LEVELS.find((l) => l.id === id)
  if (!level) throw new Error(`missing heist ${id}`)
  return level
}

describe('token heist constraints', () => {
  it('starts as one character per tile and joins back to the message', () => {
    const level = byId(1)
    const tiles = initialTiles(level.message)
    expect(tiles).toEqual(['C', 'A', 'T'])
    expect(joinTiles(tiles)).toBe('CAT')
    expect(isWinning(tiles, level)).toBe(false)
  })

  it('wins CAT with an odd cut under budget and loses the banned whole word', () => {
    const level = byId(1)
    expect(isWinning(['CA', 'T'], level)).toBe(true)
    expect(isWinning(['CAT'], level)).toBe(false)
    expect(isWinning(['C', 'AT'], level)).toBe(false)
    expect(findBanned(['C', 'AT'], level.bannedTokens)).toBe('AT')
  })

  it('rejects a corrupted message even when the tile count is legal', () => {
    const level = byId(1)
    expect(isWinning(['CA', 'X'], level)).toBe(false)
  })

  it('smuggles PASSWORD in three awkward tiles', () => {
    const level = byId(2)
    expect(isWinning(['PA', 'SSWO', 'RD'], level)).toBe(true)
    expect(isWinning(['PASS', 'WO', 'RD'], level)).toBe(false)
    expect(isWinning(['PA', 'SS', 'WO', 'RD'], level)).toBe(false)
  })

  it('lets spaces live inside tiles so ATTACK AT DAWN fits five tokens', () => {
    const level = byId(3)
    const tiles = ['ATTAC', 'K ', 'A', 'T DAW', 'N']
    expect(joinTiles(tiles)).toBe(level.message)
    expect(tiles.length).toBeLessThanOrEqual(level.tokenBudget)
    expect(findBanned(tiles, level.bannedTokens)).toBeNull()
    expect(isWinning(tiles, level)).toBe(true)
    expect(isWinning(['ATTACK', ' ', 'AT', ' ', 'DAWN'], level)).toBe(false)
  })

  it('shows spaces as a visible glyph', () => {
    expect(displayTile('AT ')).toBe('AT\u2423')
  })
})
