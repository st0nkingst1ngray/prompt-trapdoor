import { createCodeCatalog } from '../python/catalog'
import { PYITHON_LEVELS, PYITHON_MODULES } from './types'

const catalog = createCodeCatalog(
  { label: 'pyi-thon', levels: PYITHON_LEVELS, modules: PYITHON_MODULES },
  'pyithon/curriculum.json',
)

export const parsePyithonCurriculum = catalog.parse
export const primePyithonCurriculum = catalog.prime
export const resetPyithonCurriculumCache = catalog.reset
export const peekPyithonCurriculum = catalog.peek
export const ensurePyithonCurriculum = catalog.ensure
export const pyithonLevelById = catalog.levelById
export const pyithonModuleById = catalog.moduleById
