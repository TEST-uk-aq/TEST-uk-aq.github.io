// One validation boundary for the publisher, public Worker and browser.
export const SCHEMA_VERSION = 1;
export const KV_KEY = "site_notice_current";
const CODE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const FORBIDDEN_KEYS = new Set(["constructor", "prototype", "__proto__"]);

function object(value, allowed, required, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.includes(key))
      || required.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`Invalid ${context} fields`);
  }
}

export function safeLink(value) {
  if (typeof value !== "string" || /[\s\\<>"'\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error("Invalid notice link");
  }
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    throw new Error("Notice links require HTTPS or a same-site root-relative path");
  }
  return url.href;
}

// Deliberately small Markdown grammar: literal text, paragraphs and [text](URL).
// HTML stays text; unsupported/malformed Markdown links fail publication.
export function parseMessage(message) {
  if (typeof message !== "string" || message.length > 16000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)) {
    throw new Error("Notice message must be a string of at most 16000 characters");
  }
  return message.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map((paragraph) => {
    const tokens = [];
    const pattern = /\[([^\[\]\n]+)\]\(([^\s()]+)\)/g;
    let offset = 0;
    for (const match of paragraph.matchAll(pattern)) {
      const before = paragraph.slice(offset, match.index);
      if (/[\[\]]/.test(before) || before.endsWith("!")) throw new Error("Unsupported notice link syntax");
      if (before) tokens.push({ text: before });
      tokens.push({ text: match[1], href: safeLink(match[2]) });
      offset = match.index + match[0].length;
    }
    const after = paragraph.slice(offset);
    if (/[\[\]]/.test(after)) throw new Error("Malformed notice link syntax");
    if (after) tokens.push({ text: after });
    return tokens;
  });
}

export function normalizeSource(source) {
  object(source, ["site_notice", "network_notices"], ["site_notice"], "notice configuration");
  const site = source.site_notice;
  object(site, ["enabled", "message"], ["enabled", "message"], "site_notice");
  if (typeof site.enabled !== "boolean") throw new Error("site_notice.enabled must be boolean");
  parseMessage(site.message);
  if (site.enabled && !site.message.trim()) throw new Error("Enabled site notice has no message");
  const notices = Object.hasOwn(source, "network_notices") ? source.network_notices : {};
  if (!notices || typeof notices !== "object" || Array.isArray(notices) || Object.keys(notices).length > 100) {
    throw new Error("Invalid network_notices table");
  }
  const networks = Object.create(null);
  for (const code of Object.keys(notices).sort()) {
    if (!CODE.test(code) || FORBIDDEN_KEYS.has(code)) throw new Error("Invalid canonical network_code");
    const notice = notices[code];
    object(notice, ["enabled", "message"], ["enabled"], "network notice");
    if (typeof notice.enabled !== "boolean") throw new Error("Network enabled must be boolean");
    if (Object.hasOwn(notice, "message")) parseMessage(notice.message);
    if (notice.enabled && !(notice.message ?? site.message).trim()) throw new Error("Enabled network notice has no effective message");
    networks[code] = { enabled: notice.enabled };
    if (Object.hasOwn(notice, "message")) networks[code].message = notice.message;
  }
  return { site_notice: { enabled: site.enabled, message: site.message }, network_notices: networks };
}

export function canonicalPayload(source) {
  return { schema_version: SCHEMA_VERSION, ...normalizeSource(source) };
}

export function validateDocument(document) {
  object(document, ["schema_version", "revision", "site_notice", "network_notices"],
    ["schema_version", "revision", "site_notice", "network_notices"], "published notice");
  if (document.schema_version !== SCHEMA_VERSION || !/^[a-f0-9]{64}$/.test(document.revision)) {
    throw new Error("Unsupported notice schema or revision");
  }
  return { ...canonicalPayload({ site_notice: document.site_notice, network_notices: document.network_notices }), revision: document.revision };
}

export async function verifyDocument(document) {
  const validated = validateDocument(document);
  const { revision, ...payload } = validated;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== revision) throw new Error("Notice content revision does not match");
  return validated;
}

export function validateEndpoint(value) {
  if (typeof value !== "string" || !/^https:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error("UK_AQ_SITE_NOTICE_URL must be an explicit HTTPS endpoint");
  }
  const url = new URL(value);
  if (!url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error("Notice endpoint cannot contain credentials, query or fragment");
  }
  return url.href;
}
