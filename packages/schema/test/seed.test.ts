import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseJsonl } from "../src/index.ts";

test("checked-in seed events match the schema and cover bot, day, and task", () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), "../../../data/events.jsonl");
  const parsed = parseJsonl(readFileSync(file, "utf8"));
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.events.length >= 20);
  assert.ok(new Set(parsed.events.map((event) => event.bot_id)).size >= 2);
  assert.ok(new Set(parsed.events.map((event) => event.ts.slice(0, 10))).size >= 2);
  assert.ok(new Set(parsed.events.map((event) => event.task)).size >= 2);
  assert.ok(parsed.events.some((event) => event.status === "fail"));
  assert.ok(parsed.events.some((event) => event.status === "partial"));
  assert.ok(parsed.events.some((event) => event.estimates === undefined));
  assert.ok(parsed.events.some((event) => event.run_kind === "routine"));
  assert.ok(parsed.events.some((event) => event.run_kind === "chat"));
  assert.ok(parsed.events.some((event) => typeof event.estimates?.context_chars === "number"));
});
