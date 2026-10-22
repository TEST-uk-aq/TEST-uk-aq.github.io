#!/usr/bin/env node
// Generate an explicit, environment-scoped Wrangler config; does not deploy.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEndpoint } from "../../shared/site-notice-schema.js";

function setting(name, pattern) {
  const value = process.env[name] || "";
  if (!pattern.test(value)) throw new Error(`Missing or invalid ${name}`);
  return value;
}
const account = setting("CLOUDFLARE_ACCOUNT_ID", /^[a-fA-F0-9]{32}$/);
const namespace = setting("UK_AQ_SITE_NOTICE_KV_NAMESPACE_ID", /^[a-fA-F0-9]{32}$/);
const name = setting("UK_AQ_SITE_NOTICE_WORKER_NAME", /^[a-z0-9][a-z0-9-]{0,62}$/);
const endpoint = new URL(validateEndpoint(process.env.UK_AQ_SITE_NOTICE_URL));
const origins = setting("UK_AQ_SITE_NOTICE_ALLOWED_ORIGINS", /\S/).split(",").map((entry) => {
  const value = entry.trim();
  const url = new URL(validateEndpoint(value));
  if (value !== url.origin && value !== url.origin + "/") throw new Error("Allowed origins must be explicit HTTPS origins");
  return url.origin;
});
if (process.argv.length !== 3) throw new Error("Supply an output Wrangler JSON path under work/");
const destination = path.resolve(process.argv[2]);
if (!destination.includes(`${path.sep}work${path.sep}`)) throw new Error("Write generated config under work/");
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, JSON.stringify({
  name,
  account_id: account,
  main: fileURLToPath(new URL("../../workers/site-notice/worker.js", import.meta.url)),
  compatibility_date: "2026-10-22",
  workers_dev: true,
  kv_namespaces: [{ binding: "SITE_NOTICE_KV", id: namespace }],
  vars: { SITE_NOTICE_ALLOWED_ORIGINS: [...new Set(origins)].sort().join(","), SITE_NOTICE_PATH: endpoint.pathname },
}, null, 2) + "\n");
console.log("Generated notice Worker configuration; no resources changed");
