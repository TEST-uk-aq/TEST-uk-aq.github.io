// Thin TEST adapter. All history transport, cache, request ownership and drawing are shared.
import runtime from '../shared/station-chart/station-chart-runtime.js';

const source = document.getElementById('source'), range = document.getElementById('range');
const chunkDays = document.getElementById('older-chunk-days');
const workerVersion = document.getElementById('worker-version');
const operatorTokenInput = document.getElementById('version-operator-token');
const verification = document.getElementById('version-verification');
const DAY_MS = 24 * 60 * 60 * 1000;
const status = document.getElementById('status'), output = document.getElementById('diagnostics');
const loadButton = document.getElementById('load'), refreshButton = document.getElementById('refresh');
const identity = { connector_id: 1, timeseries_id: 43, station_id: 1581, pollutant: 'pm10', label: 'AURN PM10 · 43', source_generation: 'v3' };
const base = window.ukAqSharedAuth.cacheBaseUrl;
// Pilot fixtures only. Absence is always decided by the authenticated manifest, not this list.
const ranges = {
  day: { start_utc: '2026-08-12T00:00:00.000Z', end_utc: '2026-08-13T00:00:00.000Z', label: '24h' },
  month: { start_utc: '2026-08-01T00:00:00.000Z', end_utc: '2026-09-01T00:00:00.000Z', label: '31d' },
  adjacent: { start_utc: '2026-09-01T00:00:00.000Z', end_utc: '2026-10-01T00:00:00.000Z', label: '30d' },
  mixed: { start_utc: '2026-08-01T00:00:00.000Z', end_utc: '2026-10-01T00:00:00.000Z', label: '61d' },
};
let chart = null, owner = null, run = 0, latestRun = null;
function record(event, session) {
  if (!session?.active || session !== latestRun) return;
  if (event.type === 'response' && event.requested_version_id) session.requestedVersionIds.add(event.requested_version_id);
  session.events.push({ at_utc: new Date().toISOString(), elapsed_ms: performance.now()-session.began,
    ...runtime.diagnostics.shapeEvent(event.type, event).details,
    run: session.id, comparison_source: session.config.source, selected_older_chunk_days: session.config.selected_older_chunk_days,
    older_chunk_ms: session.config.older_chunk_ms, requested_version: session.config.requested_version,
    verified_executed_version: null, version_verification: 'unverified', comparison_valid: false });
  if (session.events.length > 2000) { session.events.shift(); session.dropped_events++; }
  // Avoid synchronous large diagnostics DOM writes in the chart's visible commit.
  if (!record.pending) { record.pending = true; requestAnimationFrame(() => {
    output.textContent = JSON.stringify(latestRun?.events || [],null,2); record.pending = false;
  }); }
}
function message(text, options) { status.textContent = text; status.classList.toggle('error', options?.error === true); }
function makeController(context) {
  const config = context.session.config;
  const emit = event => record(event, context.session);
  // Capture each transport's run at dispatch; late responses cannot enter a newer run.
  const measuredFetch = (url, init) => {
    if (init?.signal?.aborted) throw new DOMException('Chart request cancelled', 'AbortError');
    return context.session.measuredFetch(url, init);
  };
  const scheduler = runtime.historyLoader.createPriorityFetchScheduler(6);
  const normal = runtime.calculatedClient.createCalculatedStationHistoryClient({ stationSeriesUrl: `${base}/station-series`, historyUrl: `${base}/timeseries`,
    fetchApi: measuredFetch, scheduler,
  });
  const json = config.source === 'json' ? runtime.historicalJsonClient.createHistoricalJsonClient({
    baseUrl: `${base}/history-json`, fetchApi: measuredFetch, scheduler, onDiagnostic: emit,
  }) : null;
  const hybrid = config.source === 'hybrid' ? runtime.hybridHistoryClient.createHybridHistoryClient({
    baseUrl: `${base}/history-json`, stationSeriesUrl: `${base}/station-series`, historyUrl: `${base}/timeseries`,
    sourceGeneration: identity.source_generation, fetchApi: measuredFetch, scheduler, onDiagnostic: emit,
  }) : null;
  const diagnostics = runtime.diagnostics.createDiagnostics({
    recordEvent: (name, details) => emit({ type: name, ...details }),
    recordTiming: (name, value_ms) => emit({ type: 'timing', name, value_ms }),
  });
  const renderer = runtime.diagnostics.observeRenderer(runtime.renderer.createStationChartRenderer({
    getWindowLabel: () => config.range_label, noHistoryMessage: 'No observations available for this interval.',
  }), { record: emit, getRun: () => context.session.id, getStartedAt: () => context.session.began });
  return runtime.controller.createStationChartController({ renderer, calculatedClient: normal, compatibilityClient: normal, dataClient: hybrid || json,
    maxSelection: 1, diagnostics, backgroundAqiPrefetch: false,
    getWindowLabel: () => config.range_label,
    // Keep JSON-only presentation partitioning as before; publication/object selection stays monthly.
    olderChunkMs: config.controller_older_chunk_ms,
    cacheContract: `historical-json-comparison:${config.source}:${config.controller_older_chunk_ms}:${config.requested_version}`,
    onMessage: (text, options) => { if (context.session === latestRun && context.session.active) message(text, options); },
    onCacheCommit: details => emit({ type: 'cache_commit', ...details }),
  });
}
async function load(refresh = false) {
  const requestedVersion = source.value === 'calculated' ? workerVersion.value : 'normal';
  if (!['normal', 'stage3', 'stage4'].includes(requestedVersion)) { message('Unknown Worker version selection.', { error: true }); return; }
  // Captured only by the transport closure, never by the serialisable run config.
  const operatorToken = requestedVersion === 'normal' ? '' : operatorTokenInput.value;
  if (requestedVersion !== 'normal' && (operatorToken.length < 32 || operatorToken.length > 512)) {
    message('Enter the dedicated version comparison operator token (32–512 characters).', { error: true }); return;
  }
  const generation = ++run;
  if (!refresh || !chart) { chart?.destroy(); chart = null; owner = null; }
  if (latestRun) latestRun.active = false;
  const selectedRange = ranges[range.value], selectedDays = Number(chunkDays.value);
  const config = Object.freeze({ source: source.value, range_key: range.value, range_label: selectedRange.label,
    requested_version: requestedVersion,
    range: { start_utc: selectedRange.start_utc, end_utc: selectedRange.end_utc },
    selected_older_chunk_days: selectedDays,
    older_chunk_ms: source.value === 'json' ? null : selectedDays * DAY_MS,
    controller_older_chunk_ms: source.value === 'json'
      ? (range.value === 'mixed' ? 7 * DAY_MS : range.value === 'day' ? DAY_MS / 4 : 3 * DAY_MS)
      : selectedDays * DAY_MS });
  const session = { id: generation, began: performance.now(), started_at_utc: new Date().toISOString(),
    config, refresh, active: true, events: [], dropped_events: 0, requestedVersionIds: new Set() };
  latestRun = session;
  session.measuredFetch = runtime.diagnostics.createMeasuredFetch(async (url, init) => {
    if (!session.active || session !== latestRun || init?.signal?.aborted) throw new DOMException('Chart request cancelled', 'AbortError');
    let fetchApi = window.ukAqFetchCacheApi;
    if (requestedVersion !== 'normal') {
      fetchApi = window.ukAqSharedAuth.fetchVersionComparisonApi;
      if (typeof fetchApi !== 'function') throw new Error('Trusted TEST version comparison API is unavailable.');
      const headers = new Headers(init?.headers);
      headers.set('X-UK-AQ-Station-History-Version-Selection', requestedVersion);
      headers.set('X-UK-AQ-Station-History-Version-Operator-Token', operatorToken);
      headers.delete('If-None-Match'); headers.delete('If-Modified-Since');
      init = { ...init, headers, cache: 'no-store', redirect: 'error' };
    }
    const response = await fetchApi(url, init);
    if (!session.active || session !== latestRun || init?.signal?.aborted) {
      await response.body?.cancel(); throw new DOMException('Chart request cancelled', 'AbortError');
    }
    return response;
  }, event => record(event, session));
  verification.textContent = `Requested version: ${workerVersion.options[workerVersion.selectedIndex].text}. Executed version: unverified. This comparison is not valid until Cloudflare invocation analytics confirms scriptVersion for every measured request.`;
  if (owner) owner.session = session;
  loadButton.disabled = true; refreshButton.disabled = true; message('Loading…');
  record({ type: 'comparison_started', identity, ...config, refresh }, session);
  try {
    if (!chart) {
      owner = { session }; chart = makeController(owner);
      chart.mount({ svg: document.getElementById('chart'), wrap: document.getElementById('chart-wrap'), tooltip: document.getElementById('chart-tooltip') });
    }
    const result = refresh ? await chart.refresh() : await chart.setSelection([identity], { range: config.range });
    if (generation !== run) return;
    record({ type: 'full_settlement', observation_complete: result?.observation_complete ?? false,
      observation_coverage: result?.observation_coverage, outcome: result ? 'settled' : 'failed', range: config.range }, session);
    if (result) message(result.observation_complete ? 'Chart settled. See independent AQI status and publication diagnostics below.' : 'Chart settled with unavailable or incomplete history. See diagnostics.');
  } catch (error) { if (generation === run) { message(`Chart unavailable: ${error.message}`, { error: true }); record({ type: 'error', error: error.message }, session); } }
  finally { if (generation === run) { loadButton.disabled = false; refreshButton.disabled = !chart; } }
}
function changed() {
  record({ type: 'comparison_invalidated', reason: 'selection_changed' }, latestRun);
  run++; if (latestRun) latestRun.active = false;
  chart?.destroy(); chart = null; owner = null;
  chunkDays.disabled = source.value === 'json';
  workerVersion.disabled = source.value !== 'calculated';
  if (workerVersion.disabled) workerVersion.value = 'normal';
  operatorTokenInput.disabled = workerVersion.disabled || workerVersion.value === 'normal';
  verification.textContent = 'Executed version: unverified. Load a fresh run, then confirm scriptVersion in Cloudflare invocation analytics before accepting the comparison.';
  loadButton.disabled = false; refreshButton.disabled = true;
  message('Selection changed. Load to compare the same physical identity and interval.');
}
loadButton.addEventListener('click', () => { void load(); });
refreshButton.addEventListener('click', () => { void load(true); });
source.addEventListener('change', changed); range.addEventListener('change', changed); chunkDays.addEventListener('change', changed);
workerVersion.addEventListener('change', changed); operatorTokenInput.addEventListener('input', changed);
window.addEventListener('pagehide', () => { if (latestRun) latestRun.active = false; chart?.destroy(); operatorTokenInput.value = ''; });
document.getElementById('download').addEventListener('click', () => {
  const session = latestRun;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schema_version: 3, run: session?.id,
    started_at_utc: session?.started_at_utc, identity, ...session?.config, refresh: session?.refresh,
    requested_configured_version_ids: [...(session?.requestedVersionIds || [])],
    verified_executed_version: null, version_verification: 'unverified', comparison_valid: false,
    verification_required: 'Cloudflare invocation analytics scriptVersion must confirm every measured request; HTTP success does not verify routing.',
    timing_basis: 'browser_elapsed_ms_not_worker_cpu', dropped_events: session?.dropped_events || 0, events: session?.events || [] },null,2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = `uk-aq-historical-chart-${session?.config.source || 'no-run'}-${session?.config.requested_version || 'normal'}-${session?.config.selected_older_chunk_days || 3}d-diagnostics.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
});
