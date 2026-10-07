import { createCodeProgress } from '../python/progress'
import { PYITHON_LEVELS } from './types'

const progress = createCodeProgress('pyithon-save-v1', PYITHON_LEVELS, 'PYI-THON CERTIFICATE')

export const PYITHON_SAVE_KEY = progress.key
export const emptyPyithonSave = progress.empty
export const loadPyithon = progress.load
export const writePyithon = progress.write
export const clearPyithonSave = progress.clear
export const levelUnlocked = progress.levelUnlocked
export const resumeLevelId = progress.resumeLevelId
export const awardLevel = progress.awardLevel
export const recordPyithonFail = progress.recordFail
export const revealHint = progress.revealHint
export const hintStage = progress.hintStage
export const setDraft = progress.setDraft
export const setPlayerName = progress.setPlayerName
export const certificateText = progress.certificateText
