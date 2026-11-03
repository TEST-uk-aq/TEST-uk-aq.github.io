// Optional closed-history data provider. Orchestration, settlement and rendering stay shared.
import domain from './station-chart-domain-module.js';
import cache from './station-chart-cache-module.js';
import calculated from './station-history-client-module.js';
import diagnostics from './station-chart-diagnostics-module.js';

const ALGORITHM = 'aqilevels_hourly_v3', FRESHNESS_MS = 300000, HOUR = 3600000;
const SHA = /^[a-f0-9]{64}$/, UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const abort = signal => signal?.throwIfAborted();
const physical = r => ({ connector_id: r.connector_id, station_id: r.station_id, timeseries_id: r.timeseries_id,
  pollutant_code: r.pollutant_code || r.pollutant });
const identityKey = r => [r.connector_id, r.station_id, r.timeseries_id, r.pollutant_code || r.pollutant].join(':');
const sameIdentity = (a, b) => identityKey(a) === identityKey(b);
function bounds(month) {
  check(/^\d{4}-(0[1-9]|1[0-2])$/.test(month || ''), 'history_month_invalid');
  const start = `${month}-01T00:00:00.000Z`, end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  return { start_utc: start, end_utc: end.toISOString() };
}
function monthsFor(range) {
  const r = domain.snapshotChartRange(range); check(r, 'history_range_invalid');
  const current = Date.parse(new Date().toISOString().slice(0,7) + '-01T00:00:00.000Z');
  check(r.endMs <= current && r.endMs > r.startMs, 'history_closed_months_only');
  const months = [], date = new Date(r.startIso.slice(0,7) + '-01T00:00:00.000Z');
  while (date.getTime() < r.endMs) {
    check(months.length < 12, 'history_range_unsupported'); months.push(date.toISOString().slice(0,7)); date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return months;
}
function validateManifest(m, request, month) {
  const b = bounds(month);
  check(m?.schema_version === 1 && m.kind === 'uk_aq_historical_json_pair_selection'
    && sameIdentity(m.identity, request) && m.month_utc === month, 'history_selection_identity_invalid');
  check(m.interval?.start_utc === b.start_utc && m.interval.end_utc === b.end_utc
    && UUID.test(m.pub_id || '') && m.algorithm_version === ALGORITHM && SHA.test(m.source_id || ''), 'history_selection_version_invalid');
  check(m.source?.generation === 'v3' && m.source.source_complete === true && m.source.terminal_complete === true
    && m.source.context_complete === true && ['checkpoint_sha256','evidence_sha256','candidate_sha256','binding_sha256','verification_sha256','month_content_hash','terminal_manifest_hash']
      .every(k => SHA.test(m.source[k] || '')), 'history_selection_source_incomplete');
  check(m.source.edge_day_proofs && ['first','last','context'].every(k => Object.hasOwn(m.source.edge_day_proofs,k)
    && (m.source.edge_day_proofs[k] === null || SHA.test(m.source.edge_day_proofs[k]))), 'history_edge_proof_invalid');
  check(m.admission?.mode === 'manual_isolated_test' && m.admission.readback_verified === true
    && m.admission.managed_publication_eligible === false, 'history_selection_admission_invalid');
  for (const kind of ['observations','aqi']) {
    const o = m.objects?.[kind];
    check(o && o.content_encoding === 'gzip' && o.content_type === 'application/json' && SHA.test(o.sha256 || '') && SHA.test(o.json_sha256 || '') && Number.isSafeInteger(o.byte_size) && o.byte_size > 0
      && o.byte_size <= 8 * 1024 ** 2 && Number.isSafeInteger(o.json_byte_size) && o.json_byte_size > 0 && o.json_byte_size <= 32 * 1024 ** 2
      && o.pub_id === m.pub_id && o.source_id === m.source_id && o.algorithm_version === ALGORITHM, 'history_pair_inconsistent');
  }
  return m;
}
const versionKey = m => [identityKey(m.identity), m.month_utc, m.source_id, m.pub_id, m.algorithm_version,
  m.objects.observations.sha256, m.objects.aqi.sha256].join('|');
async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
}
function validateProduct(x, m, kind) {
  const b = m.interval;
  check(x?.schema_version === 1 && x.kind === `uk_aq_jsongen_bootstrap_${kind}_candidate`
    && sameIdentity(x.identity, m.identity) && x.pub_id === m.pub_id && x.month_utc === m.month_utc
    && x.source_checkpoint?.sha256 === m.source.checkpoint_sha256 && x.source_evidence?.sha256 === m.source.evidence_sha256
    && x.calculation_dependencies?.version === m.algorithm_version
    && x.coverage?.requested_start_utc === b.start_utc && x.coverage.requested_end_exclusive_utc === b.end_utc
    && x.coverage.partial_month === false, 'history_product_pair_invalid');
  if (kind === 'observations') {
    check(JSON.stringify(x.row_columns) === JSON.stringify(['observed_at_utc','value','station_id','source_status','verification_status','embedded_verification_status','source_status_provenance'])
      && x.completeness?.requested_source_complete === true && Array.isArray(x.observations)
      && x.observations.length === m.objects.observations.row_count, 'history_observations_invalid');
    check(x.observations.every(r => Array.isArray(r) && r.length === 7 && r[0] >= b.start_utc && r[0] < b.end_utc
      && typeof r[1] === 'number' && Number.isFinite(r[1]) && r[2] === m.identity.station_id), 'history_observation_row_invalid');
  } else {
    check(x.algorithm_version === m.algorithm_version && x.aqi?.algorithm_version === m.algorithm_version
      && Array.isArray(x.aqi?.rows) && x.aqi.rows.length === (Date.parse(b.end_utc)-Date.parse(b.start_utc))/HOUR
      && x.completeness?.terminal_source_complete === true && x.completeness.context_source_complete === true,
    'history_aqi_incomplete');
    check(x.aqi.rows.every((r,i) => r.timestamp_hour_utc === new Date(Date.parse(b.start_utc)+(i+1)*HOUR).toISOString()
      && r.period_end_utc === r.timestamp_hour_utc && r.period_start_utc === new Date(Date.parse(r.timestamp_hour_utc)-HOUR).toISOString()
      && sameIdentity(r, m.identity) && r.algorithm_version === m.algorithm_version), 'history_aqi_grid_invalid');
    check(Array.isArray(x.terminal_source_inputs) && x.terminal_source_inputs.every(r => sameIdentity(r,m.identity)
      && r.observed_at_utc === b.end_utc && typeof r.value === 'number' && Number.isFinite(r.value)), 'history_terminal_input_invalid');
  }
  return x;
}
export function createHistoricalJsonClient(options = {}) {
  const base = String(options.baseUrl || '').replace(/\/$/, ''), fetchApi = options.fetchApi || globalThis.fetch?.bind(globalThis);
  check(base && fetchApi, 'historical_json_configuration_missing');
  const storage = options.cache || cache.historicalJsonCache, scheduler = options.scheduler;
  const contextOwner = Symbol('historical-json-client');
  const activeTransports = new WeakMap();
  let selections = new Map(), expiresAt = 0, preparedKey = '';
  const emit = (type, detail = {}) => options.onDiagnostic?.({ type, ...detail });
  function urlFor(route, request, month, manifest) {
    const url = new URL(`${base}/${route}`);
    for (const [k,v] of Object.entries({ connector_id: request.connector_id, station_id: request.station_id,
      timeseries_id: request.timeseries_id, pollutant: request.pollutant || request.pollutant_code, month })) url.searchParams.set(k,String(v));
    if (manifest) for (const [k,v] of Object.entries({ pub_id: manifest.pub_id, source_id: manifest.source_id,
      algorithm_version: manifest.algorithm_version, sha256: manifest.objects[route].sha256 })) url.searchParams.set(k,v);
    return url;
  }
  async function responseFor(url, signal, priority = 0) {
    abort(signal); const began = performance.now();
    const execute = () => fetchApi(url.href, { credentials: 'include', signal, cache: url.pathname.endsWith('/manifest') ? 'no-store' : 'default', headers: { Accept: 'application/json' } });
    const response = scheduler?.schedule ? await scheduler.schedule(priority, execute, signal) : await execute();
    emit('history_response', { route: url.pathname, status: response.status, headers_ms: performance.now()-began,
      cache: response.headers.get('X-UK-AQ-History-Cache'), pub_id: response.headers.get('X-UK-AQ-History-PubID'),
      source_id: response.headers.get('X-UK-AQ-History-Source'), compressed_bytes: Number(response.headers.get('X-UK-AQ-History-Compressed-Bytes')) || null,
      r2_reads: response.headers.get('X-UK-AQ-History-R2-Reads'), server_timing: response.headers.get('Server-Timing') });
    if (!response.ok) {
      const payload = await response.json().catch(() => null), error = new Error(payload?.error?.code || `history_http_${response.status}`);
      error.ukAqHttpStatus = response.status; throw error;
    }
    return response;
  }
  async function manifestFor(request, month, signal, force) {
    const key = `${base}|selection|${identityKey(request)}|${month}`, cached = storage.get(key);
    if (!force && cached && performance.now() < cached.expiresAt) { emit('history_selection_cache_hit', { month, pub_id: cached.value.pub_id }); return cached; }
    const began = performance.now(), response = await responseFor(urlFor('manifest',request,month), signal);
    check((Number(response.headers.get('Age')) || 0) === 0, 'history_selector_age_invalid');
    const value = validateManifest(await response.json(), request, month); abort(signal);
    const entry = { value, expiresAt: began + FRESHNESS_MS };
    check(performance.now() < entry.expiresAt, 'history_selection_expired');
    storage.set(key, entry, 16384); emit('history_selection', { month, pub_id: value.pub_id, source_id: value.source_id,
      algorithm_version: value.algorithm_version, source: value.source, completeness: value.completeness, authority: value.admission });
    return entry;
  }
  async function prepareLoad(entries, range, { signal, reason } = {}) {
    const months = monthsFor(range), next = new Map(); let expiry = Infinity;
    // Bounded by the existing request scheduler. Missing months remain explicit, not empty data.
    for (const entry of entries) for (const month of [...months].reverse()) {
      const key = `${identityKey(entry)}|${month}`;
      try {
        const selected = await manifestFor(entry, month, signal, reason === 'refresh' || reason === 'publication-check');
        next.set(key, { manifest: selected.value }); expiry = Math.min(expiry, selected.expiresAt);
      } catch (error) {
        if (error.ukAqHttpStatus !== 404) throw error;
        next.set(key, { unavailable: error.message }); expiry = Math.min(expiry, performance.now() + FRESHNESS_MS);
        emit('history_month_unavailable', { month, identity: physical(entry), error: error.message });
      }
    }
    for (const entry of entries) for (let i=1; i<months.length; i++) {
      const previous = next.get(`${identityKey(entry)}|${months[i-1]}`)?.manifest;
      const following = next.get(`${identityKey(entry)}|${months[i]}`)?.manifest;
      if (!previous || !following) continue;
      check(previous.source.terminal_manifest_hash === following.source.edge_day_proofs.first,
        'history_terminal_source_join_conflict');
      if ((entry.pollutant || entry.pollutant_code) !== 'no2')
        check(previous.source.edge_day_proofs.last === following.source.edge_day_proofs.context,
          'history_pm_context_join_conflict');
    }
    abort(signal); check(performance.now() < expiry, 'history_selection_expired');
    const key = [...next.entries()].map(([id,s]) => `${id}|${s.manifest ? versionKey(s.manifest) : s.unavailable}`).join(';');
    const changed = key !== preparedKey;
    selections = next; preparedKey = key; expiresAt = expiry;
    return { changed, context: Object.freeze({ owner: contextOwner, selections: new Map(next), expiresAt: expiry }) };
  }
  async function readProduct(m, kind, signal, priority) {
    const key = `${base}|object|${versionKey(m)}|${kind}`, cached = storage.get(key);
    if (cached) { emit('history_object_cache_hit', { kind, month: m.month_utc, pub_id: m.pub_id }); return cached; }
    const began = performance.now(), url = urlFor(kind, m.identity, m.month_utc, m);
    const response = await responseFor(url, signal, priority);
    const d = m.objects[kind];
    check(response.headers.get('X-UK-AQ-History-PubID') === m.pub_id && response.headers.get('X-UK-AQ-History-Source') === m.source_id
      && response.headers.get('X-UK-AQ-History-Algorithm') === m.algorithm_version
      && response.headers.get('X-UK-AQ-History-Object-SHA256') === d.sha256, 'history_transport_identity_invalid');
    const text = await response.text(), bytes = new TextEncoder().encode(text);
    check(bytes.length === d.json_byte_size && await digest(bytes) === d.json_sha256, 'history_decoded_digest_invalid');
    const value = validateProduct(JSON.parse(text), m, kind); abort(signal);
    storage.set(key, value, bytes.length);
    emit('history_body', { kind, month: m.month_utc, pub_id: m.pub_id, body_ms: performance.now()-began,
      decoded_bytes: bytes.length, compressed_bytes: d.byte_size, resource_timing: diagnostics.resourceTimingFor(url.href) });
    return value;
  }
  function product(m, kind, signal, priority) {
    if (!signal) return readProduct(m, kind, signal, priority);
    let active = activeTransports.get(signal);
    if (!active) { active = new Map(); activeTransports.set(signal, active); }
    const key = `${versionKey(m)}|${kind}`;
    if (active.has(key)) return active.get(key);
    const promise = readProduct(m, kind, signal, priority).finally(() => active.delete(key));
    active.set(key, promise);
    return promise;
  }
  async function load(rawRequest, rawParts, signal) {
    const request = calculated.normalizeRequest(rawRequest), parts = calculated.normalizeParts(request, rawParts);
    const r = domain.snapshotChartRange(request), months = monthsFor(r);
    // Direct client consumers get the same selection boundary as controller consumers.
    const supplied = rawRequest.data_client_context;
    let selectedSnapshot = supplied?.owner === contextOwner ? supplied.selections : new Map(selections);
    let snapshotExpiresAt = supplied?.owner === contextOwner ? supplied.expiresAt : expiresAt;
    if (supplied?.owner !== contextOwner && (!months.every(month => selectedSnapshot.has(`${identityKey(request)}|${month}`)) || performance.now() >= expiresAt)) {
      const prepared = await prepareLoad([request], r, { signal });
      selectedSnapshot = prepared.context.selections; snapshotExpiresAt = prepared.context.expiresAt;
    }
    const observationRows = [], terminalProofs = [], aqiRows = [], missing = [], obsErrors = [], aqiErrors = [], publications = [];
    const loadedObservationMonths = new Set();
    let observationComplete = true, aqiComplete = true;
    for (const month of months) {
      abort(signal);
      const selected = selectedSnapshot.get(`${identityKey(request)}|${month}`), m = selected?.manifest;
      if (!m) { missing.push(month); observationComplete = false; aqiComplete = false; continue; }
      publications.push({ month, pub_id: m.pub_id, source_id: m.source_id, algorithm_version: m.algorithm_version });
      const needsTerminal = parts.observations && request.start_utc <= m.interval.end_utc && request.end_utc >= m.interval.end_utc;
      const results = await Promise.allSettled([
        parts.observations ? product(m, 'observations', signal, rawParts?.priority) : null,
        parts.aqi || needsTerminal ? product(m, 'aqi', signal, rawParts?.priority) : null,
      ]); abort(signal);
      for (const result of results) if (result.status === 'rejected' && result.reason.ukAqHttpStatus === 409) throw result.reason;
      const obs = results[0].status === 'fulfilled' ? results[0].value : null;
      const aq = results[1].status === 'fulfilled' ? results[1].value : null;
      if (obs) loadedObservationMonths.add(month);
      if (parts.observations) {
        if (!obs) { observationComplete = false; obsErrors.push(results[0].reason?.message || 'history_observations_unavailable'); }
        else obs.observations.forEach((row, index) => {
          if (row[0] >= request.start_utc && row[0] <= request.end_utc) observationRows.push({
            ...m.identity, observed_at_utc: row[0], value: row[1], source_status: row[3], verification_status: row[4],
            embedded_verification_status: row[5], source_status_provenance: row[6],
            chart_observation_id: `${m.month_utc}:${m.pub_id}:${index}` });
        });
        // E is authenticated next timestamp-day input; never move it into raw [S,E) storage.
        if (needsTerminal) {
          if (aq) terminalProofs.push({ endpoint: m.interval.end_utc, rows: aq.terminal_source_inputs, month: m.month_utc, pub_id: m.pub_id });
          else { observationComplete = false; obsErrors.push('history_terminal_dependency_unavailable'); }
        }
      }
      if (parts.aqi) {
        if (!aq) { aqiComplete = false; aqiErrors.push(results[1].reason?.message || 'history_aqi_unavailable'); }
        else {
          aqiComplete &&= aq.aqi.response_complete === true;
          aqiRows.push(...aq.aqi.rows.filter(row => row.timestamp_hour_utc > request.start_utc && row.timestamp_hour_utc <= request.end_utc));
        }
      }
    }
    for (const proof of terminalProofs) {
      const nextMonth = proof.endpoint.slice(0,7);
      const following = selectedSnapshot.get(`${identityKey(request)}|${nextMonth}`)?.manifest;
      if (following && months.includes(nextMonth) && loadedObservationMonths.has(nextMonth)) {
        const original = observationRows.filter(row => row.observed_at_utc === proof.endpoint);
        const signature = row => JSON.stringify([row.value,row.station_id,row.source_status,row.verification_status,
          row.embedded_verification_status,row.source_status_provenance]);
        check(JSON.stringify(original.map(signature).sort()) === JSON.stringify(proof.rows.map(signature).sort()),
          'history_observation_boundary_conflict');
      } else proof.rows.forEach((row,index) => observationRows.push({ ...row, source: 'authenticated_terminal_dependency',
        chart_observation_id: `${proof.month}:${proof.pub_id}:terminal:${index}` }));
    }
    observationRows.sort((a,b) => a.observed_at_utc.localeCompare(b.observed_at_utc));
    aqiRows.sort((a,b) => a.timestamp_hour_utc.localeCompare(b.timestamp_hour_utc));
    check(new Set(aqiRows.map(row => row.timestamp_hour_utc)).size === aqiRows.length, 'history_aqi_join_conflict');
    const gapRanges = missing.map(month => ({ ...bounds(month), reason: 'history_month_unavailable' }));
    const indexSummary = index => ({ evaluated_complete: aqiComplete && aqiRows.every(row => ['ok','missing_input','insufficient_samples'].includes(row[`${index}_calculation_status`])),
      available_endpoint_count: aqiRows.filter(row => row[`${index}_calculation_status`] === 'ok').length,
      unavailable_endpoint_count: aqiRows.filter(row => row[`${index}_calculation_status`] !== 'ok').length });
    const payload = { schema_version: 2, identity: physical(request), request, publications,
      observations: { enabled: parts.observations, rows: observationRows, response_complete: observationComplete,
        has_gap: missing.length > 0, gap_ranges: gapRanges, partial_reasons: [...missing.map(m => `missing_month:${m}`), ...obsErrors],
        ...(obsErrors.length ? { error: obsErrors[0] } : {}) },
      aqi: { enabled: parts.aqi, rows: aqiRows, algorithm_version: ALGORITHM, publication_source: 'precomputed_compressed_json',
        calculation_source: 'calculated_from_observations', response_complete: aqiComplete, has_gap: missing.length > 0,
        gap_ranges: gapRanges, partial_reasons: [...missing.map(m => `missing_month:${m}`), ...aqiErrors],
        completeness: { daqi: indexSummary('daqi'), eaqi: indexSummary('eaqi') },
        ...(aqiErrors.length || missing.length ? { error: aqiErrors[0] || 'history_month_unavailable', malformed: true } : {}) } };
    emit('history_range_settled', { publications, missing_months: missing, observation_complete: observationComplete,
      aqi_complete: aqiComplete, daqi: payload.aqi.completeness.daqi, eaqi: payload.aqi.completeness.eaqi, errors: [...obsErrors,...aqiErrors] });
    check(performance.now() < snapshotExpiresAt, 'history_selection_expired');
    const normalizeStarted = performance.now();
    const result = Object.freeze({ ...calculated.normalizeResult(payload, request, parts, 'current'), source: 'historical-json' });
    emit('history_normalization', { normalization_ms: performance.now()-normalizeStarted });
    return result;
  }
  return Object.freeze({ kind: 'historical-json', prepareLoad,
    cacheIdentity(entry, _range, context) { return [...(context?.owner === contextOwner ? context.selections : selections).entries()].filter(([key]) => key.startsWith(`${identityKey(entry)}|`))
      .map(([key,s]) => s.manifest ? versionKey(s.manifest) : `${key}|unavailable`).join(';') || 'unselected'; },
    selectionExpiresAt(context) { return context?.owner === contextOwner ? context.expiresAt : expiresAt; },
    async loadCurrent(request, parts, signal) {
      const normalized = calculated.normalizeRequest(request), months = monthsFor(normalized);
      const start = normalized.start_utc > bounds(months.at(-1)).start_utc ? normalized.start_utc : bounds(months.at(-1)).start_utc;
      const result = await load({ ...request, start_utc: start }, parts, signal);
      const head = section => ({ ...section, stable_head_start_utc: start, stable_head_end_utc: normalized.end_utc,
        ...(start > normalized.start_utc ? { next_chunk_end_utc: start } : {}) });
      return Object.freeze({ ...result, request: normalized, observations: head(result.observations), aqi: head(result.aqi) });
    },
    loadOlder: load,
    prefetchAqi(request, signal) { return load(request, { observations: false, aqi: true, priority: 2 }, signal); },
  });
}
export default { createHistoricalJsonClient };
