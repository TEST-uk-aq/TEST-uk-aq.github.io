import runtime from "../shared/station-chart/station-chart-runtime.js";
import { loadCatalog, createJsonHistoryClient, createPublicationStore } from "./client.js";
const $ = id => document.getElementById(id);
const controls = { source: $("source"), station: $("station"), pollutant: $("pollutant"), range: $("range") };
const params = new URLSearchParams(location.search), environment = params.get("environment") || "";
const base = window.ukAqSharedAuth?.cacheBaseUrl;
const fetchApi = (url, init) => window.ukAqFetchCacheApi(url, init);
let catalog = null, graph = null, generation = 0, operation = null, action = null, records = [], graphCounter = 0;
let paintPending = false;
function record(value) {
  records.push({ at_utc: new Date().toISOString(), ...value });
  if (records.length > 1500) records.shift();
  if (!paintPending) {
    paintPending = true;
    requestAnimationFrame(() => { paintPending = false; $("diagnostics").textContent = JSON.stringify(records.slice(-60), null, 2); });
  }
}
const store = createPublicationStore(record);
function option(select, value, text) { const node = document.createElement("option"); node.value = value; node.textContent = text; select.append(node); }
function selectedSample() {
  return catalog?.samples.find(sample => `${sample.identity.connector_id}:${sample.identity.station_id}` === controls.station.value
    && sample.identity.pollutant_code === controls.pollutant.value);
}
function selectedView() { return selectedSample()?.views.find(view => view.id === controls.range.value); }
function populate() {
  const previousStation = controls.station.value, previousPollutant = controls.pollutant.value, previousRange = controls.range.value;
  controls.station.replaceChildren();
  const seen = new Set();
  for (const sample of catalog.samples) {
    const key = `${sample.identity.connector_id}:${sample.identity.station_id}`;
    if (!seen.has(key)) { seen.add(key); option(controls.station, key, sample.station_label); }
  }
  if (seen.has(previousStation)) controls.station.value = previousStation;
  const available = catalog.samples.filter(sample => `${sample.identity.connector_id}:${sample.identity.station_id}` === controls.station.value);
  controls.pollutant.replaceChildren();
  for (const sample of available) option(controls.pollutant, sample.identity.pollutant_code, ({ pm25: "PM2.5", pm10: "PM10", no2: "NO₂" })[sample.identity.pollutant_code]);
  if (available.some(sample => sample.identity.pollutant_code === previousPollutant)) controls.pollutant.value = previousPollutant;
  controls.range.replaceChildren();
  const sample = selectedSample();
  for (const view of sample.views) option(controls.range, view.id, view.label);
  if (sample.views.some(view => view.id === previousRange)) controls.range.value = previousRange;
  $("scope").textContent = `${catalog.environment} · ${catalog.experiment_id}. Exploratory historical source as read. Not verified production publication.`;
}
function closeGraph() { graph?.context.destroy(); graph?.chart.destroy(); graph = null; }
function startOperation(reason) {
  const id = ++generation;
  operation?.abort(); operation = new AbortController();
  action = { id, reason, began: performance.now(), firstLine: false, responseMarked: new Set(), committedMarked: new Set() };
  record({ type: "action_started", action_id: id, reason, source: controls.source.value,
    sample_id: selectedSample()?.id, range: selectedView(), memory: performance.memory ? { used_js_heap_bytes: performance.memory.usedJSHeapSize } : null });
  $("status").textContent = "Loading…";
  return { id, signal: operation.signal };
}
function covers(intervals, range) {
  let cursor = Date.parse(range.start_utc);
  for (const interval of intervals.slice().sort((left, right) => left.start - right.start)) {
    if (interval.end < cursor) continue;
    if (interval.start > cursor) return false;
    cursor = Math.max(cursor, interval.end);
    if (cursor >= Date.parse(range.end_utc)) return true;
  }
  return false;
}
function makeGraph() {
  closeGraph();
  const graphId = ++graphCounter, source = controls.source.value, intervals = new Map();
  const scopedRecord = value => record({ graph_id: graphId, source, ...value });
  const scheduler = runtime.historyLoader.createPriorityFetchScheduler(6);
  const measuredNormalFetch = async (url, init) => {
    const began = performance.now(), response = await fetchApi(url, init), headersAt = performance.now();
    scopedRecord({ type: "normal_request", route: new URL(url).pathname, status: response.status,
      response_ms: headersAt - began, cache: response.headers.get("X-UK-AQ-Cache"), worker_cpu_ms: null });
    return new Proxy(response, { get(target, property) {
      if (property === "json") return async () => {
        const text = await target.text(), bodyAt = performance.now(), payload = JSON.parse(text);
        const resource = performance.getEntriesByName(url).at(-1);
        scopedRecord({ type: "normal_body", route: new URL(url).pathname, body_ms: bodyAt - headersAt,
          parse_ms: performance.now() - bodyAt, decoded_bytes: new TextEncoder().encode(text).byteLength,
          compressed_bytes: resource?.encodedBodySize || null, transfer_bytes: resource?.transferSize || null,
          timing_visibility: resource?.encodedBodySize ? "resource_timing" : "unavailable_or_cached" });
        return payload;
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  };
  const rawClient = source === "normal"
    ? runtime.calculatedClient.createCalculatedStationHistoryClient({ stationSeriesUrl: `${base}/station-series`, historyUrl: `${base}/timeseries`,
      fetchApi: measuredNormalFetch, scheduler,
      onResponse: ({ payload, response }) => scopedRecord({ type: "normal_source", source_mode: payload?.source?.mode || null,
        source_generation: payload?.source?.generation || response.headers.get("X-UK-AQ-Source-Generation") || null,
        observations_complete: payload?.observations?.response_complete ?? null, aqi_complete: payload?.aqi?.response_complete ?? null }) })
    : createJsonHistoryClient({ base, catalog, environment,
      fetchApi: (url, init) => scheduler.schedule(0, () => fetchApi(url, init), init?.signal), record: scopedRecord, store });
  function coverageKey(identity, part) { return `${identity.connector_id}:${identity.station_id}:${identity.timeseries_id}:${identity.pollutant_code || identity.pollutant}:${part}`; }
  const tracked = async (method, args) => {
    const result = await rawClient[method](...args);
    if (args.at(-1)?.aborted) return result;
    for (const part of ["observations", "aqi"]) {
      const section = result[part];
      if (!section?.enabled) continue;
      const key = coverageKey(result.request, part);
      if (section.error || !result.identity_valid) { intervals.delete(key); continue; }
      const list = intervals.get(key) || [];
      const start = Date.parse(section.stable_head_start_utc || result.request.start_utc), end = Date.parse(section.stable_head_end_utc || result.request.end_utc);
      list.push({ start, end });
      // Bound diagnostics separately from chart/cache ownership.
      if (list.length > 256) list.splice(0, list.length - 256);
      intervals.set(key, list);
      scopedRecord({ type: "part_response_settled", action_id: action?.id, part, start_utc: new Date(start).toISOString(), end_utc: new Date(end).toISOString(),
        response_complete: section.response_complete, has_gap: section.has_gap, row_count: section.rows?.length || 0 });
    }
    return result;
  };
  const client = { kind: "calculated", loadCurrent: (...args) => tracked("loadCurrent", args),
    loadOlder: (...args) => tracked("loadOlder", args), prefetchAqi: (...args) => tracked("prefetchAqi", args) };
  const renderer = runtime.renderer.createStationChartRenderer({ getWindowLabel: () => controls.range.value, noHistoryMessage: "No observations in this configured range." });
  const timedRenderer = new Proxy(renderer, { get(target, property) {
    const value = Reflect.get(target, property, target);
    if (typeof value !== "function") return value;
    if (!["renderAxes", "renderObservations", "renderAqi"].includes(property)) return value.bind(target);
    return (...args) => {
      const began = performance.now(), result = Reflect.apply(value, target, args);
      scopedRecord({ type: "render", action_id: action?.id, part: property, duration_ms: performance.now() - began });
      if (property === "renderObservations" && action && !action.firstLine) {
        const count = [...(args[0]?.observations?.values?.() || [])].reduce((sum, points) => sum + points.length, 0);
        if (count) {
          const currentAction = action; currentAction.firstLine = true;
          requestAnimationFrame(() => { if (currentAction === action) scopedRecord({ type: "first_visible_line", action_id: currentAction.id,
            elapsed_ms: performance.now() - currentAction.began, points: count }); });
        }
      }
      return result;
    };
  } });
  const chart = runtime.controller.createStationChartController({ renderer: timedRenderer, calculatedClient: client, compatibilityClient: client,
    maxSelection: 1, getWindowLabel: () => controls.range.value,
    cacheContract: `compressed-history:${source}:${environment}:${catalog.config_sha256}:${catalog.samples.map(sample => `${sample.id}:${sample.publication_sha256 || "unpublished"}`).join("|")}`,
    diagnostics: runtime.diagnostics.createDiagnostics({ recordEvent: (name, details) => {
      scopedRecord({ type: "controller_event", action_id: action?.id, name, details, elapsed_ms: action ? performance.now() - action.began : null });
      if (name === "station_chart_load_completed") scopedRecord({ type: "full_observation_settlement", action_id: action?.id,
        elapsed_ms: action ? performance.now() - action.began : null, evidence: "shared_controller_complete" });
    }, recordTiming: (name, duration_ms) => scopedRecord({ type: "controller_timing", name, duration_ms }) }),
    onCacheCommit: details => {
      scopedRecord({ type: "cache_merge_commit", action_id: action?.id, ...details });
      const sample = selectedSample(), view = selectedView();
      if (!action || !sample || !view || details.timeseries_id !== sample.identity.timeseries_id) return;
      for (const part of details.kinds) {
        if (action.committedMarked.has(part) || !covers(intervals.get(coverageKey(sample.identity, part)) || [], view)) continue;
        action.committedMarked.add(part);
        scopedRecord({ type: "full_part_settlement", part, action_id: action.id, elapsed_ms: performance.now() - action.began,
          evidence: "normalised_response_coverage_and_shared_cache_commit", complete: "inspect_part_completeness_records" });
      }
    }, onMessage: (message, options) => { if (options?.error) $("status").textContent = message; } });
  chart.mount({ svg: $("chart"), wrap: $("chart-wrap"), tooltip: $("chart-tooltip") });
  const context = runtime.pollutantContext.createPollutantContextController({
    onRender: async load => {
      const result = await chart.replacePollutantContext({ pollutant: load.pollutant, status: "ready", contextGuard: load,
        entries: load.entries, selectedStationIds: load.selectedStationIds, primaryStationId: load.primaryStationId,
        aqiSourceStationId: load.aqiSourceStationId, range: selectedView(), renderMode: load.renderMode });
      if (result?.committed) load.complete();
    }, onFailed: load => scopedRecord({ type: "pollutant_context_failed", error: load.error?.message || null }) });
  graph = { chart, context, source, graphId };
}
async function apply(reason) {
  const current = startOperation(reason);
  try {
    if (reason === "refresh") {
      closeGraph(); store.clear();
      const refreshedCatalog = await loadCatalog({ base, environment, fetchApi, signal: current.signal, record });
      if (current.id !== generation) return;
      catalog = refreshedCatalog;
      populate();
    }
    const sample = selectedSample(), view = selectedView();
    if (!sample || !view) throw new Error("No configured station/pollutant/range");
    if (controls.source.value === "json" && !sample.publication_sha256) throw new Error("This configured sample has no selected precomputed publication");
    if (!graph || graph.source !== controls.source.value) makeGraph();
    const entry = { ...sample.identity, pollutant: sample.identity.pollutant_code, source_generation: catalog.source_generation,
      name: sample.station_label, label: sample.station_label, unit: "µg/m³" };
    let result;
    if (graph.chart.pollutant !== entry.pollutant) {
      result = await graph.context.setPollutantContext({ pollutant: entry.pollutant, status: "ready", entries: [entry],
        selectedStationIds: [entry.station_id], primaryStationId: entry.station_id, aqiSourceStationId: entry.station_id,
        preserveRange: true, preserveSelection: true });
    } else {
      graph.context.invalidate("selection-or-range-change");
      if (graph.chart.selection[0]?.timeseries_id !== entry.timeseries_id) result = await graph.chart.setSelection([entry], { range: view });
      else if (reason === "range") result = await graph.chart.setRange(view);
      else result = await graph.chart.refresh();
    }
    if (current.id !== generation) return;
    record({ type: "action_finished", action_id: current.id, elapsed_ms: performance.now() - action.began,
      source: graph.source, sample_id: sample.id, publication: sample.publication_sha256, result_present: Boolean(result),
      observations_complete: result?.observation_complete ?? result?.state?.observation_complete ?? null,
      worker_cpu_ms: null });
    $("status").textContent = result ? "Chart operation settled. Inspect independent source, observation and AQI diagnostics." : "Chart operation failed or is incomplete; inspect diagnostics.";
  } catch (error) {
    if (current.id !== generation || error.name === "AbortError") return;
    if (["station", "pollutant", "source", "refresh"].includes(reason)) closeGraph();
    record({ type: "failure", action_id: current.id, error: error.message });
    $("status").textContent = error.message;
  }
}
async function initialise() {
  try {
    if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(environment) || !base || new URL(base, location.href).protocol !== "https:") throw new Error("Provide the approved environment query parameter and an HTTPS cache_base (or same-origin /api/aq)");
    catalog = await loadCatalog({ base, environment, fetchApi, record });
    populate();
    $("load").disabled = false; $("refresh").disabled = false;
    for (const control of Object.values(controls)) control.disabled = false;
    $("status").textContent = "Configuration loaded. Select a source and load the chart.";
  } catch (error) { $("status").textContent = error.message; record({ type: "configuration_failure", error: error.message }); }
}
controls.station.addEventListener("change", () => { populate(); void apply("station"); });
controls.pollutant.addEventListener("change", () => { populate(); void apply("pollutant"); });
controls.range.addEventListener("change", () => void apply("range"));
controls.source.addEventListener("change", () => { closeGraph(); void apply("source"); });
$("load").addEventListener("click", () => void apply("load"));
$("refresh").addEventListener("click", () => void apply("refresh"));
$("download").addEventListener("click", () => {
  const requests = records.filter(record => record.type === "request" || record.type === "request_failure" || record.type === "normal_request");
  const blob = new Blob([JSON.stringify({ schema_version: 2, environment, catalog, records,
    summary: { retained_records: records.length, request_count: requests.length,
      known_compressed_bytes: records.reduce((sum, record) => sum + (record.compressed_bytes || 0), 0),
      worker_cpu_ms: null, cpu_evidence: "Collect actual Cloudflare invocation telemetry by request/route in P2" } }, null, 2)], { type: "application/json" });
  const link = document.createElement("a"), url = URL.createObjectURL(blob);
  link.href = url; link.download = "compressed-chart-comparison.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("resize", () => graph?.chart.resize());
window.addEventListener("pagehide", () => { operation?.abort(); closeGraph(); store.clear(); });
void initialise();
