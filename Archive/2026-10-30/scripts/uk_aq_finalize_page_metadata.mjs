#!/usr/bin/env node
// Finalise first-party page metadata in the GitHub Pages staging tree.

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_IMAGE_PATH = "/images/UK-AQ-OG-Images-homepage.png";
const DEFAULT_IMAGE_ALT = "UK AQ live and historical air quality data from multiple air quality networks across the UK.";
const EXCLUDED_PATHS = new Set([
  "compressed-chart-history-test/index.html",
  "wood-burning/shun-bc-october-2025-animation-prep.html",
]);

async function main() {
  const [targetArg] = process.argv.slice(2);
  if (!targetArg?.trim()) {
    throw new Error("Usage: node scripts/uk_aq_finalize_page_metadata.mjs <path>/.pages-site");
  }

  const targetRoot = path.resolve(targetArg);
  if (path.basename(targetRoot) !== ".pages-site") {
    throw new Error("Unsafe target: metadata target must be a directory named .pages-site.");
  }
  const rootStat = await fs.lstat(targetRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Unsafe target: metadata target must be a real directory named .pages-site.");
  }

  const origin = readCnameOrigin(await fs.readFile(path.join(targetRoot, "CNAME"), "utf8"));
  await requireImage(targetRoot, DEFAULT_IMAGE_PATH);

  const htmlFiles = await findHtmlFiles(targetRoot);
  let processed = 0;
  for (const filePath of htmlFiles) {
    const relativePath = toPosix(path.relative(targetRoot, filePath));
    if (relativePath.startsWith("Archive/") || relativePath.startsWith("dark-preview/") || EXCLUDED_PATHS.has(relativePath)) {
      continue;
    }

    const source = await fs.readFile(filePath, "utf8");
    const updated = await finalizeHtml(source, relativePath, targetRoot, origin);
    if (updated !== source) await fs.writeFile(filePath, updated, "utf8");
    processed += 1;
  }
  console.log(`Finalised first-party page metadata for ${processed} staged HTML pages using ${origin}.`);
}

async function finalizeHtml(html, relativePath, targetRoot, origin) {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
  if (!headMatch) throw new Error(`Missing <head> in ${relativePath}`);
  const head = headMatch[1];
  const title = firstTagText(head, "title");
  if (!title) throw new Error(`Missing page title in ${relativePath}`);

  const description = firstMetaContent(head, "name", "description");
  if (!description) throw new Error(`Missing meta description in ${relativePath}`);
  const ogTitle = firstMetaContent(head, "property", "og:title") || title;
  const ogDescription = firstMetaContent(head, "property", "og:description") || description;
  const twitterTitle = firstMetaContent(head, "name", "twitter:title") || ogTitle;
  const twitterDescription = firstMetaContent(head, "name", "twitter:description") || ogDescription;

  const routePath = getPagePath(relativePath);
  const existingCanonical = firstLinkHref(head, "canonical");
  const canonicalPath = existingCanonical ? canonicalRoute(existingCanonical, relativePath) : routePath;
  const pageUrl = new URL(canonicalPath, origin).href;

  const override = firstMetaContent(head, "name", "uk-aq-og-image");
  const overrideAlt = firstMetaContent(head, "name", "uk-aq-og-image-alt");
  const imageWidth = firstMetaContent(head, "name", "uk-aq-og-image-width") || "1200";
  const imageHeight = firstMetaContent(head, "name", "uk-aq-og-image-height") || "630";
  const imageTypeOverride = firstMetaContent(head, "name", "uk-aq-og-image-type");
  const imagePath = override || DEFAULT_IMAGE_PATH;
  if (!imagePath.startsWith("/") || imagePath.startsWith("//") || /[?#\\\s]/.test(imagePath)) {
    throw new Error(`Open Graph image override must be a root-relative path without query or fragment in ${relativePath}`);
  }
  await requireImage(targetRoot, imagePath);
  const imageUrl = new URL(imagePath, origin).href;
  const imageType = imageTypeOverride || (imagePath.toLowerCase().endsWith(".png") ? "image/png"
    : imagePath.toLowerCase().endsWith(".jpg") || imagePath.toLowerCase().endsWith(".jpeg") ? "image/jpeg"
      : imagePath.toLowerCase().endsWith(".webp") ? "image/webp" : null);
  if (!imageType || !/^image\/(?:png|jpeg|webp)$/.test(imageType)) throw new Error(`Unsupported Open Graph image type for ${imagePath}`);
  if (!/^\d+$/.test(imageWidth) || Number(imageWidth) < 1 || !/^\d+$/.test(imageHeight) || Number(imageHeight) < 1) {
    throw new Error(`Open Graph image dimensions must be positive integers in ${relativePath}`);
  }

  let cleaned = head
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      const attrs = parseAttributes(tag);
      const key = (attrs.property || attrs.name || "").toLowerCase();
      return key === "description" || key === "og:type" || key === "og:site_name" || key === "og:title" || key === "og:description" || key === "og:url" || key.startsWith("og:image") || key.startsWith("twitter:") || key.startsWith("uk-aq-og-image") ? "" : tag;
    })
    .replace(/<link\b[^>]*>/gi, (tag) => parseAttributes(tag).rel?.toLowerCase().split(/\s+/).includes("canonical") ? "" : tag);

  const metadata = [
    meta({ name: "description", content: description }),
    `<link rel="canonical" href="${escapeAttribute(pageUrl)}">`,
    meta({ property: "og:type", content: "website" }),
    meta({ property: "og:site_name", content: "UK AQ" }),
    meta({ property: "og:title", content: ogTitle }),
    meta({ property: "og:description", content: ogDescription }),
    meta({ property: "og:url", content: pageUrl }),
    meta({ property: "og:image", content: imageUrl }),
    meta({ property: "og:image:width", content: imageWidth }),
    meta({ property: "og:image:height", content: imageHeight }),
    meta({ property: "og:image:type", content: imageType }),
    meta({ property: "og:image:alt", content: overrideAlt || DEFAULT_IMAGE_ALT }),
    meta({ name: "twitter:card", content: "summary_large_image" }),
    meta({ name: "twitter:title", content: twitterTitle }),
    meta({ name: "twitter:description", content: twitterDescription }),
    meta({ name: "twitter:image", content: imageUrl }),
  ].join("\n  ");
  const newHead = `${metadata}\n  ${cleaned.trim()}`;
  return html.replace(headMatch[0], `<head>${newHead}\n</head>`);
}

function readCnameOrigin(value) {
  const hostname = value.trim().toLowerCase();
  const invalid = "CNAME must contain exactly one valid hostname without URL syntax, paths, ports or wildcards.";
  if (!hostname || hostname.length > 253 || !hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error(invalid);
  }
  const url = new URL(`https://${hostname}`);
  if (url.hostname !== hostname || url.pathname !== "/" || url.search || url.hash) throw new Error(invalid);
  return url.origin;
}

function canonicalRoute(value, relativePath) {
  if (value.startsWith("//")) throw new Error(`Protocol-relative canonical URL is not allowed in ${relativePath}`);
  let url;
  try { url = new URL(value, "https://canonical.invalid"); } catch { throw new Error(`Invalid canonical URL in ${relativePath}`); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
    throw new Error(`Canonical URL must be HTTPS without credentials, port or fragment in ${relativePath}`);
  }
  // Self-canonical paths follow the deployment CNAME, including when old source HTML
  // still contains the public LIVE origin. Preserve the existing path and query.
  return `${url.pathname}${url.search}`;
}

function getPagePath(relativePath) {
  if (relativePath === "index.html") return "/";
  if (relativePath.endsWith("/index.html")) return `/${relativePath.slice(0, -"index.html".length)}`;
  return `/${relativePath}`;
}

async function requireImage(root, publicPath) {
  const relative = publicPath.slice(1);
  if (!relative || relative.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`Invalid root-relative image path: ${publicPath}`);
  }
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Image path escapes staging tree: ${publicPath}`);
  const stat = await fs.lstat(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Open Graph image must be a regular staged file: ${publicPath}`);
}

async function findHtmlFiles(directory) {
  const results = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".pages-site") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) results.push(...await findHtmlFiles(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) results.push(fullPath);
  }
  return results.sort();
}

function firstMetaContent(head, keyName, keyValue) {
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = parseAttributes(tag);
    if ((attrs[keyName] || "").toLowerCase() === keyValue.toLowerCase()) return decodeAttribute(attrs.content || "").trim();
  }
  return "";
}

function firstLinkHref(head, relValue) {
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const attrs = parseAttributes(tag);
    if ((attrs.rel || "").toLowerCase().split(/\s+/).includes(relValue)) return decodeAttribute(attrs.href || "").trim();
  }
  return "";
}

function firstTagText(head, tagName) {
  const match = head.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "i"));
  return match ? decodeAttribute(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
}

function parseAttributes(tag) {
  const attrs = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = pattern.exec(tag))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return attrs;
}

function meta(attrs) {
  return `<meta ${Object.entries(attrs).map(([key, value]) => `${key}="${escapeAttribute(value)}"`).join(" ")}>`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeAttribute(value) {
  return String(value).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function toPosix(value) { return value.split(path.sep).join("/"); }

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
