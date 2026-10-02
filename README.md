# prompt-trapdoor

Two products share this repository. They use different commands and ports.

| Product | What it is | Command | URL |
| --- | --- | --- | --- |
| **Prompt Trapdoor / Token Heist** | Browser puzzle games | `npm run dev` | http://localhost:5173/prompt-trapdoor/ |
| **Grok Usage** | Self-reported bot usage ledger | `npm run demo` | http://127.0.0.1:4173 |

GitHub Pages publishes **only the games**. On every push to `main`, Actions runs `npm ci` and `npm run build`, then deploys `./dist` at <https://st0nkingst1ngray.github.io/prompt-trapdoor/>. The usage ledger stays local.

```bash
npm install
npm run dev       # games
npm run demo      # usage ledger (reseeds sample data)
```

## Prompt Trapdoor and Token Heist

Browser puzzle games that teach LLM ideas by winning. ADHD-friendly — sticky HUD (Goal · Constraints · Attempt/time · Next action), instant feedback, no API keys.

```bash
npm install
npm run dev
```

`npm run game` is the same command. Open the URL Vite prints (default `http://localhost:5173/prompt-trapdoor/`).

Production build, the same one GitHub Pages runs:

```bash
npm run build
npm run preview
```

`npm run build` is `tsc && vite build`. Vite `base` is `/prompt-trapdoor/`, and the output directory is `./dist`.

### Modes

#### Prompt Trapdoor

1. Open **Prompt Trapdoor** from the hub.
2. Read the sticky HUD, type a prompt → mock model replies instantly.
3. **Win** when the reply contains the secret (and you respect bans / budget / format).
4. Optional **Explain why** tip. Progress autosaves (`prompt-trapdoor-save-v1`).

| # | Title | Twist | Unlocks |
|---|--------|--------|---------|
| 1 | The Cave Door | Easy secret, few bans | Next-token prediction |
| 2 | Synonym Maze | Synonyms / indirection | Related-word mapping |
| 3 | Word Budget | Max words on prompt | Context windows |
| 4 | Format Gate | JSON `{"answer":"..."}` | Structured output |
| 5 | Trapdoor Stack | Bans + budget + `>>> <<<` | Stacked constraints |

#### Token Heist (playable)

Sneak a message past a **token guard** by splitting & merging tiles (BPE-ish). Words ≠ tokens: banned strings only catch an *exact* tile. Stay under the token budget before the timer ends (60–90s).

1. Hub → **Token Heist**.
2. **＋** merges neighbors; click a multi-letter tile to split into letters.
3. Submit when the path is clear (no red tiles, under budget). Soft feedback if busted; timer expiry = lose.
4. Autosave key: `token-heist-save-v1` (separate from Trapdoor).

| # | Title | Message | Budget | Time | Lesson |
|---|--------|---------|--------|------|--------|
| 1 | Letter Drop | `CAT` | 2 | 75s | Subword pieces |
| 2 | Password Split | `PASSWORD` | 3 | 80s | Common BPE chunks |
| 3 | Dawn Raid | `ATTACK AT DAWN` | 5 | 90s | Spaces inside tokens |
| 4 | Adversarial Vocab | `SECRETCODE` | 4 | 90s | Awkward cuts dodge filters |

#### Temperature Casino

Still **locked** (stub).

### Game tech

- Vite + TypeScript (vanilla DOM), source in `src/`
- Deterministic mock LLM for Trapdoor; local tile tokenizer for Heist
- Dark high-contrast UI, big buttons
- GitHub Pages base: `/prompt-trapdoor/`

Reset progress in the browser console: `__ptReset()` (clears both Trapdoor and Heist saves).

Known limits: the mock model is pattern-based, not a real LLM. The Heist tokenizer is a teaching toy (exact tile bans), not production BPE. Progress is per-browser (`localStorage`), not synced. Temperature Casino remains a locked stub.

## Grok Usage

Self-reported ledger for Grok Bot work: which bot ran, on which task, and the estimates it recorded for tokens, steps, and context.

### Open the ledger

```bash
npm run demo
```

That command installs dependencies if they are missing, writes a multi-bot sample into `data/events.jsonl`, and starts the dashboard. It prints one URL:

```text
http://127.0.0.1:4173
```

Leave the process running. Open that URL.

In about ten seconds you should see:

- A dark ledger, not a blank table
- Four figures: events today, bots active, estimated tokens, fail rate
- A day timeline with today marked in amber
- Research Bot already open as a story (it reported the most tokens): its tasks, each run, context size, and token estimates
- This sentence, in the page header: **Self-reported estimates. Not Cursor billing.**

Click Inbox Bot or Ops Bot to focus that bot. Click it again to return to the whole ledger. Use the day and task filters to narrow the same numbers.

`npm run demo` rewrites `data/events.jsonl` with sample runs dated through today. If you have recorded your own events in that file, copy it aside first.

### Honest scope

These numbers are **self-reported estimates**. They are not Cursor billing, and they are not remaining-context truth from a per-task API. Grok Bot does not expose one. This tool does not scrape Cursor's usage UI, and it never claims an exact bill.

Optional estimate fields may be omitted or null when the bot does not know them:

- `tokens_in` / `tokens_out`
- `agent_steps`
- `context_chars`
- `attachments_bytes`

### Log an event

Requires Node.js 20 or newer. `npm install` once at the repo root covers both products.

```bash
npx grok-usage log \
  --bot-id research-bot \
  --bot-name "Research Bot" \
  --task "literature scan" \
  --run-kind routine \
  --status ok \
  --model grok-4 \
  --source skill \
  --tokens-in 8400 \
  --tokens-out 1500 \
  --agent-steps 6 \
  --context-chars 28000 \
  --attachments-bytes 16000 \
  --notes "recorded by the bot after the run"
```

The default store is `./data/events.jsonl` (append-only, one JSON object per line). Override it with `--file`.

Check a file:

```bash
npx grok-usage validate ./data/events.jsonl
```

Exit 0 means every non-blank line matches the schema. Exit 1 names the bad line. Exit 2 means the command itself was malformed.

A full event as JSON works too. Flags override fields in the object. `id`, `ts`, `schema_version`, and `source` are filled in when omitted (`source` defaults to `cli`).

```bash
echo '{
  "bot_id": "inbox-bot",
  "bot_name": "Inbox Bot",
  "task": "triage",
  "run_kind": "routine",
  "status": "ok",
  "source": "skill",
  "estimates": { "tokens_in": 2100, "tokens_out": 480, "agent_steps": 3, "context_chars": 9000, "attachments_bytes": 0 }
}' | npx grok-usage log --stdin
```

Open the dashboard without reseeding:

```bash
npm run dashboard
```

That serves `http://127.0.0.1:5180` and reads `./data/events.jsonl`. Port 5180 is intentional: the games already use 5173. Refresh the page after new lines are appended.

### How a Grok Bot skill should write events

There is no public per-task usage API to call. A skill or routine you control can append one event at the end of a run by shelling out to this CLI. Record only what that run can actually see (prompt size, step count, attachment bytes). Leave a field out, or set it to `null`, when it is unknown.

```bash
npx grok-usage log \
  --source skill \
  --bot-id "$BOT_ID" \
  --bot-name "$BOT_NAME" \
  --task "$TASK_LABEL" \
  --run-kind routine \
  --status ok \
  --model "$MODEL" \
  --tokens-in "$TOKENS_IN" \
  --tokens-out "$TOKENS_OUT" \
  --agent-steps "$STEPS" \
  --context-chars "$CONTEXT_CHARS" \
  --file ./data/events.jsonl
```

`run_kind` is `chat`, `routine`, `webhook`, `cloud_agent`, or `other`. `status` is `ok`, `fail`, or `partial`.

### Event schema

`packages/schema/usage-event.schema.json` is the contract (JSON Schema draft-07, `schema_version` 1).

```json
{
  "schema_version": 1,
  "id": "uuid",
  "ts": "ISO-8601",
  "bot_id": "string",
  "bot_name": "string",
  "task": "short label",
  "run_kind": "chat|routine|webhook|cloud_agent|other",
  "status": "ok|fail|partial",
  "model": "optional",
  "estimates": {
    "tokens_in": null,
    "tokens_out": null,
    "agent_steps": null,
    "context_chars": null,
    "attachments_bytes": null
  },
  "notes": "optional",
  "source": "cli|skill|manual"
}
```

## Layout

- `index.html`, `src/`, `vite.config.ts` — Prompt Trapdoor and Token Heist (Pages site)
- `packages/schema` — usage event schema, JSONL parse, summaries
- `packages/cli` — `grok-usage` command (`log`, `validate`)
- `apps/dashboard` — local Vite + React ledger (`GET /api/events` on the same origin)
- `data/events.jsonl` — append-only usage store
- `.github/workflows/deploy-pages.yml` — builds the games only

```bash
npm test
npm run typecheck
npm run build
```

`npm test` covers the usage ledger (schema, CLI, dashboard filters). The games are typechecked by `npm run typecheck` and built by `npm run build`.

## License

MIT. See [LICENSE](LICENSE).
