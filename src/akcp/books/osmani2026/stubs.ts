import type { AkcpSection } from '../../types'

/** Indexed sections stay empty until their own pass flips them to playable. */
export function indexedSection(id: string, title: string, questRequired: boolean): AkcpSection {
  return {
    id,
    title,
    stat: null,
    status: 'indexed',
    questRequired,
    paragraphs: [],
    pages: [],
    steps: [],
    boss: null,
  }
}
