import fs from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseExercismCurriculum } from '../src/akcp/exercism-python/catalog'
import {
  EXERCISM_PYTHON_SAVE_KEY,
  awardLevel as awardExercism,
  certificateText as exercismCertificate,
  clearExercismPythonSave,
  emptyExercismPythonSave,
  hintStage as exercismHintStage,
  levelUnlocked as exercismUnlocked,
  loadExercismPython,
  recordExercismFail,
  resumeLevelId as exercismResume,
  revealHint as revealExercism,
  writeExercismPython,
} from '../src/akcp/exercism-python/save'
import { parseKoansCurriculum } from '../src/akcp/python-koans/catalog'
import {
  PYTHON_KOANS_SAVE_KEY,
  awardLevel as awardKoan,
  certificateText as koanCertificate,
  clearPythonKoansSave,
  emptyPythonKoansSave,
  levelUnlocked as koanUnlocked,
  loadPythonKoans,
  resumeLevelId as koanResume,
  writePythonKoans,
} from '../src/akcp/python-koans/save'
import { parsePyithonCurriculum } from '../src/akcp/pyithon/catalog'
import {
  PYITHON_SAVE_KEY,
  awardLevel as awardPyithon,
  certificateText as pyithonCertificate,
  clearPyithonSave,
  emptyPyithonSave,
  hintStage as pyithonHintStage,
  levelUnlocked as pyithonUnlocked,
  loadPyithon,
  recordPyithonFail,
  resumeLevelId as pyithonResume,
  revealHint as revealPyithon,
  writePyithon,
} from '../src/akcp/pyithon/save'

const koans = parseKoansCurriculum(JSON.parse(fs.readFileSync('public/python-koans/curriculum.json', 'utf8')))
const exercism = parseExercismCurriculum(JSON.parse(fs.readFileSync('public/exercism-python/curriculum.json', 'utf8')))
const pyithon = parsePyithonCurriculum(JSON.parse(fs.readFileSync('public/pyithon/curriculum.json', 'utf8')))

beforeEach(() => localStorage.clear())

describe('python book saves', () => {
  it('keeps three separate keys and leaves the other campaigns alone', () => {
    localStorage.setItem('akcp-save-v1', 'osmani')
    localStorage.setItem('bash-missions-save-v1', 'bash')
    localStorage.setItem('hunter-association-save-v1', 'rank')
    writePythonKoans({ ...emptyPythonKoansSave(), xp: 40, cleared: [1], playerName: 'Ada' })
    writeExercismPython({ ...emptyExercismPythonSave(), xp: 80, cleared: [1] })
    writePyithon({ ...emptyPyithonSave(), xp: 40, cleared: [1] })
    expect(loadPythonKoans().xp).toBe(40)
    expect(loadPythonKoans().playerName).toBe('Ada')
    expect(loadExercismPython().xp).toBe(80)
    expect(loadPyithon().cleared).toEqual([1])
    expect(localStorage.getItem('akcp-save-v1')).toBe('osmani')
    expect(localStorage.getItem('bash-missions-save-v1')).toBe('bash')
    expect(localStorage.getItem('hunter-association-save-v1')).toBe('rank')
    localStorage.setItem(PYTHON_KOANS_SAVE_KEY, '{')
    expect(loadPythonKoans()).toEqual(emptyPythonKoansSave())
    clearPythonKoansSave()
    clearExercismPythonSave()
    clearPyithonSave()
    expect(localStorage.getItem(PYTHON_KOANS_SAVE_KEY)).toBeNull()
    expect(localStorage.getItem(EXERCISM_PYTHON_SAVE_KEY)).toBeNull()
    expect(localStorage.getItem(PYITHON_SAVE_KEY)).toBeNull()
    expect(localStorage.getItem('akcp-save-v1')).toBe('osmani')
  })

  it('unlocks the next mission, awards xp once, and certificates a finished module', () => {
    expect(koanUnlocked(emptyPythonKoansSave(), 1)).toBe(true)
    expect(koanUnlocked(emptyPythonKoansSave(), 2)).toBe(false)
    expect(koanResume(emptyPythonKoansSave())).toBe(1)
    const mod = koans.modules[0]
    let save = emptyPythonKoansSave()
    for (const id of mod.levelIds) {
      const level = koans.levels[id - 1]
      const awarded = awardKoan(save, {
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
    expect(koanCertificate(mod.display, 'Hunter', '2026-10-06')).toContain('PYTHON KOANS CERTIFICATE')
    expect(koanUnlocked(save, mod.levelIds[mod.levelIds.length - 1] + 1)).toBe(true)
    const again = awardKoan(save, {
      levelId: 1,
      xp: 40,
      moduleId: 1,
      moduleLevelIds: mod.levelIds,
      today: '2026-10-06',
    })
    expect(again.xpGained).toBe(0)

    const practice = exercism.modules[1]
    let exercise = emptyExercismPythonSave()
    expect(exercismUnlocked(exercise, practice.levelIds[0])).toBe(false)
    const firstConcept = exercism.modules[0]
    for (const id of firstConcept.levelIds) {
      exercise = awardExercism(exercise, {
        levelId: id,
        xp: exercism.levels[id - 1].xp,
        moduleId: firstConcept.id,
        moduleLevelIds: firstConcept.levelIds,
        today: '2026-10-06',
      }).save
    }
    expect(exercise.certifiedOn['1']).toBe('2026-10-06')
    expect(exercismCertificate('Concept track', 'Hunter', '2026-10-06')).toContain('EXERCISM PYTHON CERTIFICATE')
    expect(exercismUnlocked(exercise, firstConcept.levelIds[firstConcept.levelIds.length - 1] + 1)).toBe(true)
    expect(exercismResume(exercise)).toBe(firstConcept.levelIds.length + 1)
    exercise = revealExercism(exercise, 3)
    exercise = recordExercismFail(exercise, 3)
    writeExercismPython(exercise)
    expect(exercismHintStage(loadExercismPython(), 3)).toBe(1)
    expect(loadExercismPython().fails['3']).toBe(1)

    const phase = pyithon.modules[2]
    let python = emptyPyithonSave()
    expect(pyithonUnlocked(python, 2)).toBe(false)
    for (let id = 1; id <= pyithon.levels.length; id += 1) {
      const awarded = awardPyithon(python, {
        levelId: id,
        xp: pyithon.levels[id - 1].xp,
        moduleId: pyithon.levels[id - 1].module,
        moduleLevelIds: pyithon.modules[pyithon.levels[id - 1].module - 1].levelIds,
        today: '2026-10-06',
      })
      python = awarded.save
      if (id === phase.levelIds[phase.levelIds.length - 1]) expect(awarded.certificate).toBe(true)
    }
    expect(python.certifiedOn['3']).toBe('2026-10-06')
    expect(pyithonCertificate(phase.display, 'Hunter', '2026-10-06')).toContain(phase.display)
    expect(pyithonResume(python)).toBe(30)
    python = revealPyithon(revealPyithon(python, 2), 2)
    python = recordPyithonFail(python, 2)
    writePyithon(python)
    expect(pyithonHintStage(loadPyithon(), 2)).toBe(2)
    expect(loadPyithon().fails['2']).toBe(1)
    localStorage.setItem(PYITHON_SAVE_KEY, JSON.stringify({ version: 1, cleared: [1, 0, 501], xp: 1 }))
    expect(loadPyithon().cleared).toEqual([1])
  })

  it('registers the published curriculum sizes', () => {
    expect(koans.levels).toHaveLength(278)
    expect(koans.modules).toHaveLength(37)
    expect(koans.source.license).toBe('MIT')
    expect(exercism.levels).toHaveLength(149)
    expect(exercism.modules).toHaveLength(10)
    expect(exercism.source.url).toContain('exercism/python')
    expect(pyithon.levels).toHaveLength(30)
    expect(pyithon.modules).toHaveLength(3)
    expect(pyithon.levels[0]?.tests).toEqual(['stdout'])
    expect(() => parseKoansCurriculum({ ...koans, levels: koans.levels.slice(0, 2) })).toThrow(/278/)
  })
})
