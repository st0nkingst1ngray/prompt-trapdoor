import { describe, expect, it } from 'vitest'
import { coverageGaps, triviaHits } from '../src/akcp/coverage'
import { LOCKED_SECTION_IDS, OSMANI_BOOK } from '../src/akcp/books/osmani2026/index'
import type { AkcpBook, AkcpSection } from '../src/akcp/types'

function section(partial: Partial<AkcpSection> & Pick<AkcpSection, 'id'>): AkcpSection {
  return {
    title: partial.id,
    stat: 'planning',
    status: 'playable',
    questRequired: true,
    paragraphs: [],
    pages: [],
    steps: [],
    boss: null,
    ...partial,
  }
}

function book(sections: AkcpSection[]): AkcpBook {
  return {
    id: 'fixture',
    title: 'Fixture',
    sourceLabel: 'fixture',
    chapters: [{ id: 'c', title: 'C', sections }],
  }
}

describe('akcp coverage', () => {
  it('locks the twelve Osmani section ids in reading order', () => {
    expect(LOCKED_SECTION_IDS).toEqual([
      'intro', 'specs', 'chunks', 'context', 'models', 'lifecycle',
      'human', 'commits', 'rules', 'testing', 'learn', 'conclusion',
    ])
    expect(OSMANI_BOOK.chapters[0].sections.map((s) => s.id)).toEqual([...LOCKED_SECTION_IDS])
  })

  it('flags a playable paragraph that is on no page and in no quest', () => {
    const gaps = coverageGaps(book([
      section({
        id: 'specs',
        paragraphs: [{ id: 'specs.p1', text: "Don't just throw wishes at the model." }],
        pages: [],
        steps: [],
        boss: null,
      }),
    ]))
    expect(gaps.map((g) => g.code)).toContain('paragraph-not-on-page')
    expect(gaps.map((g) => g.code)).toContain('playable-without-boss')
  })

  it('accepts a playable section whose paragraphs are paged and covered', () => {
    const gaps = coverageGaps(book([
      section({
        id: 'specs',
        paragraphs: [{ id: 'specs.p1', text: "Don't just throw wishes" }],
        pages: [{ id: 'specs.page.1', paragraphId: 'specs.p1' }],
        steps: [
          {
            id: 'specs-order',
            kind: 'order',
            title: 'Order',
            goal: 'Order the workflow',
            constraints: 'Technical decision. 5 attempts.',
            nextAction: 'Submit the order',
            tip: 'Spec before codegen.',
            covers: ['specs.p1'],
            stat: 'planning',
            maxAttempts: 5,
            steps: [
              { id: 'ask', label: 'Ask' },
              { id: 'code', label: 'Code' },
            ],
            correct: ['ask', 'code'],
          },
          {
            id: 'specs-checklist',
            kind: 'checklist',
            title: 'Check',
            goal: 'Flag the broken plan',
            constraints: 'Technical decision. 5 attempts.',
            nextAction: 'Submit the flags',
            tip: 'A plan names the tests.',
            covers: ['specs.p1'],
            stat: 'planning',
            maxAttempts: 5,
            options: [{ id: 'no-tests', label: 'Testing strategy is missing' }],
            correct: ['no-tests'],
          },
        ],
        boss: {
          id: 'specs-boss',
          title: 'Boss',
          stat: 'planning',
          covers: ['specs.p1'],
          maxAttempts: 5,
          beats: [],
        },
      }),
    ]))
    expect(gaps).toEqual([])
  })

  it('flags trivia prompts', () => {
    const hits = triviaHits(book([
      section({
        id: 'specs',
        questRequired: false,
        status: 'indexed',
        steps: [{
          id: 'bad',
          kind: 'checklist',
          title: 'Bad',
          goal: 'What year did the author write this?',
          constraints: '',
          nextAction: '',
          tip: '',
          covers: [],
          stat: 'planning',
          maxAttempts: 5,
          options: [{ id: 'a', label: 'name the author' }],
          correct: ['a'],
        }],
      }),
    ]))
    expect(hits.length).toBeGreaterThan(0)
  })
})
