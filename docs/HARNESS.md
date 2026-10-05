# Grok 4.7 harness: build while you play

The harness lets you prompt new content from inside the game and keep playing while Grok Bot builds it. You play on the web build until the new version is live there. The APK comes later, only if you ask for one. The running app does **not** hot-reload itself mid-session.

## The human loop

```
play (web or APK)
  └─ 💡 Prompt next gate  (hub strip; stored on this device, nothing is sent)
       └─ Handoff → paste into Grok Bot chat
            🧠 inventing    Grok 4.7 plans a gate spec (planning mode)
            🔨 building     Grok Bot writes src/gates/<door>.ts + tests on the box
            🌐 web_ready    npm test + npm run build pass → refresh the web build and play
            📦 apk_building optional: HARNESS_JOB=<id> npm run android:apk
            📱 apk_ready    zip/APK handed over
            ⚠️ failed       note says why → re-prompt or retry (failed → inventing | building)
```

You keep playing on **web** the whole time (`http://localhost:5173/prompt-trapdoor/` on the box, or Pages once it's deployed). The game checks `harness-status.json` every 15 s. When a state changes, a toast appears and a pulsing pill (top-right) shows while something is in flight (`inventing`, `building`, `apk_building`).

## Pieces

| File | Role |
| --- | --- |
| `src/harness/buildQueue.ts` | Job model, the state machine (`TRANSITIONS`), localStorage queue `hunter-harness-queue-v1`, handoff text, remote merge, APK normalization |
| `src/harness/harnessUi.ts` | Hub strip (status + **Prompt next gate** composer + handoff/copy + recent jobs), floating toast, in-flight pill, poller |
| `scripts/harness.mjs` | CLI Grok Bot runs on the box. Writes `public/harness-status.json` and mirrors it to `dist/` so `vite preview` picks it up without a rebuild |
| `public/harness-status.json` | Status file the game polls. It ships inside every build too |
| `scripts/android-apk.sh` | With `HARNESS_JOB=<id>`, flips the job to `apk_building`, then `apk_ready` (or `failed` on error) |
| `tests/harness.test.ts` | Queue, transitions, merge, poll, CLI ↔ game state-machine parity, hub strip DOM flow |

### Job states and allowed moves

| From | To |
| --- | --- |
| inventing | building, failed |
| building | web_ready, failed |
| web_ready | apk_building, building (another pass), failed |
| apk_building | apk_ready, failed |
| apk_ready | building (next iteration) |
| failed | inventing, building |

Both the game and the CLI hold this table. A test fails if the two copies drift apart.

## Grok Bot side (box)

```bash
cd /workspace/prompt-trapdoor
node scripts/harness.mjs add --id hj-xxxx --kind gate --prompt "door about fake citations"   # id from the in-game handoff
node scripts/harness.mjs set hj-xxxx building --note "Grok 4.7 spec done, writing src/gates/…"
npm test && npm run build                      # gate for web_ready
node scripts/harness.mjs set hj-xxxx web_ready --result <gateId> --note "Refresh web to play"
HARNESS_JOB=hj-xxxx npm run android:apk        # optional → apk_building → apk_ready
node scripts/harness.mjs list
```

`latest` works in place of an id. If a job was queued from chat and not from the game, `add` without `--id` creates one, and the game shows it on the next poll.

## Grok 4.7 authoring target (gate spec)

Grok 4.7 writes specs and Grok Bot turns them into code. The spec stays inside the stage kinds the renderer already supports. That keeps a freeform prompt from turning into arbitrary code:

| Kind | Player does | Example doors |
| --- | --- | --- |
| `text` | Writes a short message; 5 attempts; checklist after each | Whispered Override |
| `select` | Taps cards (≤ maxPicks, `1` = swap), optional token budget, then runs | Seal the Hierarchy, Schema Croupier, Say It Again Safer |
| `sampling` | Temperature / top-k / top-p over candidate logits | Temperature Casino |
| `knobs` | Any sliders + on/off chips, live sample preview + live checklist, then Lock | Stop the Runaway, Logit Ward 1–2 |

Each spec gives: door id, emoji, rank, class road, tagline, and 3 stages. Each stage has title, goal, brief, constraints, tip, concept (the defense it names), nextAction, kind-specific data, and **win/fail cases** that become vitest assertions. The rules stay the same as everywhere else: a local deterministic mock, fake targets only (MailMole, Archive Wisp, Ticket Imp, Reward Pup, Exam Mirror), and the fake canary `HA-CANARY-7F3A`. No real systems and no real secrets.

## Not in scope (on purpose)

- The phone or the browser calling a model API. No keys, cost, or latency on the device.
- Hot-reloading the running APK. Play on web until the next APK lands.
- Code generated without a human tap. Every job starts from your prompt, and nothing ships until tests pass.

## Odds (from the planning chat)

Status in the game, web-first play, and the APK as a later artifact: roughly **75–85%** that it feels fluid. The slow part is APK rebuild time (minutes), and web play covers that wait.
