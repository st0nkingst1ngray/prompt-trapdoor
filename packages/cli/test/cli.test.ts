import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { run, type Io } from "../src/cli.ts";

const fixedId = "8a245b37-d7d5-4885-94c9-1ecfed0ad890";
const fixedTs = "2026-09-30T12:00:00.000Z";

function capture(): { io: Io; stdout: () => string; stderr: () => string } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: {
      stdout: (chunk) => {
        out.push(chunk);
      },
      stderr: (chunk) => {
        err.push(chunk);
      },
      stdin: "",
    },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

async function tempFile(): Promise<{ dir: string; file: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "grok-usage-"));
  return {
    dir,
    file: path.join(dir, "events.jsonl"),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

function logArgs(file: string, extra: string[] = []): string[] {
  return [
    "log",
    "--file",
    file,
    "--bot-id",
    "research-bot",
    "--bot-name",
    "Research Bot",
    "--task",
    "literature scan",
    "--run-kind",
    "chat",
    "--status",
    "ok",
    "--id",
    fixedId,
    "--ts",
    fixedTs,
    ...extra,
  ];
}

test("log appends one valid JSON line and fills source", async () => {
  const { file, cleanup } = await tempFile();
  try {
    const cap = capture();
    const code = await run(
      logArgs(file, ["--tokens-in", "1200", "--tokens-out", "300", "--notes", "afternoon pass"]),
      cap.io,
    );
    assert.equal(code, 0);
    assert.match(cap.stdout(), /logged 8a245b37-d7d5-4885-94c9-1ecfed0ad890/);
    const lines = (await readFile(file, "utf8")).trim().split("\n");
    assert.equal(lines.length, 1);
    const event = JSON.parse(lines[0] ?? "") as { source: string; estimates: { tokens_in: number }; notes: string };
    assert.equal(event.source, "cli");
    assert.equal(event.estimates.tokens_in, 1200);
    assert.equal(event.notes, "afternoon pass");
  } finally {
    await cleanup();
  }
});

test("a second append keeps the first line", async () => {
  const { file, cleanup } = await tempFile();
  try {
    assert.equal(await run(logArgs(file), capture().io), 0);
    const secondId = "7d298444-c57b-4ada-bc17-5fac78843713";
    assert.equal(
      await run(logArgs(file, ["--id", secondId, "--task", "citation check"]), capture().io),
      0,
    );
    const lines = (await readFile(file, "utf8")).trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0] ?? "").id, fixedId);
    assert.equal(JSON.parse(lines[1] ?? "").task, "citation check");
  } finally {
    await cleanup();
  }
});

test("invalid events are refused and do not create or change the file", async () => {
  const { file, dir, cleanup } = await tempFile();
  try {
    const cap = capture();
    const code = await run(["log", "--file", file, "--bot-id", "research-bot"], cap.io);
    assert.equal(code, 1);
    assert.match(cap.stderr(), /invalid event/);
    await assert.rejects(stat(file));

    await writeFile(file, "{\"keep\":true}\n");
    const before = await readFile(file, "utf8");
    const again = await run(logArgs(file, ["--run-kind", "cron"]), capture().io);
    assert.equal(again, 1);
    assert.equal(await readFile(file, "utf8"), before);
    assert.equal(dir.length > 0, true);
  } finally {
    await cleanup();
  }
});

test("flags override JSON and source can stay skill", async () => {
  const { file, cleanup } = await tempFile();
  try {
    const payload = {
      bot_id: "inbox-bot",
      bot_name: "Inbox Bot",
      task: "triage",
      run_kind: "webhook",
      status: "ok",
      source: "skill",
      id: fixedId,
      ts: fixedTs,
      estimates: { tokens_in: 10 },
    };
    const code = await run(
      [
        "log",
        "--file",
        file,
        "--json",
        JSON.stringify(payload),
        "--task",
        "triage override",
        "--tokens-in",
        "42",
      ],
      capture().io,
    );
    assert.equal(code, 0);
    const event = JSON.parse(await readFile(file, "utf8")) as {
      task: string;
      source: string;
      estimates: { tokens_in: number };
      schema_version: number;
    };
    assert.equal(event.task, "triage override");
    assert.equal(event.source, "skill");
    assert.equal(event.estimates.tokens_in, 42);
    assert.equal(event.schema_version, 1);
  } finally {
    await cleanup();
  }
});

test("omitted id and timestamp are generated", async () => {
  const { file, cleanup } = await tempFile();
  try {
    const before = Date.now();
    const code = await run(
      [
        "log",
        "--file",
        file,
        "--bot-id",
        "ops-bot",
        "--bot-name",
        "Ops Bot",
        "--task",
        "health check",
        "--run-kind",
        "routine",
        "--status",
        "ok",
      ],
      capture().io,
    );
    const after = Date.now();
    assert.equal(code, 0);
    const event = JSON.parse(await readFile(file, "utf8")) as { id: string; ts: string };
    assert.match(event.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const ts = Date.parse(event.ts);
    assert.ok(ts >= before && ts <= after);
  } finally {
    await cleanup();
  }
});

test("log creates parent directories", async () => {
  const { dir, cleanup } = await tempFile();
  try {
    const file = path.join(dir, "nested", "events.jsonl");
    assert.equal(await run(logArgs(file), capture().io), 0);
    const text = await readFile(file, "utf8");
    assert.equal(text.endsWith("\n"), true);
  } finally {
    await cleanup();
  }
});

test("validate accepts a good file and reports a bad line", async () => {
  const { file, cleanup } = await tempFile();
  try {
    assert.equal(await run(logArgs(file), capture().io), 0);
    const good = capture();
    assert.equal(await run(["validate", file], good.io), 0);
    assert.match(good.stdout(), /valid 1 events/);

    await writeFile(file, `${await readFile(file, "utf8")}{"schema_version":1}\n`, "utf8");
    const bad = capture();
    assert.equal(await run(["validate", "--file", file], bad.io), 1);
    assert.match(bad.stderr(), new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:2:`));
  } finally {
    await cleanup();
  }
});

test("non-integer estimates and unknown commands are usage errors", async () => {
  const { file, cleanup } = await tempFile();
  try {
    const cap = capture();
    assert.equal(await run(logArgs(file, ["--agent-steps", "1.5"]), cap.io), 2);
    assert.match(cap.stderr(), /agent_steps/);
    await assert.rejects(stat(file));
    const unknown = capture();
    assert.equal(await run(["explode"], unknown.io), 2);
    assert.match(unknown.stderr(), /unknown command/);
  } finally {
    await cleanup();
  }
});

test("the bin shim appends an event", async () => {
  const { file, cleanup } = await tempFile();
  try {
    const bin = fileURLToPath(new URL("../bin/grok-usage.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [bin, ...logArgs(file)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const event = JSON.parse(await readFile(file, "utf8")) as { bot_id: string };
    assert.equal(event.bot_id, "research-bot");
  } finally {
    await cleanup();
  }
});
