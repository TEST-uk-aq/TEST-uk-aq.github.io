import { siteNoticeUrl } from "../site-notice-config.js";
import { validateEndpoint, verifyDocument } from "./site-notice-schema.js";

const REFRESH_MS = 120000;
const MAX_AGE_MS = 130000;
const subscribers = new Set();
let current = null;
let pending = null;
let started = false;
let expires = 0;
let expiryTimer;
let lastDiagnostic = "";

function update(next) {
  if (current?.revision === next?.revision) return;
  current = next;
  for (const subscriber of subscribers) subscriber(current);
}

function fail(reason) {
  update(null);
  // One diagnostic per distinct failure; no message content, credentials or URL.
  const diagnostic = `Site notice configuration error: ${reason}`;
  if (diagnostic !== lastDiagnostic) console.error(diagnostic);
  lastDiagnostic = diagnostic;
}

async function refresh() {
  if (pending) return pending;
  pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const endpoint = validateEndpoint(siteNoticeUrl);
      const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store", credentials: "omit", redirect: "error" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new Error("Expected JSON");
      const text = await response.text();
      if (text.length > 262144) throw new Error("Configuration too large");
      const next = await verifyDocument(JSON.parse(text));
      clearTimeout(expiryTimer);
      expires = Date.now() + MAX_AGE_MS;
      expiryTimer = setTimeout(() => fail("Configuration expired"), MAX_AGE_MS);
      lastDiagnostic = "";
      update(next);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Retrieval failed");
    } finally {
      clearTimeout(timeout);
    }
  })();
  try { await pending; } finally { pending = null; }
}

export function subscribeNotices(subscriber) {
  subscribers.add(subscriber);
  subscriber(current);
  if (!started) {
    started = true;
    void refresh();
    setInterval(() => { void refresh(); }, REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (current && Date.now() >= expires) fail("Configuration expired");
      void refresh();
    });
  }
  return () => subscribers.delete(subscriber);
}
