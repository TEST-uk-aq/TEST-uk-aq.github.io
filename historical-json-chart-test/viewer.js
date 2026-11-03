// Thin TEST adapter. All history transport, cache, request ownership and drawing are shared.
import runtime from '../shared/station-chart/station-chart-runtime.js';

const source = document.getElementById('source'), range = document.getElementById('range');
const status = document.getElementById('status'), output = document.getElementById('diagnostics');
const loadButton = document.getElementById('load'), refreshButton = document.getElementById('refresh');
const identity = { connector_id: 1, timeseries_id: 43, station_id: 1581, pollutant: 'pm10', label: 'AURN PM10 · 43', source_generation: 'v3' };
const base = window.ukAqSharedAuth.cacheBaseUrl;
// Pilot fixtures only. Absence is always decided by the authenticated manifest, not this list.
const ranges = {
  day: { start_utc: '2026-08-12T00:00:00.000Z', end_utc: '2026-08-13T00:00:00.000Z', label: '24h' },
  month: { start_utc: '2026-08-01T00:00:00.000Z', end_utc: '2026-09-01T00:00:00.000Z', label: '31d' },
  adjacent: { start_utc: '2026-09-01T00:00:00.000Z', end_utc: '2026-10-01T00:00:00.000Z', label: '31d' },
  mixed: { start_utc: '2026-08-01T00:00:00.000Z', end_utc: '2026-10-01T00:00:00.000Z', label: '90d' },
};
let chart = null, run = 0, began = 0, events = [], latestRange = null;
function record(event) {
  events.push({ at_utc: new Date().toISOString(), elapsed_ms: performance.now()-began, ...runtime.diagnostics.shapeEvent(event.type, event).details });
  if (events.length > 400) events.shift();
  // Avoid synchronous large diagnostics DOM writes in the chart's visible commit.
  if (!record.pending) { record.pending = true; requestAnimationFrame(() => { output.textContent = JSON.stringify(events,null,2); record.pending = false; }); }
}
function message(text, options) { status.textContent = text; status.classList.toggle('error', options?.error === true); }
const measuredFetch = runtime.diagnostics.createMeasuredFetch((url,init) => window.ukAqFetchCacheApi(url,init), record);
function makeController() {
  const scheduler = runtime.historyLoader.createPriorityFetchScheduler(6);
  const normal = runtime.calculatedClient.createCalculatedStationHistoryClient({ stationSeriesUrl: `${base}/station-series`, historyUrl: `${base}/timeseries`,
    fetchApi: measuredFetch, scheduler,
    onResponse: ({ payload }) => record({ type: 'calculated_source', identity: payload.identity || payload.request,
      source: payload.source, algorithm_version: payload.aqi?.algorithm_version,
      observation_complete: payload.observations?.response_complete, aqi_complete: payload.aqi?.response_complete }),
  });
  const json = source.value === 'json' ? runtime.historicalJsonClient.createHistoricalJsonClient({
    baseUrl: `${base}/history-json`, fetchApi: measuredFetch, scheduler, onDiagnostic: record,
  }) : null;
  const hybrid = source.value === 'hybrid' ? runtime.hybridHistoryClient.createHybridHistoryClient({
    baseUrl: `${base}/history-json`, stationSeriesUrl: `${base}/station-series`, historyUrl: `${base}/timeseries`,
    sourceGeneration: identity.source_generation, fetchApi: measuredFetch, scheduler, onDiagnostic: record,
  }) : null;
  const diagnostics = runtime.diagnostics.createDiagnostics({
    recordEvent: (name, details) => record({ type: name, ...details }),
    recordTiming: (name, value_ms) => record({ type: 'timing', name, value_ms }),
  });
  const renderer = runtime.diagnostics.observeRenderer(runtime.renderer.createStationChartRenderer({
    getWindowLabel: () => ranges[range.value].label, noHistoryMessage: 'No observations available for this interval.',
  }), { record, getRun: () => run, getStartedAt: () => began });
  return runtime.controller.createStationChartController({ renderer, calculatedClient: normal, compatibilityClient: normal, dataClient: hybrid || json,
    maxSelection: 1, diagnostics, backgroundAqiPrefetch: false,
    getWindowLabel: () => ranges[range.value].label,
    cacheContract: `historical-json-comparison:${source.value}`, onMessage: message,
    onCacheCommit: details => record({ type: 'cache_commit', ...details }),
  });
}
async function load(refresh = false) {
  const generation = ++run; began = performance.now(); events = [];
  loadButton.disabled = true; refreshButton.disabled = true; message('Loading…');
  const selectedRange = ranges[range.value];
  latestRange = { start_utc: selectedRange.start_utc, end_utc: selectedRange.end_utc };
  record({ type: 'comparison_started', source: source.value, identity, range: latestRange, refresh });
  try {
    if (!refresh || !chart) {
      chart?.destroy(); chart = makeController();
      chart.mount({ svg: document.getElementById('chart'), wrap: document.getElementById('chart-wrap'), tooltip: document.getElementById('chart-tooltip') });
    }
    const result = refresh ? await chart.refresh() : await chart.setSelection([identity], { range: latestRange });
    if (generation !== run) return;
    record({ type: 'full_settlement', elapsed_ms: performance.now()-began, observation_complete: result?.observation_complete ?? false,
      outcome: result ? 'settled' : 'failed', range: latestRange, source: source.value });
    if (result) message(result.observation_complete ? 'Chart settled. See independent AQI status and publication diagnostics below.' : 'Chart settled with unavailable or incomplete history. See diagnostics.');
  } catch (error) { if (generation === run) { message(`Chart unavailable: ${error.message}`, { error: true }); record({ type: 'error', error: error.message }); } }
  finally { if (generation === run) { loadButton.disabled = false; refreshButton.disabled = !chart; } }
}
function changed() { run++; chart?.destroy(); chart = null; loadButton.disabled = false; refreshButton.disabled = true; message('Selection changed. Load to compare the same physical identity and interval.'); }
loadButton.addEventListener('click', () => { void load(); });
refreshButton.addEventListener('click', () => { void load(true); });
source.addEventListener('change', changed); range.addEventListener('change', changed);
window.addEventListener('pagehide', () => chart?.destroy());
document.getElementById('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schema_version: 1, source: source.value, identity, range: latestRange, events },null,2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'uk-aq-historical-chart-diagnostics.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
});
