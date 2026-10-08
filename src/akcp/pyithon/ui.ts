import { mountCodeBook, unmountCodeBook, type CodeBookCallbacks } from '../python/bookUi'
import { ensurePyithonCurriculum, pyithonLevelById, pyithonModuleById } from './catalog'
import { gradePyithon } from './grade'
import {
  PYITHON_SAVE_KEY,
  awardLevel,
  certificateText,
  hintStage,
  levelUnlocked,
  loadPyithon,
  recordPyithonFail,
  resumeLevelId,
  revealHint,
  setDraft,
  setPlayerName,
  writePyithon,
} from './save'

const PREFIX = 'pyi'

export function mountPyithon(root: HTMLElement, callbacks: CodeBookCallbacks, start?: { levelId?: number }): void {
  mountCodeBook(root, callbacks, {
    prefix: PREFIX,
    title: 'pyi-thon',
    eyebrow: 'AKCP book · Python',
    blurb: '30 levels, three phases. Print the expected output. Hints stay one step ahead of the answer.',
    credit: 'pyi-thon by Edward Yi · MIT License · github.com/aiedwardyi/pyi-thon',
    sim: 'Training sim. Your code runs in a local browser sandbox. The first Check downloads Python (Pyodide) from jsDelivr and caches it in this browser. Your code has no network and is not sent to a server.',
    guideLabel: 'pyi-thon guide',
    campaignDone: 'Campaign complete. 30 levels cleared.',
    constraints: 'Match the printed output. Use the concept the mission asks for.',
    saveKey: PYITHON_SAVE_KEY,
    load: loadPyithon,
    write: writePyithon,
    awardLevel,
    recordFail: recordPyithonFail,
    revealHint,
    hintStage,
    setDraft,
    setPlayerName,
    levelUnlocked,
    resumeLevelId,
    certificateText,
    ensureCurriculum: ensurePyithonCurriculum,
    levelById: pyithonLevelById,
    moduleById: pyithonModuleById,
    grade: gradePyithon,
    startLevelId: start?.levelId,
  })
}

export function unmountPyithon(): void {
  unmountCodeBook(PREFIX)
}
