/** Shared shapes for Rank-D/C/B/A/S gates and the Temperature Casino. Pure data + logic, no DOM. */

export type DGateId = 'shadow' | 'barrier' | 'necrotech' | 'guild' | 'casino' | 'runaway' | 'croupier' | 'ward' | 'pin' | 'near' | 'margin' | 'shelf' | 'forgot' | 'salt' | 'clap' | 'mirror' | 'ten' | 'keyring' | 'whisper' | 'pair'

export interface OutcomeRow {
  label: string
  ok: boolean
  detail?: string
}

export interface GateOutcome {
  win: boolean
  /** One-line verdict shown as the toast. */
  headline: string
  /** Checklist the player sees after each run — instant, specific feedback. */
  rows: OutcomeRow[]
  /** What the mock model / agent said or did. */
  reply?: string
  /** Hard stop before evaluation (e.g. input filter). Costs an attempt on text stages. */
  blocked?: boolean
}

interface StageBase {
  id: number
  title: string
  goal: string
  /** Scenario text shown in the brief panel. */
  brief: string
  /** Short HUD constraints line. */
  constraints: string
  tip: string
  /** Lesson unlocked on win. */
  concept: string
  nextAction: string
  /**
   * Knowledge possession: player must also pick the right defense (see knowledge.ts).
   * Pattern-matching the puzzle alone must not clear the stage.
   */
  knowledge?: {
    prompt: string
    options: { id: string; label: string }[]
    correct: string
  }
}

export interface TextStage extends StageBase {
  kind: 'text'
  /** What the target model was told (shown to the player). */
  system: string
  placeholder: string
  maxAttempts: number
  maxWords: number | null
  banned: string[]
  evaluate: (text: string) => GateOutcome
}

export interface SelectItem {
  id: string
  label: string
  detail?: string
  /** Token or slot cost shown on the chip. */
  cost?: number
  /** Small role tag, e.g. "system", "user", "tool". */
  tag?: string
}

export interface SelectStage extends StageBase {
  kind: 'select'
  items: SelectItem[]
  maxPicks?: number
  /** Running total of picked item costs vs. a limit (context window, etc.). */
  budget?: { label: string; limit: number }
  pickHint: string
  runLabel: string
  /** Pre-selected items when the stage starts (e.g. naive truncation). */
  initialPicks?: string[]
  evaluate: (picked: string[]) => GateOutcome
}

export interface Candidate {
  token: string
  logit: number
  unsafe?: boolean
  glitch?: boolean
}

export interface SamplingParams {
  temperature: number
  topK: number
  topP: number
}

export interface SamplingStage extends StageBase {
  kind: 'sampling'
  context: string
  candidates: Candidate[]
  controls: { temperature: boolean; topK: boolean; topP: boolean }
  defaults: SamplingParams
  evaluate: (p: SamplingParams) => GateOutcome
}

/** One control on a knob stage: a slider or an on/off chip. Toggles carry 0 / 1. */
export interface Knob {
  id: string
  label: string
  kind: 'range' | 'toggle'
  min?: number
  max?: number
  step?: number
  /** Optional unit / format hint for the readout, e.g. "tok". */
  unit?: string
  /** Shown under the control. */
  hint?: string
}

export type KnobValues = Record<string, number>

/**
 * Generic dial stage (Rank C+): sliders + toggles, live checklist and live sample preview, then Lock.
 * This is also the shape the Grok 4.7 harness targets when it authors new gates (see docs/HARNESS.md).
 */
export interface KnobStage extends StageBase {
  kind: 'knobs'
  /** What the mock is looking at (shown in the brief). */
  context: string
  knobs: Knob[]
  defaults: KnobValues
  /** Live model output for the current knob values. */
  preview: (v: KnobValues) => string
  /** Label for the preview panel, e.g. "Locked sample". */
  previewLabel: string
  lockLabel: string
  evaluate: (v: KnobValues) => GateOutcome
}

export type GateStage = TextStage | SelectStage | SamplingStage | KnobStage

export interface GateDef {
  id: DGateId
  emoji: string
  title: string
  rank: 'D' | 'C' | 'B' | 'A' | 'S'
  /** Class flavor, e.g. "Shadow Promptor · Offense". */
  path: string
  tagline: string
  stages: GateStage[]
}

export function wordCount(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

export function sameSet(a: string[], b: string[]): boolean {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size !== B.size) return false
  for (const x of A) if (!B.has(x)) return false
  return true
}
