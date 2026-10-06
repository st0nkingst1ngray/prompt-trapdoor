import { createCodeCatalog } from '../python/catalog'
import { PYTHON_KOANS_LEVELS, PYTHON_KOANS_MODULES } from './types'

const catalog = createCodeCatalog(
  { label: 'Python Koans', levels: PYTHON_KOANS_LEVELS, modules: PYTHON_KOANS_MODULES },
  'python-koans/curriculum.json',
)

export const parseKoansCurriculum = catalog.parse
export const primeKoansCurriculum = catalog.prime
export const resetKoansCurriculumCache = catalog.reset
export const peekKoansCurriculum = catalog.peek
export const ensureKoansCurriculum = catalog.ensure
export const koanLevelById = catalog.levelById
export const koanModuleById = catalog.moduleById
