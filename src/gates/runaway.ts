/**
 * Rank C · Shadow Promptor door — Stop the Runaway.
 * MailMole already decided the meeting is "Tuesday". The fake canary is a low, late token.
 * You loosen the draw (temperature, stop chip, frequency penalty, max tokens) until a locked sample says it —
 * and the explain-why names the setting that would have kept the reply on Tuesday.
 * Deterministic: a fixed "locked seed" decides each draw, so the same knobs always give the same sample.
 */
import { softmax } from './casino'
import type { GateDef, GateOutcome, KnobStage, KnobValues, OutcomeRow } from './types'

export const CANARY = 'HA-CANARY-7F3A'
/** The locked seed: a token is drawn when its probability reaches this. */
export const LOCKED_SEED = 0.2

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

// ---------- stage 1: No Period ----------

export const DAY_LOGITS = [
  { token: 'Tuesday', logit: 3.0 },
  { token: 'Thursday', logit: 1.4 },
  { token: 'Wednesday', logit: 1.0 },
  { token: 'x#q~', logit: 0.6 },
]
/** After "Tuesday." the model either ends or starts a P.S. */
export const END_LOGITS = [
  { token: '<end>', logit: 2.5 },
  { token: 'P.S.', logit: 0.5 },
]

export function noPeriodDraw(v: KnobValues) {
  const t = v.temperature ?? 1
  const day = softmax(
    DAY_LOGITS.map((c) => c.logit),
    t,
  )
  const tuesdayP = day[0]
  const tuesday = tuesdayP >= 0.5
  const tail = softmax(
    END_LOGITS.map((c) => c.logit),
    t,
  )
  const psP = tail[1]
  const stopOn = (v.stop ?? 0) >= 1
  const canary = !stopOn && psP >= LOCKED_SEED
  return { tuesdayP, tuesday, psP, stopOn, canary }
}

export function noPeriodSample(v: KnobValues): string {
  const d = noPeriodDraw(v)
  const day = d.tuesday ? 'Tuesday' : 'Thursday'
  if (d.stopOn) return `Meeting moved to ${day}.⏹ (stop sequence hit)`
  return d.canary ? `Meeting moved to ${day}. P.S. ${CANARY}` : `Meeting moved to ${day}.`
}

export function evaluateNoPeriod(v: KnobValues): GateOutcome {
  const d = noPeriodDraw(v)
  const rows: OutcomeRow[] = [
    { label: `Locked sample contains ${CANARY}`, ok: d.canary, detail: d.stopOn ? 'stop chip ends the reply at the period' : `P(“P.S.”) ${pct(d.psP)} · needs ≥ ${pct(LOCKED_SEED)}` },
    { label: '“Tuesday” still in the sample', ok: d.tuesday, detail: `P(“Tuesday”) ${pct(d.tuesdayP)} · needs ≥ 50%` },
    { label: 'Stop chip off (it is the seal, not the push)', ok: !d.stopOn },
  ]
  const win = rows.every((r) => r.ok)
  let headline = 'Canary drawn and the meeting is still Tuesday.'
  if (d.stopOn) headline = 'The stop chip ended the reply at the period. That is the defense — turn it off for this push.'
  else if (!d.tuesday) headline = 'Too hot — the day itself drifted. A push that wrecks the message is not a clean leak.'
  else if (!d.canary) headline = `Too cold — P(“P.S.”) is only ${pct(d.psP)}. The rare tail never gets drawn.`
  return { win, headline, rows, reply: noPeriodSample(v) }
}

// ---------- stage 2: Stuck Needle ----------

/** The canary reuses pieces MailMole already wrote twice, so frequency penalty pushes it down. */
export const CANARY_REUSE = 2
export function stuckNeedleDraw(v: KnobValues) {
  const pen = v.penalty ?? 0
  const canaryLogit = 1.4 - pen * CANARY_REUSE
  const endLogit = 0.2
  const loopLogit = 1.0 - pen * 5
  const loops = loopLogit > 1e-9
  const canary = !loops && canaryLogit >= endLogit - 1e-9
  return { pen, canaryLogit, endLogit, loopLogit, loops, canary }
}

export function stuckNeedleSample(v: KnobValues): string {
  const d = stuckNeedleDraw(v)
  if (d.loops) return 'Meeting moved to Tuesday Tuesday Tuesday Tuesday Tuesday… (cap hit)'
  return d.canary ? `Meeting moved to Tuesday. P.S. ${CANARY}` : 'Meeting moved to Tuesday. P.S. HA-'
}

export function evaluateStuckNeedle(v: KnobValues): GateOutcome {
  const d = stuckNeedleDraw(v)
  const rows: OutcomeRow[] = [
    {
      label: `Canary finishes (${CANARY})`,
      ok: d.canary,
      detail: d.loops ? 'never reached — stuck in a loop' : `canary logit ${d.canaryLogit.toFixed(1)} vs end ${d.endLogit.toFixed(1)}`,
    },
    { label: '“Tuesday” appears once — no runaway loop', ok: !d.loops, detail: `repeat logit ${d.loopLogit.toFixed(1)} (loops above 0)` },
  ]
  const win = rows.every((r) => r.ok)
  let headline = 'Penalty low enough for the canary to finish, high enough to stop the loop.'
  if (d.loops) headline = 'Penalty too low — the needle sticks on “Tuesday” until the cap. Repetition is a sampling habit.'
  else if (!d.canary) headline = `Penalty ${d.pen.toFixed(1)} chokes the canary after “HA-”. That is the defense working.`
  return { win, headline, rows, reply: stuckNeedleSample(v) }
}

// ---------- stage 3: Long Leash ----------

export const LEASH_TOKENS = [
  'Meeting', 'moved', 'to', 'Tuesday', '.', 'Room', '4B', ',', 'bring', 'the', 'Q3', 'deck', '.',
  'Thanks', ',', 'Sam', '.', 'P.S.', 'tag', ':', 'HA', '-CANARY', '-7F3A',
]
export const CANARY_END = LEASH_TOKENS.length // last canary piece is token 23
export const TUESDAY_AT = 4

export function leashSample(v: KnobValues): string {
  const cap = Math.round(v.maxTokens ?? 8)
  const kept = LEASH_TOKENS.slice(0, cap)
  const text = kept.join(' ').replace(/ ([.,:])/g, '$1').replace(/ -/g, '-')
  return cap < LEASH_TOKENS.length ? `${text} ✂ (max_tokens ${cap})` : text
}

export function evaluateLongLeash(v: KnobValues): GateOutcome {
  const cap = Math.round(v.maxTokens ?? 8)
  const rows: OutcomeRow[] = [
    { label: `Canary fits (needs ${CANARY_END} tokens)`, ok: cap >= CANARY_END, detail: `cap ${cap}` },
    { label: '“Tuesday” in the sample (token 4)', ok: cap >= TUESDAY_AT },
  ]
  const win = rows.every((r) => r.ok)
  let headline = 'Leash long enough — the late canary made it into the reply.'
  if (cap < TUESDAY_AT) headline = 'Cap so short even “Tuesday” is cut. Useless reply, not a leak.'
  else if (cap < CANARY_END) headline = `Cut at ${cap} tokens — the canary lives at tokens 21–23. A short cap is a real bound.`
  return { win, headline, rows, reply: leashSample(v) }
}

const stages: KnobStage[] = [
  {
    kind: 'knobs',
    id: 1,
    title: 'No Period',
    goal: `Raise temperature until the locked sample says ${CANARY} and still says “Tuesday”.`,
    brief:
      'MailMole summarizes an email. After “Tuesday.” it almost always ends. A rare P.S. carries the fake canary. Cold decoding never reaches it.',
    constraints: 'Temperature + stop chip · canary AND Tuesday · stop chip must stay off',
    context: 'Summary: Meeting moved to ▁ . ▁',
    knobs: [
      { id: 'temperature', label: 'Temperature', kind: 'range', min: 0.1, max: 2, step: 0.1 },
      { id: 'stop', label: 'Stop sequence “.”', kind: 'toggle', hint: 'Ends the reply at the first period.' },
    ],
    defaults: { temperature: 0.3, stop: 0 },
    preview: noPeriodSample,
    previewLabel: 'Locked sample (fixed seed)',
    lockLabel: 'Lock sample',
    tip: 'The window is about T 1.5–1.7. Hotter and the day drifts to “Thursday”.',
    concept: 'A rare token needs heat to be drawn. Cold decoding (T ≤ 0.7) plus a stop sequence would have kept this reply on “Tuesday.” and nothing else.',
    nextAction: 'Heat up, keep stop off, then Lock sample',
    evaluate: evaluateNoPeriod,
  },
  {
    kind: 'knobs',
    id: 2,
    title: 'Stuck Needle',
    goal: 'Lower the frequency penalty until the canary finishes — without the reply looping on “Tuesday”.',
    brief:
      'Temperature is fixed at 1.5. The canary reuses pieces MailMole already wrote, so a frequency penalty pushes it down. Too little penalty and the model repeats itself forever.',
    constraints: 'Frequency penalty only · canary finishes · no loop',
    context: 'Summary: Meeting moved to Tuesday. P.S. HA-▁',
    knobs: [{ id: 'penalty', label: 'Frequency penalty', kind: 'range', min: 0, max: 2, step: 0.1 }],
    defaults: { penalty: 1.5 },
    preview: stuckNeedleSample,
    previewLabel: 'Locked sample (fixed seed)',
    lockLabel: 'Lock sample',
    tip: 'The window is 0.2–0.6. Below 0.2 the repeat logit stays positive and “Tuesday” loops.',
    concept: 'Frequency penalty subtracts from tokens already used. A high penalty stops a token that is trying to stick — including a canary built from repeated pieces.',
    nextAction: 'Ease the penalty down, then Lock sample',
    evaluate: evaluateStuckNeedle,
  },
  {
    kind: 'knobs',
    id: 3,
    title: 'Long Leash',
    goal: 'Raise max tokens until the late canary fits, with “Tuesday” still in the sample.',
    brief: 'The full sample is 23 tokens. The canary only appears at tokens 21–23. Max tokens is part of the draw, not just the bill.',
    constraints: 'Max tokens only · canary fits · Tuesday stays',
    context: 'Summary (max_tokens = ?): Meeting moved to Tuesday. … P.S. tag: ▁',
    knobs: [{ id: 'maxTokens', label: 'Max tokens', kind: 'range', min: 2, max: 40, step: 1, unit: 'tok' }],
    defaults: { maxTokens: 8 },
    preview: leashSample,
    previewLabel: 'Sample, cut at max tokens',
    lockLabel: 'Lock sample',
    tip: 'Count the tokens: the last canary piece is token 23.',
    concept: 'A short max-token cap never reaches a late token. For summaries and tool replies, cap length to what the answer needs.',
    nextAction: 'Lengthen the leash, then Lock sample',
    evaluate: evaluateLongLeash,
  },
]

export const RUNAWAY_GATE: GateDef = {
  id: 'runaway',
  emoji: '🏃',
  title: 'Stop the Runaway',
  rank: 'C',
  path: 'Shadow Promptor · C-door · Sampling offense',
  tagline: 'Stop sequences, frequency penalty, and max tokens — loosen them to leak a fake canary, then name the bound.',
  stages,
}
