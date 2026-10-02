import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Connect, PreviewServer, ViteDevServer } from "vite";
import { defineConfig } from "vite";
import { parseJsonl } from "../../packages/schema/src/index.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaEntry = path.resolve(repoRoot, "packages/schema/src/aggregate.ts");

function eventsPath(): string {
  return process.env.EVENTS_FILE ? path.resolve(process.env.EVENTS_FILE) : path.join(repoRoot, "data", "events.jsonl");
}

function sendEvents(_req: IncomingMessage, res: ServerResponse): void {
  const file = eventsPath();
  const relative = path.relative(repoRoot, file) || file;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (!existsSync(file)) {
    res.end(JSON.stringify({ file: relative, missing: true, events: [], errors: [] }));
    return;
  }
  const parsed = parseJsonl(readFileSync(file, "utf8"));
  res.end(JSON.stringify({ file: relative, missing: false, events: parsed.events, errors: parsed.errors }));
}

function eventsApi(req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction): void {
  const url = req.url?.split("?")[0];
  if (url !== "/api/events") {
    next();
    return;
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }
  try {
    sendEvents(req, res);
  } catch (error) {
    res.statusCode = 500;
    const message = error instanceof Error ? error.message : "failed to read events";
    res.end(JSON.stringify({ error: message }));
  }
}

function eventsPlugin() {
  return {
    name: "grok-usage-events",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(eventsApi);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(eventsApi);
    },
  };
}

export default defineConfig({
  plugins: [react(), eventsPlugin()],
  resolve: {
    alias: {
      "@grok-usage/schema/aggregate": schemaEntry,
    },
  },
  optimizeDeps: {
    exclude: ["@grok-usage/schema"],
  },
  server: {
    host: "127.0.0.1",
    port: 5180,
    fs: { allow: [repoRoot] },
  },
  preview: {
    host: "127.0.0.1",
    port: 5181,
  },
});
