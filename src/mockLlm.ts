import type { Level } from './levels'

const DEFAULTS = [
  "I'm not sure I follow. Try describing the idea without naming it directly.",
  'Hmm. That prompt is vague. Give me a clearer hint or riddle.',
  'I can help — rephrase with a famous reference or idiom.',
  'Interesting ask. Be more specific about the phrase you want.',
  'No match yet. Point me at a story, idiom, or paper nickname.',
]

function includesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n))
}

function wantsJson(prompt: string): boolean {
  return /\bjson\b/i.test(prompt) || /\{.*"answer"/i.test(prompt) || /as json/i.test(prompt)
}

function wantsArrows(prompt: string): boolean {
  return />>>/.test(prompt) || /triple.?arrow/i.test(prompt) || /wrap.*>>>/i.test(prompt) || /arrows/i.test(prompt)
}

function wrapSecret(secret: string, level: Level, prompt: string): string {
  if (level.format.kind === 'json_answer' || wantsJson(prompt)) {
    return `{"answer":"${secret}"}`
  }
  if (level.format.kind === 'triple_arrow' || wantsArrows(prompt)) {
    return `>>>${secret}<<<`
  }
  return secret
}

/** Deterministic mock “LLM” — fair, beatable, no API keys. */
export function mockReply(prompt: string, level: Level, attempt: number): string {
  const p = prompt.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!p) return 'Please type a prompt first.'

  // Direct echo attempts (player pastes secret words somehow)
  if (p.includes(level.secret.toLowerCase())) {
    return wrapSecret(level.secret, level, prompt)
  }

  // Level hint patterns
  if (includesAny(p, level.modelHints)) {
    return wrapSecret(level.secret, level, prompt)
  }

  // Generic clever patterns
  if (/\b(acrostic|initials|first letters)\b/.test(p)) {
    return `Using initials I get something like: ${level.secret
      .split(/\s+/)
      .map((w) => w[0])
      .join('')}… try a clearer description.`
  }

  if (/\b(spell|letters?)\b/.test(p) && /\b(say|output|write|reply)\b/.test(p)) {
    return 'Spell it out for me as a description — I respond to meaning, not just letters.'
  }

  // Format-only asks without secret trigger
  if (level.format.kind === 'json_answer' && wantsJson(p) && !includesAny(p, level.modelHints)) {
    return '{"answer":"???"}'
  }
  if (level.format.kind === 'triple_arrow' && wantsArrows(p) && !includesAny(p, level.modelHints)) {
    return '>>>???<<<'
  }

  // Soft progressive nudge by attempt number (deterministic)
  const idx = Math.min(attempt - 1, DEFAULTS.length - 1)
  const base = DEFAULTS[idx]

  if (level.id === 1) {
    return `${base} (Folklore cave? Famous thief tale?)`
  }
  if (level.id === 2) {
    return `${base} (Think of an idiom about rarity.)`
  }
  if (level.id === 3) {
    return `${base} (What unit + cap bound an LLM prompt?)`
  }
  if (level.id === 4) {
    return `${base} (Prod slang + insist on JSON {"answer":"..."}.)`
  }
  if (level.id === 5) {
    return `${base} (2017 NLP slogan; wrap with >>> <<<; stay brief.)`
  }
  return base
}
