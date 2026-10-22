#!/usr/bin/env node
import { createHash } from "node:crypto";
import { canonicalPayload } from "../../shared/site-notice-schema.js";

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 262144) throw new Error("Notice source too large");
}
const payload = canonicalPayload(JSON.parse(input));
const revision = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
const result = JSON.stringify({ ...payload, revision });
if (Buffer.byteLength(result) > 262144) throw new Error("Published notice too large");
process.stdout.write(result + "\n");
