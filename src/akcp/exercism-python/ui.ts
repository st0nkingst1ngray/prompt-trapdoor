import { mountCodeBook, unmountCodeBook, type CodeBookCallbacks } from '../python/bookUi'
import { ensureExercismCurriculum, exercismLevelById, exercismModuleById } from './catalog'
import { gradeExercismPython } from './grade'
import {
  EXERCISM_PYTHON_SAVE_KEY,
  awardLevel,
  certificateText,
  hintStage,
  levelUnlocked,
  loadExercismPython,
  recordExercismFail,
  resumeLevelId,
  revealHint,
  setDraft,
  setPlayerName,
  writeExercismPython,
} from './save'

const PREFIX = 'expy'

export function mountExercismPython(root: HTMLElement, callbacks: CodeBookCallbacks): void {
  mountCodeBook(root, callbacks, {
    prefix: PREFIX,
    title: 'Exercism Python',
    eyebrow: 'AKCP book · Python',
    blurb: '149 exercises. Concept track first, then practice by difficulty. Write the function, then Check.',
    credit: 'Exercism Python track · MIT License · github.com/exercism/python',
    sim: 'Training sim. Your code runs in a local browser sandbox. The first Check downloads Python (Pyodide) from jsDelivr and caches it in this browser. Your code has no network and is not sent to a server.',
    guideLabel: 'Track guide',
    campaignDone: 'Campaign complete. 149 exercises cleared.',
    constraints: 'The included tests must pass. Local Python. No network.',
    saveKey: EXERCISM_PYTHON_SAVE_KEY,
    load: loadExercismPython,
    write: writeExercismPython,
    awardLevel,
    recordFail: recordExercismFail,
    revealHint,
    hintStage,
    setDraft,
    setPlayerName,
    levelUnlocked,
    resumeLevelId,
    certificateText,
    ensureCurriculum: ensureExercismCurriculum,
    levelById: exercismLevelById,
    moduleById: exercismModuleById,
    grade: gradeExercismPython,
  })
}

export function unmountExercismPython(): void {
  unmountCodeBook(PREFIX)
}
