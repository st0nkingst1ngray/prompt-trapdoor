import type { AwardInput, AwardResult, CodeSave } from './types'

export function createCodeProgress(key: string, maxLevel: number, banner: string) {
  function empty(): CodeSave {
    return {
      version: 1,
      cleared: [],
      xp: 0,
      fails: {},
      hints: {},
      drafts: {},
      certifiedOn: {},
      playerName: 'Hunter',
    }
  }

  function clone(save: CodeSave): CodeSave {
    return {
      version: 1,
      cleared: [...save.cleared],
      xp: save.xp,
      fails: { ...save.fails },
      hints: { ...save.hints },
      drafts: { ...save.drafts },
      certifiedOn: { ...save.certifiedOn },
      playerName: save.playerName,
    }
  }

  function numberMap(value: unknown, max: number): Record<string, number> {
    const out: Record<string, number> = {}
    if (!value || typeof value !== 'object') return out
    for (const [id, n] of Object.entries(value)) {
      if (typeof n === 'number' && n >= 0 && n <= max) out[id] = Math.floor(n)
    }
    return out
  }

  function stringMap(value: unknown): Record<string, string> {
    const out: Record<string, string> = {}
    if (!value || typeof value !== 'object') return out
    for (const [id, text] of Object.entries(value)) {
      if (typeof text === 'string' && text.length <= 200_000) out[id] = text
    }
    return out
  }

  function load(): CodeSave {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return empty()
      const parsed = JSON.parse(raw) as Partial<CodeSave>
      const cleared = Array.isArray(parsed.cleared)
        ? [...new Set(parsed.cleared.filter((id): id is number => typeof id === 'number' && id >= 1 && id <= maxLevel))].sort((a, b) => a - b)
        : []
      const name = typeof parsed.playerName === 'string' && parsed.playerName.trim()
        ? parsed.playerName.trim().slice(0, 40)
        : 'Hunter'
      return {
        version: 1,
        cleared,
        xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? Math.floor(parsed.xp) : 0,
        fails: numberMap(parsed.fails, 1_000_000),
        hints: numberMap(parsed.hints, 5),
        drafts: stringMap(parsed.drafts),
        certifiedOn: stringMap(parsed.certifiedOn),
        playerName: name,
      }
    } catch {
      return empty()
    }
  }

  function write(save: CodeSave): void {
    try {
      localStorage.setItem(key, JSON.stringify(save))
    } catch {
      /* private mode or a full disk — the session still plays */
    }
  }

  function clear(): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }

  function levelUnlocked(save: CodeSave, levelId: number): boolean {
    if (levelId === 1) return true
    return save.cleared.includes(levelId - 1)
  }

  function resumeLevelId(save: CodeSave, levelCount = maxLevel): number {
    for (let id = 1; id <= levelCount; id += 1) {
      if (!save.cleared.includes(id)) return id
    }
    return levelCount
  }

  function awardLevel(save: CodeSave, input: AwardInput): AwardResult {
    const next = clone(save)
    if (next.cleared.includes(input.levelId)) return { save: next, xpGained: 0, certificate: false }
    next.cleared = [...next.cleared, input.levelId].sort((a, b) => a - b)
    const gained = input.xp > 0 ? Math.floor(input.xp) : 0
    next.xp += gained
    const done = input.moduleLevelIds.every((id) => next.cleared.includes(id))
    const moduleKey = String(input.moduleId)
    const certificate = done && next.certifiedOn[moduleKey] == null
    if (certificate) next.certifiedOn[moduleKey] = input.today
    return { save: next, xpGained: gained, certificate }
  }

  function recordFail(save: CodeSave, levelId: number): CodeSave {
    const next = clone(save)
    const id = String(levelId)
    next.fails[id] = (next.fails[id] ?? 0) + 1
    return next
  }

  function revealHint(save: CodeSave, levelId: number): CodeSave {
    const next = clone(save)
    const id = String(levelId)
    next.hints[id] = Math.min(5, (next.hints[id] ?? 0) + 1)
    return next
  }

  function hintStage(save: CodeSave, levelId: number): number {
    return save.hints[String(levelId)] ?? 0
  }

  function setDraft(save: CodeSave, levelId: number, script: string): CodeSave {
    const next = clone(save)
    next.drafts[String(levelId)] = script.slice(0, 200_000)
    return next
  }

  function setPlayerName(save: CodeSave, name: string): CodeSave {
    const next = clone(save)
    const trimmed = name.trim().slice(0, 40)
    next.playerName = trimmed || 'Hunter'
    return next
  }

  function certificateText(moduleName: string, playerName: string, completedDate: string): string {
    const title = ` ${banner} `
    const pad = Math.max(0, 38 - title.length)
    const left = Math.floor(pad / 2)
    const right = pad - left
    const line = `#${' '.repeat(left)}${title}${' '.repeat(right)}#`
    return (
      '########################################\n' +
      `${line}\n` +
      '########################################\n' +
      `Player: ${playerName}\n` +
      `Module: ${moduleName}\n` +
      `Completed: ${completedDate}\n`
    )
  }

  return {
    key,
    empty,
    load,
    write,
    clear,
    levelUnlocked,
    resumeLevelId,
    awardLevel,
    recordFail,
    revealHint,
    hintStage,
    setDraft,
    setPlayerName,
    certificateText,
  }
}
