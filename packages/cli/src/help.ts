export const HELP = `grok-usage — append and check self-reported bot usage events

These numbers are estimates you choose to record. They are not Cursor billing,
and this tool does not read Cursor's usage screens.

Usage:
  grok-usage log [options]
  grok-usage validate [file]

log writes one JSON object as a line in an append-only JSONL file.
Missing id, timestamp, schema_version, and source are filled in
(source defaults to cli).

Options:
  --file <path>              JSONL store (default ./data/events.jsonl)
  --bot-id <id>              Stable bot id
  --bot-name <name>          Display name
  --task <label>             Short task label
  --run-kind <kind>          chat | routine | webhook | cloud_agent | other
  --status <status>          ok | fail | partial
  --model <name>             Optional model name
  --source <source>          cli | skill | manual (default cli)
  --notes <text>             Optional note
  --tokens-in <n>            Optional non-negative integer estimate
  --tokens-out <n>           Optional non-negative integer estimate
  --agent-steps <n>          Optional non-negative integer estimate
  --context-chars <n>        Optional non-negative integer estimate
  --attachments-bytes <n>    Optional non-negative integer estimate
  --id <uuid>                Default: generated
  --ts <iso8601>             Default: current time
  --json <object>            Partial or full event; flags override fields
  --stdin                    Read one JSON object from stdin
  -h, --help                 Show this help

validate checks every non-blank line against the usage event schema.
Exit 0 when the file is valid, 1 when a line is not, 2 on bad usage.
`;
