import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilters, summarize } from "../src/aggregate.ts";
import type { UsageEvent } from "../src/types.ts";

function event(overrides: Partial<UsageEvent>): UsageEvent {
  return {
    schema_version: 1,
    id: "8a245b37-d7d5-4885-94c9-1ecfed0ad890",
    ts: "2026-09-30T12:00:00.000Z",
    bot_id: "a",
    bot_name: "A",
    task: "t1",
    run_kind: "chat",
    status: "ok",
    source: "cli",
    ...overrides,
  };
}

const events: UsageEvent[] = [
  event({
    id: "8a245b37-d7d5-4885-94c9-1ecfed0ad890",
    ts: "2026-09-30T23:30:00.000Z",
    bot_id: "a",
    bot_name: "Alpha",
    task: "t1",
    status: "ok",
    estimates: { tokens_in: 10, tokens_out: 1, agent_steps: 2, context_chars: 100, attachments_bytes: null },
  }),
  event({
    id: "7d298444-c57b-4ada-bc17-5fac78843713",
    ts: "2026-09-30T08:00:00.000Z",
    bot_id: "a",
    bot_name: "Alpha old",
    task: "t2",
    status: "fail",
    estimates: { tokens_in: null, tokens_out: null, agent_steps: null, context_chars: null, attachments_bytes: null },
  }),
  event({
    id: "ac65b486-224e-4492-b2a7-be65ea624c28",
    ts: "2026-10-01T00:30:00.000Z",
    bot_id: "b",
    bot_name: "Beta",
    task: "t1",
    status: "partial",
    estimates: { tokens_in: 5, tokens_out: 5, agent_steps: 1, context_chars: 20, attachments_bytes: 8 },
  }),
];

test("sums ignore null estimates and bucket days in UTC", () => {
  const summary = summarize(events);
  assert.equal(summary.count, 3);
  assert.deepEqual(summary.byStatus, { ok: 1, fail: 1, partial: 1 });
  assert.equal(summary.tokensIn, 15);
  assert.equal(summary.tokensOut, 6);
  assert.equal(summary.agentSteps, 3);
  assert.equal(summary.contextChars, 120);
  assert.equal(summary.attachmentsBytes, 8);
  assert.deepEqual(
    summary.byDay.map((bucket) => bucket.day),
    ["2026-09-30", "2026-10-01"],
  );
  assert.equal(summary.byBot[0]?.botId, "a");
  assert.equal(summary.byBot[0]?.botName, "Alpha");
  assert.equal(summary.byTask[0]?.task, "t1");
  assert.equal(summary.byTask[0]?.count, 2);
});

test("filters by bot, day, and task", () => {
  const byBotAndDay = summarize(applyFilters(events, { botId: "a", day: "2026-09-30" }));
  assert.equal(byBotAndDay.count, 2);
  assert.equal(byBotAndDay.tokensIn, 10);

  const byTask = summarize(applyFilters(events, { task: "t1" }));
  assert.equal(byTask.count, 2);
  assert.equal(byTask.byStatus.partial, 1);
});

test("an empty slice reports null totals rather than zero", () => {
  const summary = summarize(applyFilters(events, { botId: "missing" }));
  assert.equal(summary.count, 0);
  assert.equal(summary.tokensIn, null);
  assert.deepEqual(summary.byDay, []);
});
