import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJsonl, stringifyEvent, validateEvent } from "../src/index.ts";
import type { UsageEvent } from "../src/index.ts";

const eventId = "8a245b37-d7d5-4885-94c9-1ecfed0ad890";

function minimalEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    id: eventId,
    ts: "2026-09-30T12:00:00.000Z",
    bot_id: "research-bot",
    bot_name: "Research Bot",
    task: "literature scan",
    run_kind: "chat",
    status: "ok",
    source: "cli",
    ...overrides,
  };
}

test("accepts a minimal event", () => {
  const result = validateEvent(minimalEvent());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.event.bot_id, "research-bot");
});

test("accepts null estimate fields", () => {
  const result = validateEvent(
    minimalEvent({
      model: "grok-4",
      notes: "rough count",
      estimates: {
        tokens_in: 1200,
        tokens_out: null,
        agent_steps: 3,
        context_chars: null,
        attachments_bytes: 0,
      },
    }),
  );
  assert.equal(result.ok, true);
});

test("rejects a missing bot id", () => {
  const input = minimalEvent();
  delete input.bot_id;
  const result = validateEvent(input);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.message.includes("bot_id")));
  }
});

test("rejects an unknown run kind, negative tokens, a bad id, and extra fields", () => {
  assert.equal(validateEvent(minimalEvent({ run_kind: "cron" })).ok, false);
  assert.equal(
    validateEvent(minimalEvent({ estimates: { tokens_in: -1 } })).ok,
    false,
  );
  assert.equal(validateEvent(minimalEvent({ id: "not-a-uuid" })).ok, false);
  assert.equal(validateEvent(minimalEvent({ billed_usd: 2 })).ok, false);
  assert.equal(validateEvent(minimalEvent({ schema_version: 2 })).ok, false);
  assert.equal(
    validateEvent(minimalEvent({ estimates: { tokens_in: "10" } })).ok,
    false,
  );
});

test("round-trips a JSONL line and reports the bad line number", () => {
  const event = validateEvent(
    minimalEvent({
      estimates: { tokens_in: 10, tokens_out: null, agent_steps: 1, context_chars: 4, attachments_bytes: 0 },
    }),
  );
  assert.equal(event.ok, true);
  if (!event.ok) return;
  const line = stringifyEvent(event.event);
  assert.equal(line.includes("\n"), false);
  const parsed = parseJsonl(`${line}\n\n{not json}\n${JSON.stringify({ schema_version: 1 })}\n`);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0]?.id, eventId);
  assert.deepEqual(
    parsed.errors.map((error) => error.line),
    [3, 4],
  );
});

test("stringify keeps a stable key order", () => {
  const event: UsageEvent = {
    source: "manual",
    status: "partial",
    run_kind: "other",
    task: "note",
    bot_name: "Ops Bot",
    bot_id: "ops-bot",
    ts: "2026-09-26T19:00:00.000Z",
    id: eventId,
    schema_version: 1,
    notes: "by hand",
    estimates: { attachments_bytes: 1, tokens_in: 2 },
  };
  const line = stringifyEvent(event);
  assert.ok(line.indexOf('"schema_version"') < line.indexOf('"bot_id"'));
  assert.ok(line.indexOf('"tokens_in"') < line.indexOf('"attachments_bytes"'));
});
