import {
  countWords,
  formatSatisfied,
  promptHasBanned,
  secretInText,
  type Level,
} from './levels'

/** Same order as the trapdoor submit path: empty, banned, budget, win, format, miss. */
export type JudgeResult = 'empty' | 'banned' | 'budget' | 'win' | 'format' | 'miss'

export interface JudgeOutcome {
  result: JudgeResult
  bannedWord: string | null
  words: number
}

export function judgePrompt(level: Level, rawPrompt: string, reply: string): JudgeOutcome {
  const prompt = rawPrompt.trim()
  const words = countWords(prompt)
  if (!prompt) return { result: 'empty', bannedWord: null, words: 0 }

  const banned = promptHasBanned(prompt, level.banned)
  if (banned) return { result: 'banned', bannedWord: banned, words }

  if (level.maxPromptWords != null && words > level.maxPromptWords) {
    return { result: 'budget', bannedWord: null, words }
  }

  const hasSecret = secretInText(reply, level.secret)
  const fmtOk = formatSatisfied(reply, level.secret, level.format)
  if (hasSecret && fmtOk) return { result: 'win', bannedWord: null, words }
  if (hasSecret && !fmtOk) return { result: 'format', bannedWord: null, words }
  return { result: 'miss', bannedWord: null, words }
}
