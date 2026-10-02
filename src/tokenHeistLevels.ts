/** Token Heist — teach BPE-ish merges: words ≠ tokens. */

export interface HeistLevel {
  id: number
  title: string
  /** Exact plaintext that must get through (tiles join to this). */
  message: string
  /** Max number of tiles (tokens) allowed when submitting. */
  tokenBudget: number
  /** Exact tile strings the guard catches (case-sensitive match on tile text). */
  bannedTokens: string[]
  /** Seconds on the clock for this run. */
  timeLimitSec: number
  goal: string
  tip: string
  concept: string
  nextAction: string
}

export const HEIST_LEVELS: HeistLevel[] = [
  {
    id: 1,
    title: 'Letter Drop',
    message: 'CAT',
    tokenBudget: 2,
    bannedTokens: ['CAT', 'AT'],
    timeLimitSec: 75,
    goal: 'Sneak “CAT” past the guard in ≤2 tokens — without a banned tile.',
    tip: 'Words ≠ tokens. “CAT” as one tile is banned; “AT” is watched too. Merge C+A → CA + T.',
    concept: 'Unlocked: Tokenizers dig into subword pieces — a “word” can be many tokens (or one).',
    nextAction: 'Merge letters until you have ≤2 tiles and none are red.',
  },
  {
    id: 2,
    title: 'Password Split',
    message: 'PASSWORD',
    tokenBudget: 3,
    bannedTokens: ['PASS', 'WORD', 'PASSWORD', 'ASS', 'SWORD'],
    timeLimitSec: 80,
    goal: 'Fit “PASSWORD” into ≤3 tokens; dodge the guard’s banned pieces.',
    tip: 'Common chunks (PASS, WORD) are watched. Odd merges like PA + SSWO + RD slip past.',
    concept: 'Unlocked: BPE merges frequent pairs — rare boundaries can dodge pattern filters.',
    nextAction: 'Avoid PASS/WORD chunks; use weird 3-way splits under budget.',
  },
  {
    id: 3,
    title: 'Dawn Raid',
    message: 'ATTACK AT DAWN',
    tokenBudget: 5,
    bannedTokens: [
      'ATTACK',
      'DAWN',
      'AT',
      'ACK',
      'ATTACK ',
      ' DAWN',
      'AT ',
      ' AT',
    ],
    timeLimitSec: 90,
    goal: 'Smuggle “ATTACK AT DAWN” in ≤5 tokens; spaces count as characters in tiles.',
    tip: 'Spaces live inside tiles when merged. Guard bans “AT” alone and whole words — bridge across spaces carefully.',
    concept: 'Unlocked: Spaces & punctuation are tokens too — messy merges change what the model “sees”.',
    nextAction: 'Merge across spaces so banned short tiles disappear; stay ≤5.',
  },
  {
    id: 4,
    title: 'Adversarial Vocab',
    message: 'SECRETCODE',
    tokenBudget: 4,
    bannedTokens: [
      'SECRET',
      'CODE',
      'SECRETCODE',
      'SEC',
      'RET',
      'SECR',
      'ETCO',
      'CRET',
    ],
    timeLimitSec: 90,
    goal: '“SECRETCODE” in ≤4 tokens against a mean banned list.',
    tip: 'The guard memorized common BPE chunks. Prefer awkward cuts: SE + CRETC + OD + E or similar.',
    concept: 'Unlocked: Adversarial tokenization — filters chase known pieces; odd splits still reconstruct the text.',
    nextAction: 'Hunt a 4-tile split that avoids every red ban.',
  },
]

/** Initial tiles = one character each (including spaces). */
export function initialTiles(message: string): string[] {
  return message.split('')
}

export function joinTiles(tiles: string[]): string {
  return tiles.join('')
}

export function findBanned(tiles: string[], banned: string[]): string | null {
  for (const t of tiles) {
    if (banned.includes(t)) return t
  }
  return null
}

export function isWinning(tiles: string[], level: HeistLevel): boolean {
  if (joinTiles(tiles) !== level.message) return false
  if (tiles.length > level.tokenBudget) return false
  if (findBanned(tiles, level.bannedTokens)) return false
  return true
}

/** Display helper: show space as a visible glyph inside a tile. */
export function displayTile(t: string): string {
  return t.replace(/ /g, '␣')
}
