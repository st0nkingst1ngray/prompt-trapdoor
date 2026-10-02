#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));
const child = spawnSync(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(child.status === null ? 1 : child.status);
