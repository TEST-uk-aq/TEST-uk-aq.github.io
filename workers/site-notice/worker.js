import { KV_KEY, verifyDocument } from "../../shared/site-notice-schema.js";

function reply(body, status, origin, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=30, s-maxage=30, must-revalidate" : "no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Origin",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      ...extra,
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = String(env.SITE_NOTICE_ALLOWED_ORIGINS || "").split(",").filter(Boolean);
    if (!env.SITE_NOTICE_KV || !env.SITE_NOTICE_PATH || !allowed.length) {
      return reply({ error: "notice_configuration_unavailable" }, 503, null);
    }
    if (origin && !allowed.includes(origin)) return reply({ error: "origin_not_allowed" }, 403, null);
    if (new URL(request.url).pathname !== env.SITE_NOTICE_PATH) return reply({ error: "not_found" }, 404, origin);
    if (request.method !== "GET") return reply({ error: "method_not_allowed" }, 405, origin, { Allow: "GET" });
    try {
      // No Cache API layer; bounded KV cache plus HTTP cache, no stale-on-error.
      const raw = await env.SITE_NOTICE_KV.get(KV_KEY, { cacheTtl: 60 });
      if (raw === null) return reply({ error: "notice_configuration_missing" }, 503, origin);
      if (raw.length > 262144) throw new Error("Notice too large");
      const document = await verifyDocument(JSON.parse(raw));
      return reply(document, 200, origin);
    } catch {
      // Bounded response only; do not log editorial content or error per request.
      return reply({ error: "notice_configuration_invalid_or_unavailable" }, 503, origin);
    }
  },
};
