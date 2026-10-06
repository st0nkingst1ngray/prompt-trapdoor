export type AkcpStatId =
  | 'planning'
  | 'context'
  | 'verification'
  | 'versionControl'
  | 'testing'
  | 'adaptation'

export type AkcpQuestKind = 'order' | 'transcript' | 'checklist'

export interface AkcpParagraph {
  id: string
  text: string
  /** True only for conclusion.p5 (the book promo). */
  questExempt?: boolean
}

export interface AkcpPage {
  id: string
  paragraphId: string
}

export interface AkcpOrderStep {
  id: string
  label: string
}

export interface AkcpLine {
  id: string
  speaker: 'user' | 'agent'
  text: string
  mark: 'keep' | 'stop'
}

export interface AkcpOption {
  id: string
  label: string
}

interface AkcpActivityBase {
  id: string
  title: string
  goal: string
  constraints: string
  nextAction: string
  tip: string
  covers: string[]
  stat: AkcpStatId
  maxAttempts: number
}

export interface AkcpOrderActivity extends AkcpActivityBase {
  kind: 'order'
  steps: AkcpOrderStep[]
  correct: string[]
}

export interface AkcpTranscriptActivity extends AkcpActivityBase {
  kind: 'transcript'
  lines: AkcpLine[]
}

export interface AkcpChecklistActivity extends AkcpActivityBase {
  kind: 'checklist'
  options: AkcpOption[]
  correct: string[]
}

export type AkcpActivity = AkcpOrderActivity | AkcpTranscriptActivity | AkcpChecklistActivity

export interface AkcpBoss {
  id: string
  title: string
  stat: AkcpStatId
  covers: string[]
  maxAttempts: number
  beats: AkcpActivity[]
}

export interface AkcpSection {
  id: string
  title: string
  stat: AkcpStatId | null
  status: 'playable' | 'indexed'
  questRequired: boolean
  paragraphs: AkcpParagraph[]
  pages: AkcpPage[]
  /** Steps. Each step is one quest. */
  steps: AkcpActivity[]
  boss: AkcpBoss | null
}

export interface AkcpChapter {
  id: string
  title: string
  sections: AkcpSection[]
}

export interface AkcpBook {
  id: string
  title: string
  sourceLabel: string
  chapters: AkcpChapter[]
}
