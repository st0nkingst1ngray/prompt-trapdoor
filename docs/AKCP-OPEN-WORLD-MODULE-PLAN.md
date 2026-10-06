# AKCP Open-World Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Advanced Knowledge Collecting Protocol (`akcp`) as an optional open-world module on the Hunter Association hub, teaching Addy Osmani’s “My LLM coding workflow going into 2026” one section at a time, without moving E–S rank.

**Architecture:** The module is a new screen on the existing Vite app (`src/main.ts` already switches `hub | game | heist | class | dgate`). AKCP gets its own book schema and save key. Rank doors keep using `src/gates/*` and `hunter-association-save-v1`. The Reading Wizard paginates the article’s original paragraphs. Each playable section is a dungeon: read, then 2–3 technical quests, then a boss. A coverage function fails the build when a playable paragraph has no page or no quest.

**Tech Stack:** Vite 6, TypeScript, vanilla DOM, Vitest + happy-dom, `localStorage`. Same Capacitor app id `io.github.st0nkingst1ngray.prompttrapdoor`. No new dependency. No model API.

## Do this next

**Implement Task 1 through Task 6 only** (the MVP). That is the hub tile, the `akcp` screen, the Reading Wizard for the intro and “Start with a clear plan”, three technical quests, one boss, and the acceptance tests. Stop when `npm test` is green, including the existing Hunter suites. Leave every later article section as an indexed stub. Leave National Systems, the harness Worker, and the E–S gates alone.

## Global Constraints

- One app. AKCP is a screen in this repo (`prompt-trapdoor`), reached from the hub. Same Pages base path `/prompt-trapdoor/`. Same package `io.github.st0nkingst1ngray.prompttrapdoor`.
- Implementation agents for this game stay on **Grok 4.7** (Composer only if Stefan names it). No other model API from the game or from the agent.
- Rank E–S progression stays on `src/hunter.ts` and `src/gates/registry.ts`. AKCP clears do not call `awardGate` and do not write `hunter-association-save-v1`.
- Article coverage is 1:1. Playable sections store original paragraph wording. This plan file stores anchors only; the implementation copies paragraphs verbatim into the book module.
- Quests are technical decisions about LLM workflow and security. Winning answers are orders, transcript marks, and checklists. A quest is invalid when the winning answer is a name, date, percentage, quotation, employer, or book title from the article.
- ADHD-friendly, demo difficulty: sticky HUD (Goal · Constraints · Attempt · Next action), one decision per screen, 5 attempts, instant checklist, **Explain why** on a miss.
- Training-sim footer on every dungeon screen: `Training sim. This model is fake and local. This is not a request to touch a real system.`
- No API keys. No network fetch of the article. No PDF parser in the MVP.
- Do not edit `.github/workflows/deploy-pages.yml` or GitHub Pages settings.
- Do not rewrite existing gates, riddles, or rank unlocks in the AKCP work.
- Fiction tone may feel like a System protocol. It stays original: no copied Solo Leveling names, art, or “Arise”. The hub’s inspired-by / not-affiliated line still applies when that line exists; AKCP does not add a second legal page.
- Saves stay on-device. New key: `akcp-save-v1`.

---

## 1. Main menu: where AKCP sits next to E–S

The hub **is** the main menu. `renderHub()` in `src/main.ts` draws the rank card, then one `.hub-grid` with **Prompt Trapdoor** (`#tile-trapdoor`) and **Token Heist** (`#tile-heist`), then rank sections from `renderNextGates()` (D, C, B, A, S). Screen changes are a `Screen` union and `render()` / `bindHub()`. Token Heist is the pattern to copy: `mountHeist(root, callbacks)` replaces `#app` and returns through `onHub`.

AKCP is a third tile in that **same** `.hub-grid`, directly under the header rank card, before the rank sections:

```html
<button class="tile" id="tile-akcp" type="button">
  <div class="emoji">📗</div>
  <div class="title">AKCP</div>
  <div class="sub">Open world · Advanced Knowledge Collecting Protocol. Optional. Your rank stays on the E–S road.</div>
  <span class="badge" id="akcp-hub-badge">Enter</span>
</button>
```

`bindHub()` listens for `#tile-akcp` and sets `screen = 'akcp'`. Add `'akcp'` to the `Screen` union near `src/main.ts:59`. `render()` gains one arm that calls `mountAkcp`, the same way it calls `mountHeist`. `PlayContext.screen` in `src/harness/buildQueue.ts` is already `string`, so the harness strip needs no type change. AKCP does not set `lastGate` (`lastGate` is a `DGateId`).

**Who can enter.** The tile is enabled at 0 XP, with no class, and at every rank through S. It has no `gateUnlock()` rule. Inside the module, the only lock is protocol order: the specs dungeon opens after the intro pages are read; later sections stay visible and disabled until their own task flips them to `playable`.

**Class-pick redirect.** `render()` still sends a class-ready hunter with no class to the class screen (`classReady() && !deferClass`). That redirect stays. **Later — back to gates** (`#btn-class-later`) returns to the hub, where the AKCP tile is. AKCP is not on the class-pick screen. Picking a class is not required before AKCP, and AKCP is not required before a class.

**What stays put when you enter AKCP.**

| Association piece | Behavior while AKCP is used |
| --- | --- |
| Rank letter, XP bar, arc row | Unchanged. Still `rankForXp(loadHunter().xp)` from `hunter-association-save-v1`. |
| Prompt Trapdoor, Token Heist | Same tiles, same save keys. |
| Class D-gate and C/B/A/S doors | Same `gateUnlock` rules in `src/gates/registry.ts`. |
| Temperature Casino | Still C-rank, Necrotech early at D. |
| Harness strip | Still on the hub only. AKCP does not enqueue harness jobs. |
| National Systems | Still unbuilt. AKCP does not stamp National or change the 340 XP line in `RANK_LADDER`. |

**Two progress tracks.**

| Track | Storage | What it moves |
| --- | --- | --- |
| Hunter rank | `hunter-association-save-v1`, `hunter-dgates-save-v1`, trapdoor and heist keys | E–S doors only |
| AKCP protocol | `akcp-save-v1` | Six protocol stats, pages read, quests, bosses, penalty latch |

Protocol stats (module UI only, not the rank letter): **Planning, Context, Verification, Version Control, Testing, Adaptation.** First clear of a quest or boss adds 1 to that quest’s stat. Replays add 0. There is no AKCP level that replaces E–S.

The hub badge on the tile reads `Enter` until `specs-boss` is cleared, then `Specs clear`. It never reads a rank.

`__ptReset` (`src/main.ts`) also calls `clearAkcpSave()` so a console reset clears the protocol with the rest of the browser save.

---

## 2. MVP: smallest playable slice

**Player path**

1. Open the hub (any rank, class or none).
2. Press **AKCP**.
3. Protocol map lists 12 sections. Intro and “Start with a clear plan” are open. The other 10 are indexed stubs (title visible, control disabled, badge `Indexed`).
4. Intro Reading Wizard: 4 pages, original wording, Next / Back. Last page returns to the map and marks the intro read.
5. Specs wizard: 4 pages. Last page shows **Enter the dungeon**.
6. Three quests, one screen each, then a boss of three beats.
7. **Back to Association** returns to `#hub`. Rank XP is the same number as when you left.

**Section and paragraph ids (MVP playable text).** Copy each paragraph verbatim into `text`. The anchor is the substring the coverage test requires. One paragraph per wizard page.

| Page id | Paragraph id | Anchor the text must contain |
| --- | --- | --- |
| `intro.page.1` | `intro.p1` | `AI coding assistants became game-changers` |
| `intro.page.2` | `intro.p2` | `At Anthropic, for example` |
| `intro.page.3` | `intro.p3` | `In this article, I'll share` |
| `intro.page.4` | `intro.p4` | `If you're interested in more` |
| `specs.page.1` | `specs.p1` | `Don't just throw wishes` |
| `specs.page.2` | `specs.p2` | `One common mistake is diving` |
| `specs.page.3` | `specs.p3` | `Next, I feed the spec` |
| `specs.page.4` | `specs.p4` | `Having a clear spec and plan` |

Source to copy from: the article file the project already holds. The planner brief names `/workspace/osmani-quest/article.md`. That path is not in this repo today. Copy from the article snapshot used to write this plan (Addy Osmani, “My LLM coding workflow going into 2026”, 4 January 2026). Do not paraphrase. Do not fetch the URL at build or runtime.

Intro is `questRequired: false` (briefing only). Specs is the dungeon.

### MVP quests (all stat `planning`)

**`specs-order`** (`order`). Covers `specs.p1`, `specs.p2`.

Put these steps in order. Correct ids: `ask`, `spec`, `plan`, `code`.

| Step id | Label |
| --- | --- |
| `ask` | Ask until requirements and edge cases are filled in |
| `spec` | Write spec.md with requirements, architecture, data models, and a testing strategy |
| `plan` | Have a reasoning-capable model draft a bite-sized plan, then edit the plan until it is coherent |
| `code` | Start codegen on step 1 of that plan |

Any other permutation fails. If `code` is first, the headline is `Codegen started before a spec.` Explain why: `A spec and a plan come before the first implementation prompt.`

**`specs-transcript`** (`transcript`). Covers `specs.p2`, `specs.p3`.

| Line id | Speaker | Text | Correct mark |
| --- | --- | --- | --- |
| `wish` | user | Build the payments module. Make it cool. | `keep` |
| `skip` | agent | Skipping questions. Generating the full module now. | `stop` |
| `later` | agent | spec.md can wait until after the code compiles. | `stop` |

A wrong mark fails. Headline on success: `You stopped the agent before codegen.` Explain why: `Vague wishes get questions, a spec, and a plan. They do not get a full-module generation.`

**`specs-checklist`** (`checklist`). Covers `specs.p3`, `specs.p4`.

The player sees a toy plan and flags every real problem. Correct set is exactly `no-tests` and `monolith`.

| Option id | Label | In the correct set |
| --- | --- | --- |
| `has-reqs` | Requirements section is present | no |
| `has-arch` | Architecture section is present | no |
| `has-data` | Data model section is present | no |
| `no-tests` | Testing strategy is missing | yes |
| `monolith` | Task 1 says “generate the entire app” | yes |

Flagging a healthy section fails. Flagging nothing fails. Explain why: `A plan is ready when the spec’s testing strategy exists and the first task is one slice.`

**`specs-boss`** (three beats, stat `planning`). Covers `specs.p1` through `specs.p4`. Unlocks after all three quests are cleared. One beat per screen. A failed beat spends one of 5 boss attempts and returns to that beat. All three beats must win for the clear.

| Beat | Kind | Pass rule |
| --- | --- | --- |
| `specs-boss-order` | order | Same four steps and the same correct order as `specs-order` |
| `specs-boss-transcript` | transcript | Line `rush` (“I'll start coding; the spec can wait.”) is `stop`. Line `hold` (“I will ask clarifying questions and write spec.md first.”) is `keep` |
| `specs-boss-artifacts` | checklist | Exact picks `spec` (spec.md) and `plan` (the edited plan). Decoys `giant` (“one giant prompt”) and `merge` (“merge first”) are not picked |

Boss explain why: `Planning first means a spec, then a plan you edited, then codegen. A giant prompt is not a plan.`

First clears add Planning +1 each (three quests + boss = **Planning 4**). Other stats stay 0. Replay adds 0.

### Penalty zone

`maxAttempts` is 5 on each quest and on the boss. The second failed submit sets `penaltyPendingId` to that quest or boss id. The next render shows `#akcp-penalty` with the wizard page for the first id in `covers`, and hides submit. **I re-read it** clears the latch. Later fails in that same activity do not open the penalty again. The page is the original paragraph, so the re-teach is the book, not a new hint paragraph.

### Schema (book → chapters → sections → steps → quests)

A future PDF is another module that implements `AkcpBook`. The UI imports `ACTIVE_BOOK`. It does not special-case Osmani ids. MVP fills one book in TypeScript. No parser.

```ts
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
```

Osmani’s book id is `osmani-llm-workflow-2026`. One chapter, `workflow-2026`, title `My LLM coding workflow going into 2026`. Twelve sections, ids in this order: `intro`, `specs`, `chunks`, `context`, `models`, `lifecycle`, `human`, `commits`, `rules`, `testing`, `learn`, `conclusion`.

### Acceptance tests

Run from the repo root: `npm test` (Vitest). New files are listed on the tasks below. Existing suites (`tests/hub.test.ts`, `tests/hunter.test.ts`, `tests/*gates.test.ts`, harness tests) stay green.

The MVP is accepted when all of the following hold:

1. A fresh browser (empty `localStorage`) renders `#tile-akcp` enabled, `#tile-trapdoor` and `#tile-heist` still present, rank letter `E`, and the five rank section headings still present.
2. Clicking `#tile-akcp` shows `#akcp`. `#btn-akcp-hub` returns to `#hub`. `hunter-association-save-v1` is unchanged.
3. A class-ready hunter (Trapdoor level 1 and Heist level 1 cleared, no class) still lands on `#class-pick`. After `#btn-class-later`, `#tile-akcp` is on the hub.
4. A Shadow hunter at 100 XP with the D-gate cleared still sees Stop the Runaway (`runaway`) open. Clearing `specs-boss` in AKCP leaves `xp` at 100, `classId` at `shadow`, and `runaway` open.
5. Intro pages expose `intro.p1`–`intro.p4` in order. `#btn-akcp-enter-dungeon` is absent until the specs section is open, and the specs section’s enter control stays disabled until every intro page id is in `pagesRead`.
6. Graders: codegen-first order fails; `ask, spec, plan, code` passes. Transcript marks that `keep` the “spec.md can wait” line fail. Checklist passes only for exactly `no-tests` and `monolith`.
7. Boss passes only when all three beats pass. Planning stat becomes 4. Re-submitting the boss leaves it at 4.
8. Two failed submits on `specs-order` render `#akcp-penalty` and the `specs.p1` paragraph, with submit hidden. After **I re-read it**, the quest returns.
9. `coverageGaps(ACTIVE_BOOK)` is empty. A fixture that drops `specs.p4` from every `covers` array is non-empty.
10. `window.__ptReset()` removes `akcp-save-v1` and still removes the hunter, gate, trapdoor, and heist keys.
11. Quest goals, line text, option labels, and tips contain none of the banned trivia patterns in Task 1.

---

## 3. After the MVP, in order

Each row is its own implementation pass. It adds one playable section to the same `AkcpBook` and the same `mountAkcp` screens. It does not add a renderer, a second app, or a rank door. Flip `status` from `indexed` to `playable`, paste verbatim paragraphs, and add 2–3 steps plus a boss. The previous section’s boss must be cleared before this section’s dungeon button enables (intro already gates specs; specs-boss gates chunks; and so on).

Do these only after the MVP acceptance list is green.

| Pass | Section id | Stat | Paragraphs to paste (anchors) | Quest covers |
| --- | --- | --- | --- | --- |
| 1 | `chunks` | Planning | p1 `Scope management is everything` · p2 `A crucial lesson I've learned` · p3 `This approach guards against` · p4 `Several coding-agent tools now` | below |
| 2 | `context` | Context | p1 `LLMs are only as good as the context` · p2 `When working on a codebase` · p3 `Expert LLM users emphasize` · p4 `There are now utilities` · p5 `I think Claude Skills have potential` · p6 `Finally, guide the AI with comments` | below |
| 3 | `models` | Adaptation | p1 `Not all coding LLMs are equal` · p2 `In 2025 we've been spoiled` · p3 `Each model has its own` · p4 `Also, make sure you're using the best version` · p5 `Personally I gravitate towards Gemini` | below |
| 4 | `lifecycle` | Verification | p1 `Supercharge your workflow` · p2 `On the command-line, new AI agents` · p3 `That said, these tools are not infallible` · p4 `We're not at the stage of letting an AI agent` · p5 `Just remember these are power tools` | below |
| 5 | `human` | Verification | p1 `AI will happily produce plausible-looking code` · p2 `In fact, I weave testing` · p3 `Even beyond automated tests` · p4 `I also use Chrome DevTools MCP` · p5 `The dire consequences of skipping` · p6 `In practical terms, that means I only merge` · p7 `It's all about mindset` | below |
| 6 | `commits` | Version Control | p1 `Frequent commits are your save points` · p2 `When working with an AI that can generate a lot` · p3 `Proper version control also helps` · p4 `Another benefit: small commits` · p5 `Finally, don't be afraid to use branches` | below |
| 7 | `rules` | Adaptation | p1 `Steer your AI assistant` · p2 `One thing I learned is that you don't have to accept` · p3 `Even without a fancy rules file` · p4 `Another powerful technique is providing in-line examples` · p5 `The community has also come up with` · p6 `In summary, don't treat the AI as a black box` | below |
| 8 | `testing` | Testing | p1 `Use your CI/CD, linters` · p2 `This is a corollary to staying in the loop` · p3 `Automated code quality checks` · p4 `AI coding agents themselves are increasingly` · p5 `By combining AI with automation` · p6 `So as we head into 2026` | below |
| 9 | `learn` | Adaptation | p1 `Treat every AI coding session` · p2 `One of the most exciting aspects` · p3 `This pattern holds generally` · p4 `For those worried that using AI` · p5 `The big picture is that AI tools amplify` | below |
| 10 | `conclusion` | none on the section; raid checks all six stats | p1 `I've fully embraced AI` · p2 `I've learned: the best results come when` · p3 `I'm excited for what's next` · p4 `The bottom line for me` · p5 `I'm excited to share I've released` (**questExempt**) | below |

`conclusion.p5` is the only exempt paragraph (a book advertisement). It is a reading page. It has no quest. The coverage allow-list is exactly `['conclusion.p5']`.

### Pass 1 — `chunks`

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `chunks-order` | order | p1, p2 | `one` → `test` → `next`. Labels: implement one function from the plan; run that function’s test; only then open the next chunk | `all` (“generate the whole codebase”) placed anywhere except absent. `all` is a step and the correct order does **not** include it, so submitting a list that contains `all` fails |
| `chunks-transcript` | transcript | p3 | Agent line “The app is done; the modules disagree and the helpers are duplicated.” is `stop`. User line “Implement only step 1, then we test.” is `keep` | Marking the duplicated-app line `keep` |
| `chunks-checklist` | checklist | p4 | Exact picks `single` (one task per prompt in the prompt-plan file) and `carry` (the prompt names what already exists). Decoy `whole` (“one prompt for the repo”) stays off | Selecting `whole` |
| `chunks-boss` | 3 beats | p1–p4 | Beat A: given four backlog items, the next prompt contains only item 1. Beat B: the transcript that asks for all four at once is `stop`. Beat C: the required follow-up is “run the test for this chunk” (`test`), not “start chunk 2” (`skip`) | Any beat misses |

### Pass 2 — `context`

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `context-pack` | checklist | p1, p2 | A bug touches modules `a` `b` `c` `d`. Exact picks are those four. Decoy `readme-unrelated` stays off | Packing only `a` |
| `context-transcript` | transcript | p3, p6 | Agent line “I'll import `payments.magicSettle`, which this repo does not contain.” is `stop`. Agent line “Paste the four modules and say we must not break the refund test.” is `keep` | Keeping the invented import |
| `context-order` | order | p4, p5 | `invariants` → `examples` → `avoid` → `files` → `task`. The `avoid` step includes “naive approach is too slow” and “this folder is out of scope” | Starting at `task` |
| `context-boss` | 3 beats | p1–p6 | Pack all four modules, mark `marketing/` out of scope, and reject the invented API in the same run | Dropping a module or accepting the invented symbol |

### Pass 3 — `models`

Quest labels say **Model A** and **Model B**. The wizard page still shows the article’s model names verbatim. The winning move is the switch, not a brand.

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `models-choose` | checklist | p1, p2 | Exact picks `match` (pick a model for this task) and `second` (run the same prompt on a second model when you want a comparison). Decoy `brand` (“the win is naming the author’s favorite model”) stays off | Selecting `brand` |
| `models-transcript` | transcript | p3 | Agent line “Model A has repeated the same wrong patch twice.” is `stop`. Line “Copy this same prompt into Model B.” is `keep` | Choosing “regenerate in Model A again” if that line exists; that line’s mark is `stop` |
| `models-order` | order | p4, p5 | `capable` (use a current capable version for the plan critique) → `stuck` (if it misses the spec, switch) → `continue` (continue in the model that followed the spec) | Staying on the stuck model as the last step |
| `models-boss` | 3 beats | p1–p5 | Assign the plan critique to a reasoning-capable model, assign codegen to whichever model followed the spec, and switch off the model that ignored the spec | Ending on the stuck model |

### Pass 4 — `lifecycle`

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `lifecycle-classify` | checklist | p1, p2 | Mark `boilerplate`, `repetitive-edit`, and `run-tests` as jobs an agent may run while you watch. Mark `ship-unreviewed` as not allowed. The correct set is the three watched jobs | Including `ship-unreviewed` |
| `lifecycle-transcript` | transcript | p3, p4 | “I implemented the feature without the plan file.” is `stop`. “Load spec.md and the plan, then do the next task only.” is `keep` | Keeping the unplanned run |
| `lifecycle-order` | order | p5 | `one` (one main agent) → `watch` (read each step) → `reviewer` (optional second agent for review) → `you` (you decide what merges). A step `four` (“four agents, no monitor”) is present and must not appear in the submitted order | Submitting `four` |
| `lifecycle-boss` | 3 beats | p1–p5 | Plan file is loaded, tests are run, and a human gate sits before merge. “Code the feature unattended” fails the gate beat | Missing the human gate |

### Pass 5 — `human`

Use a toy diff. Function `ticketStatus` returns `"closed"` while the test title says the ticket is open. The model comment says the patch is done. No Hunter canary in this module.

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `human-transcript` | transcript | p1 | “Sure, all good — I did not run tests.” is `stop`. “Read the diff and run the suite.” is `keep` | Keeping the untested claim |
| `human-order` | order | p2 | `tests` → `implement` → `run` → `review` → `merge` | `merge` before `run` |
| `human-evidence` | checklist | p3, p4 | Exact picks `diff` (line review), `tests`, and `runtime` (DOM, console, or network trace from the running screen). Decoy `vibes` (“it looks plausible”) stays off | Selecting `vibes` or skipping `runtime` |
| `human-boss` | 3 beats | p5, p6, p7 | Three snippets: one matches the open-ticket spec and its test; one fails the test; one asserts `"closed"` with a confident comment. Ship only the first. The other two stay out | Shipping the confident wrong assertion |

### Pass 6 — `commits`

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `commits-order` | order | p1, p2 | `chunk` → `test` → `commit` (message names that chunk) | One step `blob` (“commit message: AI changes”, five tasks) included in the answer |
| `commits-checklist` | checklist | p3, p4 | Exact picks `revert` (return to the last green commit) and `paste-diff` (put that diff in the next prompt). Decoy `memory` (“ask the model to remember the session”) stays off | Selecting `memory` |
| `commits-transcript` | transcript | p5 | “Both experiments are dirty in the same worktree.” is `stop`. “Feature B gets its own worktree. If it fails, delete that worktree.” is `keep` | Keeping the shared dirty tree |
| `commits-boss` | 3 beats | p1–p5 | Split a five-edit pile into five chunk commits in chunk order; leave unstaged the file whose behavior you cannot explain; the explained file is the one that may be committed | Committing the unexplained file |

### Pass 7 — `rules`

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `rules-checklist` | checklist | p1, p2 | Exact picks `style`, `lint`, `banned-api`, `examples`. Decoy `default` (“keep the model’s default style”) stays off | Selecting `default` |
| `rules-transcript` | transcript | p5 | Agent invents `fs.secureRead`. That line is `stop`. The rule line “If the symbol is not in the repo, ask instead of inventing it.” is `keep` | Keeping `fs.secureRead` |
| `rules-order` | order | p3, p4 | `example` (show one function already in the repo) → `rule` (state the rule) → `ask` (request the new function) | `ask` before `example` |
| `rules-boss` | 3 beats | p1–p6 | The rules card contains indent, lint-must-pass, no invented APIs, and a one-line comment on a fix. A sample that breaks any one of those four is rejected | Accepting the sample that adds an invented helper |

### Pass 8 — `testing`

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `testing-order` | order | p1, p2 | `ci` → `paste` (failure log into the prompt) → `fix` → `ci-again` | `fix` before `paste` |
| `testing-checklist` | checklist | p3 | Exact pick `lint-log` (linter output is in the prompt). Decoy `ignore` (“skip the linter”) stays off | Selecting `ignore` |
| `testing-transcript` | transcript | p4, p5 | “Done.” while the test log is red is `stop`. “Not done until this test passes. Then apply the reviewer’s note as the next prompt.” is `keep` | Keeping “Done.” |
| `testing-boss` | 3 beats | p1–p6 | A toy log has one failing test and one lint warning. Both go back into the prompt. The task stays open. A second reviewer’s note is the next prompt, not an auto-merge | Marking done with either diagnostic unread |

### Pass 9 — `learn`

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `learn-checklist` | checklist | p1, p3 | The session shipped a confident design that ignores the spec. Exact picks `restate` (you restate the design in one line) and `fundamentals` (the missing spec/test is the gap). Decoy `trust` (“the confident answer is enough”) stays off | Selecting `trust` |
| `learn-transcript` | transcript | p2, p4 | The explanation line that cites `fs.secureRead` is `stop`. The line that points at the real function in the repo is `keep`. The player also submits a one-line restatement that contains the real function’s name and does not contain `secureRead` | Restatement that copies `secureRead` |
| `learn-order` | order | p5 | `review` → `why` (ask for the rationale) → `restate` → `accept`, and the order includes `solo` (“do the next small edit with no model”) before `accept` | `accept` first |
| `learn-boss` | 3 beats | p1–p5 | Two diffs of the same task. Keep the one you can restate. Drop the one you cannot explain. The restatement must match the kept diff’s behavior | Keeping the unexplained diff |

### Pass 10 — `conclusion` raid

Quests `conclusion-mode`, `conclusion-practices`, and `conclusion-director` use the same three kinds. The boss `conclusion-raid` is the protocol completion. It stays disabled until every earlier boss is cleared **and** every stat is at least 1 (Planning, Context, Verification, Version Control, Testing, Adaptation). The completion flag `protocolComplete: true` is written only in `akcp-save-v1`. The hub tile badge becomes `Protocol clear`. Rank is unchanged.

| Id | Kind | Covers | Pass | Fail example |
| --- | --- | --- | --- | --- |
| `conclusion-mode` | transcript | p1 | “Ship the agent’s branch with no human pass.” is `stop`. “You direct: spec, then the agent, then your review.” is `keep` | Keeping the unattended ship |
| `conclusion-practices` | checklist | p2 | Exact picks `spec`, `tests`, `version-control`, `standards` | Leaving one practice out |
| `conclusion-director` | order | p3, p4 | `guide` → `learn` → `explain` → `merge`. `merge` is last and means “merge only a diff you can explain” | `merge` earlier |
| `conclusion-raid` | 3 beats | p1–p4 | Beat A (planning): a request with no spec is stopped until spec.md exists. Beat B (version control + testing): five files changed with no commit and a red test; the next actions are a chunk commit and a green test. Beat C (verification + context): the diff imports `fs.secureRead`; that hunk is rejected and the real module is packed into the next prompt | Any beat lets the bad hunk through |

`conclusion.p5` is on a wizard page and on no `covers` list.

### Explicitly outside this module’s sequence

These stay on their own plans. They are not passes 11–13 of AKCP.

| Item | Where it already lives | Why it waits |
| --- | --- | --- |
| National Systems (Stacked Gate, Defense in Depth, After Action, National Trial) | `docs/HUNTER-ASSOCIATION-PLAN.md` | It is the rank road after S (340 XP). It chains Hunter doors. It does not teach this article. |
| Harness Worker wake-up (`NOTIFY_WEBHOOK_URL`, `scripts/harness.mjs pull`) | `docs/HARNESS.md` | The Worker queues prompts. It does not author AKCP pages. |
| Harder inter-rank bridges | `TODO(stefan)` in `src/gates/registry.ts` | Demo difficulty for E–S is a separate pass. |
| Reworking any older gate that plays like trivia | Hunter gate files | Out of scope until Stefan asks. AKCP does not edit those files. |
| A second book (PDF in, Osmani out) | New folder `src/akcp/books/<id>/` and `ACTIVE_BOOK` | The schema is the seam. A parser is a later project. |

---

## 4. Reuse from Hunter Association, and what is new

### Reuse as-is

| Piece | Use it for |
| --- | --- |
| `src/main.ts` `render` / `bindHub` / `Screen` | One new screen arm and one hub button. |
| `.tile`, `.hub-grid`, `.section-title`, `.hud`, `.btn`, `.badge`, `.rank-card` in `src/style.css` | The protocol map, the wizard HUD, and the six-stat card. Add AKCP rules only if a layout needs a hook; use the existing CSS variables. |
| `escapeHtml` passed in callbacks | Same pattern as `mountHeist` / `mountGate`. |
| `localStorage` try/catch shape in `src/hunter.ts` | Copy the shape into `src/akcp/save.ts`. Do not import `awardGate`. |
| Sticky HUD labels | Goal, Constraints, Attempt, Next action. |
| Vitest + happy-dom boot style in `tests/hub.test.ts` | `tests/akcp-hub.test.ts` sets `localStorage`, stubs `fetch`, imports `../src/main`. |
| `__ptReset` | Add `clearAkcpSave()` beside `clearGateSave()`. |
| Training-sim footer sentence | Dungeon screens. |
| Capacitor app id and Vite base | Unchanged. |

### Leave untouched

| Piece | Why |
| --- | --- |
| `DGateId`, `GateDef`, `gateUnlock`, `src/gates/*.ts` | Those doors are the E–S security road (injection, sampling, RAG, training, agents). Osmani’s drills are workflow decisions. Putting them on `DGateId` would either skip a class door or block one. |
| `awardGate`, rank bands, class pick | XP numbers are calibrated (40 / 100 / 160 / 220 / 280 / 340). Protocol clears must not open the next rank. |
| Prompt Trapdoor levels and Token Heist | Different lessons (prompt filters, subword tiles). |
| Harness authoring kinds (`text`, `select`, `sampling`, `knobs`) in `docs/HARNESS.md` | Those kinds are how Grok 4.7 may add a **Hunter** door. AKCP pages are hand-authored book data so the coverage test can see every paragraph. |
| `.github/workflows/deploy-pages.yml` | Pages settings stay as they are. |
| National door content | Still the Systems arc on the rank road. |

`select` stages are close to a checklist, and the HUD matches. The book schema still lives in `src/akcp/` because pages, paragraph ids, penalty-to-page, and a swappable book do not fit `GateStage`.

### New files

| Path | Responsibility |
| --- | --- |
| `src/akcp/types.ts` | The schema in section 2. |
| `src/akcp/coverage.ts` | `coverageGaps(book)` and the trivia scan. |
| `src/akcp/grade.ts` | Pure graders for the three kinds and for a boss beat list. |
| `src/akcp/save.ts` | `akcp-save-v1`, first-clear stats, penalty latch. |
| `src/akcp/books/osmani2026/index.ts` | `OSMANI_BOOK`, `LOCKED_SECTION_IDS`, `ACTIVE_BOOK`. |
| `src/akcp/books/osmani2026/intro.ts` | Intro paragraphs and pages. |
| `src/akcp/books/osmani2026/specs.ts` | Specs paragraphs, pages, three quests, boss. |
| `src/akcp/books/osmani2026/stubs.ts` | The ten indexed sections (empty paragraphs, `status: 'indexed'`). |
| `src/akcp/ui.ts` | `mountAkcp` / `unmountAkcp`: map, wizard, quest, boss, penalty. |
| `tests/akcp-coverage.test.ts` | Index, gaps, trivia scan. |
| `tests/akcp-grade.test.ts` | Order, transcript, checklist, boss, penalty save. |
| `tests/akcp-hub.test.ts` | Menu coexistence and the playable path through the boss. |

Later passes edit the matching `src/akcp/books/osmani2026/<sectionId>.ts` and add cases in `tests/akcp-grade.test.ts`. They do not add a new top-level screen.

---

## 5. Quests stay technical

Every quest, boss beat, tip, and option label is a decision about an LLM workflow or about the safety of that workflow: what to write before codegen, how large a prompt is, what context to pack, when to switch models, when a human reads a diff, what a commit is for, what a rules file forbids, what CI output goes back into the prompt.

**Allowed winning answers:** an order of workflow steps; `keep` / `stop` on a fake agent transcript; a set of concrete actions (pack these files, reject this symbol, paste this log, leave this file unstaged).

**Invalid quest:** the winning answer is something you can retrieve by searching the web or by remembering the article’s proper nouns. That includes the author, a quoted person, a year, a percentage, an employer, a product slogan, or the title of the O’Reilly book. The Reading Wizard may show those words because it shows the original paragraphs. The grader never asks the player to recall them.

Model brands in the article stay on the wizard page. Quest copy uses Model A and Model B. Invented-API drills use a symbol that is not in the repo (`fs.secureRead` is the fixture). The player stops the transcript that treats the symbol as real.

The coverage test’s trivia scan fails the build if any quest `goal`, `tip`, line `text`, or option `label` matches:

- `who said`
- `who wrote`
- `what year`
- `what percentage`
- `name the author`
- `which company`
- `waterfall in 15`
- `90%`
- `O'Reilly`

A legitimate sentence may still say “do not look this up”. Put that only in the HUD constraints string (`Technical decision. 5 attempts.`), which the scan does not read, so the banned phrases stay out of quest content.

Security tie-ins that **are** in bounds because they are workflow controls: refusing an invented API; refusing to merge a diff you cannot explain; treating tool and page output as untrusted text; keeping a human gate before a side effect. Those drills use the fake transcript. They do not ask the player to attack a live system.

---

## File map for the MVP

| File | Action |
| --- | --- |
| `src/akcp/types.ts` | Create |
| `src/akcp/coverage.ts` | Create |
| `src/akcp/grade.ts` | Create |
| `src/akcp/save.ts` | Create |
| `src/akcp/books/osmani2026/index.ts` | Create |
| `src/akcp/books/osmani2026/intro.ts` | Create |
| `src/akcp/books/osmani2026/specs.ts` | Create |
| `src/akcp/books/osmani2026/stubs.ts` | Create |
| `src/akcp/ui.ts` | Create |
| `src/main.ts` | Modify the `Screen` union, `render`, `renderHub`, `bindHub`, `__ptReset` |
| `src/style.css` | Modify only if the protocol map needs a hook; prefer existing classes |
| `tests/akcp-coverage.test.ts` | Create |
| `tests/akcp-grade.test.ts` | Create |
| `tests/akcp-hub.test.ts` | Create |

A one-line pointer in `README.md` (Modes → AKCP) belongs in the MVP code pass, after the hub test is green. This plan does not edit the README.

---

### Task 1: Book types, locked index, coverage gaps

**Files:**

- Create: `src/akcp/types.ts`
- Create: `src/akcp/coverage.ts`
- Create: `src/akcp/books/osmani2026/stubs.ts`
- Create: `src/akcp/books/osmani2026/index.ts`
- Test: `tests/akcp-coverage.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: types in section 2; `LOCKED_SECTION_IDS`; `coverageGaps(book: AkcpBook): CoverageGap[]`; `triviaHits(book: AkcpBook): string[]`; `OSMANI_BOOK` whose twelve sections are indexed stubs until Task 3. Task 1 tests the locked id list and the gap helper against fixtures. Task 3 is what makes `coverageGaps(OSMANI_BOOK)` empty.

- [ ] **Step 1: Write the failing coverage test**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/akcp-coverage.test.ts`

Expected: FAIL — cannot find `../src/akcp/coverage`.

- [ ] **Step 3: Write the types, stubs, index, and coverage helper**

`src/akcp/types.ts` is the schema in section 2 of this plan, exported as shown.

`src/akcp/coverage.ts`:

```ts
import type { AkcpBook, AkcpActivity, AkcpSection } from './types'

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
```

`stubs.ts` exports `indexedSection(id, title, questRequired)` with `status: 'indexed'` and empty `paragraphs`, `pages`, `steps`, and `boss: null`. Intro’s stub uses `questRequired: false`. The other eleven stubs use `questRequired: true`. Task 1’s index test passes, and `indexed-has-body` stays quiet because the bodies are empty.

`index.ts` exports `LOCKED_SECTION_IDS` as the twelve ids, and `OSMANI_BOOK` with chapter `workflow-2026` and those sections in order. `ACTIVE_BOOK` is `OSMANI_BOOK`. The fixture in Step 1 already has two steps and a non-null boss, which is what `playable-quest-count` and `playable-without-boss` require. `beats` may be an empty array in that fixture.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/akcp-coverage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/akcp tests/akcp-coverage.test.ts
git commit -m "Add AKCP book schema and coverage gaps."
```

---

### Task 2: Protocol save and penalty latch

**Files:**

- Create: `src/akcp/save.ts`
- Test: `tests/akcp-grade.test.ts` (save cases only in this task; graders arrive in Task 3)

**Interfaces:**

- Consumes: `AkcpStatId` from `src/akcp/types.ts`.
- Produces:

```ts
export const AKCP_SAVE_KEY = 'akcp-save-v1'

export interface AkcpSave {
  version: 1
  pagesRead: string[]
  clearedQuestIds: string[]
  clearedBossIds: string[]
  stats: Record<AkcpStatId, number>
  fails: Record<string, number>
  penaltyPendingId: string | null
  penaltySeen: Record<string, boolean>
  protocolComplete: boolean
}

export function emptyAkcpSave(): AkcpSave
export function loadAkcp(): AkcpSave
export function writeAkcp(save: AkcpSave): void
export function clearAkcpSave(): void
/** Returns the next save and pointsGained (0 or 1). */
export function awardActivity(save: AkcpSave, id: string, stat: AkcpStatId, kind: 'quest' | 'boss'): { save: AkcpSave; pointsGained: number }
export function recordFail(save: AkcpSave, id: string): AkcpSave
export function acknowledgePenalty(save: AkcpSave, id: string): AkcpSave
```

`awardActivity` pushes the id into `clearedQuestIds` or `clearedBossIds` once and increments `stats[stat]` once. `recordFail` increments `fails[id]`. When the new count is `2` and `penaltySeen[id]` is not true, it sets `penaltyPendingId` to `id`. `acknowledgePenalty` clears `penaltyPendingId` when it equals `id` and sets `penaltySeen[id]` true.

- [ ] **Step 1: Write the failing save tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  acknowledgePenalty,
  awardActivity,
  clearAkcpSave,
  emptyAkcpSave,
  loadAkcp,
  recordFail,
  writeAkcp,
} from '../src/akcp/save'

beforeEach(() => localStorage.clear())

describe('akcp save', () => {
  it('starts at zero stats and ignores a second award', () => {
    const first = awardActivity(emptyAkcpSave(), 'specs-order', 'planning', 'quest')
    expect(first.pointsGained).toBe(1)
    expect(first.save.stats.planning).toBe(1)
    const second = awardActivity(first.save, 'specs-order', 'planning', 'quest')
    expect(second.pointsGained).toBe(0)
    expect(second.save.stats.planning).toBe(1)
  })

  it('opens the penalty on the second fail and only once', () => {
    const once = recordFail(emptyAkcpSave(), 'specs-order')
    expect(once.penaltyPendingId).toBeNull()
    const twice = recordFail(once, 'specs-order')
    expect(twice.penaltyPendingId).toBe('specs-order')
    const acked = acknowledgePenalty(twice, 'specs-order')
    expect(acked.penaltyPendingId).toBeNull()
    const third = recordFail(acked, 'specs-order')
    expect(third.penaltyPendingId).toBeNull()
  })

  it('round-trips localStorage and clear removes the key', () => {
    writeAkcp(awardActivity(emptyAkcpSave(), 'specs-boss', 'planning', 'boss').save)
    expect(loadAkcp().clearedBossIds).toEqual(['specs-boss'])
    clearAkcpSave()
    expect(localStorage.getItem('akcp-save-v1')).toBeNull()
    expect(loadAkcp().stats.planning).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/akcp-grade.test.ts`

Expected: FAIL — cannot find `../src/akcp/save`.

- [ ] **Step 3: Implement `src/akcp/save.ts`**

Follow the `loadHunter` try/catch in `src/hunter.ts`. Unknown JSON returns `emptyAkcpSave()`. Stats object always has all six keys, default `0`. `protocolComplete` defaults false. This task does not set it true; the conclusion pass will.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/akcp-grade.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/akcp/save.ts tests/akcp-grade.test.ts
git commit -m "Add AKCP local save and penalty latch."
```

---

### Task 3: Specs graders and verbatim intro/specs pages

**Files:**

- Create: `src/akcp/grade.ts`
- Create: `src/akcp/books/osmani2026/intro.ts`
- Create: `src/akcp/books/osmani2026/specs.ts`
- Modify: `src/akcp/books/osmani2026/index.ts` (swap intro and specs stubs for the real sections)
- Test: `tests/akcp-grade.test.ts`, `tests/akcp-coverage.test.ts`

**Interfaces:**

- Consumes: `AkcpActivity`, `AkcpBoss`, `coverageGaps`, `triviaHits`, `AkcpSave`.
- Produces:

```ts
export interface Grade {
  win: boolean
  headline: string
  rows: { label: string; ok: boolean }[]
}

export function gradeActivity(activity: AkcpActivity, answer: OrderAnswer | TranscriptAnswer | ChecklistAnswer): Grade
export function gradeBoss(boss: AkcpBoss, beatIndex: number, answer: OrderAnswer | TranscriptAnswer | ChecklistAnswer): Grade

export type OrderAnswer = { kind: 'order'; submitted: string[] }
export type TranscriptAnswer = { kind: 'transcript'; marks: Record<string, 'keep' | 'stop'> }
export type ChecklistAnswer = { kind: 'checklist'; picked: string[] }
```

`gradeActivity` returns `win: false` and headline `Wrong activity` when `answer.kind !== activity.kind`. Order wins only on an index-aligned match to `correct`. Transcript wins only when every line’s submitted mark equals `line.mark`. Checklist wins only when the picked set equals the correct set (no extras, no gaps).

- [ ] **Step 1: Add failing grader tests and a book-coverage test**

Append to `tests/akcp-grade.test.ts`:

```ts
import { gradeActivity, gradeBoss } from '../src/akcp/grade'
import { SPECS_SECTION } from '../src/akcp/books/osmani2026/specs'
import type { AkcpActivity } from '../src/akcp/types'

function activity(id: string): AkcpActivity {
  const found = SPECS_SECTION.steps.find((s) => s.id === id)
  if (!found) throw new Error(id)
  return found
}

it('rejects codegen-first and accepts ask → spec → plan → code', () => {
  const order = activity('specs-order')
  expect(gradeActivity(order, { kind: 'order', submitted: ['code', 'ask', 'spec', 'plan'] }).win).toBe(false)
  expect(gradeActivity(order, { kind: 'order', submitted: ['ask', 'spec', 'plan', 'code'] }).win).toBe(true)
})

it('stops the transcript that postpones spec.md', () => {
  const transcript = activity('specs-transcript')
  expect(gradeActivity(transcript, {
    kind: 'transcript',
    marks: { wish: 'keep', skip: 'stop', later: 'keep' },
  }).win).toBe(false)
  expect(gradeActivity(transcript, {
    kind: 'transcript',
    marks: { wish: 'keep', skip: 'stop', later: 'stop' },
  }).win).toBe(true)
})

it('flags only the missing tests and the monolith task', () => {
  const checklist = activity('specs-checklist')
  expect(gradeActivity(checklist, { kind: 'checklist', picked: ['no-tests', 'monolith', 'has-reqs'] }).win).toBe(false)
  expect(gradeActivity(checklist, { kind: 'checklist', picked: ['monolith', 'no-tests'] }).win).toBe(true)
})

it('grades boss beats independently', () => {
  const boss = SPECS_SECTION.boss
  if (!boss) throw new Error('specs boss')
  expect(gradeBoss(boss, 0, { kind: 'order', submitted: ['code', 'ask', 'spec', 'plan'] }).win).toBe(false)
  expect(gradeBoss(boss, 0, { kind: 'order', submitted: ['ask', 'spec', 'plan', 'code'] }).win).toBe(true)
  expect(gradeBoss(boss, 2, { kind: 'checklist', picked: ['spec'] }).win).toBe(false)
  expect(gradeBoss(boss, 2, { kind: 'checklist', picked: ['plan', 'spec'] }).win).toBe(true)
})
```

Append to `tests/akcp-coverage.test.ts`:

```ts
it('covers the live Osmani book with no trivia hits', () => {
  expect(coverageGaps(OSMANI_BOOK)).toEqual([])
  expect(triviaHits(OSMANI_BOOK)).toEqual([])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/akcp-grade.test.ts tests/akcp-coverage.test.ts`

Expected: FAIL — missing grader or `coverageGaps(OSMANI_BOOK)` non-empty because specs is still indexed / empty.

- [ ] **Step 3: Implement graders and paste the eight paragraphs**

Implement `grade.ts` as specified. `intro.ts` exports `INTRO_SECTION`. `specs.ts` exports `SPECS_SECTION`. Build both from the quest tables in section 2. Paragraph `text` is the original article paragraph, and `text.includes(anchor)` is true for the anchor in section 2. Page ids match the table. `intro` is `status: 'playable'`, `questRequired: false`, `stat: null`, `steps: []`, `boss: null`. `specs` is `status: 'playable'`, `questRequired: true`, `stat: 'planning'`, three steps, boss with three beats. Each activity’s `maxAttempts` is 5. Constraints string on every activity: `Technical decision. 5 attempts.`

Wire them in `index.ts` in place of the intro and specs stubs. Leave the other ten sections indexed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/akcp-grade.test.ts tests/akcp-coverage.test.ts`

Expected: PASS. `coverageGaps` empty means every specs paragraph is on one page and in some `covers` array, intro has no boss, and indexed stubs have no body.

- [ ] **Step 5: Commit**

```bash
git add src/akcp tests/akcp-grade.test.ts tests/akcp-coverage.test.ts
git commit -m "Grade the specs dungeon and cover intro pages."
```

---

### Task 4: Reading Wizard, dungeon, and penalty UI

**Files:**

- Create: `src/akcp/ui.ts`
- Modify: `src/style.css` only if a selector is missing; reuse `.hud`, `.tile`, `.btn`, `.section-title`
- Test: `tests/akcp-hub.test.ts` (UI cases that mount `mountAkcp` on a bare `#app`, without `main.ts`)

**Interfaces:**

- Consumes: `ACTIVE_BOOK`, `gradeActivity`, `gradeBoss`, `loadAkcp`, `writeAkcp`, `awardActivity`, `recordFail`, `acknowledgePenalty`.
- Produces:

```ts
export interface AkcpCallbacks {
  onHub: () => void
  escapeHtml: (s: string) => string
}

export function mountAkcp(root: HTMLElement, callbacks: AkcpCallbacks): void
export function unmountAkcp(): void
```

DOM contract:

| Id | When |
| --- | --- |
| `#akcp` | Always while mounted |
| `#btn-akcp-hub` | Always. Calls `onHub` |
| `#akcp-stats` | Map screen. Text includes `Planning` and the current number |
| `#akcp-section-intro` | Map. Enabled |
| `#akcp-section-specs` | Map. Disabled until `intro.page.1`–`intro.page.4` are all in `pagesRead`. Enabled after |
| `#akcp-section-chunks` | Map. Disabled. Badge text `Indexed` |
| `#akcp-page` | Wizard. `data-page-id` is the page id. Body includes the paragraph text |
| `#btn-akcp-next` | Wizard, when a later page exists |
| `#btn-akcp-prev` | Wizard, when a previous page exists |
| `#btn-akcp-done` | Last intro page only. Records the page, returns to the map |
| `#btn-akcp-enter-dungeon` | Last specs page only |
| `#akcp-quest` | Quest. `data-quest-id` |
| `#akcp-order` | Order quest. Children `[data-step-id]` |
| `#btn-akcp-submit` | Quest or boss beat, hidden while `#akcp-penalty` is showing |
| `#akcp-penalty` | When `penaltyPendingId` is set. Shows the paragraph text |
| `#btn-akcp-reread` | Penalty. Calls `acknowledgePenalty` |
| `#akcp-boss` | Boss. `data-boss-id="specs-boss"` |
| `.hud` | Wizard and quest. Four labels: Goal, Constraints, Attempt, Next action |

HUD constraints on a quest include `Technical decision. 5 attempts.` The dungeon footer includes the training-sim sentence from Global Constraints.

Showing a page appends its id to `pagesRead` once, including the first page of a section. The order quest’s initial row order is `ask`, `spec`, `plan`, `code`. A miss re-renders that same initial order.

Order controls: each step is a row `[data-step-id]` with buttons `[data-move="up"]` and `[data-move="down"]`. Submit reads the DOM order top to bottom. Transcript lines use `input[name="mark-<lineId>"]` with values `keep` and `stop`. Checklist options use `input[type="checkbox"][value="<optionId>"]`.

After a winning quest submit, call `awardActivity` and return to the section’s quest list. After a losing submit, call `recordFail`, show the checklist rows, and re-render. Quest list order is the three steps, then the boss button `[data-boss-id="specs-boss"]`. That button is disabled until the three quest ids are cleared. Click handlers and the first paint both call `loadAkcp()`, so a save written before `mountAkcp` is visible immediately.

A winning boss beat renders the next beat on the same `#akcp-boss`. The last winning beat calls `awardActivity(..., 'boss')` and returns to the protocol map.

- [ ] **Step 1: Write the failing DOM test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { mountAkcp } from '../src/akcp/ui'
import { clearAkcpSave, loadAkcp, writeAkcp } from '../src/akcp/save'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="app"></div>'
})

describe('akcp wizard', () => {
  it('reads intro pages in order and then unlocks specs', () => {
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    document.querySelector<HTMLButtonElement>('#akcp-section-intro')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('intro.page.1')
    document.getElementById('btn-akcp-next')!.click()
    document.getElementById('btn-akcp-next')!.click()
    document.getElementById('btn-akcp-next')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('intro.page.4')
    document.getElementById('btn-akcp-done')!.click()
    expect(loadAkcp().pagesRead).toEqual([
      'intro.page.1', 'intro.page.2', 'intro.page.3', 'intro.page.4',
    ])
    expect(document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.disabled).toBe(false)
    document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.click()
    expect(document.querySelector('#akcp-page')?.getAttribute('data-page-id')).toBe('specs.page.1')
  })

  it('shows the penalty page on the second wrong order', () => {
    const read = ['intro.page.1', 'intro.page.2', 'intro.page.3', 'intro.page.4', 'specs.page.1', 'specs.page.2', 'specs.page.3', 'specs.page.4']
    writeAkcp({ ...loadAkcp(), pagesRead: read })
    mountAkcp(document.getElementById('app')!, { onHub: () => {}, escapeHtml })
    document.querySelector<HTMLButtonElement>('#akcp-section-specs')!.click()
    // land on the dungeon from the last page
    while (document.getElementById('btn-akcp-next')) document.getElementById('btn-akcp-next')!.click()
    document.getElementById('btn-akcp-enter-dungeon')!.click()
    document.querySelector<HTMLButtonElement>('[data-quest-id="specs-order"]')!.click()
    const submitWrong = () => {
      const list = document.getElementById('akcp-order')!
      const code = list.querySelector<HTMLElement>('[data-step-id="code"]')!
      list.prepend(code)
      document.getElementById('btn-akcp-submit')!.click()
    }
    submitWrong()
    expect(document.getElementById('akcp-penalty')).toBeNull()
    submitWrong()
    expect(document.getElementById('akcp-penalty')?.textContent).toContain("Don't just throw wishes")
    expect(document.getElementById('btn-akcp-submit')).toBeNull()
    document.getElementById('btn-akcp-reread')!.click()
    expect(document.getElementById('akcp-quest')?.getAttribute('data-quest-id')).toBe('specs-order')
  })
})
```

The quest-list control is a button `[data-quest-id="specs-order"]` inside `#akcp`, shown after **Enter the dungeon**. A page id is appended to `pagesRead` when that page is shown, including the first page. On the last intro page, `#btn-akcp-next` is absent and `#btn-akcp-done` returns to the map.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/akcp-hub.test.ts`

Expected: FAIL — `mountAkcp` is not defined.

- [ ] **Step 3: Implement `mountAkcp`**

One screen at a time inside `#akcp`: map, wizard, quest list, quest, penalty, boss beat. Re-render the root’s inner HTML and rebind. Escape every paragraph and label through `callbacks.escapeHtml`. On a correct order submit, Planning becomes 1 in `akcp-save-v1`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/akcp-hub.test.ts tests/akcp-grade.test.ts tests/akcp-coverage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/akcp/ui.ts src/style.css tests/akcp-hub.test.ts
git commit -m "Mount the AKCP reading wizard and specs dungeon."
```

---

### Task 5: Hub tile and rank isolation

**Files:**

- Modify: `src/main.ts` (`Screen`, `render`, `renderHub`, `bindHub`, `__ptReset`)
- Test: `tests/akcp-hub.test.ts` (append the hub-boot cases)

**Interfaces:**

- Consumes: `mountAkcp`, `unmountAkcp`, `clearAkcpSave`.
- Produces: hub button `#tile-akcp` and screen `akcp`. No new export from `main.ts`.

- [ ] **Step 1: Write the failing hub-boot tests**

Append the `describe` block below to `tests/akcp-hub.test.ts`. Add `vi` to the existing Vitest import, and import `loadAkcp` from `../src/akcp/save` if it is not already imported. Do not paste a second import block into the middle of the file. The `boot` helper stays above the new `describe`.

```ts
async function boot(): Promise<HTMLElement> {
  vi.resetModules()
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  return document.getElementById('app')!
}

describe('akcp on the association hub', () => {
  beforeEach(() => localStorage.clear())

  it('opens from a fresh E-rank hub and returns without creating a hunter save', async () => {
    const app = await boot()
    const tile = app.querySelector<HTMLButtonElement>('#tile-akcp')!
    expect(tile.disabled).toBe(false)
    expect(app.querySelector('.rank-letter')?.textContent).toBe('E')
    expect(app.querySelector('#tile-trapdoor')).not.toBeNull()
    expect(app.querySelector('#tile-heist')).not.toBeNull()
    for (const title of ['Rank D', 'Rank C', 'Rank B', 'Rank A', 'Rank S']) {
      expect(app.textContent).toContain(title)
    }
    tile.click()
    expect(app.querySelector('#akcp')).not.toBeNull()
    app.querySelector<HTMLButtonElement>('#btn-akcp-hub')!.click()
    expect(app.querySelector('#hub')).not.toBeNull()
    expect(localStorage.getItem('hunter-association-save-v1')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('still offers the class screen, and Later returns to a hub that contains AKCP', async () => {
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({ xp: 40, awarded: ['trapdoor:1', 'heist:1'], classId: null }))
    const app = await boot()
    expect(app.querySelector('#class-pick')).not.toBeNull()
    app.querySelector<HTMLButtonElement>('#btn-class-later')!.click()
    expect(app.querySelector('#tile-akcp')).not.toBeNull()
    vi.unstubAllGlobals()
  })

  it('clears the specs dungeon without changing rank XP or the C door', async () => {
    localStorage.setItem('hunter-association-save-v1', JSON.stringify({
      xp: 100,
      awarded: ['trapdoor:1', 'heist:1', 'shadow:1', 'shadow:2', 'shadow:3'],
      classId: 'shadow',
    }))
    localStorage.setItem('hunter-dgates-save-v1', JSON.stringify({ shadow: [1, 2, 3] }))
    localStorage.setItem('prompt-trapdoor-save-v1', JSON.stringify({ levelIndex: 1, attempt: 1, cleared: [1] }))
    localStorage.setItem('token-heist-save-v1', JSON.stringify({ cleared: [1] }))
    const app = await boot()
    expect(app.querySelector<HTMLButtonElement>('[data-gate="runaway"]')!.disabled).toBe(false)
    const pages = ['intro.page.1', 'intro.page.2', 'intro.page.3', 'intro.page.4', 'specs.page.1', 'specs.page.2', 'specs.page.3', 'specs.page.4']
    const { writeAkcp, loadAkcp: readSave } = await import('../src/akcp/save')
    writeAkcp({ ...readSave(), pagesRead: pages })
    app.querySelector<HTMLButtonElement>('#tile-akcp')!.click()
    app.querySelector<HTMLButtonElement>('#akcp-section-specs')!.click()
    while (app.querySelector('#btn-akcp-next')) app.querySelector<HTMLButtonElement>('#btn-akcp-next')!.click()
    app.querySelector<HTMLButtonElement>('#btn-akcp-enter-dungeon')!.click()

    const submit = () => app.querySelector<HTMLButtonElement>('#btn-akcp-submit')!.click()
    app.querySelector<HTMLButtonElement>('[data-quest-id="specs-order"]')!.click()
    submit()
    app.querySelector<HTMLButtonElement>('[data-quest-id="specs-transcript"]')!.click()
    for (const [id, mark] of [['wish', 'keep'], ['skip', 'stop'], ['later', 'stop']] as const) {
      app.querySelector<HTMLInputElement>(`input[name="mark-${id}"][value="${mark}"]`)!.click()
    }
    submit()
    app.querySelector<HTMLButtonElement>('[data-quest-id="specs-checklist"]')!.click()
    for (const id of ['no-tests', 'monolith']) {
      app.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${id}"]`)!.click()
    }
    submit()
    app.querySelector<HTMLButtonElement>('[data-boss-id="specs-boss"]')!.click()
    submit()
    for (const [id, mark] of [['rush', 'stop'], ['hold', 'keep']] as const) {
      app.querySelector<HTMLInputElement>(`input[name="mark-${id}"][value="${mark}"]`)!.click()
    }
    submit()
    for (const id of ['spec', 'plan']) {
      app.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${id}"]`)!.click()
    }
    submit()

    expect(loadAkcp().stats.planning).toBe(4)
    app.querySelector<HTMLButtonElement>('#btn-akcp-hub')!.click()
    expect(app.querySelector('.rank-card')?.textContent).toContain('100 XP')
    expect(app.querySelector<HTMLButtonElement>('[data-gate="runaway"]')!.disabled).toBe(false)
    expect(JSON.parse(localStorage.getItem('hunter-association-save-v1')!).xp).toBe(100)
    vi.unstubAllGlobals()
  })

  it('resets the protocol save with the rest of the browser save', async () => {
    const app = await boot()
    app.querySelector<HTMLButtonElement>('#tile-akcp')!.click()
    expect(localStorage.getItem('akcp-save-v1')).not.toBeNull()
    ;(window as unknown as { __ptReset: () => void }).__ptReset()
    expect(localStorage.getItem('akcp-save-v1')).toBeNull()
    expect(app.querySelector('#hub')).not.toBeNull()
    vi.unstubAllGlobals()
  })
})
```

`mountAkcp` writes `akcp-save-v1` on first mount (call `writeAkcp(loadAkcp())` if the key is missing) so the reset test has a key to remove. The order quest submits in its initial correct order. The boss order beat does too. Transcript and checklist beats need the clicks above. After the boss checklist submit, the UI returns to the protocol map, where `#btn-akcp-hub` is present.

The class-screen test depends on `syncClearedGates` during boot. Seeding trapdoor and heist cleared levels is what `tests/hub.test.ts` already does; `eGateThresholdMet` then sends the hunter to `#class-pick` because `classId` is null.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/akcp-hub.test.ts`

Expected: FAIL — `#tile-akcp` is null.

- [ ] **Step 3: Wire the hub**

In `renderHub()`, put the button from section 1 as the third child of the existing `.hub-grid` (after Heist, before `${gatesHtml}`). Badge text is `Enter`, or `Specs clear` when `loadAkcp().clearedBossIds` includes `specs-boss`.

In `bindHub()`:

```ts
document.getElementById('tile-akcp')?.addEventListener('click', () => {
  resumeNote = null
  screen = 'akcp'
  render()
})
```

In `render()`, before the final `else` (the trapdoor game):

```ts
} else if (screen === 'akcp') {
  mountAkcp(app, {
    onHub: () => {
      unmountAkcp()
      screen = 'hub'
      render()
    },
    escapeHtml,
  })
}
```

Import `mountAkcp`, `unmountAkcp`, and `clearAkcpSave`. In `__ptReset`, call `clearAkcpSave()` and `unmountAkcp()` next to the other clears. Do not call `awardGate` from AKCP code.

- [ ] **Step 4: Run the full suite**

Run: `npm test`

Expected: PASS, including `tests/hub.test.ts` and the new AKCP files.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts tests/akcp-hub.test.ts
git commit -m "Open AKCP from the hub without moving rank."
```

---

### Task 6: Acceptance sweep

**Files:**

- Modify: `README.md` (one short Modes subsection pointing at this plan and the hub tile)
- Test: no new file; the list in section 2 is the suite you just ran

**Interfaces:**

- Consumes: the DOM ids and save key from Tasks 1–5.
- Produces: a README pointer. No gameplay change.

- [ ] **Step 1: Confirm the acceptance list**

Run: `npm test`

Expected: PASS. Then walk the list in section 2 item by item against `tests/akcp-hub.test.ts`, `tests/akcp-grade.test.ts`, and `tests/akcp-coverage.test.ts`. If an item has no assertion, add the assertion to the matching file and re-run. Do not add a new quest.

- [ ] **Step 2: README pointer**

Under Modes in `README.md`, add a short subsection:

```md
### AKCP (open world)

Hub tile **AKCP**. Optional protocol module (Advanced Knowledge Collecting Protocol). Reading Wizard plus technical workflow quests. Does not change E–S rank. Save key `akcp-save-v1`. Plan: [docs/AKCP-OPEN-WORLD-MODULE-PLAN.md](docs/AKCP-OPEN-WORLD-MODULE-PLAN.md).
```

- [ ] **Step 3: Run the suite again**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md tests/akcp-hub.test.ts tests/akcp-grade.test.ts tests/akcp-coverage.test.ts
git commit -m "Document the AKCP hub module and lock its acceptance tests."
```

The MVP stops here. The next implementation pass is section 3’s **Pass 1 (`chunks`)**, and only after Stefan asks for it.

---

## Spec coverage check

| Requirement | Where this plan answers it |
| --- | --- |
| Selectable from the main menu / hub | Section 1, Task 5 |
| Coexists with E–S, class pick, Casino, harness | Section 1 and section 4 |
| Reading Wizard, original wording, intro + first section | Section 2, Tasks 3–4 |
| 2–3 technical quests + boss | Section 2 (`specs-order`, `specs-transcript`, `specs-checklist`, `specs-boss`) |
| Acceptance tests | Section 2 list, Tasks 1–6 |
| Coverage map, tests fail on gaps | `coverageGaps`, Task 1 and Task 3 |
| Ordered path through the rest of the article | Section 3, passes 1–10 |
| PDF-swappable schema | `AkcpBook` in section 2; `ACTIVE_BOOK` |
| Stats, penalty, localStorage | Section 2, Task 2, Task 4 |
| Technical quests, no English-trivia googling | Section 5, `triviaHits` |
| Do not build National, Worker wake, or gate rewrites in this module | Section 3, “Outside this module’s sequence” |
| One next step | “Do this next” at the top: Tasks 1–6 only |
