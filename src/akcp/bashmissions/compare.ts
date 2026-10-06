/** Output comparison modes from BashMissions `engine/validator.py` (re-implemented). */

export function normalizeWhitespace(text: string): string {
  return text.split(/\s+/).filter((part) => part.length > 0).join(' ')
}

function fullMatch(pattern: string, text: string): boolean {
  const match = new RegExp(`^(?:${pattern})$`).exec(text)
  return match !== null
}

export function compareOutput(actual: string, expected: string, mode: string): boolean {
  if (mode === 'exact') return actual === expected
  if (mode === 'contains') return actual.includes(expected)
  if (mode === 'ignore_whitespace') return normalizeWhitespace(actual) === normalizeWhitespace(expected)
  if (mode === 'regex') return fullMatch(expected, actual)
  throw new Error(`Unknown comparison mode: ${mode}`)
}
