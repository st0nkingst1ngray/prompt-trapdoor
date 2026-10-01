import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "data", "events.jsonl");

const BOTS = {
  "research-bot": "Research Bot",
  "inbox-bot": "Inbox Bot",
  "ops-bot": "Ops Bot",
};

let seq = 0;

function eventId() {
  seq += 1;
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, "0")}`;
}

function stamp(dayOffset, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function wave(day, salt) {
  return ((day * 17 + salt * 13) % 9) - 4;
}

function estimates(base, day, salt, patch = {}) {
  const shift = wave(day, salt);
  return {
    tokens_in: Math.max(0, base.tokens_in + shift * 180),
    tokens_out: Math.max(0, base.tokens_out + shift * 40),
    agent_steps: base.agent_steps,
    context_chars: Math.max(0, base.context_chars + shift * 900),
    attachments_bytes: base.attachments_bytes,
    ...patch,
  };
}

const profiles = {
  literature: { tokens_in: 8400, tokens_out: 1500, agent_steps: 6, context_chars: 28000, attachments_bytes: 16000 },
  citation: { tokens_in: 4600, tokens_out: 980, agent_steps: 4, context_chars: 18000, attachments_bytes: 420000 },
  brief: { tokens_in: 15200, tokens_out: 3400, agent_steps: 11, context_chars: 76000, attachments_bytes: 88000 },
  triage: { tokens_in: 2100, tokens_out: 480, agent_steps: 3, context_chars: 9000, attachments_bytes: 0 },
  drafts: { tokens_in: 3900, tokens_out: 1600, agent_steps: 5, context_chars: 14000, attachments_bytes: 6000 },
  health: { tokens_in: 900, tokens_out: 240, agent_steps: 2, context_chars: 3200, attachments_bytes: 0 },
  deploy: { tokens_in: 7200, tokens_out: 860, agent_steps: 8, context_chars: 24000, attachments_bytes: 1500 },
};

function ev({ day, hour, minute, bot, task, kind, status, model, estimates: usage, notes, source = "skill" }) {
  const event = {
    schema_version: 1,
    id: eventId(),
    ts: stamp(day, hour, minute),
    bot_id: bot,
    bot_name: BOTS[bot],
    task,
    run_kind: kind,
    status,
    source,
  };
  if (model) event.model = model;
  if (usage) event.estimates = usage;
  if (notes) event.notes = notes;
  return event;
}

const events = [];

for (let day = 13; day >= 0; day -= 1) {
  const literatureFail = day === 10;
  events.push(
    ev({
      day,
      hour: 8,
      minute: 10,
      bot: "research-bot",
      task: "literature scan",
      kind: "routine",
      status: literatureFail ? "fail" : "ok",
      model: "grok-4",
      estimates: estimates(profiles.literature, day, 1),
      notes: literatureFail ? "Index timed out before the scan finished." : undefined,
    }),
    ev({
      day,
      hour: 8,
      minute: 40,
      bot: "inbox-bot",
      task: "triage",
      kind: day === 11 ? "webhook" : "routine",
      status: "ok",
      model: "grok-4-fast",
      estimates: estimates(profiles.triage, day, 2),
      notes: day === 11 ? "Inbound alias dropped a batch into the inbox." : undefined,
    }),
    ev({
      day,
      hour: 9,
      minute: 5,
      bot: "ops-bot",
      task: "health check",
      kind: "routine",
      status: "ok",
      model: "grok-4-fast",
      estimates: estimates(profiles.health, day, 3),
    }),
  );
}

const extras = [
  { day: 0, hour: 11, minute: 20, bot: "research-bot", task: "weekly brief", kind: "routine", status: "ok", model: "grok-4", profile: "brief", salt: 4, patch: { context_chars: 92400, tokens_in: 18400, tokens_out: 4100, agent_steps: 12 }, notes: "Pulled the week's scans into one brief. Largest context in the sample." },
  { day: 0, hour: 14, minute: 5, bot: "research-bot", task: "citation check", kind: "chat", status: "fail", model: "grok-4", profile: "citation", salt: 5, notes: "Could not open the source PDF. The run stopped after the outline." },
  { day: 0, hour: 15, minute: 30, bot: "inbox-bot", task: "draft replies", kind: "chat", status: "ok", model: "grok-4", profile: "drafts", salt: 6 },
  { day: 0, hour: 16, minute: 10, bot: "ops-bot", task: "deploy watch", kind: "cloud_agent", status: "ok", model: "grok-4", profile: "deploy", salt: 7, notes: "Watched the afternoon rollout through to healthy checks." },
  { day: 1, hour: 13, minute: 15, bot: "inbox-bot", task: "draft replies", kind: "chat", status: "partial", model: "grok-4", profile: "drafts", salt: 6, notes: "Two of four drafts were recorded." },
  { day: 1, hour: 16, minute: 40, bot: "research-bot", task: "citation check", kind: "chat", status: "ok", model: "grok-4", profile: "citation", salt: 5 },
  { day: 2, hour: 18, minute: 5, bot: "ops-bot", task: "incident note", kind: "chat", status: "partial", source: "manual", notes: "Operator added this after the pager note. Token estimates were unknown." },
  { day: 2, hour: 11, minute: 50, bot: "inbox-bot", task: "draft replies", kind: "chat", status: "fail", model: "grok-4", profile: "drafts", salt: 6, notes: "The thread outgrew the notes the bot kept." },
  { day: 3, hour: 15, minute: 25, bot: "ops-bot", task: "deploy watch", kind: "cloud_agent", status: "ok", model: "grok-4", profile: "deploy", salt: 7 },
  { day: 4, hour: 10, minute: 35, bot: "research-bot", task: "citation check", kind: "chat", status: "ok", model: "grok-4", profile: "citation", salt: 5, patch: { tokens_out: null, attachments_bytes: null } },
  { day: 5, hour: 17, minute: 5, bot: "ops-bot", task: "deploy watch", kind: "cloud_agent", status: "partial", model: "grok-4", profile: "deploy", salt: 7, notes: "Staging only. The production watch did not run." },
  { day: 5, hour: 12, minute: 10, bot: "inbox-bot", task: "draft replies", kind: "chat", status: "ok", model: "grok-4", profile: "drafts", salt: 6 },
  { day: 6, hour: 19, minute: 12, bot: "ops-bot", task: "deploy watch", kind: "cloud_agent", status: "fail", model: "grok-4", profile: "deploy", salt: 7, notes: "Rollout log ended early." },
  { day: 7, hour: 11, minute: 0, bot: "research-bot", task: "weekly brief", kind: "routine", status: "ok", model: "grok-4", profile: "brief", salt: 4 },
  { day: 7, hour: 14, minute: 45, bot: "inbox-bot", task: "draft replies", kind: "chat", status: "ok", model: "grok-4", profile: "drafts", salt: 6 },
  { day: 8, hour: 13, minute: 20, bot: "research-bot", task: "citation check", kind: "chat", status: "ok", model: "grok-4", profile: "citation", salt: 5, source: "cli" },
  { day: 9, hour: 16, minute: 30, bot: "ops-bot", task: "deploy watch", kind: "cloud_agent", status: "ok", model: "grok-4", profile: "deploy", salt: 7 },
  { day: 12, hour: 15, minute: 0, bot: "inbox-bot", task: "draft replies", kind: "chat", status: "ok", model: "grok-4", profile: "drafts", salt: 6, source: "cli" },
];

for (const extra of extras) {
  events.push(
    ev({
      day: extra.day,
      hour: extra.hour,
      minute: extra.minute,
      bot: extra.bot,
      task: extra.task,
      kind: extra.kind,
      status: extra.status,
      model: extra.model,
      source: extra.source,
      notes: extra.notes,
      estimates: extra.profile ? estimates(profiles[extra.profile], extra.day, extra.salt, extra.patch) : undefined,
    }),
  );
}

events.sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
console.log(`wrote ${events.length} events -> ${outFile}`);
