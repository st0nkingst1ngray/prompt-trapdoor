export type FormatConstraint =
  | { kind: 'none' }
  | { kind: 'json_answer' } // reply must contain {"answer":"<secret>"} style
  | { kind: 'triple_arrow' } // reply must contain >>>SECRET<<<

export interface Level {
  id: number
  title: string
  goal: string
  secret: string
  banned: string[]
  maxAttempts: number
  maxPromptWords: number | null
  format: FormatConstraint
  /** Patterns (lowercase) that make the mock model emit the secret */
  modelHints: string[]
  /** One-sentence tip shown via "Explain why" */
  tip: string
  /** Unlocked after win */
  concept: string
  /** Short next-action nudge when idle */
  nextAction: string
}

export const LEVELS: Level[] = [
  {
    id: 1,
    title: 'The Cave Door',
    goal: 'Make the model say the secret phrase.',
    secret: 'OPEN SESAME',
    banned: ['sesame', 'password', 'magic'],
    maxAttempts: 5,
    maxPromptWords: null,
    format: { kind: 'none' },
    modelHints: [
      'ali baba',
      'arabian nights',
      'cave door',
      'thieves cave',
      'folklore phrase',
      'open the cave',
      'forty thieves',
      'seed plant after open',
      'two words unlock cave',
    ],
    tip: 'Models answer from patterns in training data. Describe the thing — don’t name banned words.',
    concept: 'Unlocked: Models predict likely next tokens from patterns — they don’t “know” secrets like people do.',
    nextAction: 'Describe a famous cave-opening phrase without banned words.',
  },
  {
    id: 2,
    title: 'Synonym Maze',
    goal: 'Get the secret via indirection — synonyms & riddles count.',
    secret: 'BLUE MOON',
    banned: ['blue', 'moon', 'color', 'sky', 'lunar', 'night', 'azure'],
    maxAttempts: 5,
    maxPromptWords: null,
    format: { kind: 'none' },
    modelHints: [
      'once in a',
      'rare occurrence idiom',
      'rare event idiom',
      'second full',
      'melancholy sphere',
      'sad cow',
      'idiom for rare',
      'very uncommon phrase',
      'cyan crater',
      'indigo satellite',
    ],
    tip: 'Banned lists catch surface forms. Models still map related ideas — try idioms and descriptions.',
    concept: 'Unlocked: Synonym & indirection — models map related words even when exact terms are blocked.',
    nextAction: 'Ask for a famous “rare event” idiom without banned words.',
  },
  {
    id: 3,
    title: 'Word Budget',
    goal: 'Win with a tiny prompt — every word costs.',
    secret: 'TOKEN LIMIT',
    banned: ['token', 'limit', 'tokens', 'limits', 'context', 'window'],
    maxAttempts: 5,
    maxPromptWords: 8,
    format: { kind: 'none' },
    modelHints: [
      'llm text unit cap',
      'llm text-unit cap',
      'model input unit maximum',
      'chat length unit max',
      'ai word-piece ceiling',
      'piece of text quota',
      'name the llm text-unit cap',
      'what caps prompt size',
      'gpt input size unit',
    ],
    tip: 'Context windows are finite. Short, precise prompts teach you to spend words wisely.',
    concept: 'Unlocked: Context windows are finite — every word (token) costs space in the budget.',
    nextAction: 'Ask in ≤8 words what caps an LLM’s input size.',
  },
  {
    id: 4,
    title: 'Format Gate',
    goal: 'Secret must appear inside JSON: {"answer":"..."}',
    secret: 'SHIP IT',
    banned: ['ship', 'deploy', 'release', 'launch'],
    maxAttempts: 5,
    maxPromptWords: null,
    format: { kind: 'json_answer' },
    modelHints: [
      'send to production',
      'push to prod',
      'merge and go live',
      'two-word shipyard slang',
      'dev slang for publish',
      'move product live',
      'greenlight the build',
      'sail the build',
    ],
    tip: 'Clear format instructions steer structure. Models follow “reply as JSON” when you insist.',
    concept: 'Unlocked: Structured output — clear format instructions make models emit parseable shapes.',
    nextAction: 'Ask for prod-slang in JSON {"answer":"..."} form.',
  },
  {
    id: 5,
    title: 'Trapdoor Stack',
    goal: 'Beat bans + word budget + format together.',
    secret: 'ATTENTION IS ALL',
    banned: [
      'attention',
      'transformer',
      'paper',
      'title',
      'you need',
      'all you need',
    ],
    maxAttempts: 6,
    maxPromptWords: 12,
    format: { kind: 'triple_arrow' },
    modelHints: [
      'vaswani et al',
      'self-focus mechanism slogan',
      'self-focus slogan',
      '2017 nlp slogan',
      '2017 google nlp slogan',
      'seminal seq2seq slogan',
      'what self-focus needs slogan',
      'headline of vaswani',
    ],
    tip: 'Real prompting juggles goals, bans, length, and format at once — constraints stack.',
    concept: 'Unlocked: Constraints stack — real prompting balances goals, guardrails, length, and format.',
    nextAction: '≤12 words: ask for the 2017 NLP slogan (no banned words).',
  },
]

export function normalizeSecret(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function secretInText(text: string, secret: string): boolean {
  return normalizeSecret(text).includes(normalizeSecret(secret))
}

export function promptHasBanned(prompt: string, banned: string[]): string | null {
  const lower = prompt.toLowerCase()
  for (const b of banned) {
    const re = new RegExp(`\\b${escapeReg(b)}\\b`, 'i')
    if (re.test(lower)) return b
  }
  return null
}

export function countWords(prompt: string): number {
  const t = prompt.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

export function formatSatisfied(reply: string, secret: string, format: FormatConstraint): boolean {
  if (format.kind === 'none') return true
  if (format.kind === 'json_answer') {
    try {
      const m = reply.match(/\{[\s\S]*\}/)
      if (!m) return false
      const obj = JSON.parse(m[0]) as { answer?: unknown }
      return typeof obj.answer === 'string' && secretInText(obj.answer, secret)
    } catch {
      return false
    }
  }
  if (format.kind === 'triple_arrow') {
    const m = reply.match(/>>>([\s\S]*?)<<</)
    return !!m && secretInText(m[1], secret)
  }
  return true
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
