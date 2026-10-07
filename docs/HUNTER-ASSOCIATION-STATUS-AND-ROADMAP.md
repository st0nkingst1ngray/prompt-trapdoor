# Hunter Association — status and roadmap

Date: 2026-10-05. Plan only. This file does not change the game.

Stefan can start here. The history below is already filled in.

## Where the truth is

| Place | What it actually is on 2026-10-05 |
| --- | --- |
| **Box** | The game you play. Ranks E–S, harness, Android wrap, Cloudflare Worker project. Vitest on the 15:09 snapshot: **13 files, 149 passed**. |
| **GitHub `main`** | Stuck at `caf2252` (2026-10-01). Prompt Trapdoor + Token Heist only. Casino is a locked stub. No classes, no harness, no Worker, no APK. |
| **Pages** | <https://st0nkingst1ngray.github.io/prompt-trapdoor/> returns **Prompt Trapdoor**, `last-modified` **2026-10-01 22:33 UTC**. Same early hub as `main`. |
| **PR #2** (draft) | `docs/HUNTER-ASSOCIATION-PLAN.md` only. The E→National layer plan. Not merged. |
| **PR #3** (draft) | Pre-APK **GO** report plus an older box import. **170 tests**. That tree has no `workers/` folder. Not merged. |
| **PR #1** (open) | Grok usage dashboard. Leave it out of the game tree. |
| **Worker** | Live. `GET /v1/health` returned `{"ok":true}` on 2026-10-05. |

The box and PR #3 have **diverged**. The box grew the private harness API. PR #3 grew extra tests (knowledge possession, unlock ladder, two harness moves) on an earlier snapshot. Neither side has the other’s latest work. `main` has neither.

## What exists now

### Ranks and gates (box, playable)

Training sim. Local mock. Sticky HUD, stage pips, **Explain why**. No model API key inside a gate.

XP is **+20** per first stage clear. Rank bands in `src/hunter.ts` (PR #3 import of the game):

| Badge | XP to enter | Arc | Your door |
| --- | --- | --- | --- |
| E | 0 | Tokens and prompts | Prompt Trapdoor (5) + Token Heist (4) |
| D | 40 | Attention / injection | Class door, 3 stages |
| C | 100 | Sampling | Class door. Necrotech’s is Temperature Casino, open early at D |
| B | 160 | Memory / RAG | Class door |
| A | 220 | Training | Class door + **Know it** |
| S | 280 | Agents | Class door + **Know it**. 340 XP is still S |

Class pick after Trapdoor level 1 **and** Heist level 1, or after all 5 Trapdoor levels. Clear **your** door, then the other three at that rank open (cross-training). Sibling XP does not skip your next door.

| Class | D | C | B | A | S |
| --- | --- | --- | --- | --- | --- |
| Shadow Promptor (offense) | Whispered Override | Stop the Runaway | Note in the Margin | Clap Trap | Whisper in the Ticket |
| Barrier Mage (defense) | Seal the Hierarchy | Logit Ward | Empty Shelf | Mirror Exam | Second Pair |
| Necrotech (internals) | Context Autopsy | Temperature Casino | Pin the Oath | Forgot the Oath | Ten Steps |
| Guild Master (agents / RAG) | Confused Deputy | Schema Croupier | Near but Wrong | Salt in the Batch | Keyring |

**Not in the game:** National Systems. The names already written in PR #2, and not built, are **Stacked Gate**, **Defense in Depth**, **After Action**, **National Trial**. Harder gates between ranks are also not built. `LEVELS.md` and `registry.ts` say the current ranks are **demo difficulty** on purpose.

PR #3’s README still says A is 220–299 and S starts at 300. The ladder in `hunter.ts` is the one above. Trust the ladder.

### Harness (box)

Play on the web while a build runs. The open app does not hot-reload. APK is a later zip when you ask.

States: `inventing` → `building` → `web_ready` → `apk_building` → `apk_ready`, or `failed` back to `inventing` / `building`.

In the hub: status strip, **Prompt next gate**, ⚙️ API panel, copy-handoff if the API is absent. Queue key `hunter-harness-queue-v1`. The game polls `harness-status.json`. Spec: `docs/HARNESS.md` on PR #3.

### Cloudflare Worker (box, live)

Base URL (no token in this doc):

`https://hunter-harness-api.hunter-assoc-6xa92l.workers.dev`

| Call | Role |
| --- | --- |
| `POST /v1/prompt` | In-game prompt becomes a job |
| `GET /v1/status` | Hub reads jobs |
| `PATCH /v1/jobs/:id` | Move a job’s state |
| `GET /v1/health` | Liveness. Checked 2026-10-05: `{"ok":true}` |

Auth is `Authorization: Bearer` plus the Worker secret `HARNESS_TOKEN`. Storage is KV. Browser calls are CORS-limited. The phone stores the URL and the token in the ⚙️ API panel on **that device**. An optional notify webhook exists and is **not** wired to a Grok Bot wake routine.

Box layout for this piece: `workers/`, `src/harness/remoteApi.ts`, `tests/harnessApi.test.ts` (5), `tests/harnessApiWorker.test.ts` (9). Those files are **not** on `main` or on PR #3.

### Android APK

- Package `io.github.st0nkingst1ngray.prompttrapdoor`, app name Hunter Association, version 0.1.0.
- Script: `npm run android:apk` (JDK 21, `CAPACITOR=1`, relative `./assets/`).
- `npm run build` is the Pages base `/prompt-trapdoor/`. Copying that `dist/` into the WebView leaves a blank screen.
- PR #3 verdict: **GO** for a **debug** bake. Gradle was not run in that pass. No release keystore.
- If the APK on the phone was built before the ⚙️ API panel, rebuild once so the phone can reach the Worker.

### Tests, two numbers

| Tree | Tests | Has Worker API tests | Has the extra A/S knowledge + unlock-ladder tests from PR #3 |
| --- | --- | --- | --- |
| Box snapshot 15:09 | 149 passed | Yes | Not in that run (`harness.test.ts` is 12, not 14) |
| PR #3 | 170 passed | No | Yes (30 + 3 + 2) |

Do not quote 170 as the current box, and do not quote 149 as PR #3.

## Stefan’s prompts → what shipped

Prefer these rows over a new gate list. Door names through S match the plan that expanded his arc. He has not replaced those names.

| He asked for | Shipped | Still open |
| --- | --- | --- |
| Prompt Trapdoor as LLM-security training, ADHD-friendly | E hub: sticky HUD, instant mock, Explain why, autosave | Public site still shows this hub only |
| Solo Leveling–**inspired** ranks and classes. Not affiliated | Four classes, E–S badge, class road on the hub | National badge. Privacy, Terms, and the inspired-by line before anyone else installs it |
| Full LLM path, not only injection: tokens → attention → sampling → memory → training → agents → systems | E through S doors in that order | **Systems / National** |
| Knowledge possession from Rank A up | Know-it strip on every A and S stage. Wrong or missing defense fails the clear | PR #3’s extra 30 assertions may be missing on the latest box. Re-check after the sync |
| Demo difficulty now. Much harder **between** ranks later | Demo clears, called out in `LEVELS.md` | Inter-rank bridges |
| Invent the next gate as he develops, and prefer **his** prompt over an invented brief | Hub reveals the next written door. **Prompt next gate** stores his words for handoff | Webhook does not wake Grok Bot yet. New National work waits for his prompt if he wants different doors than PR #2 |
| Private API so only he drives the app | Worker live, bearer token, device-local ⚙️ API | Token stays out of git, Pages, and chat |
| Web play while the APK builds. No same-session hot reload | Harness states + web build. APK script flips the job when `HARNESS_JOB` is set | Phone and browser saves are separate |
| Android APK and a zip | Capacitor project + `android:apk` on the box. PR #3 says debug bake is GO | Confirm a debug APK that includes the API panel |
| Cloudflare account and a Worker he can manage | Worker above. Teammate bot is the Cloudflare workflow | Wake routine on the notify webhook |
| Build on Grok Bot / the box. Cloud agents: Grok 4.7 or Composer only. Tokens are tight | This split is the cost of building on the box faster than GitHub | One tree, then small slices |

## Next stretch (about 30 days of sessions)

Order is the point. Each item is one session. Stop when tokens hurt. Do not start National on a second copy of the repo.

1. **One tree.** From the box, land gates + `workers/` + harness in git. Cherry-pick PR #3’s knowledge and unlock-ladder tests onto that tree if the box does not already have them. Run `npm test` once and record the new count. Leave PR #1 alone.
2. **Phone loop.** Paste Worker URL + token in ⚙️ API on the device. Send one prompt. See the job on the hub. Rebuild the debug APK only if that panel is missing.
3. **Webhook wake.** Connect the Worker’s optional notify to a Grok Bot routine that starts on a new prompt. Keep copy-handoff as the fallback when the routine is down.
4. **National, his written names, one door per session.** Demo difficulty. Stacked Gate, then Defense in Depth, then After Action, then National Trial (4 of 5, title **LLM Shadow Hunter**). Stage wins stay the ones in PR #2. If he prompts a different Systems door, that prompt replaces the next unbuilt name.
5. **Privacy, Terms, hub line — before a public Pages or store share.** Device-only progress, no account, fake local model, not a license to attack a real system, inspired-by / not affiliated. Review class lore for borrowed character names (Necrotech text on the PR #3 tree says “Jinwoo”).
6. **Difficulty ramp.** After National is playable on demo, add harder bridges **between** ranks. Do not retune a demo door in the same change as a new door. Wait for his prompt on what “harder” should mean.

Pages publish is a switch he throws **after** step 1, and after step 5 if the audience is anyone but him. Until then, play on the box web build.

## Risks

- **Tokens.** He is low. Prefer Grok Bot on the box for the next door. Cloud agents stay on Grok 4.7 or Composer. Rebuilding E–S from scratch spends the budget the sync is meant to save.
- **Secrets.** `HARNESS_TOKEN` lives in the Worker and in the phone panel. Do not commit `.harness.local`, Wrangler secrets, or the token. This doc has none.
- **IP.** Ranks feel like that fiction and are not a license. No copied art, no “Arise”, no affiliation claim. The Necrotech lore line that names Jinwoo should be rewritten before a public build. Privacy and Terms are still absent, so the public URL should stay the old hub until those pages exist.
- **Pages and git lag.** The live site is the 1 October game. The Pages API has also pointed at `cursor/grok-usage-observability-78a6`. Publishing `main` as it is today republishes Prompt Trapdoor. Publishing the usage branch can replace the game with the dashboard. Desktop copy-from-box is set to Never, so the sync has to start on the box.
- **Two test totals.** Shipping from PR #3 drops the Worker. Shipping from the 149-test snapshot can drop the stricter A/S checks. The sync in step 1 is what makes “green” mean one thing.
- **APK base path.** Android builds need `npm run android:apk`. A Pages `dist/` in the WebView is a blank app.
- **Saves.** `localStorage` on that browser or that WebView only. Phone progress does not follow a desktop session.

## Pick one tomorrow

Three choices. One is enough.

1. **Sync the box to GitHub.** One branch with the Worker and the PR #3 tests. Do not deploy Pages in that same step.
2. **Prove the private loop.** One prompt from the phone API panel to the live Worker, token typed on the device only.
3. **Build Stacked Gate only**, on the box, demo difficulty, three beats already specified (retrieve, tool, sample). Skip this if he would rather spend the session on the webhook wake.

After any of the three, the next session rereads this file instead of retelling the arc.
