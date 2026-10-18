#!/usr/bin/env node
// Inject the public Media email origin into the Pages staging tree before hashing.

import fs from "node:fs/promises";
import path from "node:path";

const PLACEHOLDER = '"__UK_AQ_MEDIA_EMAIL_PUBLIC_URL__"';
const CONFIG_PATH = "news/subscription-config.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0].trim()) {
    throw new Error("Usage: node scripts/uk_aq_inject_media_email_config.mjs <path>/.pages-site");
  }

  const value = process.env.UK_AQ_MEDIA_EMAIL_PUBLIC_URL;
  if (!value || !value.trim()) {
    throw new Error("Missing repository variable UK_AQ_MEDIA_EMAIL_PUBLIC_URL.");
  }

  const invalidOriginMessage = "UK_AQ_MEDIA_EMAIL_PUBLIC_URL must be a valid HTTPS origin without credentials, a path other than /, query or fragment.";
  // Check the raw shape too: URL parsing normalises dot paths and backslashes,
  // strips some whitespace, and hides empty userinfo/query/fragment delimiters.
  if (!/^https:\/\/[^/?#@\\\s\u0000-\u001f\u007f]+\/?$/i.test(value)) {
    throw new Error(invalidOriginMessage);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(invalidOriginMessage);
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(invalidOriginMessage);
  }

  const targetRoot = path.resolve(args[0]);
  const rootStat = await fs.lstat(targetRoot);
  if (path.basename(targetRoot) !== ".pages-site" || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Unsafe target: staging target must be a real directory named .pages-site.");
  }
  const configPath = path.join(targetRoot, CONFIG_PATH);
  const configStat = await fs.lstat(configPath);
  if (!configStat.isFile() || configStat.isSymbolicLink()) {
    throw new Error(`Staged ${CONFIG_PATH} must be a real file.`);
  }
  const source = await fs.readFile(configPath, "utf8");
  if (source.split(PLACEHOLDER).length !== 2) {
    throw new Error(`Expected exactly one Media email URL placeholder in staged ${CONFIG_PATH}.`);
  }
  // Replace the entire JS string literal; the callback avoids replacement-pattern
  // expansion. origin removes the optional trailing slash used by API callers.
  await fs.writeFile(configPath, source.replace(PLACEHOLDER, () => JSON.stringify(url.origin)), "utf8");
  console.log(`Injected UK_AQ_MEDIA_EMAIL_PUBLIC_URL into staged ${CONFIG_PATH}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
