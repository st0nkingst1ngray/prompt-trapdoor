# Grok Usage

Self-reported ledger for Grok Bot work: which bot ran, on which task, and the estimates it recorded for tokens, steps, and context.

The repository name `prompt-trapdoor` is historical. This is the home of the ledger.

## Open it once

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

## Honest scope

These numbers are **self-reported estimates**. They are not Cursor billing, and they are not remaining-context truth from a per-task API. Grok Bot does not expose one. This tool does not scrape Cursor's usage UI, and it never claims an exact bill.

Optional estimate fields may be omitted or null when the bot does not know them:

- `tokens_in` / `tokens_out`
- `agent_steps`
- `context_chars`
- `attachments_bytes`

## Install and log an event

Requires Node.js 20 or newer.

```bash
npm install
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

That serves `http://127.0.0.1:5173` and reads `./data/events.jsonl`. Refresh the page after new lines are appended.

## How a Grok Bot skill should write events

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

## Event schema

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

- `packages/schema` validates events, parses JSONL, and summarizes by bot, day, and task
- `packages/cli` is the `grok-usage` command (`log`, `validate`)
- `apps/dashboard` is the local Vite + React ledger (`GET /api/events` on the same origin)
- `data/events.jsonl` is the default append-only store

```bash
npm test
npm run typecheck
```

## License

MIT. See [LICENSE](LICENSE).
