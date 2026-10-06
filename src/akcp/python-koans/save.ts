import { createCodeProgress } from '../python/progress'
import { PYTHON_KOANS_LEVELS } from './types'

const progress = createCodeProgress('python-koans-save-v1', PYTHON_KOANS_LEVELS, 'PYTHON KOANS CERTIFICATE')

export const PYTHON_KOANS_SAVE_KEY = progress.key
export const emptyPythonKoansSave = progress.empty
export const loadPythonKoans = progress.load
export const writePythonKoans = progress.write
export const clearPythonKoansSave = progress.clear
export const levelUnlocked = progress.levelUnlocked
export const resumeLevelId = progress.resumeLevelId
export const awardLevel = progress.awardLevel
export const recordKoanFail = progress.recordFail
export const revealHint = progress.revealHint
export const hintStage = progress.hintStage
export const setDraft = progress.setDraft
export const setPlayerName = progress.setPlayerName
export const certificateText = progress.certificateText
