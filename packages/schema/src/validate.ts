import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import type { UsageEvent, ValidationResult } from "./types.ts";

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "usage-event.schema.json");
const schema: object = JSON.parse(readFileSync(schemaPath, "utf8")) as object;

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function formatError(error: ErrorObject): { path: string; message: string } {
  const path = error.instancePath || "(root)";
  let message = error.message ?? "invalid";
  if (typeof error.params.additionalProperty === "string") {
    message = `${message}: ${error.params.additionalProperty}`;
  }
  return { path, message };
}

export function validateEvent(input: unknown): ValidationResult {
  if (validate(input)) {
    return { ok: true, event: input as UsageEvent };
  }
  return {
    ok: false,
    errors: (validate.errors ?? []).map(formatError),
  };
}

export function schemaFilePath(): string {
  return schemaPath;
}
