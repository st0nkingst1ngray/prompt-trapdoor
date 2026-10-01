import assert from "node:assert/strict";
import { test } from "node:test";
import type { UsageEvent } from "@grok-usage/schema/aggregate";
import { botCards, daySpan, failRate, filterEvents, localDay, storyFor, timeline } from "./view.ts";

function event(overrides: Partial<UsageEvent>): UsageEvent {
  return {
    schema_version: 1,
    id: "00000000-0000-4000-8000-000000000001",
    ts: "2026-10-01T12:00:00.000Z",
    bot_id: "research-bot",
    bot_name: "Research Bot",
    task: "literature scan",
    run_kind: "routine",
    status: "ok",
    source: "skill",
    ...overrides,
  };
}

test("local day follows the machine calendar for that instant", () => {
  const iso = "2026-10-01T12:00:00.000Z";
  const date = new Date(iso);
  const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  assert.equal(localDay(iso), expected);
});

test("filters by bot, day, and task without treating a blank filter as a value", () => {
  const events = [
    event({ id: "00000000-0000-4000-8000-000000000001", bot_id: "research-bot", task: "literature scan" }),
    event({
      id: "00000000-0000-4000-8000-000000000002",
      ts: "2026-09-30T12:00:00.000Z",
      bot_id: "inbox-bot",
      bot_name: "Inbox Bot",
      task: "triage",
      run_kind: "chat",
    }),
  ];
  const day = localDay(events[0]?.ts ?? "");
  assert.equal(filterEvents(events, { botId: "inbox-bot", day: "", task: "" }).length, 1);
  assert.equal(filterEvents(events, { botId: "", day, task: "literature scan" }).length, 1);
  assert.equal(filterEvents(events, { botId: "", day: "", task: "" }).length, 2);
});

test("timeline marks today and story scales context against the peak", () => {
  const today = "2026-10-01T15:00:00.000Z";
  const yesterday = "2026-09-30T15:00:00.000Z";
  const events = [
    event({
      ts: yesterday,
      estimates: { context_chars: 1000, tokens_in: 10, tokens_out: 5, agent_steps: 1, attachments_bytes: 0 },
    }),
    event({
      id: "00000000-0000-4000-8000-000000000002",
      ts: today,
      task: "weekly brief",
      status: "fail",
      estimates: { context_chars: 4000, tokens_in: null, tokens_out: 7, agent_steps: 2, attachments_bytes: null },
    }),
  ];
  const todayDay = localDay(today);
  const bars = timeline(events, todayDay);
  assert.equal(bars.at(-1)?.isToday, true);
  assert.equal(bars.at(-1)?.fail, 1);
  assert.ok(daySpan(events).length >= 2);
  const story = storyFor(events, { botId: "research-bot", day: "", task: "" });
  assert.ok(story);
  assert.equal(story?.contextPeak, 4000);
  assert.equal(story?.contextPeakTask, "weekly brief");
  assert.equal(story?.runs[0]?.contextPct, 100);
  assert.equal(story?.runs[1]?.contextPct, 25);
  assert.equal(story?.failCount, 1);
  const cards = botCards(events, daySpan(events));
  assert.equal(cards[0]?.botId, "research-bot");
  assert.equal(cards[0]?.tokens, 22);
  assert.equal(failRate(1, 4), 0.25);
  assert.equal(failRate(0, 0), null);
});
