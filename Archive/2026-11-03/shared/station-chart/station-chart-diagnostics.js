// Bounded, non-blocking diagnostic shaping for station charts.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.UkAqStationChartDiagnostics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_LIMITS = Object.freeze({
    maxArrayItems: 16,
    maxObjectKeys: 48,
    maxStringLength: 512,
    maxDepth: 5,
  });
  const ROW_ARRAY_KEYS = /(^|_)(rows?|points?|observation_points|aqi_points)$/i;

  function shapeValue(value, limits, depth, seen) {
    if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return value.slice(0, limits.maxStringLength);
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    if (value instanceof Error) {
      return {
        name: String(value.name || "Error").slice(0, 64),
        message: String(value.message || value).slice(0, limits.maxStringLength),
      };
    }
    if (depth >= limits.maxDepth) return "[bounded]";
    if (typeof value !== "object") return String(value).slice(0, limits.maxStringLength);
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    if (Array.isArray(value)) {
      const shaped = value.slice(0, limits.maxArrayItems).map(function (entry) {
        return shapeValue(entry, limits, depth + 1, seen);
      });
      seen.delete(value);
      return shaped;
    }
    const output = {};
    Object.keys(value).slice(0, limits.maxObjectKeys).forEach(function (key) {
      if (ROW_ARRAY_KEYS.test(key) && Array.isArray(value[key])) {
        output[`${key}_count`] = value[key].length;
        return;
      }
      output[key] = shapeValue(value[key], limits, depth + 1, seen);
    });
    seen.delete(value);
    return output;
  }

  function shapeEvent(type, details = {}, options = {}) {
    const limits = { ...DEFAULT_LIMITS, ...options };
    return {
      type: String(type || "station_chart_event").slice(0, 96),
      details: shapeValue(details, limits, 0, new Set()),
    };
  }

  function shapeTiming(name, valueMs) {
    const numeric = Number(valueMs);
    return {
      name: String(name || "station_chart_timing").slice(0, 96),
      value_ms: Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : null,
    };
  }

  function createDiagnostics(options = {}) {
    const recordEvent = typeof options.recordEvent === "function" ? options.recordEvent : function () {};
    const recordTiming = typeof options.recordTiming === "function" ? options.recordTiming : function () {};
    return Object.freeze({
      event(type, details) {
        const shaped = shapeEvent(type, details, options.limits);
        queueMicrotask(function () { recordEvent(shaped.type, shaped.details); });
        return shaped;
      },
      timing(name, valueMs) {
        const shaped = shapeTiming(name, valueMs);
        queueMicrotask(function () { recordTiming(shaped.name, shaped.value_ms); });
        return shaped;
      },
    });
  }

  function resourceTimingFor(url) {
    const value = performance.getEntriesByName?.(String(url))?.at(-1);
    return value ? { transfer_bytes: value.transferSize || null, encoded_body_bytes: value.encodedBodySize || null,
      decoded_body_bytes: value.decodedBodySize || null, network_duration_ms: value.duration,
      delivery_type: value.deliveryType || null } : null;
  }

  function createMeasuredFetch(fetchApi, record) {
    return async function (url, init) {
      const began = performance.now();
      const response = await fetchApi(url, init);
      const headersAt = performance.now();
      record({ type: "response", route: new URL(url).pathname, headers_ms: headersAt - began, status: response.status,
        cache: response.headers.get("X-UK-AQ-Cache") || response.headers.get("CF-Cache-Status"),
        content_length: response.headers.get("Content-Length"), server_timing: response.headers.get("Server-Timing") });
      return new Proxy(response, { get(target, property) {
        if (property === "json") return async function () {
          const text = await target.text(), receivedAt = performance.now(), value = JSON.parse(text);
          record({ type: "body", route: new URL(url).pathname, transfer_ms: receivedAt - headersAt,
            parse_ms: performance.now() - receivedAt, decoded_bytes: new TextEncoder().encode(text).length,
            resource_timing: resourceTimingFor(url) });
          return value;
        };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
    };
  }

  function observeRenderer(renderer, options) {
    let lastRun = null, firstLine = false;
    return new Proxy({}, { get(_target, property) {
      const target = renderer;
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      if (!["renderAxes", "renderObservations", "renderAqi"].includes(property)) return value.bind(target);
      return function (...args) {
        const run = options.getRun();
        if (run !== lastRun) { lastRun = run; firstLine = false; }
        const began = performance.now(), result = value.apply(target, args);
        options.record({ type: "render", part: property, duration_ms: performance.now() - began });
        const points = property === "renderObservations"
          ? [...(args[0]?.observations?.values?.() || [])].reduce((n, rows) => n + rows.length, 0) : 0;
        if (points && !firstLine) {
          firstLine = true;
          requestAnimationFrame(function () { requestAnimationFrame(function () {
            if (options.getRun() === run) options.record({ type: "first_visible_line", elapsed_ms: performance.now() - options.getStartedAt(), points });
          }); });
        }
        return result;
      };
    } });
  }

  return {
    DEFAULT_LIMITS,
    shapeEvent,
    shapeTiming,
    createDiagnostics,
    createMeasuredFetch,
    resourceTimingFor,
    observeRenderer,
  };
});
