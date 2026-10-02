export const RUN_KINDS = ["chat", "routine", "webhook", "cloud_agent", "other"] as const;
export const STATUSES = ["ok", "fail", "partial"] as const;
export const SOURCES = ["cli", "skill", "manual"] as const;

export type RunKind = (typeof RUN_KINDS)[number];
export type RunStatus = (typeof STATUSES)[number];
export type EventSource = (typeof SOURCES)[number];

export interface UsageEstimates {
  tokens_in?: number | null;
  tokens_out?: number | null;
  agent_steps?: number | null;
  context_chars?: number | null;
  attachments_bytes?: number | null;
}

/** One self-reported bot run. Numeric fields are estimates, not billing. */
export interface UsageEvent {
  schema_version: 1;
  id: string;
  ts: string;
  bot_id: string;
  bot_name: string;
  task: string;
  run_kind: RunKind;
  status: RunStatus;
  model?: string;
  estimates?: UsageEstimates;
  notes?: string;
  source: EventSource;
}

export interface FieldError {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; event: UsageEvent }
  | { ok: false; errors: FieldError[] };
