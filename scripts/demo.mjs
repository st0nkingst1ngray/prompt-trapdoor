import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dashboardRoot = join(root, "apps", "dashboard");
const port = 4173;

const major = Number(process.versions.node.split(".")[0]);
if (!Number.isFinite(major) || major < 20) {
  console.error("Node.js 20 or newer is required.");
  process.exit(1);
}

if (!existsSync(join(root, "node_modules", "vite", "package.json"))) {
  console.log("Installing dependencies…");
  const install = spawnSync("npm", ["install"], { cwd: root, stdio: "inherit" });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const seed = spawnSync(process.execPath, [join(root, "scripts", "seed-events.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (seed.status !== 0) process.exit(seed.status ?? 1);

const { createServer } = await import("vite");
const server = await createServer({
  root: dashboardRoot,
  configFile: join(dashboardRoot, "vite.config.ts"),
  clearScreen: false,
  logLevel: "warn",
  server: { host: "127.0.0.1", port, strictPort: true },
});

await server.listen();
const url = `http://127.0.0.1:${port}`;

let payload;
try {
  const response = await fetch(`${url}/api/events`);
  if (!response.ok) throw new Error(`API status ${response.status}`);
  payload = await response.json();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Dashboard did not come up at ${url}: ${message}`);
  await server.close();
  process.exit(1);
}

const today = localDay(new Date().toISOString());
const events = Array.isArray(payload.events) ? payload.events : [];
const todayCount = events.filter((event) => localDay(event.ts) === today).length;
const bots = new Set(events.map((event) => event.bot_id));
if (events.length < 20 || todayCount < 1 || bots.size < 3) {
  console.error("Sample data is too thin to open the demo. Re-run npm run seed and try again.");
  await server.close();
  process.exit(1);
}

console.log(`
Grok Usage is ready.

Open  ${url}

${events.length} sample runs are loaded, including ${todayCount} from today across ${bots.size} bots.
Figures are self-reported estimates, not Cursor billing.

Leave this process running. Ctrl+C stops it.
`);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

await new Promise(() => {});

function localDay(ts) {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
