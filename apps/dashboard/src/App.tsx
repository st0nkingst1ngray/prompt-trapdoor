import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { summarize, type UsageEvent } from "@grok-usage/schema/aggregate";
import {
  formatBytes,
  formatCompact,
  formatDay,
  formatInt,
  formatPercent,
  formatWhen,
  kindLabel,
  weekday,
} from "./format.ts";
import {
  botCards,
  busiestBot,
  daySpan,
  failRate,
  filterEvents,
  localDay,
  storyFor,
  timeline,
  todayKey,
  type Filters,
} from "./view.ts";

interface EventsPayload {
  file: string;
  missing: boolean;
  events: UsageEvent[];
  errors: { line: number; message: string }[];
}

export function App() {
  const [payload, setPayload] = useState<EventsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState("");
  const [storyPick, setStoryPick] = useState("");
  const [day, setDay] = useState("");
  const [task, setTask] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      if (!response.ok) throw new Error(`The events API returned ${response.status}.`);
      setPayload((await response.json()) as EventsPayload);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load events.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const events = payload?.events ?? [];
  const span = useMemo(() => daySpan(events), [events]);
  const cards = useMemo(() => botCards(events, span), [events, span]);
  const storyId = focusId || storyPick || busiestBot(cards);

  const dayOptions = useMemo(() => {
    const scoped = filterEvents(events, { botId: focusId, day: "", task: "" });
    return daySpan(scoped).reverse();
  }, [events, focusId]);
  const taskOptions = useMemo(() => {
    const scoped = filterEvents(events, { botId: focusId, day: dayOptions.includes(day) ? day : "", task: "" });
    return [...new Set(scoped.map((event) => event.task))].sort((a, b) => a.localeCompare(b));
  }, [events, focusId, day, dayOptions]);

  const dayValue = dayOptions.includes(day) ? day : "";
  const taskValue = taskOptions.includes(task) ? task : "";
  const filters: Filters = { botId: focusId, day: dayValue, task: taskValue };
  const view = filterEvents(events, filters);
  const summary = summarize(view);
  const today = todayKey();
  const todayEvents = filterEvents(events, { botId: focusId, day: "", task: taskValue }).filter(
    (event) => localDay(event.ts) === today,
  );
  const activeBots = new Set(todayEvents.map((event) => event.bot_id)).size;
  const tokenTotal =
    summary.tokensIn === null && summary.tokensOut === null ? null : (summary.tokensIn ?? 0) + (summary.tokensOut ?? 0);
  const rate = failRate(summary.byStatus.fail, summary.count);
  const bars = timeline(view, today);
  const story = storyFor(events, { botId: storyId, day: dayValue, task: taskValue });
  const maxBar = Math.max(1, ...bars.map((bar) => bar.count));
  const filtersActive = Boolean(focusId || dayValue || taskValue);

  function chooseBot(botId: string) {
    setStoryPick(botId);
    setFocusId((current) => (current === botId ? "" : botId));
  }

  if (!payload && !error) {
    return (
      <Shell>
        <p className="loading" role="status">
          Opening the ledger…
        </p>
      </Shell>
    );
  }

  if (error && !payload) {
    return (
      <Shell>
        <div className="empty" data-testid="empty-state">
          <h1>The ledger did not load</h1>
          <p>{error}</p>
          <p>Start it with <code>npm run demo</code> and open the URL it prints.</p>
        </div>
      </Shell>
    );
  }

  if (!payload || payload.missing || payload.events.length === 0) {
    return (
      <Shell>
        <Honesty />
        <div className="empty" data-testid="empty-state">
          <h1>No runs recorded yet</h1>
          <p>
            This file is empty{payload?.file ? `: ${payload.file}` : ""}. Log a self-reported event, then refresh.
            <code>npm run demo</code> loads a full sample instead.
          </p>
        </div>
      </Shell>
    );
  }

  const recent = [...view].sort((a, b) => b.ts.localeCompare(a.ts));

  return (
    <Shell>
      <header className="mast">
        <div>
          <p className="kicker">Local ledger · schema 1</p>
          <h1>Grok Usage</h1>
          <p className="lede">What your bots report from the work you give them.</p>
        </div>
        <Honesty />
      </header>

      <div className="toolbar">
        <label>
          Bot
          <select
            value={focusId}
            onChange={(event) => {
              const next = event.target.value;
              setFocusId(next);
              if (next) setStoryPick(next);
            }}
          >
            <option value="">All bots</option>
            {cards.map((card) => (
              <option key={card.botId} value={card.botId}>
                {card.botName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Day
          <select value={dayValue} onChange={(event) => setDay(event.target.value)}>
            <option value="">All days</option>
            {dayOptions.map((option) => (
              <option key={option} value={option}>
                {formatDay(option)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Task
          <select value={taskValue} onChange={(event) => setTask(event.target.value)}>
            <option value="">All tasks</option>
            {taskOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="toolbar-actions">
          {filtersActive ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setFocusId("");
                setStoryPick("");
                setDay("");
                setTask("");
              }}
            >
              Clear filters
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={() => void load()}>
            Refresh
          </button>
          <span className="file-pill">{payload.file}</span>
        </div>
      </div>

      {payload.errors.length > 0 ? (
        <p className="warn" role="status">
          {payload.errors.length} line{payload.errors.length === 1 ? "" : "s"} in the file did not match the schema and
          are hidden.
        </p>
      ) : null}

      <section className="kpis" aria-label="Summary">
        <article className="kpi kpi-today" data-testid="kpi-events-today">
          <p>Events today</p>
          <strong>{formatInt(todayEvents.length)}</strong>
          <span>runs dated {formatDay(today)}</span>
        </article>
        <article className="kpi kpi-bots" data-testid="kpi-bots-active">
          <p>Bots active</p>
          <strong>{formatInt(activeBots)}</strong>
          <span>with a run today</span>
        </article>
        <article className="kpi kpi-tokens" data-testid="kpi-tokens">
          <p>Estimated tokens</p>
          <strong>{formatCompact(tokenTotal)}</strong>
          <span>
            {formatCompact(summary.tokensIn)} in · {formatCompact(summary.tokensOut)} out
          </span>
        </article>
        <article className="kpi kpi-fail" data-testid="kpi-fail-rate">
          <p>Fail rate</p>
          <strong>{formatPercent(rate)}</strong>
          <span>
            {formatInt(summary.byStatus.fail)} failed · {formatInt(summary.count)}{" "}
            {summary.count === 1 ? "run" : "runs"} in view
          </span>
        </article>
      </section>

      <section className="panel" aria-labelledby="timeline-heading">
        <div className="panel-head">
          <h2 id="timeline-heading">Runs by day</h2>
          <p>{bars.length} days in this view. Amber is today. Red marks failed runs.</p>
        </div>
        <div
          className="timeline"
          data-testid="timeline"
          role="img"
          aria-label={bars
            .map((bar) => `${formatDay(bar.day)}: ${bar.count} ${bar.count === 1 ? "run" : "runs"}`)
            .join(", ")}
        >
          {bars.map((bar) => (
            <div key={bar.day} className={bar.isToday ? "day-col is-today" : "day-col"}>
              <span className="day-count">{bar.count}</span>
              <div className="day-track">
                <div className="day-fill" style={{ height: `${Math.max(bar.count === 0 ? 2 : 8, (bar.count / maxBar) * 100)}%` }}>
                  {bar.fail > 0 ? <span className="day-fail" style={{ height: `${(bar.fail / Math.max(bar.count, 1)) * 100}%` }} /> : null}
                </div>
              </div>
              <span className="day-label">
                <span className="day-week">{weekday(bar.day)}</span>
                <span className="day-date">
                  <span className="day-num">{Number(bar.day.slice(8))}</span>
                  <span className="day-month"> {formatDay(bar.day).split(" ").slice(1).join(" ")}</span>
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="hint">Click a bot to focus its runs. Click it again to return to the whole ledger.</p>
      <section className="bots" aria-label="Bots">
        {cards.map((card) => {
          const selected = card.botId === storyId;
          const sparkMax = Math.max(1, ...card.spark);
          return (
            <button
              key={card.botId}
              type="button"
              className={selected ? "bot-card is-selected" : "bot-card"}
              aria-pressed={selected}
              data-testid="bot-card"
              onClick={() => chooseBot(card.botId)}
            >
              <span className="bot-name">{card.botName}</span>
              <span className="bot-meta">
                {card.count} runs · {card.fail} failed · {formatCompact(card.tokens)} tokens
              </span>
              <span className="spark" aria-hidden="true">
                {card.spark.map((value, index) => (
                  <span key={`${card.botId}-${index}`} style={{ height: value === 0 ? "2px" : `${(value / sparkMax) * 100}%` }} />
                ))}
              </span>
            </button>
          );
        })}
      </section>

      <section className="panel story" data-testid="story" aria-labelledby="story-heading">
        {story ? (
          <>
            <div className="panel-head">
              <div>
                <p className="kicker">Story</p>
                <h2 id="story-heading" data-testid="story-title">
                  {story.botName}
                </h2>
                <p className="narrative">
                  {story.runCount} runs across {story.tasks.length} tasks
                  {story.failCount > 0 ? `, ${story.failCount} failed` : ""}
                  {story.partialCount > 0 ? `, ${story.partialCount} partial` : ""}.
                  {story.contextPeak !== null && story.contextPeakTask
                    ? ` Largest reported context was ${formatInt(story.contextPeak)} chars on ${story.contextPeakTask}.`
                    : " No context size was reported."}
                </p>
              </div>
              <dl className="story-stats">
                <div>
                  <dt>Context avg</dt>
                  <dd>{formatCompact(story.contextAvg)}</dd>
                </div>
                <div>
                  <dt>Context peak</dt>
                  <dd>{formatCompact(story.contextPeak)}</dd>
                </div>
                <div>
                  <dt>Reported</dt>
                  <dd>
                    {story.contextReported}/{story.runCount}
                  </dd>
                </div>
              </dl>
            </div>
            <ul className="chips">
              {story.tasks.map((item) => (
                <li key={item.task}>
                  {item.task}
                  <span>{item.count}</span>
                  {item.fail > 0 ? <span className="chip-fail">{item.fail} fail</span> : null}
                </li>
              ))}
            </ul>
            <div className="runs">
              {story.runs.map(({ event, context, contextPct }) => (
                <article key={event.id} className={`run run-${event.status}`} data-testid="story-run">
                  <header>
                    <time dateTime={event.ts}>{formatWhen(event.ts)}</time>
                    <strong>{event.task}</strong>
                    <span className={`status status-${event.status}`}>{event.status}</span>
                    <span className="meta">
                      {kindLabel(event.run_kind)}
                      {event.model ? ` · ${event.model}` : ""} · {event.source}
                    </span>
                  </header>
                  {context === null ? (
                    <p className="context-missing">Context size not reported</p>
                  ) : (
                    <div className="context">
                      <div className="context-track">
                        <div className="context-fill" style={{ width: `${contextPct}%` }} />
                      </div>
                      <span>{formatInt(context)} chars</span>
                    </div>
                  )}
                  <dl>
                    <div>
                      <dt>in</dt>
                      <dd>{formatCompact(event.estimates?.tokens_in)}</dd>
                    </div>
                    <div>
                      <dt>out</dt>
                      <dd>{formatCompact(event.estimates?.tokens_out)}</dd>
                    </div>
                    <div>
                      <dt>steps</dt>
                      <dd>{formatInt(event.estimates?.agent_steps)}</dd>
                    </div>
                    <div>
                      <dt>attached</dt>
                      <dd>{formatBytes(event.estimates?.attachments_bytes)}</dd>
                    </div>
                  </dl>
                  {event.notes ? <p className="note">{event.notes}</p> : null}
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="filtered-empty">No runs for this bot in the current filters.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="tasks-heading">
        <div className="panel-head">
          <h2 id="tasks-heading">Tasks in this view</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Runs</th>
                <th>Failed</th>
                <th>Partial</th>
                <th>Tokens in</th>
                <th>Tokens out</th>
              </tr>
            </thead>
            <tbody>
              {summary.byTask.map((row) => (
                <tr key={row.task}>
                  <td>{row.task}</td>
                  <td>{formatInt(row.count)}</td>
                  <td>{formatInt(row.fail)}</td>
                  <td>{formatInt(row.partial)}</td>
                  <td>{formatCompact(row.tokensIn)}</td>
                  <td>{formatCompact(row.tokensOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="runs-heading">
        <div className="panel-head">
          <h2 id="runs-heading">Recorded runs</h2>
          <p>{recent.length} in this view, newest first.</p>
        </div>
        <div className="table-wrap runs-table">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Bot</th>
                <th>Task</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Model</th>
                <th>In</th>
                <th>Out</th>
                <th>Steps</th>
                <th>Context</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((event) => (
                <tr key={event.id} data-testid="event-row">
                  <td>{formatWhen(event.ts)}</td>
                  <td>{event.bot_name}</td>
                  <td>{event.task}</td>
                  <td>{kindLabel(event.run_kind)}</td>
                  <td>
                    <span className={`status status-${event.status}`}>{event.status}</span>
                  </td>
                  <td>{event.model ?? "—"}</td>
                  <td>{formatCompact(event.estimates?.tokens_in)}</td>
                  <td>{formatCompact(event.estimates?.tokens_out)}</td>
                  <td>{formatInt(event.estimates?.agent_steps)}</td>
                  <td>{formatCompact(event.estimates?.context_chars)}</td>
                  <td>{event.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        Append-only JSONL. Null estimates stay blank. This is not a bill.
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="page">{children}</main>;
}

function Honesty() {
  return (
    <p className="honesty" data-testid="honesty-banner" role="note">
      Self-reported estimates. Not Cursor billing. This app does not read Cursor&apos;s usage UI.
    </p>
  );
}
