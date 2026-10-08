import { OSMANI_BOOK } from '../books/osmani2026/index'
import { peekCurriculum } from '../bashmissions/catalog'
import { levelUnlocked as bashUnlocked, loadBashMissions, resumeLevelId as bashResume } from '../bashmissions/save'
import { BASH_MISSIONS_LEVELS } from '../bashmissions/types'
import { peekExercismCurriculum } from '../exercism-python/catalog'
import { levelUnlocked as exercismUnlocked, loadExercismPython, resumeLevelId as exercismResume } from '../exercism-python/save'
import { EXERCISM_PYTHON_LEVELS } from '../exercism-python/types'
import { peekPyithonCurriculum } from '../pyithon/catalog'
import { levelUnlocked as pyithonUnlocked, loadPyithon, resumeLevelId as pyithonResume } from '../pyithon/save'
import { PYITHON_LEVELS } from '../pyithon/types'
import { peekKoansCurriculum } from '../python-koans/catalog'
import { levelUnlocked as koansUnlocked, loadPythonKoans, resumeLevelId as koansResume } from '../python-koans/save'
import { PYTHON_KOANS_LEVELS } from '../python-koans/types'
import { loadAkcp } from '../save'
import type { AkcpSection } from '../types'
import type { CodeCurriculum } from '../python/types'
import {
  BACKUP_PATH,
  CREDENTIAL_PATH,
  WORDLIST_PATH,
  backupScriptText,
  credentialText,
  historyText,
  loreText,
  motdText,
  shadowText,
  sudoersText,
  sysadminPromptText,
  wordlistText,
  LESSONS,
} from './rootGame'
import { VFS_HOME } from './save'
import type { AccessState, VfsBookId, VfsBookLayer, VfsDirSpec, VfsEntry, VfsFileSpec, VfsLaunch, VfsPerm, VfsSnapshot } from './types'

const extraLayers: VfsBookLayer[] = []

export function registerVfsBook(layer: VfsBookLayer): void {
  extraLayers.push(layer)
}

export function resetVfsRegistry(): void {
  extraLayers.length = 0
}

export function chapterSlug(id: number): string {
  return `ch${String(id).padStart(2, '0')}`
}

export function missionFileName(prefix: string, id: number): string {
  return `${prefix}-${String(id).padStart(3, '0')}`
}

export function baseName(path: string): string {
  if (path === '/') return '/'
  const index = path.lastIndexOf('/')
  return path.slice(index + 1)
}

export function parentPath(path: string): string {
  if (path === '/') return '/'
  const index = path.lastIndexOf('/')
  return index <= 0 ? '/' : path.slice(0, index)
}

export function resolvePath(cwd: string, input: string): string {
  let raw = input.trim()
  if (raw === '~' || raw.startsWith('~/')) raw = `${VFS_HOME}${raw.slice(1)}`
  const base = raw.startsWith('/') ? raw : `${cwd}/${raw}`
  const parts: string[] = []
  for (const part of base.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

function putDir(entries: Map<string, VfsEntry>, path: string, perm: VfsPerm, hidden = false): void {
  if (path !== '/') {
    const parent = parentPath(path)
    if (!entries.has(parent)) putDir(entries, parent, 'open', false)
  }
  entries.set(path, { path, name: baseName(path), kind: 'dir', hidden, perm })
}

function putFile(
  entries: Map<string, VfsEntry>,
  path: string,
  perm: VfsPerm,
  hidden: boolean,
  body: string,
  launch?: VfsLaunch,
): void {
  const parent = parentPath(path)
  if (!entries.has(parent)) putDir(entries, parent, 'open', false)
  entries.set(path, { path, name: baseName(path), kind: 'file', hidden, perm, body, launch })
}

function addDir(entries: Map<string, VfsEntry>, parent: string, dir: VfsDirSpec): void {
  const path = `${parent}/${dir.name}`
  const locked = dir.locked === true || subtreeLocked(dir)
  putDir(entries, path, locked ? 'locked' : 'open', dir.hidden === true)
  for (const file of dir.files ?? []) {
    const filePerm: VfsPerm = locked || !file.unlocked ? 'locked' : 'open'
    putFile(entries, `${path}/${file.name}`, filePerm, false, file.blurb, file.launch)
  }
  for (const child of dir.dirs ?? []) addDir(entries, path, child)
}

function subtreeLocked(dir: VfsDirSpec): boolean {
  if (dir.locked === true) return true
  const files = dir.files ?? []
  const dirs = dir.dirs ?? []
  if (files.length === 0 && dirs.length === 0) return false
  return files.every((file) => !file.unlocked) && dirs.every((child) => subtreeLocked(child))
}

export function canRead(entry: VfsEntry, state: AccessState): boolean {
  if (state.isRoot) return true
  if (entry.perm === 'root-only') return false
  if (entry.perm === 'open') return true
  return chmodHit(entry.path, state.earlyUnlock)
}

function chmodHit(path: string, early: string[]): boolean {
  for (const item of early) {
    if (path === item) return true
    const prefix = item.endsWith('/') ? item : `${item}/`
    if (path.startsWith(prefix)) return true
  }
  return false
}

export function modeString(entry: VfsEntry, state: AccessState): string {
  const open = canRead(entry, state)
  if (entry.kind === 'dir') return open ? 'drwxr-xr-x' : 'drwx------'
  return open ? '-rw-r--r--' : '-rw-------'
}

export function childrenOf(snapshot: VfsSnapshot, path: string): VfsEntry[] {
  const prefix = path === '/' ? '/' : `${path}/`
  const out: VfsEntry[] = []
  for (const entry of snapshot.entries.values()) {
    if (entry.path === path || !entry.path.startsWith(prefix)) continue
    const rest = entry.path.slice(prefix.length)
    if (!rest.includes('/')) out.push(entry)
  }
  return out
}

export function listChildren(snapshot: VfsSnapshot, path: string, showHidden: boolean): VfsEntry[] {
  return childrenOf(snapshot, path)
    .filter((entry) => showHidden || !entry.hidden)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

function skeleton(entries: Map<string, VfsEntry>): void {
  for (const path of ['/', '/akcp', '/akcp/books', '/home', VFS_HOME, '/etc', '/usr', '/usr/local', '/usr/local/bin', '/tmp']) {
    putDir(entries, path, 'open', false)
  }
  putDir(entries, '/root', 'root-only', false)
  putDir(entries, `${VFS_HOME}/.secrets`, 'open', true)
}

function systemFiles(entries: Map<string, VfsEntry>, progress: string): void {
  putFile(entries, `${VFS_HOME}/.bash_history`, 'open', true, historyText())
  putFile(entries, `${VFS_HOME}/.progress`, 'open', true, progress)
  putFile(entries, WORDLIST_PATH, 'open', false, wordlistText())
  putFile(
    entries,
    `${VFS_HOME}/.secrets/readme`,
    'open',
    false,
    'Bonus: home hides files. ls -a shows .bash_history and .progress.',
  )
  putFile(entries, '/etc/sudoers', 'open', false, sudoersText())
  putFile(entries, '/etc/shadow', 'open', false, shadowText())
  putFile(entries, '/etc/motd', 'open', false, motdText())
  putFile(entries, '/etc/sysadmin.prompt', 'open', false, sysadminPromptText())
  putFile(entries, BACKUP_PATH, 'open', false, backupScriptText())
  putFile(entries, '/root/lore', 'root-only', false, loreText())
  putFile(entries, '/root/debrief-escalation', 'root-only', false, LESSONS.escalation.body)
  putFile(entries, '/root/debrief-brute', 'root-only', false, LESSONS.brute.body)
  putFile(entries, '/root/debrief-injection', 'root-only', false, LESSONS.injection.body)
  putFile(entries, CREDENTIAL_PATH, 'root-only', true, credentialText())
}

function mountLayer(entries: Map<string, VfsEntry>, layer: VfsBookLayer): void {
  const root = `/akcp/books/${layer.mount}`
  putDir(entries, root, 'open', false)
  for (const dir of layer.dirs) addDir(entries, root, dir)
  addDir(entries, root, {
    name: '.secrets',
    hidden: true,
    files: [{ name: 'bonus', blurb: layer.secret, unlocked: true }],
  })
}

export function buildSnapshot(layers: VfsBookLayer[], progress: string): VfsSnapshot {
  const entries = new Map<string, VfsEntry>()
  skeleton(entries)
  systemFiles(entries, progress)
  for (const layer of layers) mountLayer(entries, layer)
  return { entries }
}

function sectionOpen(section: AkcpSection, introDone: boolean): boolean {
  if (section.status !== 'playable') return false
  if (section.id === 'specs') return introDone
  return true
}

function osmaniLayer(): VfsBookLayer {
  const save = loadAkcp()
  const intro = OSMANI_BOOK.chapters.flatMap((chapter) => chapter.sections).find((section) => section.id === 'intro')
  const introDone = intro ? intro.pages.every((page) => save.pagesRead.includes(page.id)) : false
  const dirs: VfsDirSpec[] = []
  for (const chapter of OSMANI_BOOK.chapters) {
    for (const section of chapter.sections) {
      const open = sectionOpen(section, introDone)
      const files: VfsFileSpec[] = section.pages.map((_page, index) => ({
        name: `page-${index + 1}`,
        blurb: `Open ${section.title}, page ${index + 1}.`,
        unlocked: open,
        launch: open ? { book: 'osmani', target: section.id, pageIndex: index } : undefined,
      }))
      if (files.length === 0) {
        files.push({
          name: 'readme',
          blurb: `${section.title} is indexed. A later pass adds the pages.`,
          unlocked: false,
        })
      }
      dirs.push({ name: section.id, locked: !open, files })
    }
  }
  return {
    mount: 'osmani',
    title: OSMANI_BOOK.title,
    secret: 'Bonus: the specs folder stays shut until every intro page is read.',
    dirs,
  }
}

interface LevelBook {
  mount: string
  title: string
  secret: string
  book: VfsBookId
  prefix: string
  modules: { id: number; display: string; levelIds: number[] }[] | null
  titles: Map<number, string>
  unlocked: (id: number) => boolean
}

function levelLayer(input: LevelBook): VfsBookLayer {
  if (!input.modules) {
    return {
      mount: input.mount,
      title: input.title,
      secret: input.secret,
      dirs: [
        {
          name: 'ch01',
          files: [
            {
              name: 'readme',
              blurb: `${input.title} catalog is not loaded yet. The shelf retries, or use the simple list once.`,
              unlocked: true,
            },
          ],
        },
      ],
    }
  }
  const dirs: VfsDirSpec[] = input.modules.map((mod) => ({
    name: chapterSlug(mod.id),
    files: mod.levelIds.map((id) => {
      const unlocked = input.unlocked(id)
      const file = missionFileName(input.prefix, id)
      return {
        name: file,
        blurb: `${file} · ${input.titles.get(id) ?? input.title}. Open the file to launch it.`,
        unlocked,
        launch: unlocked ? { book: input.book, target: String(id) } : undefined,
      }
    }),
  }))
  return { mount: input.mount, title: input.title, secret: input.secret, dirs }
}

function titlesOf(book: { levels: { id: number; title: string }[] } | null): Map<number, string> {
  return new Map((book?.levels ?? []).map((level) => [level.id, level.title]))
}

function codeLayer(
  mount: string,
  title: string,
  secret: string,
  book: VfsBookId,
  prefix: string,
  curriculum: CodeCurriculum | null,
  unlocked: (id: number) => boolean,
): VfsBookLayer {
  return levelLayer({
    mount,
    title,
    secret,
    book,
    prefix,
    modules: curriculum?.modules ?? null,
    titles: titlesOf(curriculum),
    unlocked,
  })
}

export function bookLayersFromRegistry(): VfsBookLayer[] {
  const bash = peekCurriculum()
  const bashSave = loadBashMissions()
  const koanSave = loadPythonKoans()
  const exercismSave = loadExercismPython()
  const pySave = loadPyithon()
  const layers = [
    osmaniLayer(),
    levelLayer({
      mount: 'bash',
      title: 'BashMissions',
      secret: 'Bonus: read ~/.bash_history with ls -a. The backup hook is the weak link.',
      book: 'bash',
      prefix: 'mission',
      modules: bash?.modules ?? null,
      titles: titlesOf(bash),
      unlocked: (id) => bashUnlocked(bashSave, id),
    }),
    codeLayer(
      'python/koans',
      'Python Koans',
      'Bonus: koan folders open one mission at a time, same as the campaign save.',
      'koans',
      'koan',
      peekKoansCurriculum(),
      (id) => koansUnlocked(koanSave, id),
    ),
    codeLayer(
      'python/exercism',
      'Exercism Python',
      'Bonus: exercise folders follow exercism-python-save-v1.',
      'exercism',
      'exercise',
      peekExercismCurriculum(),
      (id) => exercismUnlocked(exercismSave, id),
    ),
    codeLayer(
      'python/pyithon',
      'pyi-thon',
      'Bonus: three phase folders. Level 1 is the only open file on a fresh save.',
      'pyithon',
      'level',
      peekPyithonCurriculum(),
      (id) => pyithonUnlocked(pySave, id),
    ),
    ...extraLayers,
  ]
  return layers
}

export function formatProgress(lines: string[]): string {
  return ['AKCP book saves', ...lines].join('\n')
}

export function liveProgressText(): string {
  const akcp = loadAkcp()
  const bash = loadBashMissions()
  const koans = loadPythonKoans()
  const exercism = loadExercismPython()
  const py = loadPyithon()
  const bashTotal = peekCurriculum()?.levels.length ?? BASH_MISSIONS_LEVELS
  const koanTotal = peekKoansCurriculum()?.levels.length ?? PYTHON_KOANS_LEVELS
  const exercismTotal = peekExercismCurriculum()?.levels.length ?? EXERCISM_PYTHON_LEVELS
  const pyTotal = peekPyithonCurriculum()?.levels.length ?? PYITHON_LEVELS
  return formatProgress([
    `osmani (akcp-save-v1): pages ${akcp.pagesRead.length}, quests ${akcp.clearedQuestIds.length}`,
    `bash (bash-missions-save-v1): cleared ${bash.cleared.length}/${bashTotal}, next ${missionFileName('mission', bashResume(bash, bashTotal))}`,
    `koans (python-koans-save-v1): cleared ${koans.cleared.length}/${koanTotal}, next ${missionFileName('koan', koansResume(koans, koanTotal))}`,
    `exercism (exercism-python-save-v1): cleared ${exercism.cleared.length}/${exercismTotal}, next ${missionFileName('exercise', exercismResume(exercism, exercismTotal))}`,
    `pyithon (pyithon-save-v1): cleared ${py.cleared.length}/${pyTotal}, next ${missionFileName('level', pyithonResume(py, pyTotal))}`,
  ])
}

export function shelfProgress(): string {
  const bash = loadBashMissions()
  const koans = loadPythonKoans()
  const exercism = loadExercismPython()
  const py = loadPyithon()
  return `Bash ${bash.cleared.length}/${BASH_MISSIONS_LEVELS} · Koans ${koans.cleared.length}/${PYTHON_KOANS_LEVELS} · Exercism ${exercism.cleared.length}/${EXERCISM_PYTHON_LEVELS} · pyi-thon ${py.cleared.length}/${PYITHON_LEVELS}`
}

export interface ContinueTarget {
  id: string
  label: string
  launch: VfsLaunch
}

export function continueTargets(): ContinueTarget[] {
  const bash = loadBashMissions()
  const koans = loadPythonKoans()
  const exercism = loadExercismPython()
  const py = loadPyithon()
  const bashTotal = peekCurriculum()?.levels.length ?? BASH_MISSIONS_LEVELS
  const koanTotal = peekKoansCurriculum()?.levels.length ?? PYTHON_KOANS_LEVELS
  const exercismTotal = peekExercismCurriculum()?.levels.length ?? EXERCISM_PYTHON_LEVELS
  const pyTotal = peekPyithonCurriculum()?.levels.length ?? PYITHON_LEVELS
  const bashId = bashResume(bash, bashTotal)
  const koanId = koansResume(koans, koanTotal)
  const exercismId = exercismResume(exercism, exercismTotal)
  const pyId = pyithonResume(py, pyTotal)
  const bashTitle = peekCurriculum()?.levels[bashId - 1]?.title
  const koanTitle = peekKoansCurriculum()?.levels[koanId - 1]?.title
  const exercismTitle = peekExercismCurriculum()?.levels[exercismId - 1]?.title
  const pyTitle = peekPyithonCurriculum()?.levels[pyId - 1]?.title
  const osmani = osmaniContinue()
  return [
    osmani,
    { id: 'bash', label: `Bash · ${bashTitle ?? missionFileName('mission', bashId)}`, launch: { book: 'bash', target: String(bashId) } },
    { id: 'koans', label: `Koans · ${koanTitle ?? missionFileName('koan', koanId)}`, launch: { book: 'koans', target: String(koanId) } },
    { id: 'exercism', label: `Exercism · ${exercismTitle ?? missionFileName('exercise', exercismId)}`, launch: { book: 'exercism', target: String(exercismId) } },
    { id: 'pyithon', label: `pyi-thon · ${pyTitle ?? missionFileName('level', pyId)}`, launch: { book: 'pyithon', target: String(pyId) } },
  ]
}

function osmaniContinue(): ContinueTarget {
  const save = loadAkcp()
  const intro = OSMANI_BOOK.chapters.flatMap((chapter) => chapter.sections).find((section) => section.id === 'intro')
  const introDone = intro ? intro.pages.every((page) => save.pagesRead.includes(page.id)) : false
  for (const section of OSMANI_BOOK.chapters.flatMap((chapter) => chapter.sections)) {
    if (!sectionOpen(section, introDone) || section.pages.length === 0) continue
    const unread = section.pages.findIndex((page) => !save.pagesRead.includes(page.id))
    const pageIndex = unread >= 0 ? unread : 0
    return {
      id: 'osmani',
      label: `Osmani · ${section.title}`,
      launch: { book: 'osmani', target: section.id, pageIndex },
    }
  }
  return { id: 'osmani', label: 'Osmani · Introduction', launch: { book: 'osmani', target: 'intro', pageIndex: 0 } }
}

export function buildLiveSnapshot(): VfsSnapshot {
  return buildSnapshot(bookLayersFromRegistry(), liveProgressText())
}

export function findEntries(snapshot: VfsSnapshot, state: AccessState, term: string): VfsEntry[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return []
  const hits: VfsEntry[] = []
  for (const entry of snapshot.entries.values()) {
    if (entry.path === '/') continue
    if (!canRead(entry, state)) continue
    const parent = snapshot.entries.get(parentPath(entry.path))
    if (parent && !canRead(parent, state)) continue
    const hay = `${entry.path} ${entry.name} ${entry.body ?? ''}`.toLowerCase()
    if (hay.includes(needle)) hits.push(entry)
    if (hits.length >= 30) break
  }
  return hits.sort((a, b) => a.path.localeCompare(b.path))
}
