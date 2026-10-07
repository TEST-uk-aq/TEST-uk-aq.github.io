import assert from "node:assert/strict";
import fs from "node:fs";
import controllerModule from "../shared/station-chart/station-chart-controller.js";
import sourceModule from "../shared/station-chart/aqi-source-controller.js";
import cacheModule from "../shared/station-chart/station-chart-cache.js";
import historyLoaderModule from "../shared/station-chart/station-history-loader.js";
import rendererModule from "../shared/station-chart/station-chart-renderer.js";

const page = fs.readFileSync(new URL("../hex_map/index.html", import.meta.url), "utf8");
const adapter = fs.readFileSync(new URL("../hex_map/hex-map-station-chart-adapter.js", import.meta.url), "utf8");
const controllerSource = fs.readFileSync(new URL("../shared/station-chart/station-chart-controller.js", import.meta.url), "utf8");
const rendererSource = fs.readFileSync(new URL("../shared/station-chart/station-chart-renderer.js", import.meta.url), "utf8");
const calculatedClientSource = fs.readFileSync(new URL("../shared/station-chart/station-history-client.js", import.meta.url), "utf8");
const compatibilityClientSource = fs.readFileSync(new URL("../shared/station-chart/station-history-compatibility-client.js", import.meta.url), "utf8");

for (const script of [
  "station-chart-domain.js",
  "station-chart-cache.js",
  "station-chart-diagnostics.js",
  "aqi-source-controller.js",
  "pollutant-context-controller.js",
  "station-history-loader.js",
  "station-history-client.js",
  "station-history-compatibility-client.js",
  "station-chart-renderer.js",
  "station-chart-controller.js",
]) {
  assert.doesNotMatch(page, new RegExp(`<script src="/shared/station-chart/${script.replaceAll(".", "\\.")}"></script>`));
}
assert.match(page, /<link rel="stylesheet" href="\/shared\/station-chart\/station-chart\.css">/);
assert.match(page, /<script type="module" src="\/hex_map\/hex-map-bootstrap\.js"><\/script>/);
assert.doesNotMatch(page, /async function loadStationHistoryChartData|async function loadLegacyChartData|function renderAqiBands|function updateChart\(|const stationHistoryCache|window\.hexChartMode\s*=/);

for (const source of [calculatedClientSource, compatibilityClientSource]) {
  assert.match(source, /loadCurrent/);
  assert.match(source, /loadOlder/);
  assert.match(source, /prefetchAqi/);
}
assert.match(controllerSource, /function setSelection/);
assert.match(controllerSource, /function replacePollutantContext/);
assert.match(controllerSource, /function setAqiSource/);
assert.match(controllerSource, /function setRange/);
assert.match(controllerSource, /function refresh/);
assert.match(controllerSource, /function resize/);
assert.match(controllerSource, /function destroy/);
assert.doesNotMatch(controllerSource, /\bd3\.|querySelector|createElement|appendChild/);
assert.match(controllerSource, /createOrderedSettlementBuffer/);
assert.match(controllerSource, /renderer\.updateProgress/);
assert.match(rendererSource, /ChartCore\.renderProgressBar/);
assert.match(rendererSource, /function animateDomains/);
assert.match(rendererSource, /function replacePollutantContext/);
assert.match(rendererSource, /const endY = observationDomain\(state\)/);
assert.match(rendererSource, /startY\[0\] \+ \(endY\[0\] - startY\[0\]\) \* eased/);
assert.match(rendererSource, /pendingDomainState = retainNewestState/);
assert.match(rendererSource, /classed\("is-hovered"/);
assert.match(rendererSource, /classed\("is-dimmed"/);

const hoverStart = Date.parse("2026-08-12T00:00:00.000Z");
const stationA = [
  { date: new Date(hoverStart), value: 10 },
  { date: new Date(hoverStart + 60 * 60 * 1000), value: 20 },
];
const stationB = [
  { date: new Date(hoverStart), value: 70 },
  { date: new Date(hoverStart + 60 * 60 * 1000), value: 80 },
];
const hoverObservations = new Map([["a", stationA], ["b", stationB]]);
const nearestSeries = rendererModule.findNearestSeriesAtPointer(
  [{ station_id: "a" }, { station_id: "b" }],
  hoverObservations,
  new Date(hoverStart + 30 * 60 * 1000),
  76,
  (value) => value,
  (points) => [points],
);
assert.equal(nearestSeries.entry.station_id, "b", "pointer Y, not equal timestamp or selection order, owns hover");

const gapRight = { date: new Date(hoverStart + 10 * 60 * 60 * 1000), value: 100 };
const gapPoints = [...stationA, gapRight];
assert.equal(
  rendererModule.getSeriesValueAtDate(
    gapPoints,
    [stationA, [gapRight]],
    new Date(hoverStart + 5 * 60 * 60 * 1000),
  ),
  20,
  "hover geometry uses the nearest segment endpoint instead of interpolating an invisible bridge",
);

assert.doesNotMatch(adapter, /installNetworkScopeDropdownGuard|guardedEnsureSearchDataLoaded/);
assert.doesNotMatch(adapter, /\bd3\.|fetchStation|fetchAqi|stationHistoryCache|aqiBandCache|seriesDataCache/);

const counters = { current: 0, older: 0, prefetch: 0, axes: 0, observations: 0, aqi: 0, clearAqi: 0 };
const makeResult = (request, parts) => ({
  result_version: "station-history-browser-v1",
  source: "calculated",
  identity_valid: true,
  identity: {
    source: "test",
    timeseries_id: request.timeseries_id,
    connector_id: request.connector_id,
    station_id: request.station_id,
    pollutant: request.pollutant,
  },
  observations: {
    enabled: parts.observations === true,
    rows: [],
    points: [],
    response_complete: true,
    has_gap: false,
  },
  aqi: {
    enabled: parts.aqi === true,
    rows: [],
    points: [],
    response_complete: true,
    has_gap: false,
    calculation_source: "calculated_from_observations",
  },
  raw: {},
});
const client = {
  kind: "calculated",
  async loadCurrent(request, parts) { counters.current += 1; return makeResult(request, parts); },
  async loadOlder(request, parts) { counters.older += 1; return makeResult(request, parts); },
  async prefetchAqi(request) { counters.prefetch += 1; return makeResult(request, { observations: false, aqi: true }); },
};
const renderer = {
  initialise() {},
  renderAxes() { counters.axes += 1; },
  renderObservations() { counters.observations += 1; },
  renderAqi() { counters.aqi += 1; },
  clearAqi() { counters.clearAqi += 1; },
  setLoading() {},
  destroy() {},
};
const aqiSourceController = sourceModule.createAqiSourceController({ transitionMs: 0, wait: async () => {} });
const controller = controllerModule.createStationChartController({
  renderer,
  calculatedClient: client,
  compatibilityClient: client,
  aqiSourceController,
});
controller.mount({});
await controller.setRange({ start_utc: "2026-08-12T00:00:00Z", end_utc: "2026-08-12T01:00:00Z" });
await controller.setSelection([
  { station_id: 101, timeseries_id: 201, connector_id: 301, pollutant: "pm25" },
  { station_id: 102, timeseries_id: 202, connector_id: 302, pollutant: "pm25" },
]);
await new Promise((resolve) => setTimeout(resolve, 0));
const beforeSwitch = { ...counters };
await controller.setAqiSource("102");
assert.equal(counters.current, beforeSwitch.current, "a settled AQI source switch starts no current request");
assert.equal(counters.older, beforeSwitch.older, "a settled AQI source switch starts no older request");
assert.equal(counters.prefetch, beforeSwitch.prefetch, "a settled AQI source switch starts no AQI request");
assert.equal(counters.axes, beforeSwitch.axes, "AQI-only source switching does not repaint axes");
assert.equal(counters.observations, beforeSwitch.observations, "AQI-only source switching does not repaint observations");
assert.equal(counters.clearAqi, beforeSwitch.clearAqi + 1, "the old AQI layer is cleared once");
assert.equal(counters.aqi, beforeSwitch.aqi + 1, "the target AQI layer commits once");
controller.destroy();

function createContextGuard(generation) {
  const abortController = new AbortController();
  let current = true;
  return {
    value: Object.freeze({
      generation,
      signal: abortController.signal,
      isCurrent: () => current && !abortController.signal.aborted,
    }),
    invalidate() {
      current = false;
      abortController.abort();
    },
  };
}

const replacementRequests = [];
const replacementRenders = [];
let releasePm10Current;
const replacementClient = {
  kind: "calculated",
  async loadCurrent(request, parts) {
    replacementRequests.push({ ...request });
    if (request.pollutant === "pm10") {
      await new Promise((resolve) => { releasePm10Current = resolve; });
    }
    return makeResult(request, parts);
  },
  async loadOlder(request, parts) { return makeResult(request, parts); },
  async prefetchAqi(request) { return makeResult(request, { observations: false, aqi: true }); },
};
const replacementController = controllerModule.createStationChartController({
  renderer: {
    initialise() {}, setLoading() {}, clearProgress() {}, updateProgress() {}, destroy() {},
    replacePollutantContext(state) {
      replacementRenders.push({ type: "replace", pollutant: state.pollutant, renderMode: state.render_mode });
    },
    renderAxes(state) { replacementRenders.push({ type: "axes", pollutant: state.pollutant }); },
    renderObservations() {}, renderAqi() {},
  },
  calculatedClient: replacementClient,
  compatibilityClient: replacementClient,
  backgroundAqiPrefetch: false,
});
replacementController.mount({});
await replacementController.setRange({ start_utc: "2026-08-12T00:00:00Z", end_utc: "2026-08-12T01:00:00Z" });

const pm25Guard = createContextGuard(1);
const pm25Replacement = await replacementController.replacePollutantContext({
  pollutant: "pm25",
  status: "ready",
  entries: [{ station_id: 101, timeseries_id: 201, connector_id: 301, pollutant: "pm25" }],
  selectedStationIds: ["101"],
  primaryStationId: "101",
  aqiSourceStationId: "101",
  renderMode: "initial",
  contextGuard: pm25Guard.value,
});
assert.equal(pm25Replacement.committed, true);
const requestsBeforeLoading = replacementRequests.length;
const no2LoadingGuard = createContextGuard(2);
await replacementController.replacePollutantContext({
  pollutant: "no2", status: "loading", entries: [], selectedStationIds: ["101"],
  renderMode: "pollutant-replacement", contextGuard: no2LoadingGuard.value,
});
assert.equal(replacementRequests.length, requestsBeforeLoading,
  "loading target context invalidates old work without starting target history");
assert.equal(replacementController.range.startIso, "2026-08-12T00:00:00.000Z", "pollutant loading preserves range");

const no2ReadyGuard = createContextGuard(2);
const no2Replacement = await replacementController.replacePollutantContext({
  pollutant: "no2",
  status: "ready",
  entries: [{ station_id: 101, timeseries_id: 901, connector_id: 902, pollutant: "no2" }],
  selectedStationIds: ["101"],
  primaryStationId: "101",
  aqiSourceStationId: "101",
  renderMode: "pollutant-replacement",
  contextGuard: no2ReadyGuard.value,
});
assert.equal(no2Replacement.committed, true);
assert.equal(replacementController.selection[0].timeseries_id, 901, "target entry replaces the retained timeseries identity");
assert.equal(replacementController.selection[0].connector_id, 902, "target entry replaces the retained connector identity");
assert.equal(replacementRequests.at(-1).pollutant, "no2");
assert.equal(replacementRequests.at(-1).timeseries_id, 901);
assert.equal(replacementRequests.at(-1).connector_id, 902);
assert.equal(replacementRenders.filter((event) => event.type === "replace").at(-1).renderMode, "pollutant-replacement",
  "pollutant replacement reaches the renderer with its explicit non-initial mode");

const pm10Guard = createContextGuard(3);
const latePm10 = replacementController.replacePollutantContext({
  pollutant: "pm10",
  status: "ready",
  entries: [{ station_id: 101, timeseries_id: 1001, connector_id: 1002, pollutant: "pm10" }],
  selectedStationIds: ["101"],
  primaryStationId: "101",
  aqiSourceStationId: "101",
  renderMode: "pollutant-replacement",
  contextGuard: pm10Guard.value,
});
await new Promise((resolve) => setImmediate(resolve));
const rendersBeforePm10Release = replacementRenders.length;
pm10Guard.invalidate();
const rapidNo2Guard = createContextGuard(4);
await replacementController.replacePollutantContext({
  pollutant: "no2", status: "loading", entries: [], selectedStationIds: ["101"],
  renderMode: "pollutant-replacement", contextGuard: rapidNo2Guard.value,
});
releasePm10Current();
const latePm10Result = await latePm10;
assert.equal(latePm10Result.committed, false);
assert.equal(replacementRenders.length, rendersBeforePm10Release,
  "a late obsolete PM10 response performs no progressive visible commit after NO2 loading begins");

const emptyGuard = createContextGuard(5);
const emptyReplacement = await replacementController.replacePollutantContext({
  pollutant: "no2", status: "ready", entries: [], selectedStationIds: [],
  renderMode: "pollutant-replacement", contextGuard: emptyGuard.value,
});
assert.equal(emptyReplacement.committed, true, "an authoritative empty target settles normally");
assert.deepEqual(replacementController.selection, [], "authoritative empty target retains no old-pollutant entry fallback");
replacementController.destroy();

const independentRange = {
  startIso: "2026-07-01T00:00:00.000Z",
  endIso: "2026-07-10T00:00:00.000Z",
  startMs: Date.parse("2026-07-01T00:00:00.000Z"),
  endMs: Date.parse("2026-07-10T00:00:00.000Z"),
};
const independentPlan = controllerModule.buildOlderWorkPlan(
  cacheModule.createCacheRecord(),
  {
    observations: {
      stable_head_start_utc: "2026-07-08T00:00:00.000Z",
      next_older_observation_chunk_end_utc: "2026-07-08T00:00:00.000Z",
    },
    aqi: {
      stable_head_start_utc: "2026-07-06T00:00:00.000Z",
      next_older_aqi_chunk_end_utc: "2026-07-06T00:00:00.000Z",
    },
  },
  independentRange,
  { observations: true, aqi: true },
  24 * 60 * 60 * 1000,
  0,
);
assert.equal(independentPlan.filter((item) => item.observations).length, 7,
  "observation work independently reaches its own older boundary");
assert.equal(independentPlan.filter((item) => item.aqi).length, 5,
  "AQI work independently reaches its own older boundary");
assert.equal(independentPlan.some((item) => item.observations && item.aqi), false,
  "different stable-head boundaries are not collapsed into ambiguous combined requests");

const rangeDurations = new Map([
  ["12h", 12 * 60 * 60 * 1000],
  ["24h", 24 * 60 * 60 * 1000],
  ["7d", 7 * 24 * 60 * 60 * 1000],
  ["31d", 31 * 24 * 60 * 60 * 1000],
  ["90d", 90 * 24 * 60 * 60 * 1000],
]);
for (const [label, durationMs] of rangeDurations) {
  const endMs = Date.parse("2026-08-10T00:00:00.000Z");
  const startMs = endMs - durationMs;
  const tracedRange = {
    startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString(), startMs, endMs,
  };
  const tracedPlan = controllerModule.buildOlderWorkPlan(
    cacheModule.createCacheRecord(),
    { observations: {
      stable_head_start_utc: tracedRange.endIso,
      next_older_observation_chunk_end_utc: tracedRange.endIso,
    } },
    tracedRange,
    { observations: true, aqi: false },
    controllerModule.defaultOlderChunkMs(label),
    1,
  );
  assert.equal(tracedPlan[0].range.end_utc, tracedRange.endIso, `${label} work starts with the newest interval`);
  assert.equal(tracedPlan.at(-1).range.start_utc, tracedRange.startIso, `${label} work reaches the requested start`);
}

const settlementBuffer = historyLoaderModule.createOrderedSettlementBuffer(0);
const settlementLaunches = [];
const settlementCommits = [];
let releaseFirstCommit;
const firstCommitGate = new Promise((resolve) => { releaseFirstCommit = resolve; });
await controllerModule.runQueueWithConcurrency([
  { sequence: 0 }, { sequence: 1 }, { sequence: 2 },
], 2, async (item) => {
  settlementLaunches.push(item.sequence);
  controllerModule.scheduleOrderedSettlement(settlementBuffer, item.sequence, item, async (value) => {
    if (value.sequence === 0) await firstCommitGate;
    settlementCommits.push(value.sequence);
  });
});
assert.deepEqual(settlementLaunches, [0, 1, 2],
  "a fetch worker launches later network work while an ordered commit chain is still waiting");
assert.deepEqual(settlementCommits, [], "ordered visible settlement remains blocked at the unfinished newest commit");
releaseFirstCommit();
await settlementBuffer.flush();
assert.deepEqual(settlementCommits, [0, 1, 2], "decoupled network work still commits newest to oldest");

const rejectedSettlementBuffer = historyLoaderModule.createOrderedSettlementBuffer(0);
controllerModule.scheduleOrderedSettlement(rejectedSettlementBuffer, 0, {}, async () => {
  throw new Error("ordered_commit_failed");
});
await assert.rejects(rejectedSettlementBuffer.flush(), /ordered_commit_failed/,
  "ordered commit errors remain observable at the final flush");

const concurrentRequests = [];
const committedEnds = [];
const progressUpdates = [];
let activeOlder = 0;
let maxActiveOlder = 0;
const concurrentClient = {
  kind: "calculated",
  async loadCurrent(request, parts) {
    const result = makeResult(request, parts);
    return {
      ...result,
      observations: {
        ...result.observations,
        stable_head_start_utc: "2026-07-05T00:00:00.000Z",
        stable_head_end_utc: request.end_utc,
        next_older_observation_chunk_end_utc: "2026-07-05T00:00:00.000Z",
      },
      aqi: {
        ...result.aqi,
        stable_head_start_utc: "2026-07-05T00:00:00.000Z",
        stable_head_end_utc: request.end_utc,
        next_older_aqi_chunk_end_utc: "2026-07-05T00:00:00.000Z",
      },
    };
  },
  async loadOlder(request, parts) {
    concurrentRequests.push(request.end_utc);
    activeOlder += 1;
    maxActiveOlder = Math.max(maxActiveOlder, activeOlder);
    const day = new Date(request.end_utc).getUTCDate();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, day - 2) * 4));
    activeOlder -= 1;
    return makeResult(request, parts);
  },
  async prefetchAqi(request) { return makeResult(request, { observations: false, aqi: true }); },
};
const concurrentRecords = new Map();
const concurrentController = controllerModule.createStationChartController({
  renderer: {
    initialise() {}, renderAxes() {}, renderObservations() {}, renderAqi() {}, setLoading() {},
    updateProgress(settled, total) { progressUpdates.push([settled, total]); },
    clearProgress() {}, destroy() {},
  },
  calculatedClient: concurrentClient,
  compatibilityClient: concurrentClient,
  records: concurrentRecords,
  backgroundAqiPrefetch: false,
  olderChunkMs: 24 * 60 * 60 * 1000,
  primaryObservationConcurrency: 3,
  diagnostics: {
    timing() {},
    event(name, details) {
      if (name === "station_history_chunk_committed" && details.kind === "observations") committedEnds.push(details.end_utc);
    },
  },
});
concurrentController.mount({});
await concurrentController.setRange(independentRange);
await concurrentController.setSelection([
  { station_id: 501, timeseries_id: 601, connector_id: 701, pollutant: "pm25" },
]);
assert.equal(maxActiveOlder, 3, "primary older history uses its bounded per-stream concurrency");
assert.deepEqual(concurrentRequests.slice(0, 3), [
  "2026-07-05T00:00:00.000Z",
  "2026-07-04T00:00:00.000Z",
  "2026-07-03T00:00:00.000Z",
], "newest primary chunks launch first without serial waiting");
assert.deepEqual(committedEnds, [
  "2026-07-05T00:00:00.000Z",
  "2026-07-04T00:00:00.000Z",
  "2026-07-03T00:00:00.000Z",
  "2026-07-02T00:00:00.000Z",
], "out-of-order network completions commit newest to oldest");
assert.deepEqual(progressUpdates.at(-1), [4, 4], "observation progress settles every planned history chunk");
const concurrentRecord = concurrentRecords.values().next().value;
assert.equal(cacheModule.getUncoveredRanges(concurrentRecord, "observations", independentRange).length, 0,
  "the complete requested observation range is covered after history settlement");
assert.equal(cacheModule.getUncoveredRanges(concurrentRecord, "aqi", independentRange).length, 0,
  "the complete requested AQI range is covered independently");
concurrentController.destroy();

let failOlderInterval = true;
const incompleteEvents = [];
const incompleteMessages = [];
let incompleteRenderErrorCount = 0;
let incompleteLastState = null;
const failedEndUtc = "2026-07-03T00:00:00.000Z";
const incompleteRequests = [];
const incompleteClient = {
  kind: "calculated",
  async loadCurrent(request, parts) {
    const result = makeResult(request, parts);
    return {
      ...result,
      observations: {
        ...result.observations,
        points: [{ date: new Date("2026-07-08T12:00:00.000Z"), value: 8 }],
        stable_head_start_utc: "2026-07-05T00:00:00.000Z",
        stable_head_end_utc: request.end_utc,
        next_older_observation_chunk_end_utc: "2026-07-05T00:00:00.000Z",
      },
      aqi: {
        ...result.aqi,
        stable_head_start_utc: "2026-07-05T00:00:00.000Z",
        stable_head_end_utc: request.end_utc,
        next_older_aqi_chunk_end_utc: "2026-07-05T00:00:00.000Z",
      },
    };
  },
  async loadOlder(request, parts) {
    incompleteRequests.push(request.end_utc);
    if (failOlderInterval && request.end_utc === failedEndUtc) throw new Error("history_transport_failed");
    return makeResult(request, parts);
  },
  async prefetchAqi(request) { return makeResult(request, { observations: false, aqi: true }); },
};
const incompleteRecords = new Map();
const incompleteController = controllerModule.createStationChartController({
  renderer: {
    initialise() {}, renderAxes() {}, renderAqi() {}, setLoading() {}, clearProgress() {}, updateProgress() {}, destroy() {},
    renderObservations(state) { incompleteLastState = state; },
    renderError() { incompleteRenderErrorCount += 1; },
  },
  calculatedClient: incompleteClient,
  compatibilityClient: incompleteClient,
  records: incompleteRecords,
  backgroundAqiPrefetch: false,
  olderChunkMs: 24 * 60 * 60 * 1000,
  onMessage(message) { incompleteMessages.push(message); },
  diagnostics: {
    timing() {},
    event(name, details) { incompleteEvents.push([name, details]); },
  },
});
incompleteController.mount({});
await incompleteController.setRange(independentRange);
const incompleteState = await incompleteController.setSelection([
  { station_id: 801, timeseries_id: 901, connector_id: 1001, pollutant: "pm25" },
]);
assert.equal(incompleteState.complete, false, "a failed required observation interval is not labelled complete");
assert.equal(incompleteState.observation_complete, false);
assert.equal(incompleteState.observation_coverage.failed_interval_count, 1);
assert.equal(incompleteRenderErrorCount, 0, "valid retained chart data is not blanked by one older transport failure");
assert.equal(incompleteLastState.observations.get("801").length, 1, "valid current observations remain rendered");
assert.equal(incompleteMessages.some(Boolean), false, "no new user-facing partial-failure wording is invented");
const incompleteDiagnostic = incompleteEvents.find(([name]) => name === "station_chart_load_incomplete")?.[1];
assert.equal(incompleteDiagnostic?.retryable_transport_failure, true);
assert.equal(incompleteDiagnostic?.source_partial, false, "transport failure remains distinct from source-data partiality");
assert.equal(incompleteEvents.some(([name]) => name === "station_chart_load_completed"), false);

failOlderInterval = false;
const requestsBeforeRetry = incompleteRequests.filter((endUtc) => endUtc === failedEndUtc).length;
const recoveredState = await incompleteController.refresh();
assert.equal(recoveredState.complete, true, "a later normal load can complete the previously failed interval");
assert.equal(incompleteRequests.filter((endUtc) => endUtc === failedEndUtc).length, requestsBeforeRetry + 1,
  "the failed observation interval remains retryable");
incompleteController.destroy();

// Explicit Refresh preserves observation coverage and tracks derived freshness.
const refreshHourMs = 60 * 60 * 1000;
const refreshStartMs = Date.parse("2026-08-01T00:00:00.000Z");
const refreshIso = (hour) => new Date(refreshStartMs + hour * refreshHourMs).toISOString();
const refreshInterval = (start, end) => ({ start_utc: refreshIso(start), end_utc: refreshIso(end) });
const refreshRange = refreshInterval(0, 120);
const retryRange = refreshInterval(24, 48);
const drainBackground = async () => {
  for (let turn = 0; turn < 8; turn += 1) await new Promise((resolve) => setImmediate(resolve));
};

async function createRefreshFixture({ count = 3, retryIds = [1, 2, 3], pollutant = "pm25" } = {}) {
  const requests = [], records = new Map(), messages = [];
  const renders = { observations: 0, axes: 0, aqi: 0, errors: 0, unavailable: 0, cleared: 0 };
  let repaired = false;
  const controls = {
    failOlder: null, failHead: null, failAqi: null, invalidAqi: null,
    malformedAqi: false, malformedHeadAqi: false, holdHead: null, holdAqi: null, observationValue: 2.8, aqiLevel: null,
  };
  function result(request, parts, current) {
    const start = current ? Math.max(Date.parse(request.start_utc), Date.parse(refreshIso(96))) : Date.parse(request.start_utc);
    const end = Date.parse(request.end_utc);
    const inRetry = !current && start < Date.parse(refreshIso(48)) && end > Date.parse(refreshIso(24));
    const incomplete = !repaired && retryIds.includes(request.station_id) && inRetry;
    const observationPoints = [];
    const aqiPoints = [];
    for (let hour = 0; hour <= 144; hour += 1) {
      const timestamp = Date.parse(refreshIso(hour));
      if (timestamp >= start && timestamp <= end) observationPoints.push({ date: new Date(timestamp), value: controls.observationValue });
      if (timestamp > start && timestamp <= end && !(hour === 30 && !repaired)
        && !(repaired && [24, 31].includes(hour))) {
        const level = controls.aqiLevel ?? (repaired ? 1 : 2);
        aqiPoints.push({ date: new Date(timestamp), daqi: level, eaqi: level });
      }
    }
    const head = current ? {
      stable_head_start_utc: refreshIso(96), stable_head_end_utc: request.end_utc,
      output_start_utc: new Date(start).toISOString(), output_end_utc: request.end_utc,
      next_chunk_end_utc: refreshIso(96),
    } : {};
    const base = makeResult(request, parts);
    return {
      ...base,
      observations: { ...base.observations, ...head, points: observationPoints, response_complete: !incomplete, has_gap: incomplete },
      aqi: {
        ...base.aqi, ...head, points: aqiPoints, rows: aqiPoints,
        response_complete: false, has_gap: true, partial_reasons: ["insufficient_samples"],
        malformed: parts.aqi && (current ? controls.malformedHeadAqi : controls.malformedAqi),
      },
    };
  }
  const client = {
    async loadCurrent(request, parts) {
      requests.push({ ...request, type: "current", observations: parts.observations, aqi: parts.aqi });
      if (controls.failHead === request.station_id) throw new Error("head_transport_failed");
      if (controls.holdHead?.id === request.station_id) {
        await new Promise((resolve) => { controls.holdHead.release = resolve; });
      }
      return result(request, parts, true);
    },
    async loadOlder(request, parts) {
      requests.push({ ...request, type: "older", observations: parts.observations, aqi: parts.aqi });
      if (parts.observations && controls.failOlder === request.station_id) throw new Error("history_transport_failed");
      if (!parts.observations && controls.failAqi === request.station_id) throw new Error("aqi_transport_failed");
      const response = result(request, parts, false);
      if (!parts.observations && controls.invalidAqi === request.station_id) response.identity_valid = false;
      return response;
    },
    async prefetchAqi(request) {
      requests.push({ ...request, type: "prefetch", observations: false, aqi: true });
      const response = result(request, { observations: false, aqi: true }, true);
      if (controls.holdAqi?.id === request.station_id) {
        const held = controls.holdAqi;
        controls.holdAqi = null;
        await new Promise((resolve) => { held.release = resolve; });
        if (held.failure === "transport") throw new Error("obsolete_aqi_transport_failed");
        response.aqi.malformed = true;
      }
      return response;
    },
  };
  const controller = controllerModule.createStationChartController({
    renderer: {
      initialise() {}, setLoading() {}, destroy() {},
      clearAqi() { renders.cleared += 1; },
      renderError() { renders.errors += 1; },
      renderAqiUnavailable() { renders.unavailable += 1; },
      renderAxes() { renders.axes += 1; },
      renderObservations(state) { renders.observations += 1; renders.observationState = state; },
      renderAqi(state) { renders.aqi += 1; renders.aqiState = state; },
    },
    calculatedClient: client, compatibilityClient: client, records,
    onMessage(message) { messages.push(message); },
    olderChunkMs: 24 * refreshHourMs,
    aqiSourceController: sourceModule.createAqiSourceController({ transitionMs: 0, wait: async () => {} }),
  });
  controller.mount({});
  await controller.setRange(refreshRange);
  await controller.setSelection(Array.from({ length: count }, (_, index) => ({
    station_id: index + 1, timeseries_id: index + 101, connector_id: index + 201, pollutant,
  })));
  await drainBackground();
  assert.equal(requests.filter((request) => request.type === "prefetch").length, count - 1,
    "ordinary initial loading preserves secondary background prefetch");
  const record = (id) => [...records.values()].find((entry) => entry.identity?.station_id === id);
  for (let id = 1; id <= count; id += 1) {
    assert.equal(cacheModule.getUncoveredRanges(record(id), "aqi", refreshRange).length, 0,
      "legitimate blank/partial AQI is initially settled and fresh");
  }
  requests.length = 0;
  messages.length = 0;
  return { controller, requests, records, renders, messages, record, controls, repair() { repaired = true; } };
}

function olderObservationRequests(fixture) {
  return fixture.requests.filter((request) => request.type === "older" && request.observations);
}
function assertOnlyExpectedObservationRetries(fixture, ids) {
  assert.deepEqual(olderObservationRequests(fixture).map((request) => request.station_id).sort(), ids);
  assert.ok(olderObservationRequests(fixture).every((request) =>
    request.start_utc === retryRange.start_utc && request.end_utc === retryRange.end_utc),
  "complete unrelated observation chunks are never re-fetched");
}
function assertSecondaryDeferred(fixture, ids) {
  assert.ok(fixture.requests.every((request) => !ids.includes(request.station_id) || !request.aqi),
    "Refresh suppresses secondary current and historical AQI, including background prefetch");
}
function aqiAt(record, hour) {
  return record.aqi_points.find((point) => point.date.getTime() === Date.parse(refreshIso(hour)));
}

// 1: repaired primary history, bounded authoritative replacement, outside cache.
const singleRefresh = await createRefreshFixture({ count: 1, retryIds: [1] });
const primaryRecord = singleRefresh.record(1);
assert.equal(aqiAt(primaryRecord, 30), undefined, "the repaired endpoint starts as settled blank");
const obsoletePoint = aqiAt(primaryRecord, 31);
const outsidePoint = { date: new Date(refreshIso(130)), daqi: 5, eaqi: 5 };
primaryRecord.aqi_points.push(outsidePoint);
cacheModule.recordCoverageInterval(primaryRecord, "aqi", refreshInterval(120, 144), "complete");
const unselectedRecord = cacheModule.createCacheRecord();
singleRefresh.records.set("unselected", unselectedRecord);
const unselectedBefore = JSON.stringify(unselectedRecord);
singleRefresh.repair();
await singleRefresh.controller.refresh();
assertOnlyExpectedObservationRetries(singleRefresh, [1]);
assert.ok(olderObservationRequests(singleRefresh).every((request) => request.aqi),
  "the primary observation retry includes AQI despite old blank settlement");
assert.equal(aqiAt(primaryRecord, 30)?.eaqi, 1, "repaired blank EAQI appears");
assert.equal(aqiAt(primaryRecord, 36)?.eaqi, 1, "changed AQI replaces an earlier level");
assert.equal(primaryRecord.aqi_points.includes(obsoletePoint), false, "absent authoritative output removes obsolete rows");
assert.equal(aqiAt(primaryRecord, 24), undefined, "an entirely blank recalculated interval removes its old row");
assert.equal(cacheModule.getUncoveredRanges(primaryRecord, "aqi", refreshInterval(23, 24)).length, 0,
  "successfully recalculated empty output becomes settled and fresh");
assert.ok(primaryRecord.aqi_points.includes(outsidePoint), "replacement preserves points outside its interval");
assert.equal(cacheModule.getUncoveredRanges(primaryRecord, "aqi", refreshRange).length, 0);
assert.equal(cacheModule.hasStaleAqi(primaryRecord, refreshInterval(129, 130)), true,
  "cached output inside the PM tail beyond the visible range remains stale");
assert.equal(cacheModule.hasStaleAqi(primaryRecord, refreshInterval(143, 144)), false,
  "the dependency ends at the last refreshed endpoint plus 23 hours");
assert.equal(JSON.stringify(unselectedRecord), unselectedBefore, "unselected cache state stays untouched");
assert.ok(singleRefresh.requests.every((request) => Date.parse(request.end_utc) <= Date.parse(refreshRange.end_utc)),
  "immediate work is clipped to displayed output");
const primaryAqiHistory = singleRefresh.requests.filter((request) => request.type === "older" && request.aqi);
for (let index = 0; index < primaryAqiHistory.length; index += 1) {
  const left = primaryAqiHistory[index];
  assert.ok(primaryAqiHistory.slice(index + 1).every((right) =>
    Date.parse(left.end_utc) <= Date.parse(right.start_utc) || Date.parse(right.end_utc) <= Date.parse(left.start_utc)),
  "combined retries and following AQI-only work never duplicate an output interval");
}
singleRefresh.controller.destroy();

// 2, 5, 6: all three retry, secondary heads/history defer, visible equality is no shortcut.
const multiRefresh = await createRefreshFixture();
const beforeVisiblePoints = JSON.stringify(multiRefresh.record(2).observation_points);
const secondaryDiagnostics = JSON.stringify(multiRefresh.record(2).coverage.aqi.interval_states);
multiRefresh.repair();
await multiRefresh.controller.refresh();
await drainBackground();
assertOnlyExpectedObservationRetries(multiRefresh, [1, 2, 3]);
assertSecondaryDeferred(multiRefresh, [2, 3]);
assert.equal(JSON.stringify(multiRefresh.record(2).observation_points), beforeVisiblePoints,
  "this retry returns identical normalized visible observations");
assert.equal(JSON.stringify(multiRefresh.record(2).coverage.aqi.interval_states), secondaryDiagnostics,
  "freshness invalidation preserves response settlement and diagnostics");
for (const id of [2, 3]) {
  assert.equal(cacheModule.hasStaleAqi(multiRefresh.record(id), retryRange), true);
  assert.equal(cacheModule.hasStaleAqi(multiRefresh.record(id), refreshInterval(100, 101)), true,
    "accepted secondary current-head observations invalidate dependent head AQI");
  assert.equal(cacheModule.hasStaleAqi(multiRefresh.record(id), refreshInterval(70, 71)), true,
    "PM dependency extends across the observation chunk edge through t+23h");
  assert.equal(cacheModule.hasStaleAqi(multiRefresh.record(id), refreshInterval(71, 72)), false);
  const beforeSwitch = { ...multiRefresh.renders };
  multiRefresh.requests.length = 0;
  await multiRefresh.controller.setAqiSource(String(id));
  assert.ok(multiRefresh.requests.length > 0, "settled-but-stale source switching requests AQI");
  assert.ok(multiRefresh.requests.every((request) => request.aqi && !request.observations),
    "source switching never refetches observations");
  assert.equal(aqiAt(multiRefresh.record(id), 30)?.eaqi, 1);
  assert.equal(aqiAt(multiRefresh.record(id), 60)?.daqi, 1,
    "AQI-only following-chunk work repairs PM forward dependency");
  assert.equal(cacheModule.getUncoveredRanges(multiRefresh.record(id), "aqi", refreshRange).length, 0);
  assert.equal(multiRefresh.renders.aqi, beforeSwitch.aqi + 1, "the new source commits bands once");
  assert.equal(multiRefresh.renders.observations, beforeSwitch.observations);
  assert.equal(multiRefresh.renders.axes, beforeSwitch.axes);
}
multiRefresh.requests.length = 0;
await multiRefresh.controller.setAqiSource("2");
await multiRefresh.controller.setAqiSource("1");
assert.equal(multiRefresh.requests.length, 0, "settled-and-fresh sources retain the fast cache path");
multiRefresh.controller.destroy();

// 3: only B has retryable older observations; A/C history is retained.
const secondaryOnly = await createRefreshFixture({ retryIds: [2] });
secondaryOnly.repair();
await secondaryOnly.controller.refresh();
await drainBackground();
assertOnlyExpectedObservationRetries(secondaryOnly, [2]);
assertSecondaryDeferred(secondaryOnly, [2, 3]);
assert.ok(secondaryOnly.requests.filter((request) => request.type === "older" && request.station_id === 1)
  .every((request) => Date.parse(request.start_utc) >= Date.parse(refreshIso(95))),
"the only possible primary historical AQI is its own inclusive head seam, never B's old interval");
assert.equal(cacheModule.hasStaleAqi(secondaryOnly.record(2), retryRange), true);
assert.equal(cacheModule.hasStaleAqi(secondaryOnly.record(3), retryRange), false);
secondaryOnly.controller.destroy();

// 4: complete older observations produce no observation work or blanket AQI requests.
const completeRefresh = await createRefreshFixture({ retryIds: [] });
completeRefresh.repair();
await completeRefresh.controller.refresh();
await drainBackground();
assertOnlyExpectedObservationRetries(completeRefresh, []);
assertSecondaryDeferred(completeRefresh, [2, 3]);
assert.equal(completeRefresh.requests.filter((request) => request.type === "current").length, 3);
assert.ok(completeRefresh.requests.filter((request) => request.type === "older")
  .every((request) => request.aqi && !request.observations
    && request.start_utc === refreshIso(95) && request.end_utc === refreshIso(96)),
"any older request is limited to the primary head's inclusive observation endpoint");
completeRefresh.controller.destroy();

// 7: exact endpoint dependency arithmetic, including NO2 and a single PM seam.
assert.deepEqual(cacheModule.observationAqiDependency(refreshInterval(24, 25), "pm25"), {
  startMs: Date.parse(refreshIso(23)), endMs: Date.parse(refreshIso(48)),
});
assert.deepEqual(cacheModule.observationAqiDependency(refreshInterval(24, 25), "no2"), {
  startMs: Date.parse(refreshIso(23)), endMs: Date.parse(refreshIso(25)),
});

// 8: transport failure and cancelled observation work cannot invalidate freshness.
const failedRefresh = await createRefreshFixture({ retryIds: [2] });
failedRefresh.controls.failOlder = 2;
failedRefresh.controls.failHead = 3;
const failedHeadBefore = JSON.stringify(failedRefresh.record(3).aqi_freshness);
failedRefresh.repair();
await failedRefresh.controller.refresh();
assert.equal(cacheModule.hasStaleAqi(failedRefresh.record(2), retryRange), false,
  "failed older observations do not invalidate their AQI");
assert.equal(JSON.stringify(failedRefresh.record(3).aqi_freshness), failedHeadBefore,
  "failed current observations do not invalidate AQI");
failedRefresh.controller.destroy();

const obsoleteRefresh = await createRefreshFixture({ retryIds: [] });
obsoleteRefresh.controls.holdHead = { id: 2 };
const obsoleteBefore = JSON.stringify(obsoleteRefresh.record(2).aqi_freshness);
const pendingRefresh = obsoleteRefresh.controller.refresh();
await drainBackground();
await obsoleteRefresh.controller.setSelection([]);
obsoleteRefresh.controls.holdHead.release();
await pendingRefresh;
assert.equal(JSON.stringify(obsoleteRefresh.record(2).aqi_freshness), obsoleteBefore,
  "cancelled/obsolete observation responses never accept a freshness dependency");
obsoleteRefresh.controller.destroy();

// A newer dependency cannot be cleared by an earlier AQI evaluation, including
// after the newer dependency has itself been repaired. No wall clock is involved.
const raceRecord = cacheModule.createCacheRecord();
cacheModule.recordCoverageInterval(raceRecord, "aqi", refreshRange, "complete");
const oldEvaluation = cacheModule.beginAqiEvaluation(raceRecord);
cacheModule.invalidateAqiForObservations(raceRecord, retryRange, "pm25");
assert.equal(cacheModule.canApplyAqiEvaluation(raceRecord, retryRange, oldEvaluation), false);
assert.equal(cacheModule.markAqiFresh(raceRecord, retryRange, oldEvaluation), false);
assert.equal(cacheModule.hasStaleAqi(raceRecord, retryRange), true);
const newEvaluation = cacheModule.beginAqiEvaluation(raceRecord);
assert.equal(cacheModule.markAqiFresh(raceRecord, retryRange, newEvaluation), true);
assert.equal(cacheModule.canApplyAqiEvaluation(raceRecord, retryRange, oldEvaluation), false,
  "a late response cannot overwrite a newer fresh repair");
const overlappingCombined = cacheModule.beginAqiEvaluation(raceRecord);
cacheModule.invalidateAqiForObservations(raceRecord, retryRange, "pm25");
cacheModule.invalidateAqiForObservations(raceRecord, retryRange, "pm25", overlappingCombined);
assert.equal(cacheModule.canApplyAqiEvaluation(raceRecord, retryRange, overlappingCombined), false,
  "a combined response cannot erase another acceptance that raced its request");

// Combined current/older Refresh accepts observations independently of AQI.
for (const currentHead of [false, true]) {
  const malformedRefresh = await createRefreshFixture({ count: 1, retryIds: currentHead ? [] : [1] });
  const affectedHour = currentHead ? 100 : 36;
  const unrelatedHour = currentHead ? 36 : 78;
  const affectedRange = currentHead ? refreshInterval(99, 100) : retryRange;
  const retained = aqiAt(malformedRefresh.record(1), affectedHour);
  malformedRefresh.controls[currentHead ? "malformedHeadAqi" : "malformedAqi"] = true;
  malformedRefresh.controls.observationValue = 4.2;
  malformedRefresh.repair();
  const refreshed = await malformedRefresh.controller.refresh();
  assert.equal(refreshed.observation_complete, true, "AQI failure does not reject usable observation loading");
  assert.ok([...malformedRefresh.renders.observationState.observations.values()].flat()
    .some((point) => point.date.getTime() === Date.parse(refreshIso(affectedHour)) && point.value === 4.2),
  "valid refreshed observations are accepted and rendered despite malformed combined AQI");
  assert.equal(malformedRefresh.renders.errors, 0, "AQI-only failure never invokes chart-wide renderError");
  assert.ok(malformedRefresh.messages.every((message) => message === ""), "no chart-wide failure message is shown");
  assert.equal(aqiAt(malformedRefresh.record(1), affectedHour), retained, "failed recalculation preserves cached rows");
  assert.equal(cacheModule.hasStaleAqi(malformedRefresh.record(1), affectedRange), true);
  assert.ok(cacheModule.getUncoveredRanges(malformedRefresh.record(1), "aqi", affectedRange).length,
    "failed AQI remains unsettled and retryable");
  assert.ok(!malformedRefresh.renders.aqiState.aqi.some((point) => point.date.getTime() === Date.parse(refreshIso(affectedHour))),
    "terminally failed stale bands are not presented alongside refreshed observations");
  assert.ok(malformedRefresh.renders.aqiState.aqi.some((point) => point.date.getTime() === Date.parse(refreshIso(unrelatedHour))),
    "unrelated fresh bands remain displayed");
  malformedRefresh.controller.destroy();
}

// An older source-switch evaluation must not damage a newer accepted Refresh
// dependency and repair, whether its late failure is malformed or transport.
for (const failure of ["malformed", "transport"]) {
  const obsoleteAqi = await createRefreshFixture({ count: 2, retryIds: [] });
  obsoleteAqi.repair();
  await obsoleteAqi.controller.refresh();
  obsoleteAqi.controls.holdHead = { id: 2 };
  const newerRefresh = obsoleteAqi.controller.refresh();
  await drainBackground();
  const held = { id: 2, failure };
  obsoleteAqi.controls.holdAqi = held;
  const olderSwitch = obsoleteAqi.controller.setAqiSource("2");
  await drainBackground();
  assert.equal(typeof held.release, "function", "older AQI evaluation has started before the new observation acceptance");
  obsoleteAqi.controls.observationValue = 4.2;
  obsoleteAqi.controls.aqiLevel = 3;
  obsoleteAqi.controls.holdHead.release();
  await newerRefresh;
  const record = obsoleteAqi.record(2);
  assert.ok(record.observation_points.some((point) => point.date.getTime() === Date.parse(refreshIso(100)) && point.value === 4.2),
    "the newer observation dependency was accepted");
  assert.equal(cacheModule.getUncoveredRanges(record, "aqi", refreshRange).length, 0,
    "a newer AQI repair has settled fresh before the obsolete failure returns");
  assert.equal(aqiAt(record, 100).eaqi, 3, "the newer repair supplies new AQI rows");
  const beforeFailure = JSON.stringify(record);
  const beforeRender = { ...obsoleteAqi.renders };
  held.release();
  await olderSwitch;
  assert.equal(JSON.stringify(record), beforeFailure,
    "obsolete AQI failure cannot alter newer rows, settlement, freshness or cache metadata");
  assert.equal(obsoleteAqi.renders.unavailable, beforeRender.unavailable,
    "an ignored obsolete failure does not make the repaired source unavailable");
  assert.equal(obsoleteAqi.renders.observations, beforeRender.observations);
  assert.equal(obsoleteAqi.renders.axes, beforeRender.axes);
  assert.equal(obsoleteAqi.renders.errors, 0);
  assert.ok(obsoleteAqi.messages.every((message) => message === ""));
  obsoleteAqi.controller.destroy();
}

for (const failure of ["failAqi", "invalidAqi"]) {
  const failedSwitch = await createRefreshFixture({ count: 2, retryIds: [2] });
  const retained = aqiAt(failedSwitch.record(2), 36);
  failedSwitch.repair();
  await failedSwitch.controller.refresh();
  failedSwitch.controls[failure] = 2;
  const beforeSwitch = { ...failedSwitch.renders };
  failedSwitch.requests.length = 0;
  await failedSwitch.controller.setAqiSource("2");
  assert.equal(aqiAt(failedSwitch.record(2), 36), retained,
    "failed/identity-invalid AQI-only work preserves cached rows");
  assert.equal(cacheModule.hasStaleAqi(failedSwitch.record(2), retryRange), true,
    "failed recalculation never restores freshness");
  assert.equal(failedSwitch.renders.observations, beforeSwitch.observations);
  assert.equal(failedSwitch.renders.axes, beforeSwitch.axes);
  assert.ok(failedSwitch.requests.every((request) => request.aqi && !request.observations));
  assert.equal(failedSwitch.renders.cleared, beforeSwitch.cleared + 1);
  assert.equal(failedSwitch.renders.unavailable, beforeSwitch.unavailable + 1,
    "AQI-only source-switch failure retains the existing AQI-local unavailable path");
  assert.equal(failedSwitch.renders.aqi, beforeSwitch.aqi, "the failed source never commits retained stale bands");
  assert.equal(failedSwitch.renders.errors, beforeSwitch.errors);
  assert.ok(failedSwitch.messages.every((message) => message === ""));
  failedSwitch.controller.destroy();
}

console.log("Hex Map shared station-chart harness passed");
