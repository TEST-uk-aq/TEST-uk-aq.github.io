#!/usr/bin/env node
// Extend the established staged public-config injection approach, before hashing.
import fs from "node:fs/promises";
import path from "node:path";
import { validateEndpoint } from "../../shared/site-notice-schema.js";

const target = path.resolve(process.argv[2] || "");
const stat = await fs.lstat(target);
if (process.argv.length !== 3 || path.basename(target) !== ".pages-site" || !stat.isDirectory() || stat.isSymbolicLink()) {
  throw new Error("Usage: node scripts/site-notice/inject.mjs <real .pages-site directory>");
}
const endpoint = validateEndpoint(process.env.UK_AQ_SITE_NOTICE_URL);
const file = path.join(target, "site-notice-config.js");
const fileStat = await fs.lstat(file);
if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error("Unsafe staged notice config file");
const source = await fs.readFile(file, "utf8");
const placeholder = '"__UK_AQ_SITE_NOTICE_URL__"';
if (source.split(placeholder).length !== 2) throw new Error("Expected one notice endpoint placeholder");
await fs.writeFile(file, source.replace(placeholder, () => JSON.stringify(endpoint)));
console.log("Injected the public site-notice endpoint into the staged config");
