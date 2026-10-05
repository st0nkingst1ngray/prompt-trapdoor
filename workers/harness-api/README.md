# hunter-harness-api — private harness bridge (Stefan only)

A small Cloudflare Worker that lets **Prompt next gate** in Hunter Association send a prompt straight to the build queue, so you don't have to paste it into chat. Grok Bot then moves the job through the same states the game already shows. It is personal glue for one player. There are no accounts and no multiplayer, and the only purpose is to queue work on this game.

```
game (web / APK) ──POST /v1/prompt──▶ Worker ──KV──▶ job hj-…  (state: inventing)
                                         └─(optional) POST NOTIFY_WEBHOOK_URL  {type, jobId, textPreview, rank, classId}
Grok Bot (box) ──node scripts/harness.mjs pull / set …──▶ PATCH /v1/jobs/:id
game ◀──GET /v1/status every 15 s── hub strip + toast + "process ongoing" pill
```

## Endpoints

All responses are JSON with `Cache-Control: no-store`.

| Method | Path | Auth | Body / result |
| --- | --- | --- | --- |
| GET | `/v1/health` | none | `{ ok: true }` and nothing else |
| POST | `/v1/prompt` | Bearer | `{ text, kind?, rank?, classId?, xp?, lastGate?, screen?, client? }` → `201 { ok, job, notified }` |
| GET | `/v1/status` | Bearer | `?limit=1..50` → `{ ok, version: 1, updatedAt, jobs }` (newest first, same shape as `harness-status.json`) |
| GET | `/v1/status/:jobId` | Bearer | `{ ok, job }` or 404 |
| PATCH | `/v1/jobs/:id` | Bearer | `{ state, note?, result? }` → `{ ok, job }`. An illegal move returns **409** |
| OPTIONS | `*` | none | CORS preflight, answered only for origins listed in `ALLOWED_ORIGINS` |

The states and allowed moves are identical to `src/harness/buildQueue.ts` and `scripts/harness.mjs`. A test fails if the copies drift.
`inventing → building → web_ready → apk_building → apk_ready`, plus `failed` from any in-flight state, `failed → inventing | building`, `web_ready → building`, and `apk_ready → building`.

**Guard rails**
- The Bearer check hashes both sides with SHA-256, then compares them with `crypto.subtle.timingSafeEqual`.
- If `HARNESS_TOKEN` is missing or shorter than 24 characters, every call gets `503`, so the Worker never runs open by accident.
- Request bodies are capped at 4 KB and prompts at 500 characters. Prompts are limited to 6 per minute (429) in case the token ever leaks.
- A browser `Origin` that isn't in `ALLOWED_ORIGINS` gets `403`. Callers that send no Origin (curl, the Grok Bot CLI) only need the token.
- Jobs expire from KV after 60 days. The index keeps the newest 50.
- The webhook payload never carries the token or the full prompt, only a preview of 120 characters or fewer.

## Deploy (once)

Wrangler 4 needs **Node ≥ 22**. On the box (Node 20) prefix commands with `npx -y node@22 node_modules/wrangler/bin/wrangler.js` in place of `npx wrangler`.

```bash
cd workers/harness-api
npm install
npx wrangler login                                   # opens the browser, Cloudflare account
npx wrangler kv namespace create HARNESS_KV          # copy the printed id into wrangler.jsonc → kv_namespaces[0].id
openssl rand -base64 36 | tr -d '\n'                 # make a token (≥ 24 chars). Keep it in your password manager
npx wrangler secret put HARNESS_TOKEN                # paste the token
npx wrangler deploy                                  # prints https://hunter-harness-api.<subdomain>.workers.dev
BASE=https://hunter-harness-api.<subdomain>.workers.dev TOKEN=<token> bash smoke.sh   # optional: creates 1 "smoke test" job
```

Optional secrets:

```bash
npx wrangler secret put NOTIFY_WEBHOOK_URL      # https URL of a Grok Bot routine webhook (or any hook)
npx wrangler secret put NOTIFY_WEBHOOK_BEARER   # only if that webhook wants an Authorization: Bearer header
```

`ALLOWED_ORIGINS` is a plain var in `wrangler.jsonc`. The default is `capacitor://localhost,https://localhost,http://localhost:5173`, which covers the iOS Capacitor WebView, the Android Capacitor 7 WebView, and the web dev server. If you play the GitHub Pages build, add `https://st0nkingst1ngray.github.io` and redeploy.

To rotate the token, run `npx wrangler secret put HARNESS_TOKEN` again. Then paste the new token in the game (⚙️ API) and in `.harness.local` on the box.

## Webhook → Grok Bot routine

When `NOTIFY_WEBHOOK_URL` is set, each new prompt sends:

```json
{ "type": "harness.prompt", "jobId": "hj-…", "kind": "gate", "textPreview": "first ≤120 chars", "rank": "B", "classId": "barrier", "at": "2026-10-05T11:30:00.000Z" }
```

Point a Grok Bot webhook routine at it. Suggested routine instruction:

> On harness.prompt: `cd /workspace/prompt-trapdoor && node scripts/harness.mjs pull`, then build job `<jobId>` per docs/HARNESS.md (Grok 4.7 spec → gate code + tests → `set <jobId> building` / `web_ready`).

The routine gets the full prompt with its own token through `pull`. The webhook body isn't trusted for anything beyond "go look". Without a webhook, prompts still queue in KV. Grok Bot sees them on the next `pull`, or the next time you say "check the harness" in chat.

## Grok Bot side (box)

Put the URL and token in `/workspace/prompt-trapdoor/.harness.local`. That file is gitignored via `*.local` and is never committed:

```
HARNESS_API_URL=https://hunter-harness-api.<subdomain>.workers.dev
HARNESS_TOKEN=<token>
```

You can also export the same two variables. After that:

```bash
node scripts/harness.mjs pull                                   # import prompts sent from the game
node scripts/harness.mjs set hj-… building --note "spec done"   # also PATCHes the Worker (prints "worker: synced")
node scripts/harness.mjs set hj-… web_ready --result pin        # game toasts on its next poll
node scripts/harness.mjs set hj-… building --local-only         # skip the Worker
```

Jobs that never went through the Worker (old copy-handoff jobs) print `worker: not on worker` and stay file-only.

## The game, configured once per device

Hub → **Grok 4.7 harness** strip → **⚙️ API** → paste the Worker URL and token → **Save on this device** → **Test**. The result should say "✅ Connected — N jobs".

- Both values live only in that device's `localStorage` (`hunter-harness-remote-v1`). They are never in source, the build, the APK, or GitHub. Web and APK have separate storage, so each needs the paste once.
- `VITE_HARNESS_API_URL` in `.env.local` can pre-fill the **URL** (see `/.env.example`). The token has no env var on purpose, because anything with the `VITE_` prefix ends up in the public bundle.
- With no URL and token saved, or if the Worker errors, the strip falls back to the original **copy handoff**.

## Local dev + smoke

```bash
cp .dev.vars.example .dev.vars          # dummy local token, gitignored
npx wrangler dev                        # http://127.0.0.1:8787, local KV simulation
bash smoke.sh                           # 13 checks: auth, CORS, validation, state machine
```

In the game you can save `http://127.0.0.1:8787` plus the dummy token. Plain `http` is accepted for localhost only.

Unit tests live in the main repo (`npm test`): `tests/harnessApiWorker.test.ts` covers the Worker (auth, CORS, jobs, transitions, notify, rate limit), and `tests/harnessApi.test.ts` covers the game client, hub settings, fallback, and the CLI pull/PATCH round trip.
