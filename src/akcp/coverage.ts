import type { AkcpActivity, AkcpBook, AkcpSection } from './types'

export interface CoverageGap {
  sectionId: string
  code:
    | 'paragraph-not-on-page'
    | 'paragraph-not-in-quest'
    | 'page-unknown-paragraph'
    | 'playable-without-boss'
    | 'playable-quest-count'
    | 'bad-kind'
    | 'exempt-not-allowed'
    | 'indexed-has-body'
  detail: string
}

const EXEMPT_IDS = new Set(['conclusion.p5'])
const TRIVIA = [
  /who said/i,
  /who wrote/i,
  /what year/i,
  /what percentage/i,
  /name the author/i,
  /which company/i,
  /waterfall in 15/i,
  /90%/,
  /O'Reilly/,
]

function activities(section: AkcpSection): AkcpActivity[] {
  return [...section.steps, ...(section.boss?.beats ?? [])]
}

export function coverageGaps(book: AkcpBook): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const chapter of book.chapters) {
    for (const section of chapter.sections) {
      if (section.status === 'indexed') {
        if (section.paragraphs.length || section.steps.length || section.boss) {
          gaps.push({
            sectionId: section.id,
            code: 'indexed-has-body',
            detail: 'Indexed sections stay empty until their pass.',
          })
        }
        continue
      }
      const pageIds = new Set(section.pages.map((p) => p.paragraphId))
      const covered = new Set<string>([
        ...section.steps.flatMap((s) => s.covers),
        ...(section.boss?.covers ?? []),
        ...((section.boss?.beats ?? []).flatMap((b) => b.covers)),
      ])
      for (const page of section.pages) {
        if (!section.paragraphs.some((p) => p.id === page.paragraphId)) {
          gaps.push({
            sectionId: section.id,
            code: 'page-unknown-paragraph',
            detail: page.id,
          })
        }
      }
      for (const paragraph of section.paragraphs) {
        if (!pageIds.has(paragraph.id)) {
          gaps.push({
            sectionId: section.id,
            code: 'paragraph-not-on-page',
            detail: paragraph.id,
          })
        }
        const exempt = paragraph.questExempt === true
        if (exempt && !EXEMPT_IDS.has(paragraph.id)) {
          gaps.push({
            sectionId: section.id,
            code: 'exempt-not-allowed',
            detail: paragraph.id,
          })
        }
        if (!exempt && section.questRequired && !covered.has(paragraph.id)) {
          gaps.push({
            sectionId: section.id,
            code: 'paragraph-not-in-quest',
            detail: paragraph.id,
          })
        }
      }
      if (section.questRequired) {
        if (!section.boss) {
          gaps.push({ sectionId: section.id, code: 'playable-without-boss', detail: section.id })
        }
        if (section.steps.length < 2 || section.steps.length > 3) {
          gaps.push({
            sectionId: section.id,
            code: 'playable-quest-count',
            detail: String(section.steps.length),
          })
        }
      }
      for (const activity of activities(section)) {
        if (activity.kind !== 'order' && activity.kind !== 'transcript' && activity.kind !== 'checklist') {
          gaps.push({ sectionId: section.id, code: 'bad-kind', detail: activity.id })
        }
      }
    }
  }
  return gaps
}

export function triviaHits(book: AkcpBook): string[] {
  const hits: string[] = []
  const scan = (id: string, value: string) => {
    if (TRIVIA.some((re) => re.test(value))) hits.push(id)
  }
  for (const chapter of book.chapters) {
    for (const section of chapter.sections) {
      const list = [...section.steps, ...(section.boss?.beats ?? [])]
      for (const activity of list) {
        scan(activity.id, activity.goal)
        scan(activity.id, activity.tip)
        if (activity.kind === 'transcript') {
          for (const line of activity.lines) scan(activity.id, line.text)
        }
        if (activity.kind === 'checklist') {
          for (const option of activity.options) scan(activity.id, option.label)
        }
        if (activity.kind === 'order') {
          for (const step of activity.steps) scan(activity.id, step.label)
        }
      }
    }
  }
  return hits
}
