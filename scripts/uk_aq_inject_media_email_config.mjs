#!/usr/bin/env node
// Inject the public Media email configuration into Pages staging before hashing.

import fs from "node:fs/promises";
import path from "node:path";

const PLACEHOLDER = '"__UK_AQ_MEDIA_EMAIL_PUBLIC_URL__"';
const TURNSTILE_PLACEHOLDER = '"__UK_AQ_TURNSTILE_SITE_KEY__"';
const CONFIG_PATH = "news/subscription-config.js";
const PAGE_PATH = "news-by-email/index.html";
const SITE_PLACEHOLDER = '__UK_AQ_CNAME_ORIGIN__';

function cnameOrigin(value) {
  const hostname = value.trim().toLowerCase();
  const invalid = 'CNAME must contain exactly one valid hostname without URL syntax, paths, ports or wildcards.';
  if (!hostname || hostname.length > 253 || !hostname.split('.').every(label =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error(invalid);
  let url;
  try { url = new URL(`https://${hostname}`); } catch { throw new Error(invalid); }
  if (url.hostname !== hostname) throw new Error(invalid);
  return url.origin;
}

function httpsOrigin(value, name) {
  const invalid = `${name} must be a canonical HTTPS origin without credentials, path, query or fragment.`;
  // Validate raw input before URL can normalise unsafe URL forms.
  if (typeof value !== 'string' || !/^https:\/\/[^/?#@\\\s\u0000-\u001f\u007f%*<>"'`]+\/?$/.test(value)) {
    throw new Error(invalid);
  }
  let url;
  try { url = new URL(value); } catch { throw new Error(invalid); }
  if (url.protocol !== 'https:' || !url.hostname || url.port === '0' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      (!url.hostname.startsWith('[') && (url.hostname.length > 253 ||
        !url.hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) ||
      (value !== url.origin && value !== `${url.origin}/`)) throw new Error(invalid);
  return url.origin;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0].trim()) {
    throw new Error("Usage: node scripts/uk_aq_inject_media_email_config.mjs <path>/.pages-site");
  }

  const apiOrigin = httpsOrigin(process.env.UK_AQ_MEDIA_EMAIL_PUBLIC_URL, 'UK_AQ_MEDIA_EMAIL_PUBLIC_URL');
  const siteKey = (process.env.UK_AQ_TURNSTILE_SITE_KEY || '').trim();
  if (!siteKey || siteKey === '__UK_AQ_TURNSTILE_SITE_KEY__') {
    throw new Error('Missing UK_AQ_TURNSTILE_SITE_KEY for Media email configuration.');
  }

  const targetRoot = path.resolve(args[0]);
  const rootStat = await fs.lstat(targetRoot);
  if (path.basename(targetRoot) !== ".pages-site" || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Unsafe target: staging target must be a real directory named .pages-site.");
  }
  const cnamePath = path.join(targetRoot, 'CNAME');
  const cnameStat = await fs.lstat(cnamePath);
  if (!cnameStat.isFile() || cnameStat.isSymbolicLink()) {
    throw new Error('Staged CNAME must be a real file.');
  }
  const siteOrigin = cnameOrigin(await fs.readFile(cnamePath, 'utf8'));
  const configPath = path.join(targetRoot, CONFIG_PATH);
  const configStat = await fs.lstat(configPath);
  if (!configStat.isFile() || configStat.isSymbolicLink()) {
    throw new Error(`Staged ${CONFIG_PATH} must be a real file.`);
  }
  const source = await fs.readFile(configPath, "utf8");
  if (source.split(PLACEHOLDER).length !== 2) {
    throw new Error(`Expected exactly one Media email URL placeholder in staged ${CONFIG_PATH}.`);
  }
  if (source.split(TURNSTILE_PLACEHOLDER).length !== 2) {
    throw new Error(`Expected exactly one Turnstile site key placeholder in staged ${CONFIG_PATH}.`);
  }
  const pagePath = path.join(targetRoot, PAGE_PATH);
  const pageStat = await fs.lstat(pagePath);
  if (!pageStat.isFile() || pageStat.isSymbolicLink()) {
    throw new Error(`Staged ${PAGE_PATH} must be a real file.`);
  }
  const page = await fs.readFile(pagePath, 'utf8');
  if (page.split(SITE_PLACEHOLDER).length !== 5) {
    throw new Error(`Expected four CNAME origin placeholders in staged ${PAGE_PATH}.`);
  }
  // Replace the entire JS string literal; the callback avoids replacement-pattern
  // expansion. origin removes the optional trailing slash used by API callers.
  const updated = source
    .replace(PLACEHOLDER, () => JSON.stringify(apiOrigin))
    .replace(TURNSTILE_PLACEHOLDER, () => JSON.stringify(siteKey));
  await fs.writeFile(configPath, updated, "utf8");
  await fs.writeFile(pagePath, page.replaceAll(SITE_PLACEHOLDER, () => siteOrigin), 'utf8');
  console.log(`Injected public Media email configuration into staged ${CONFIG_PATH}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
