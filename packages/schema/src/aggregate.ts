import type { UsageEvent } from "./types.ts";

export type { UsageEvent, UsageEstimates, RunKind, RunStatus, EventSource } from "./types.ts";

export interface EventFilters {
  botId?: string;
  /** UTC calendar day, YYYY-MM-DD. */
  day?: string;
  task?: string;
}

export interface DayBucket {
  day: string;
  count: number;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface BotBucket {
  botId: string;
  botName: string;
  count: number;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface TaskBucket {
  task: string;
  count: number;
  fail: number;
  partial: number;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface Summary {
  count: number;
  byStatus: { ok: number; fail: number; partial: number };
  tokensIn: number | null;
  tokensOut: number | null;
  agentSteps: number | null;
  contextChars: number | null;
  attachmentsBytes: number | null;
  byDay: DayBucket[];
  byBot: BotBucket[];
  byTask: TaskBucket[];
}

export function utcDay(ts: string): string {
  return ts.slice(0, 10);
}

export function applyFilters(events: readonly UsageEvent[], filters: EventFilters = {}): UsageEvent[] {
  return events.filter((event) => {
    if (filters.botId && event.bot_id !== filters.botId) return false;
    if (filters.day && utcDay(event.ts) !== filters.day) return false;
    if (filters.task && event.task !== filters.task) return false;
    return true;
  });
}

function sumNumbers(values: Array<number | null | undefined>): number | null {
  let total: number | null = null;
  for (const value of values) {
    if (typeof value !== "number") continue;
    total = (total ?? 0) + value;
  }
  return total;
}

export function summarize(events: readonly UsageEvent[]): Summary {
  const byStatus = { ok: 0, fail: 0, partial: 0 };
  const days = new Map<string, UsageEvent[]>();
  const bots = new Map<string, UsageEvent[]>();
  const tasks = new Map<string, UsageEvent[]>();

  for (const event of events) {
    byStatus[event.status] += 1;
    const day = utcDay(event.ts);
    pushGroup(days, day, event);
    pushGroup(bots, event.bot_id, event);
    pushGroup(tasks, event.task, event);
  }

  const byDay: DayBucket[] = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, group]) => ({
      day,
      count: group.length,
      tokensIn: sumNumbers(group.map((event) => event.estimates?.tokens_in)),
      tokensOut: sumNumbers(group.map((event) => event.estimates?.tokens_out)),
    }));

  const byBot: BotBucket[] = [...bots.entries()]
    .map(([botId, group]) => {
      const latest = [...group].sort((a, b) => a.ts.localeCompare(b.ts)).at(-1);
      return {
        botId,
        botName: latest?.bot_name ?? botId,
        count: group.length,
        tokensIn: sumNumbers(group.map((event) => event.estimates?.tokens_in)),
        tokensOut: sumNumbers(group.map((event) => event.estimates?.tokens_out)),
      };
    })
    .sort((a, b) => b.count - a.count || a.botId.localeCompare(b.botId));

  const byTask: TaskBucket[] = [...tasks.entries()]
    .map(([task, group]) => ({
      task,
      count: group.length,
      fail: group.filter((event) => event.status === "fail").length,
      partial: group.filter((event) => event.status === "partial").length,
      tokensIn: sumNumbers(group.map((event) => event.estimates?.tokens_in)),
      tokensOut: sumNumbers(group.map((event) => event.estimates?.tokens_out)),
    }))
    .sort((a, b) => b.count - a.count || a.task.localeCompare(b.task));

  return {
    count: events.length,
    byStatus,
    tokensIn: sumNumbers(events.map((event) => event.estimates?.tokens_in)),
    tokensOut: sumNumbers(events.map((event) => event.estimates?.tokens_out)),
    agentSteps: sumNumbers(events.map((event) => event.estimates?.agent_steps)),
    contextChars: sumNumbers(events.map((event) => event.estimates?.context_chars)),
    attachmentsBytes: sumNumbers(events.map((event) => event.estimates?.attachments_bytes)),
    byDay,
    byBot,
    byTask,
  };
}

function pushGroup(map: Map<string, UsageEvent[]>, key: string, event: UsageEvent): void {
  const group = map.get(key);
  if (group) group.push(event);
  else map.set(key, [event]);
}
