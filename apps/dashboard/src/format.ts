export function formatInt(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dayDate(day));
}

export function weekday(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(dayDate(day));
}

export function formatWhen(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatBytes(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${trim(value / 1024)} KB`;
  return `${trim(value / (1024 * 1024))} MB`;
}

export function kindLabel(kind: string): string {
  if (kind === "cloud_agent") return "cloud agent";
  return kind;
}

function dayDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

function trim(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}
