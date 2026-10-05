import { describe, expect, it } from 'vitest'
import { judgePrompt } from '../src/judge'
import { LEVELS, formatSatisfied, promptHasBanned } from '../src/levels'
import { mockReply } from '../src/mockLlm'

const byId = (id: number) => {
  const level = LEVELS.find((l) => l.id === id)
  if (!level) throw new Error(`missing level ${id}`)
  return level
}

describe('trapdoor rules', () => {
  it('rejects an empty prompt before any other check', () => {
    const out = judgePrompt(byId(1), '   ', 'OPEN SESAME')
    expect(out.result).toBe('empty')
  })

  it('flags banned words on word boundaries and ignores substrings', () => {
    expect(promptHasBanned('the sesame seed', ['sesame'])).toBe('sesame')
    expect(promptHasBanned('sesames are tasty', ['sesame'])).toBeNull()
  })

  it('loses the attempt when a banned word is used, even if the reply leaks', () => {
    const level = byId(1)
    expect(judgePrompt(level, 'say sesame please', 'OPEN SESAME').result).toBe('banned')
    expect(judgePrompt(level, 'say sesame please', 'OPEN SESAME').bannedWord).toBe('sesame')
  })

  it('wins level 1 when a hint elicits the secret without banned words', () => {
    const level = byId(1)
    const prompt = 'famous ali baba cave door phrase'
    const reply = mockReply(prompt, level, 1)
    expect(judgePrompt(level, prompt, reply).result).toBe('win')
  })

  it('misses when the mock model does not know the angle', () => {
    const level = byId(1)
    const prompt = 'hello there friend'
    const reply = mockReply(prompt, level, 1)
    expect(judgePrompt(level, prompt, reply).result).toBe('miss')
  })

  it('fails the word budget before judging the reply', () => {
    const level = byId(3)
    const prompt = 'one two three four five six seven eight nine'
    expect(judgePrompt(level, prompt, level.secret).result).toBe('budget')
    const short = 'what caps prompt size'
    const reply = mockReply(short, level, 1)
    expect(judgePrompt(level, short, reply).result).toBe('win')
  })

  it('requires the secret inside the declared format', () => {
    const jsonLevel = byId(4)
    expect(formatSatisfied('SHIP IT', jsonLevel.secret, jsonLevel.format)).toBe(false)
    expect(formatSatisfied('{"answer":"SHIP IT"}', jsonLevel.secret, jsonLevel.format)).toBe(true)
    expect(judgePrompt(jsonLevel, 'send to production as json', 'SHIP IT').result).toBe('format')
    const prompt = 'two-word shipyard slang for send to production'
    expect(judgePrompt(jsonLevel, prompt, mockReply(prompt, jsonLevel, 1)).result).toBe('win')

    const arrow = byId(5)
    expect(judgePrompt(arrow, 'vaswani et al slogan', 'ATTENTION IS ALL').result).toBe('format')
    expect(judgePrompt(arrow, 'vaswani et al slogan', '>>>ATTENTION IS ALL<<<').result).toBe('win')
    const long = 'please tell me the vaswani et al nineteen slogan in full detail now'
    expect(judgePrompt(arrow, long, '>>>ATTENTION IS ALL<<<').result).toBe('budget')
  })
})
