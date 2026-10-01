import { validateEvent } from "./validate.ts";
import type { UsageEvent, UsageEstimates } from "./types.ts";

const EVENT_KEYS = [
  "schema_version",
  "id",
  "ts",
  "bot_id",
  "bot_name",
  "task",
  "run_kind",
  "status",
  "model",
  "estimates",
  "notes",
  "source",
] as const;

const ESTIMATE_KEYS = [
  "tokens_in",
  "tokens_out",
  "agent_steps",
  "context_chars",
  "attachments_bytes",
] as const;

export interface JsonlIssue {
  line: number;
  message: string;
}

export interface JsonlParse {
  events: UsageEvent[];
  errors: JsonlIssue[];
}

export function stringifyEvent(event: UsageEvent): string {
  const ordered: Record<string, unknown> = {};
  for (const key of EVENT_KEYS) {
    const value = event[key];
    if (value !== undefined) ordered[key] = value;
  }
  if (event.estimates) {
    const estimates: UsageEstimates = {};
    for (const key of ESTIMATE_KEYS) {
      if (event.estimates[key] !== undefined) estimates[key] = event.estimates[key];
    }
    ordered.estimates = estimates;
  }
  return JSON.stringify(ordered);
}

export function parseJsonl(text: string): JsonlParse {
  const events: UsageEvent[] = [];
  const errors: JsonlIssue[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line) continue;
    const lineNumber = index + 1;
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      errors.push({ line: lineNumber, message: "invalid JSON" });
      continue;
    }
    const result = validateEvent(value);
    if (!result.ok) {
      errors.push({
        line: lineNumber,
        message: result.errors.map((error) => `${error.path} ${error.message}`).join("; "),
      });
      continue;
    }
    events.push(result.event);
  }
  return { events, errors };
}
