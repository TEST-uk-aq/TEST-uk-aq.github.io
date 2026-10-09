import runtime from "../shared/station-chart/station-chart-runtime.js";
import { createJsonHistoryClient, identity, loadPublication, samples } from "./client.js";

const source = document.getElementById("source"), status = document.getElementById("status");
const output = document.getElementById("diagnostics"), button = document.getElementById("load");
const base = window.ukAqSharedAuth.cacheBaseUrl;
const fetchApi = (url, init) => window.ukAqFetchCacheApi(url, init);
let active = null, run = 0, entries = [];
function record(value) {
  entries.push({ at_utc: new Date().toISOString(), ...value });
  if (entries.length > 300) entries.shift();
  output.textContent = JSON.stringify(entries, null, 2);
}
function rendererWithTiming(renderer, began) {
  let firstLine = false;
  return new Proxy(renderer, { get(target, property) {
    const value = target[property];
    if (typeof value !== "function" || !["renderAxes", "renderObservations", "renderAqi"].includes(property)) return value;
    return (...args) => {
      const start = performance.now();
      const result = value(...args);
      record({ type: "render", part: property, duration_ms: Math.round(performance.now() - start) });
      if (property === "renderObservations" && !firstLine) {
        const count = [...(args[0]?.observations?.values?.() || [])].reduce((sum, points) => sum + points.length, 0);
        if (count) {
          firstLine = true;
          requestAnimationFrame(() => record({ type: "first_visible_line", elapsed_ms: Math.round(performance.now() - began), points: count }));
        }
      }
      return result;
    };
  } });
}
async function load() {
  const id = ++run;
  active?.destroy(); active = null;
  entries = [];
  status.textContent = "Loading…";
  button.disabled = true;
  const began = performance.now();
  const choice = source.value;
  const isMonth = choice.endsWith("month"), isNormal = choice.startsWith("normal");
  const sampleId = isNormal ? null : choice === "json-v2-day" ? "v2-2026-09-01"
    : isMonth ? "v3-september-2026" : "v3-2026-09-01";
  const start = "2026-09-01T00:00:00.000Z";
  const end = isMonth ? "2026-09-30T23:00:00.000Z" : "2026-09-01T23:00:00.000Z";
  record({ type: "load_started", choice, start_utc: start, end_utc: end });
  try {
    let publication = null;
    if (!isNormal) publication = await loadPublication({ base, sampleId, fetchApi, record });
    if (id !== run) return;
    const diagnostics = runtime.diagnostics.createDiagnostics({
      recordEvent: (name, details) => {
        record({ type: "controller_event", name, details,
          elapsed_ms: Math.round(performance.now() - began) });
        if (name === "station_chart_load_completed") record({ type: "observation_range_complete",
          elapsed_ms: Math.round(performance.now() - began) });
      },
      recordTiming: (name, value_ms) => record({ type: "controller_timing", name, value_ms }),
    });
    const scheduler = runtime.historyLoader.createPriorityFetchScheduler(6);
    const measuredNormalFetch = async (requestUrl, init) => {
      const startAt = performance.now();
      const response = await fetchApi(requestUrl, init);
      const headersAt = performance.now();
      record({ type: "normal_request", route: new URL(requestUrl).pathname,
        response_ms: Math.round(headersAt - startAt), status: response.status,
        cache: response.headers.get("X-UK-AQ-Cache") || response.headers.get("CF-Cache-Status") || null });
      return new Proxy(response, { get(target, property) {
        if (property === "json") return async () => {
          const text = await target.text();
          const transferredAt = performance.now();
          const payload = JSON.parse(text);
          record({ type: "normal_body", route: new URL(requestUrl).pathname,
            transfer_ms: Math.round(transferredAt - headersAt),
            parse_ms: Math.round(performance.now() - transferredAt),
            decoded_bytes: new TextEncoder().encode(text).length });
          return payload;
        };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
    };
    const normalClient = runtime.calculatedClient.createCalculatedStationHistoryClient({
      stationSeriesUrl: `${base}/station-series`, historyUrl: `${base}/timeseries`, fetchApi: measuredNormalFetch,
      scheduler,
      onResponse: ({ url, response, payload }) => record({ type: "normal_response", route: new URL(url).pathname,
        status: response.status, observations: payload?.observations?.rows?.length || 0,
        aqi: payload?.aqi?.rows?.length || 0,
        source_mode: payload?.source?.mode || response.headers.get("X-UK-AQ-Timeseries-Source-Mode") || null,
        generation: payload?.source?.generation || null }),
    });
    const scheduledJsonFetch = (requestUrl, init) => scheduler.schedule(0, () => fetchApi(requestUrl, init), init?.signal);
    const client = isNormal ? normalClient : createJsonHistoryClient({ base, publication, fetchApi: scheduledJsonFetch, record });
    const renderer = rendererWithTiming(runtime.renderer.createStationChartRenderer({
      getWindowLabel: () => isMonth ? "31d" : "24h", noHistoryMessage: "No observations in this window.",
    }), began);
    const chart = runtime.controller.createStationChartController({ renderer, calculatedClient: client,
      compatibilityClient: client, diagnostics, maxSelection: 1,
      getWindowLabel: () => isMonth ? "31d" : "24h",
      cacheContract: `compressed-chart-pilot:${isNormal ? "normal-v3" : sampleId}:${publication?.publication_sha256 || "canonical"}`,
      onCacheCommit: (details) => record({ type: "cache_merge_commit", ...details }),
      onMessage: (message, options) => { if (options?.error) status.textContent = message; },
    });
    active = chart;
    chart.mount({ svg: document.getElementById("chart"), wrap: document.getElementById("chart-wrap"),
      tooltip: document.getElementById("chart-tooltip") });
    const result = await chart.setSelection([{ ...identity, pollutant: "pm25", source_generation: isNormal ? "v3" : samples[sampleId].generation }],
      { range: { start_utc: start, end_utc: end } });
    if (id !== run) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    record({ type: "complete", elapsed_ms: Math.round(performance.now() - began),
      observation_complete: result?.observation_complete === true,
      source: choice, publication: publication?.publication_sha256 || null });
    status.textContent = `${result?.observation_complete === true ? "Loaded" : "Loaded with incomplete observation coverage"} ${choice}. ${publication ? `Publication ${publication.publication_sha256.slice(0, 12)}.` : "Normal TEST route."}`;
  } catch (error) {
    if (id === run) {
      status.textContent = `Load failed: ${error.message}`;
      record({ type: "failure", message: error.message });
    }
  } finally { if (id === run) button.disabled = false; }
}
button.addEventListener("click", load);
source.addEventListener("change", () => {
  run += 1;
  active?.destroy(); active = null;
  document.getElementById("chart").replaceChildren();
  status.textContent = "Source changed. Load the selected chart to compare it.";
  button.disabled = false;
});
document.getElementById("download").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ schema_version: 1, test_viewer: true, entries }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "uk-aq-compressed-chart-pilot-diagnostics.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
