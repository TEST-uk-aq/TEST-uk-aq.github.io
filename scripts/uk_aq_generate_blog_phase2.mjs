#!/usr/bin/env node
// Generate Phase 2 Blog cards, social images and share routes inside a Pages staging tree.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nodeProcess = globalThis.process;
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const STAGING_DIRECTORY_NAME = ".pages-site";
const POSTS_MARKER = "<!-- UK_AQ_BLOG_PHASE2_POSTS -->";
const PUBLICATION_URL = "https://ukairquality.substack.com";
const FALLBACK_IMAGE_PATH = "/images/UK-AQ-social-share.png";
const HASH_LENGTH = 12;

const LIMITS = Object.freeze({
  feedBytes: 300_000,
  postCount: 50,
  imageBytes: 8_000_000,
  titleLength: 240,
  descriptionLength: 1_000,
  authorLength: 160,
  slugLength: 120,
  urlLength: 2_048,
  imageDimension: 12_000,
});

async function main() {
  const { targetRoot, feedFile } = parseArguments(nodeProcess.argv.slice(2));
  await validateTargetRoot(targetRoot);

  const siteOrigin = await readSiteOrigin(targetRoot);
  const feed = await loadFeed(feedFile);
  validateFeed(feed);

  const fallbackImage = await loadFallbackImage(targetRoot);
  const socialDirectory = path.join(targetRoot, "blog", "social");
  await fs.mkdir(socialDirectory, { recursive: true });

  const generatedPosts = [];
  for (const post of feed.posts) {
    const image = await materialisePostImage(post, socialDirectory, fallbackImage);
    generatedPosts.push({ ...post, image_path: image.publicPath });
    await writeSharePage(targetRoot, siteOrigin, { ...post, image_path: image.publicPath });
  }

  const blogIndexPath = path.join(targetRoot, "blog", "index.html");
  const template = await fs.readFile(blogIndexPath, "utf8");
  const markerCount = template.split(POSTS_MARKER).length - 1;
  if (markerCount !== 1) {
    throw new Error(`Expected exactly one ${POSTS_MARKER} marker in blog/index.html; found ${markerCount}`);
  }
  const cards = generatedPosts.map(renderBlogCard).join("\n");
  await fs.writeFile(blogIndexPath, template.replace(POSTS_MARKER, cards), "utf8");

  console.log(
    `Generated ${generatedPosts.length} UK AQ Blog cards and share routes for ${siteOrigin}.`,
  );
}

function parseArguments(args) {
  if (!args.length || !String(args[0] || "").trim()) {
    throw new Error(
      `Usage: node scripts/uk_aq_generate_blog_phase2.mjs <path>/${STAGING_DIRECTORY_NAME} [--feed-file <json>]`,
    );
  }
  const targetRoot = path.resolve(nodeProcess.cwd(), args[0]);
  let feedFile = null;
  if (args.length === 3 && args[1] === "--feed-file" && String(args[2] || "").trim()) {
    feedFile = path.resolve(nodeProcess.cwd(), args[2]);
  } else if (args.length !== 1) {
    throw new Error(
      `Usage: node scripts/uk_aq_generate_blog_phase2.mjs <path>/${STAGING_DIRECTORY_NAME} [--feed-file <json>]`,
    );
  }
  return { targetRoot, feedFile };
}

async function validateTargetRoot(targetRoot) {
  if (path.basename(targetRoot) !== STAGING_DIRECTORY_NAME) {
    throw new Error(`Unsafe target: staging directory must be named ${STAGING_DIRECTORY_NAME}`);
  }
  const stat = await fs.lstat(targetRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Unsafe target: staging target must be a real directory: ${targetRoot}`);
  }
  const realTargetRoot = await fs.realpath(targetRoot);
  const realRepoRoot = await fs.realpath(REPO_ROOT);
  if (realTargetRoot === realRepoRoot) {
    throw new Error("Unsafe target: refusing to generate into the tracked repository root");
  }
  if (isPathWithin(realTargetRoot, realRepoRoot)) {
    const relative = toPublicPath(path.relative(realRepoRoot, realTargetRoot));
    if (relative !== STAGING_DIRECTORY_NAME) {
      throw new Error(`Unsafe target inside repository: ${relative}`);
    }
  }

  for (const requiredPath of ["CNAME", "blog/index.html", "images/UK-AQ-social-share.png"]) {
    const requiredStat = await fs.lstat(path.join(targetRoot, requiredPath));
    if (!requiredStat.isFile() || requiredStat.isSymbolicLink()) {
      throw new Error(`Required staging input must be a real file: ${requiredPath}`);
    }
  }
}

async function readSiteOrigin(targetRoot) {
  const cname = (await fs.readFile(path.join(targetRoot, "CNAME"), "utf8")).trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(cname)) {
    throw new Error("CNAME does not contain a valid public hostname");
  }
  return `https://${cname}`;
}

async function loadFeed(feedFile) {
  let bytes;
  if (feedFile) {
    bytes = await fs.readFile(feedFile);
    if (bytes.byteLength > LIMITS.feedBytes) throw new Error("Local Blog feed exceeds the size limit");
  } else {
    const feedUrl = validateFeedEndpoint(nodeProcess.env.UK_AQ_BLOG_FEED_URL || "");
    const response = await fetch(feedUrl, {
      headers: { accept: "application/json", "cache-control": "no-cache" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Blog feed endpoint returned HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("application/json")) {
      throw new Error(`Blog feed endpoint returned unsupported content type: ${contentType || "missing"}`);
    }
    bytes = await readBoundedResponse(response, LIMITS.feedBytes, "Blog feed");
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error(`Blog feed is not valid UTF-8 JSON: ${error.message}`);
  }
}

function validateFeedEndpoint(rawValue) {
  const url = new URL(boundedText(rawValue, LIMITS.urlLength, "UK_AQ_BLOG_FEED_URL"));
  if (
    url.protocol !== "https:"
    || !url.hostname
    || url.port
    || url.username
    || url.password
    || url.search
    || url.hash
    || !url.pathname.endsWith("/feed")
  ) {
    throw new Error("UK_AQ_BLOG_FEED_URL must be an HTTPS /feed endpoint without credentials, query or fragment");
  }
  return url.href;
}

function validateFeed(feed) {
  if (!feed || typeof feed !== "object" || Array.isArray(feed)) throw new Error("Blog feed must be an object");
  if (!hasExactKeys(feed, ["contract_version", "source", "publication_url", "posts"])) {
    throw new Error("Blog feed contains unsupported or missing top-level fields");
  }
  if (feed.contract_version !== 1 || feed.source !== "substack_rss" || feed.publication_url !== PUBLICATION_URL) {
    throw new Error("Blog feed contract identity is invalid");
  }
  if (!Array.isArray(feed.posts) || !feed.posts.length || feed.posts.length > LIMITS.postCount) {
    throw new Error("Blog feed must contain a bounded non-empty post list");
  }

  const postKeys = [
    "slug",
    "title",
    "description",
    "canonical_url",
    "guid",
    "author",
    "published_at",
    "image_url",
  ];
  const slugs = new Set();
  const canonicalUrls = new Set();
  let previousPublishedAt = null;
  for (const post of feed.posts) {
    if (!post || typeof post !== "object" || Array.isArray(post) || !hasExactKeys(post, postKeys)) {
      throw new Error("Blog feed post shape is invalid");
    }
    const canonicalUrl = validateCanonicalArticleUrl(post.canonical_url);
    const expectedSlug = new URL(canonicalUrl).pathname.slice("/p/".length);
    if (post.slug !== expectedSlug || slugs.has(post.slug) || canonicalUrls.has(canonicalUrl)) {
      throw new Error("Blog feed contains an invalid or duplicate post identity");
    }
    slugs.add(post.slug);
    canonicalUrls.add(canonicalUrl);
    boundedText(post.title, LIMITS.titleLength, "post title");
    boundedText(post.description, LIMITS.descriptionLength, "post description");
    boundedText(post.guid, LIMITS.urlLength, "post guid");
    boundedText(post.author, LIMITS.authorLength, "post author");
    if (new Date(post.published_at).toISOString() !== post.published_at) {
      throw new Error("Blog post publication time is not canonical ISO-8601 UTC");
    }
    if (previousPublishedAt && post.published_at > previousPublishedAt) {
      throw new Error("Blog feed posts are not ordered newest first");
    }
    previousPublishedAt = post.published_at;
    if (post.image_url !== null) validateImageUrl(post.image_url);
  }
}

async function loadFallbackImage(targetRoot) {
  const absolutePath = path.join(targetRoot, FALLBACK_IMAGE_PATH.slice(1));
  const bytes = await fs.readFile(absolutePath);
  const image = detectSupportedImage(bytes);
  if (image.extension !== "png" || image.width !== 1200 || image.height !== 630) {
    throw new Error("The first-party Blog fallback image must remain a 1200 x 630 PNG");
  }
  return { publicPath: FALLBACK_IMAGE_PATH, bytes, ...image };
}

async function materialisePostImage(post, socialDirectory, fallbackImage) {
  if (!post.image_url) return fallbackImage;

  try {
    const imageUrl = validateImageUrl(post.image_url);
    const response = await fetch(imageUrl, {
      headers: {
        accept: "image/png,image/jpeg;q=0.9,*/*;q=0.1",
        "cache-control": "no-cache",
        "user-agent": "UK-AQ-Pages-Blog-Generator/1.0",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:") throw new Error("image redirected away from HTTPS");
    const bytes = await readBoundedResponse(response, LIMITS.imageBytes, `Image for ${post.slug}`);
    const image = detectSupportedImage(bytes);
    const digest = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LENGTH);
    const fileName = `${post.slug}-${digest}.${image.extension}`;
    const absolutePath = path.join(socialDirectory, fileName);
    await fs.writeFile(absolutePath, bytes, { flag: "wx" });
    return { publicPath: `/blog/social/${fileName}`, bytes, ...image };
  } catch (error) {
    console.warn(`Using the UK AQ fallback image for ${post.slug}: ${error.message}`);
    return fallbackImage;
  }
}

function validateCanonicalArticleUrl(rawValue) {
  const text = boundedText(rawValue, LIMITS.urlLength, "canonical article URL");
  const url = new URL(text);
  if (
    url.protocol !== "https:"
    || url.hostname !== "ukairquality.substack.com"
    || url.port
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("Blog post canonical URL is invalid");
  }
  const match = /^\/p\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(url.pathname);
  if (!match || match[1].length > LIMITS.slugLength) {
    throw new Error("Blog post canonical URL does not contain a safe slug");
  }
  return url.href;
}

function validateImageUrl(rawValue) {
  const text = boundedText(rawValue, LIMITS.urlLength, "post image URL");
  const url = new URL(text);
  if (url.protocol !== "https:" || !url.hostname || url.port || url.username || url.password) {
    throw new Error("Blog post image URL must be an absolute HTTPS URL");
  }
  return url.href;
}

async function readBoundedResponse(response, maximumBytes, label) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maximumBytes) {
      await reader.cancel(`${label} size limit exceeded`);
      throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function detectSupportedImage(input) {
  const bytes = Buffer.from(input);
  let image;
  if (
    bytes.length >= 24
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    && bytes.toString("ascii", 12, 16) === "IHDR"
  ) {
    image = { extension: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    image = readJpegDimensions(bytes);
  } else {
    throw new Error("downloaded bytes are not a supported PNG or JPEG image");
  }

  if (
    !Number.isInteger(image.width)
    || !Number.isInteger(image.height)
    || image.width < 1
    || image.height < 1
    || image.width > LIMITS.imageDimension
    || image.height > LIMITS.imageDimension
  ) {
    throw new Error("image dimensions are invalid or exceed the safety limit");
  }
  return image;
}

function readJpegDimensions(bytes) {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 7) break;
      return {
        extension: "jpg",
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error("JPEG dimensions could not be validated");
}

function renderBlogCard(post) {
  const sharePath = `/blog/${post.slug}/`;
  const title = escapeHtml(post.title);
  const description = escapeHtml(post.description);
  const author = escapeHtml(post.author);
  const published = escapeHtml(formatPublishedDate(post.published_at));
  const imagePath = escapeHtml(post.image_path);
  return `        <article class="blog-article-entry" data-blog-post>
          <a class="blog-post-card" href="${sharePath}" aria-label="${title}: read on Substack">
            <span class="blog-post-image-wrap">
              <img class="blog-post-image" src="${imagePath}" alt="" loading="lazy" decoding="async">
            </span>
            <span class="blog-post-body">
              <span class="blog-post-meta"><time datetime="${escapeHtml(post.published_at)}">${published}</time><span aria-hidden="true"> · </span>${author}</span>
              <span class="blog-post-title">${title}</span>
              <span class="blog-post-description">${description}</span>
              <span class="blog-post-destination">Read on Substack <span aria-hidden="true">↗</span></span>
            </span>
          </a>
        </article>`;
}

async function writeSharePage(targetRoot, siteOrigin, post) {
  const sharePath = `/blog/${post.slug}/`;
  const shareUrl = new URL(sharePath, siteOrigin).href;
  const imageUrl = new URL(post.image_path, siteOrigin).href;
  const destinationJson = JSON.stringify(post.canonical_url).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <meta name="description" content="${escapeHtml(post.description)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(post.title)}">
  <meta property="og:description" content="${escapeHtml(post.description)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="article:published_time" content="${escapeHtml(post.published_at)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(post.title)}">
  <meta name="twitter:description" content="${escapeHtml(post.description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <title>${escapeHtml(post.title)} | UK AQ Blog</title>
  <link rel="icon" href="/images/favicon.ico" type="image/png">
  <style>
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: #fbfaf7; color: #101822; font-family: Inter, system-ui, sans-serif; }
    main { width: min(100%, 620px); padding: 32px; border: 1px solid #dfe4e8; border-radius: 18px; background: #fff; box-shadow: 0 12px 32px rgba(16, 24, 34, 0.08); }
    h1 { margin: 0 0 12px; font-size: clamp(1.6rem, 4vw, 2.25rem); line-height: 1.2; }
    p { margin: 0 0 22px; color: #5f6872; line-height: 1.6; }
    a { display: inline-flex; min-height: 44px; align-items: center; color: #0b5cab; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(post.title)}</h1>
    <p>${escapeHtml(post.description)}</p>
    <a href="${escapeHtml(post.canonical_url)}">Read on Substack</a>
  </main>
  <script>
    window.location.replace(${destinationJson});
  </script>
</body>
</html>
`;
  const routeDirectory = path.join(targetRoot, "blog", post.slug);
  await fs.mkdir(routeDirectory, { recursive: false });
  await fs.writeFile(path.join(routeDirectory, "index.html"), html, { encoding: "utf8", flag: "wx" });
}

function formatPublishedDate(isoValue) {
  const date = new Date(isoValue);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function boundedText(rawValue, maximumLength, fieldName) {
  if (typeof rawValue !== "string") throw new Error(`${fieldName} must be text`);
  const value = rawValue.trim();
  if (!value) throw new Error(`${fieldName} is missing`);
  if (value.length > maximumLength) throw new Error(`${fieldName} exceeds ${maximumLength} characters`);
  return value;
}

function hasExactKeys(value, expectedKeys) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPathWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function toPublicPath(value) {
  return value.split(path.sep).join("/");
}

await main();
