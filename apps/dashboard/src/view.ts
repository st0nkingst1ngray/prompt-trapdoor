import { summarize, type UsageEvent } from "@grok-usage/schema/aggregate";

export interface Filters {
  botId: string;
  day: string;
  task: string;
}

export interface TimelineDay {
  day: string;
  count: number;
  fail: number;
  tokens: number | null;
  isToday: boolean;
}

export interface BotCardModel {
  botId: string;
  botName: string;
  count: number;
  fail: number;
  tokens: number | null;
  spark: number[];
}

export interface StoryRun {
  event: UsageEvent;
  context: number | null;
  contextPct: number;
}

export interface StoryModel {
  botId: string;
  botName: string;
  runs: StoryRun[];
  tasks: { task: string; count: number; fail: number }[];
  runCount: number;
  failCount: number;
  partialCount: number;
  contextAvg: number | null;
  contextPeak: number | null;
  contextPeakTask: string | null;
  contextReported: number;
}

export function localDay(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  return localDay(now.toISOString());
}

export function addDays(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
  next.setDate(next.getDate() + amount);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function filterEvents(events: readonly UsageEvent[], filters: Filters): UsageEvent[] {
  return events.filter((event) => {
    if (filters.botId && event.bot_id !== filters.botId) return false;
    if (filters.task && event.task !== filters.task) return false;
    if (filters.day && localDay(event.ts) !== filters.day) return false;
    return true;
  });
}

export function daySpan(events: readonly UsageEvent[]): string[] {
  if (events.length === 0) return [];
  const keys = events.map((event) => localDay(event.ts)).sort();
  const start = keys[0] ?? "";
  const end = keys[keys.length - 1] ?? start;
  const days: string[] = [];
  for (let cursor = start; cursor <= end && days.length < 62; cursor = addDays(cursor, 1)) {
    days.push(cursor);
    if (cursor === end) break;
  }
  return days;
}

export function timeline(events: readonly UsageEvent[], today: string): TimelineDay[] {
  const days = daySpan(events);
  return days.map((day) => {
    const group = events.filter((event) => localDay(event.ts) === day);
    const summary = summarize(group);
    const tokens =
      summary.tokensIn === null && summary.tokensOut === null
        ? null
        : (summary.tokensIn ?? 0) + (summary.tokensOut ?? 0);
    return {
      day,
      count: group.length,
      fail: summary.byStatus.fail,
      tokens,
      isToday: day === today,
    };
  });
}

function sumField(events: readonly UsageEvent[], field: "tokens_in" | "tokens_out"): number | null {
  return summarize(events)[field === "tokens_in" ? "tokensIn" : "tokensOut"];
}

export function botCards(events: readonly UsageEvent[], days: readonly string[]): BotCardModel[] {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const group = groups.get(event.bot_id);
    if (group) group.push(event);
    else groups.set(event.bot_id, [event]);
  }
  return [...groups.entries()]
    .map(([botId, group]) => {
      const latest = [...group].sort((a, b) => a.ts.localeCompare(b.ts)).at(-1);
      const tokensIn = sumField(group, "tokens_in");
      const tokensOut = sumField(group, "tokens_out");
      return {
        botId,
        botName: latest?.bot_name ?? botId,
        count: group.length,
        fail: group.filter((event) => event.status === "fail").length,
        tokens: tokensIn === null && tokensOut === null ? null : (tokensIn ?? 0) + (tokensOut ?? 0),
        spark: days.map((day) => group.filter((event) => localDay(event.ts) === day).length),
      };
    })
    .sort((a, b) => (b.tokens ?? -1) - (a.tokens ?? -1) || b.count - a.count || a.botName.localeCompare(b.botName));
}

export function storyFor(events: readonly UsageEvent[], filters: Filters): StoryModel | null {
  if (!filters.botId) return null;
  const runs = filterEvents(events, filters).sort((a, b) => b.ts.localeCompare(a.ts));
  if (runs.length === 0) return null;
  const contexts = runs
    .map((event) => event.estimates?.context_chars)
    .filter((value): value is number => typeof value === "number");
  const peak = contexts.length > 0 ? Math.max(...contexts) : null;
  const peakEvent =
    peak === null
      ? undefined
      : runs.find((event) => event.estimates?.context_chars === peak);
  const max = Math.max(1, peak ?? 1);
  const tasks = new Map<string, { count: number; fail: number }>();
  for (const event of runs) {
    const current = tasks.get(event.task) ?? { count: 0, fail: 0 };
    current.count += 1;
    if (event.status === "fail") current.fail += 1;
    tasks.set(event.task, current);
  }
  return {
    botId: filters.botId,
    botName: runs[0]?.bot_name ?? filters.botId,
    runs: runs.map((event) => {
      const context = typeof event.estimates?.context_chars === "number" ? event.estimates.context_chars : null;
      return {
        event,
        context,
        contextPct: context === null ? 0 : Math.max(6, Math.round((context / max) * 100)),
      };
    }),
    tasks: [...tasks.entries()]
      .map(([task, stats]) => ({ task, ...stats }))
      .sort((a, b) => b.count - a.count || a.task.localeCompare(b.task)),
    runCount: runs.length,
    failCount: runs.filter((event) => event.status === "fail").length,
    partialCount: runs.filter((event) => event.status === "partial").length,
    contextAvg: contexts.length > 0 ? Math.round(contexts.reduce((sum, value) => sum + value, 0) / contexts.length) : null,
    contextPeak: peak,
    contextPeakTask: peakEvent?.task ?? null,
    contextReported: contexts.length,
  };
}

export function failRate(failed: number, total: number): number | null {
  if (total === 0) return null;
  return failed / total;
}

export function busiestBot(cards: readonly BotCardModel[]): string {
  return cards[0]?.botId ?? "";
}
