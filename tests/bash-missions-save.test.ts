import fs from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseCurriculum } from '../src/akcp/bashmissions/catalog'
import {
  BASH_MISSIONS_SAVE_KEY,
  awardLevel,
  certificateText,
  clearBashMissionsSave,
  emptyBashMissionsSave,
  hintStage,
  levelUnlocked,
  loadBashMissions,
  recordBashFail,
  resumeLevelId,
  revealHint,
  writeBashMissions,
} from '../src/akcp/bashmissions/save'

const curriculum = parseCurriculum(JSON.parse(fs.readFileSync('public/bashmissions/curriculum.json', 'utf8')))

beforeEach(() => localStorage.clear())

describe('bashmissions save', () => {
  it('round-trips progress and ignores corrupt json', () => {
    const save = emptyBashMissionsSave()
    save.cleared = [1]
    save.xp = 60
    save.playerName = 'Ada'
    writeBashMissions(save)
    expect(loadBashMissions().xp).toBe(60)
    expect(loadBashMissions().playerName).toBe('Ada')
    localStorage.setItem(BASH_MISSIONS_SAVE_KEY, '{')
    expect(loadBashMissions()).toEqual(emptyBashMissionsSave())
  })

  it('unlocks the next level, awards xp once, and certificates a finished module', () => {
    let save = emptyBashMissionsSave()
    expect(levelUnlocked(save, 1)).toBe(true)
    expect(levelUnlocked(save, 2)).toBe(false)
    expect(resumeLevelId(save)).toBe(1)
    const first = awardLevel(save, {
      levelId: 1,
      xp: 60,
      moduleId: 1,
      moduleLevelIds: curriculum.modules[0].levelIds,
      today: '2026-10-06',
    })
    save = first.save
    expect(first.xpGained).toBe(60)
    expect(first.certificate).toBe(false)
    expect(levelUnlocked(save, 2)).toBe(true)
    expect(levelUnlocked(save, 3)).toBe(false)
    expect(resumeLevelId(save)).toBe(2)
    const again = awardLevel(save, {
      levelId: 1,
      xp: 60,
      moduleId: 1,
      moduleLevelIds: curriculum.modules[0].levelIds,
      today: '2026-10-06',
    })
    expect(again.xpGained).toBe(0)
    expect(again.save.xp).toBe(60)

    const mod = curriculum.modules[0]
    for (const id of mod.levelIds) {
      if (save.cleared.includes(id)) continue
      const level = curriculum.levels[id - 1]
      const awarded = awardLevel(save, {
        levelId: id,
        xp: level.xp,
        moduleId: mod.id,
        moduleLevelIds: mod.levelIds,
        today: '2026-10-06',
      })
      save = awarded.save
      expect(awarded.certificate).toBe(id === mod.levelIds[mod.levelIds.length - 1])
    }
    expect(save.certifiedOn['1']).toBe('2026-10-06')
    expect(certificateText(mod.display, 'Hunter', '2026-10-06')).toContain(mod.display)
    expect(levelUnlocked(save, mod.levelIds[mod.levelIds.length - 1] + 1)).toBe(true)
  })

  it('stores hint stage and fails without touching other save keys', () => {
    localStorage.setItem('akcp-save-v1', 'osmani')
    localStorage.setItem('hunter-association-save-v1', 'rank')
    let save = revealHint(emptyBashMissionsSave(), 4)
    save = recordBashFail(save, 4)
    writeBashMissions(save)
    expect(hintStage(loadBashMissions(), 4)).toBe(1)
    expect(loadBashMissions().fails['4']).toBe(1)
    clearBashMissionsSave()
    expect(localStorage.getItem(BASH_MISSIONS_SAVE_KEY)).toBeNull()
    expect(localStorage.getItem('akcp-save-v1')).toBe('osmani')
    expect(localStorage.getItem('hunter-association-save-v1')).toBe('rank')
  })
})
