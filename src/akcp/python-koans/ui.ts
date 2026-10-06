import { mountCodeBook, unmountCodeBook, type CodeBookCallbacks } from '../python/bookUi'
import { ensureKoansCurriculum, koanLevelById, koanModuleById } from './catalog'
import { gradePythonKoans } from './grade'
import {
  PYTHON_KOANS_SAVE_KEY,
  awardLevel,
  certificateText,
  hintStage,
  levelUnlocked,
  loadPythonKoans,
  recordKoanFail,
  resumeLevelId,
  revealHint,
  setDraft,
  setPlayerName,
  writePythonKoans,
} from './save'

const PREFIX = 'koan'

export function mountPythonKoans(root: HTMLElement, callbacks: CodeBookCallbacks): void {
  mountCodeBook(root, callbacks, {
    prefix: PREFIX,
    title: 'Python Koans',
    eyebrow: 'AKCP book · Python',
    blurb: '278 missions. Make one failing test pass, then take the next hint if you need it.',
    credit: 'Python Koans by Greg Malcolm and The Status Is Not Quo · MIT License · github.com/gregmalcolm/python_koans',
    sim: 'Training sim. Your code runs in a local browser sandbox. The first Check downloads Python (Pyodide) from jsDelivr and caches it in this browser. Your code has no network and is not sent to a server.',
    guideLabel: 'Koans guide',
    campaignDone: 'Campaign complete. 278 koans cleared.',
    constraints: 'Make the named test pass. Local Python. No network.',
    saveKey: PYTHON_KOANS_SAVE_KEY,
    load: loadPythonKoans,
    write: writePythonKoans,
    awardLevel,
    recordFail: recordKoanFail,
    revealHint,
    hintStage,
    setDraft,
    setPlayerName,
    levelUnlocked,
    resumeLevelId,
    certificateText,
    ensureCurriculum: ensureKoansCurriculum,
    levelById: koanLevelById,
    moduleById: koanModuleById,
    grade: gradePythonKoans,
  })
}

export function unmountPythonKoans(): void {
  unmountCodeBook(PREFIX)
}
