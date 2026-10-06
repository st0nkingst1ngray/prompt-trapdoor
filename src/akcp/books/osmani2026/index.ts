import type { AkcpBook } from '../../types'
import { indexedSection } from './stubs'

export const LOCKED_SECTION_IDS = [
  'intro',
  'specs',
  'chunks',
  'context',
  'models',
  'lifecycle',
  'human',
  'commits',
  'rules',
  'testing',
  'learn',
  'conclusion',
] as const

const SECTION_TITLES: Record<(typeof LOCKED_SECTION_IDS)[number], string> = {
  intro: 'Introduction',
  specs: 'Start with a clear plan',
  chunks: 'Break work into small, iterative chunks',
  context: 'Provide extensive context and guidance',
  models: 'Choose the right model',
  lifecycle: 'Leverage AI coding across the lifecycle',
  human: 'Keep a human in the loop',
  commits: 'Commit often and use version control',
  rules: 'Customize behavior with rules and examples',
  testing: 'Embrace testing and automation',
  learn: 'Continuously learn and adapt',
  conclusion: 'Conclusion',
}

export const OSMANI_BOOK: AkcpBook = {
  id: 'osmani-llm-workflow-2026',
  title: 'My LLM coding workflow going into 2026',
  sourceLabel: 'Addy Osmani, My LLM coding workflow going into 2026, 4 January 2026',
  chapters: [
    {
      id: 'workflow-2026',
      title: 'My LLM coding workflow going into 2026',
      sections: LOCKED_SECTION_IDS.map((id) => indexedSection(id, SECTION_TITLES[id], id !== 'intro')),
    },
  ],
}

export const ACTIVE_BOOK = OSMANI_BOOK
