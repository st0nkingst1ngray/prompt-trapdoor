import { createCodeCatalog } from '../python/catalog'
import { EXERCISM_PYTHON_LEVELS, EXERCISM_PYTHON_MODULES } from './types'

const catalog = createCodeCatalog(
  { label: 'Exercism Python', levels: EXERCISM_PYTHON_LEVELS, modules: EXERCISM_PYTHON_MODULES },
  'exercism-python/curriculum.json',
)

export const parseExercismCurriculum = catalog.parse
export const primeExercismCurriculum = catalog.prime
export const resetExercismCurriculumCache = catalog.reset
export const peekExercismCurriculum = catalog.peek
export const ensureExercismCurriculum = catalog.ensure
export const exercismLevelById = catalog.levelById
export const exercismModuleById = catalog.moduleById
