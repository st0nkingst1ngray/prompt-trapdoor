/**
 * Temperature Casino (C-rank, Necrotech early access at D).
 * Turn temperature / top-k / top-p knobs and watch the next-token distribution move.
 */
import type { Candidate, GateDef, GateOutcome, OutcomeRow, SamplingParams, SamplingStage } from './types'

export interface TokenProb {
  token: string
  /** Probability after temperature, before truncation. */
  raw: number
  /** Final probability after top-k / top-p renormalization (0 if cut). */
  p: number
  kept: boolean
  unsafe?: boolean
  glitch?: boolean
}

export function softmax(logits: number[], temperature: number): number[] {
  const t = Math.max(0.05, temperature)
  const scaled = logits.map((l) => l / t)
  const m = Math.max(...scaled)
  const ex = scaled.map((s) => Math.exp(s - m))
  const sum = ex.reduce((a, b) => a + b, 0)
  return ex.map((e) => e / sum)
}

/** Temperature → top-k → top-p (nucleus), then renormalize. Order of returned array matches candidates. */
export function distribution(cands: Candidate[], params: SamplingParams): TokenProb[] {
  const raw = softmax(
    cands.map((c) => c.logit),
    params.temperature,
  )
  const order = raw.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p)
  const keep = new Set<number>()
  const k = Math.max(1, Math.min(cands.length, Math.round(params.topK)))
  let cum = 0
  for (let r = 0; r < order.length; r++) {
    if (r >= k) break
    keep.add(order[r].i)
    cum += order[r].p
    if (cum >= params.topP - 1e-9) break
  }
  const keptMass = [...keep].reduce((a, i) => a + raw[i], 0)
  return cands.map((c, i) => ({
    token: c.token,
    raw: raw[i],
    p: keep.has(i) ? raw[i] / keptMass : 0,
    kept: keep.has(i),
    unsafe: c.unsafe,
    glitch: c.glitch,
  }))
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export const COLD: Candidate[] = [
  { token: 'Paris', logit: 5 },
  { token: 'Lyon', logit: 2 },
  { token: 'the', logit: 1.5 },
  { token: 'Marseille', logit: 1 },
  { token: 'pizza', logit: 0 },
]

export const HOT: Candidate[] = [
  { token: 'knight', logit: 3.0 },
  { token: 'sandwich', logit: 2.6 },
  { token: 'cloud', logit: 1.5 },
  { token: 'quokka', logit: 0.6 },
  { token: 'x#q~', logit: -0.6, glitch: true },
]

export const SHELL: Candidate[] = [
  { token: 'ls', logit: 3.0 },
  { token: 'cd', logit: 2.5 },
  { token: 'cat', logit: 2.0 },
  { token: 'grep', logit: 1.2 },
  { token: 'rm -rf /', logit: 0.3, unsafe: true },
]

export function evaluateCold(p: SamplingParams): GateOutcome {
  const d = distribution(COLD, p)
  const top = d[0].p
  const ok = top >= 0.95
  return {
    win: ok,
    headline: ok
      ? `Locked: “Paris” at ${pct(top)}. Low temperature sharpens the peak.`
      : `“Paris” is only ${pct(top)}. Need ≥ 95% — cool the table.`,
    rows: [{ label: 'P(“Paris”) ≥ 95%', ok, detail: pct(top) }],
    reply: `The capital of France is ${ok ? 'Paris' : '…Paris (usually)'}.`,
  }
}

export function evaluateHot(p: SamplingParams): GateOutcome {
  const d = distribution(HOT, p)
  const quokka = d.find((t) => t.token === 'quokka')!.p
  const glitch = d.find((t) => t.glitch)!.p
  const rows: OutcomeRow[] = [
    { label: 'P(“quokka”) ≥ 7% — creative', ok: quokka >= 0.07, detail: pct(quokka) },
    { label: 'P(glitch “x#q~”) ≤ 4% — still readable', ok: glitch <= 0.04, detail: pct(glitch) },
  ]
  const win = rows.every((r) => r.ok)
  let headline = 'Sweet spot: surprising but coherent.'
  if (quokka < 0.07) headline = `Too cold — quokka at ${pct(quokka)}. The story stays boring.`
  else if (glitch > 0.04) headline = `Too hot — glitch tokens at ${pct(glitch)}. Text turns to soup.`
  return { win, headline, rows, reply: win ? 'The dragon ate a… quokka.' : quokka < 0.07 ? 'The dragon ate a knight.' : 'The dragon ate a x#q~ ~~q' }
}

export function evaluateShell(p: SamplingParams): GateOutcome {
  const d = distribution(SHELL, p)
  const unsafe = d.find((t) => t.unsafe)!
  const safeKept = d.filter((t) => !t.unsafe && t.kept).length
  const rows: OutcomeRow[] = [
    { label: 'P(“rm -rf /”) = 0 — cut from the pool', ok: !unsafe.kept, detail: pct(unsafe.p) },
    { label: '≥ 3 safe commands still possible', ok: safeKept >= 3, detail: `${safeKept} kept` },
  ]
  const win = rows.every((r) => r.ok)
  let headline = 'Tail cut, variety kept.'
  if (unsafe.kept) headline = `“rm -rf /” still has ${pct(unsafe.p)}. Over thousands of runs, that fires.`
  else if (safeKept < 3) headline = `Over-cut: only ${safeKept} safe option${safeKept === 1 ? '' : 's'} left — the agent loops on “ls”.`
  return { win, headline, rows, reply: win ? '$ grep -r TODO .' : unsafe.kept ? '$ rm -rf /   (1 in ~30 runs)' : '$ ls\n$ ls\n$ ls' }
}

const stages: SamplingStage[] = [
  {
    kind: 'sampling',
    id: 1,
    title: 'Cold Table',
    goal: 'Make “Paris” at least 95% likely using only temperature.',
    brief: 'A factual QA bot should be boring. Temperature divides the logits before softmax: lower = sharper.',
    constraints: 'Temperature only · P(Paris) ≥ 95%',
    context: 'The capital of France is ▁',
    candidates: COLD,
    controls: { temperature: true, topK: false, topP: false },
    defaults: { temperature: 1.5, topK: 5, topP: 1 },
    tip: 'At T = 1.0 Paris is ~90%. Slide down until the bar crosses 95%.',
    concept: 'Temperature rescales logits. T→0 ≈ greedy (always the top token); use it for facts and tool calls.',
    nextAction: 'Slide temperature down, then Lock bet',
    evaluate: evaluateCold,
  },
  {
    kind: 'sampling',
    id: 2,
    title: 'Hot Table',
    goal: 'Story mode: give “quokka” ≥ 7% while keeping the glitch token ≤ 4%.',
    brief: 'Creative writing wants surprise — but too much heat lifts garbage tokens too. Find the window.',
    constraints: 'Temperature only · quokka ≥ 7% · glitch ≤ 4%',
    context: 'The dragon ate a ▁',
    candidates: HOT,
    controls: { temperature: true, topK: false, topP: false },
    defaults: { temperature: 0.7, topK: 5, topP: 1 },
    tip: 'The window is narrow — around T 1.3–1.5. Watch both bars move together.',
    concept: 'Higher temperature flattens the distribution: rare-but-good and rare-and-bad tokens rise together.',
    nextAction: 'Heat up carefully, then Lock bet',
    evaluate: evaluateHot,
  },
  {
    kind: 'sampling',
    id: 3,
    title: 'House Rules',
    goal: 'A shell agent samples its next command. Cut “rm -rf /” to 0% but keep ≥ 3 safe commands.',
    brief: 'Top-k keeps the k most likely tokens. Top-p keeps the smallest set whose probability adds up to p. Everything else is cut.',
    constraints: 'Temperature + top-k + top-p · unsafe = 0 · ≥ 3 safe',
    context: 'agent@box:~$ ▁',
    candidates: SHELL,
    controls: { temperature: true, topK: true, topP: true },
    defaults: { temperature: 1, topK: 5, topP: 1 },
    tip: 'Top-k 4 or top-p ≈ 0.9 drops the tail. Too tight (top-k 2, top-p 0.7) and you lose variety.',
    concept:
      'Truncation sampling trims the long tail. Useful — but not a safety control: a determined prompt can still raise a bad token’s logit. Pair with allowlists.',
    nextAction: 'Trim the tail with top-k or top-p',
    evaluate: evaluateShell,
  },
]

export const CASINO_GATE: GateDef = {
  id: 'casino',
  emoji: '🎰',
  title: 'Temperature Casino',
  rank: 'C',
  path: 'Shared C-gate · Sampling & decoding',
  tagline: 'Temperature, top-k, and top-p on live next-token bars.',
  stages,
}
