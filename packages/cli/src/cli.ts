import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { parseJsonl, stringifyEvent, validateEvent } from "@grok-usage/schema";
import { HELP } from "./help.ts";

const DEFAULT_FILE = "./data/events.jsonl";

export interface Io {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
  stdin?: string;
  readStdin?: () => Promise<string>;
}

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

const defaultIo: Io = {
  stdout: (chunk) => {
    process.stdout.write(chunk);
  },
  stderr: (chunk) => {
    process.stderr.write(chunk);
  },
  readStdin: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  },
};

export async function run(argv: string[], io: Io = defaultIo): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        file: { type: "string" },
        json: { type: "string" },
        stdin: { type: "boolean", default: false },
        "bot-id": { type: "string" },
        "bot-name": { type: "string" },
        task: { type: "string" },
        "run-kind": { type: "string" },
        status: { type: "string" },
        model: { type: "string" },
        source: { type: "string" },
        notes: { type: "string" },
        "tokens-in": { type: "string" },
        "tokens-out": { type: "string" },
        "agent-steps": { type: "string" },
        "context-chars": { type: "string" },
        "attachments-bytes": { type: "string" },
        id: { type: "string" },
        ts: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n${HELP}`);
    return 2;
  }

  if (parsed.values.help) {
    io.stdout(HELP);
    return 0;
  }

  const command = parsed.positionals[0];
  const flags = readFlags(parsed.values);
  try {
    if (command === "log") return await logCommand(flags, io);
    if (command === "validate") {
      return await validateCommand(flags, parsed.positionals[1], io);
    }
    io.stderr(command ? `unknown command: ${command}\n${HELP}` : HELP);
    return command ? 2 : 0;
  } catch (error) {
    if (error instanceof CliError) {
      io.stderr(`${error.message}\n`);
      return error.exitCode;
    }
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 1;
  }
}

type RawValues = {
  [longOption: string]: string | boolean | Array<string | boolean> | undefined;
};

function readFlags(values: RawValues): FlagValues {
  const text = (key: string): string | undefined => (typeof values[key] === "string" ? values[key] : undefined);
  return {
    file: text("file"),
    json: text("json"),
    stdin: values.stdin === true,
    "bot-id": text("bot-id"),
    "bot-name": text("bot-name"),
    task: text("task"),
    "run-kind": text("run-kind"),
    status: text("status"),
    model: text("model"),
    source: text("source"),
    notes: text("notes"),
    "tokens-in": text("tokens-in"),
    "tokens-out": text("tokens-out"),
    "agent-steps": text("agent-steps"),
    "context-chars": text("context-chars"),
    "attachments-bytes": text("attachments-bytes"),
    id: text("id"),
    ts: text("ts"),
  };
}

type FlagValues = {
  file?: string;
  json?: string;
  stdin: boolean;
  "bot-id"?: string;
  "bot-name"?: string;
  task?: string;
  "run-kind"?: string;
  status?: string;
  model?: string;
  source?: string;
  notes?: string;
  "tokens-in"?: string;
  "tokens-out"?: string;
  "agent-steps"?: string;
  "context-chars"?: string;
  "attachments-bytes"?: string;
  id?: string;
  ts?: string;
};

async function logCommand(values: FlagValues, io: Io): Promise<number> {
  const file = values.file ?? DEFAULT_FILE;
  const input = await eventFromFlags(values, io);
  const result = validateEvent(input);
  if (!result.ok) {
    const detail = result.errors.map((error) => `${error.path} ${error.message}`).join("\n");
    throw new CliError(`invalid event:\n${detail}`, 1);
  }
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${stringifyEvent(result.event)}\n`, "utf8");
  io.stdout(
    `logged ${result.event.id} ${result.event.ts} ${result.event.bot_id} ${result.event.task} -> ${file}\n`,
  );
  return 0;
}

async function validateCommand(values: FlagValues, positionalFile: string | undefined, io: Io): Promise<number> {
  const file = values.file ?? positionalFile ?? DEFAULT_FILE;
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`cannot read ${file}: ${message}`, 1);
  }
  const parsed = parseJsonl(text);
  if (parsed.errors.length > 0) {
    for (const error of parsed.errors) {
      io.stderr(`${file}:${error.line}: ${error.message}\n`);
    }
    io.stderr(`invalid ${parsed.errors.length} of ${parsed.events.length + parsed.errors.length} lines in ${file}\n`);
    return 1;
  }
  io.stdout(`valid ${parsed.events.length} events in ${file}\n`);
  return 0;
}

async function eventFromFlags(values: FlagValues, io: Io): Promise<unknown> {
  if (values.stdin && values.json !== undefined) {
    throw new CliError("use either --json or --stdin", 2);
  }

  let base: Record<string, unknown> = {};
  if (values.stdin || values.json !== undefined) {
    const raw = values.stdin ? await readInput(io) : (values.json ?? "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new CliError(values.stdin ? "stdin was not JSON" : "--json was not JSON", 2);
    }
    base = asRecord(parsed, values.stdin ? "stdin" : "--json");
  }

  const estimates = asEstimates(base.estimates);
  assignEstimate(estimates, "tokens_in", values["tokens-in"]);
  assignEstimate(estimates, "tokens_out", values["tokens-out"]);
  assignEstimate(estimates, "agent_steps", values["agent-steps"]);
  assignEstimate(estimates, "context_chars", values["context-chars"]);
  assignEstimate(estimates, "attachments_bytes", values["attachments-bytes"]);

  const event: Record<string, unknown> = { ...base };
  if (event.schema_version === undefined) event.schema_version = 1;
  event.id = values.id ?? event.id ?? randomUUID();
  event.ts = values.ts ?? event.ts ?? new Date().toISOString();
  assign(event, "bot_id", values["bot-id"]);
  assign(event, "bot_name", values["bot-name"]);
  assign(event, "task", values.task);
  assign(event, "run_kind", values["run-kind"]);
  assign(event, "status", values.status);
  assign(event, "model", values.model);
  assign(event, "notes", values.notes);
  event.source = values.source ?? event.source ?? "cli";
  if (Object.keys(estimates).length > 0) event.estimates = estimates;
  else delete event.estimates;
  return event;
}

function assign(event: Record<string, unknown>, key: string, value: string | undefined): void {
  if (value !== undefined) event[key] = value;
}

function assignEstimate(estimates: Record<string, unknown>, key: string, raw: string | undefined): void {
  if (raw === undefined) return;
  if (!/^\d+$/.test(raw)) {
    throw new CliError(`${key} must be a non-negative integer`, 2);
  }
  estimates[key] = Number(raw);
}

function asEstimates(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError("estimates must be an object", 2);
  }
  return { ...value };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError(`${label} must be a JSON object`, 2);
  }
  return { ...(value as Record<string, unknown>) };
}

async function readInput(io: Io): Promise<string> {
  const raw = io.stdin ?? (await io.readStdin?.()) ?? "";
  if (!raw.trim()) throw new CliError("stdin was empty", 2);
  return raw;
}
