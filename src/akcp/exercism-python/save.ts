import { createCodeProgress } from '../python/progress'
import { EXERCISM_PYTHON_LEVELS } from './types'

const progress = createCodeProgress('exercism-python-save-v1', EXERCISM_PYTHON_LEVELS, 'EXERCISM PYTHON CERTIFICATE')

export const EXERCISM_PYTHON_SAVE_KEY = progress.key
export const emptyExercismPythonSave = progress.empty
export const loadExercismPython = progress.load
export const writeExercismPython = progress.write
export const clearExercismPythonSave = progress.clear
export const levelUnlocked = progress.levelUnlocked
export const resumeLevelId = progress.resumeLevelId
export const awardLevel = progress.awardLevel
export const recordExercismFail = progress.recordFail
export const revealHint = progress.revealHint
export const hintStage = progress.hintStage
export const setDraft = progress.setDraft
export const setPlayerName = progress.setPlayerName
export const certificateText = progress.certificateText
