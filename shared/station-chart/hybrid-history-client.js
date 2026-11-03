// Optional closed-month provider. The shared controller still owns work planning and settlement.
import domain from './station-chart-domain-module.js';
import calculated from './station-history-client-module.js';
import { createHistoricalJsonClient, historyMonthsFor, historyMonthBounds, HISTORY_JSON_ALGORITHM } from './historical-json-client.js';

const HOUR = 3600000;
const check = (ok, code) => { if (!ok) throw new Error(code); };
const abort = signal => signal?.throwIfAborted();
const id = r => [r.connector_id, r.station_id, r.timeseries_id, r.pollutant || r.pollutant_code].join(':');
const timestamp = row => row.observed_at_utc || row.observed_at;
const metadata = section => Object.fromEntries(Object.entries(section || {}).filter(([key]) => !['rows','points'].includes(key)));
const cursor = section => section.next_chunk_end_utc || section.next_older_observation_chunk_end_utc
  || section.next_older_aqi_chunk_end_utc || section.next_older_chunk_end_utc;
const overlap = (a, b) => a.start_utc < b.end_utc && b.start_utc < a.end_utc;
function requestIdentity(raw) {
  const r = calculated.normalizeRequest({ ...raw, station_id: Number(raw.station_id), pollutant: raw.pollutant || raw.pollutant_code });
  check(Number.isSafeInteger(r.station_id) && r.station_id > 0, 'hybrid_physical_identity_missing');
  historyMonthsFor(r);
  return r;
}

export function createHybridHistoryClient(options = {}) {
  check(!options.sourceGeneration || options.sourceGeneration === 'v3', 'hybrid_source_generation_incompatible');
  const emit = (type, details = {}) => options.onDiagnostic?.({ type, ...details });
  const transport = new WeakMap(), contexts = new WeakMap();
  const json = createHistoricalJsonClient({ ...options, unpublishedMonthFallback: true });
  // Delegate all calculated transport, including PM context, to the established client.
  const normal = calculated.createCalculatedStationHistoryClient({ ...options,
    onResponse(detail) {
      transport.set(detail.payload, { history_tags: detail.response.headers.get('X-UK-AQ-History-Cache-Tags') });
      options.onResponse?.(detail);
    },
  });
  let latest = null, previousKey = '', previousDecisions = new Map();

  function sourceKey(entry, month, context) {
    const selected = json.selectionFor(entry, month, context.json);
    return selected.manifest
      ? `${month}|json|${json.selectionCacheIdentity(entry, month, context.json)}`
      : `${id(entry)}|${month}|calculated_fallback_missing_json|expected-generation:v3|${HISTORY_JSON_ALGORITHM}`;
  }
  async function prepareLoad(entries, range, { signal, reason } = {}) {
    const began = performance.now(), months = historyMonthsFor(range);
    const identities = entries.map(entry => requestIdentity({ ...entry, start_utc: range.start_utc || range.startIso,
      end_utc: range.end_utc || range.endIso }));
    const prepared = await json.prepareLoad(identities, range, { signal, reason });
    abort(signal);
    const state = { json: prepared.context, months, range: domain.snapshotChartRange(range),
      identities, seams: new Map(), observations: new Map(), observationScopes: new Map(), aqi: new Map() };
    const decisions = new Map();
    for (const entry of identities) {
      const seams = [];
      for (const [index, month] of months.entries()) {
        const selected = json.selectionFor(entry, month, state.json);
        check(selected?.manifest || selected?.unavailable === 'history_month_unavailable', 'hybrid_selection_invalid');
        if (selected.manifest) check(typeof selected.manifest.completeness?.observations === 'boolean'
          && ['daqi','eaqi'].every(index => typeof selected.manifest.completeness?.[index]?.evaluated_complete === 'boolean'),
        'hybrid_selection_completeness_invalid');
        const decisionKey = `${id(entry)}|${month}`, previous = previousDecisions.get(decisionKey);
        const decision = { source: selected.manifest ? 'historical_json' : 'calculated_fallback_missing_json',
          pub_id: selected.manifest?.pub_id || null, source_id: selected.manifest?.source_id || null };
        decisions.set(decisionKey, decision);
        if (previous && JSON.stringify(previous) !== JSON.stringify(decision))
          emit('hybrid_publication_changed', { identity: entry, month, reason, previous, selected: decision });
        emit('hybrid_month_selected', { identity: entry, month,
          source: selected.manifest ? 'historical_json' : 'calculated_fallback_missing_json',
          reason: selected.unavailable || null, pub_id: selected.manifest?.pub_id,
          source_id: selected.manifest?.source_id, algorithm_version: selected.manifest?.algorithm_version || HISTORY_JSON_ALGORITHM });
        if (index && Boolean(selected.manifest) !== Boolean(json.selectionFor(entry, months[index-1], state.json).manifest)) {
          const boundary = historyMonthBounds(month).start_utc;
          seams.push(boundary);
          // Calculated API does not expose the JSON edge-day/status-provenance proofs.
          // Do not certify that join from equal browser values alone.
          emit('hybrid_boundary_incomplete', { identity: entry, boundary,
            reason: 'hybrid_boundary_authority_unavailable', pm_context_hours: entry.pollutant === 'no2' ? 0 : 23 });
        }
      }
      state.seams.set(id(entry), seams);
    }
    const key = identities.flatMap(entry => months.map(month => sourceKey(entry, month, state))).join(';');
    const changed = key !== previousKey;
    emit('hybrid_selection_settled', { reason, changed, previous_identity: previousKey || null,
      cache_identity: key, selection_ms: performance.now()-began, expires_at_ms: json.selectionExpiresAt(state.json) });
    previousKey = key;
    previousDecisions = decisions;
    const context = Object.freeze({}); contexts.set(context, state); latest = context;
    return { changed, context };
  }
  function assertFresh(state, signal) {
    abort(signal);
    check(performance.now() < json.selectionExpiresAt(state.json), 'history_selection_expired');
  }
  async function contextFor(request, signal) {
    let context = request.data_client_context || latest, state = contexts.get(context);
    if (request.data_client_context) check(state, 'hybrid_selection_context_invalid');
    if (!state || (!request.data_client_context && (performance.now() >= json.selectionExpiresAt(state.json)
      || !state.identities.some(entry => id(entry) === id(request))
      || !historyMonthsFor(request).every(month => state.months.includes(month))))) {
      context = (await prepareLoad([request], request, { signal })).context; state = contexts.get(context);
    }
    assertFresh(state, signal);
    check(state.identities.some(entry => id(entry) === id(request)), 'hybrid_selection_identity_invalid');
    check(historyMonthsFor(request).every(month => state.months.includes(month)), 'hybrid_selection_range_invalid');
    return state;
  }

  // This ledger detects inconsistent overlapping response boundaries in one load. It is
  // not a reusable data cache; rendered/cached points remain owned by the shared cache.
  function verifyObservations(rows, request, state, scope, complete, terminalDependencies = []) {
    const groups = new Map();
    for (const row of rows) {
      check(id(row) === id(request), 'hybrid_observation_physical_conflict');
      const time = timestamp(row);
      check(Number.isFinite(Date.parse(time)) && Number.isFinite(row.value), 'hybrid_observation_invalid');
      if (!groups.has(time)) groups.set(time, []);
      groups.get(time).push(row);
    }
    for (const proof of terminalDependencies) {
      if (proof.endpoint >= scope.start_utc && proof.endpoint <= scope.end_utc && !groups.has(proof.endpoint)) groups.set(proof.endpoint, []);
    }
    const scopes = state.observationScopes.get(id(request)) || [];
    for (const previous of scopes) if (previous.complete) {
      for (const [time, values] of groups) if (values.length && time >= previous.start_utc && time <= previous.end_utc)
        check(previous.times.has(time), 'hybrid_observation_absence_conflict');
    }
    if (complete) for (const [key, values] of state.observations) {
      if (!key.startsWith(`${id(request)}|`)) continue;
      const time = key.slice(id(request).length+1);
      if (values.length && time >= scope.start_utc && time <= scope.end_utc)
        check(groups.has(time) && groups.get(time).length > 0, 'hybrid_observation_absence_conflict');
    }
    for (const [time, values] of groups) {
      const key = `${id(request)}|${time}`, previous = state.observations.get(key);
      const signatures = rows => rows.map(row => JSON.stringify([row.value, row.station_id, row.timeseries_id])).sort();
      if (previous) {
        check(JSON.stringify(signatures(previous)) === JSON.stringify(signatures(values)), 'hybrid_observation_boundary_conflict');
        for (const field of ['source_status','verification_status','embedded_verification_status','source_status_provenance']) {
          if (previous.every(row => Object.hasOwn(row, field)) && values.every(row => Object.hasOwn(row, field))) {
            const signature = rows => rows.map(row => JSON.stringify([row.value,row[field]])).sort();
            check(JSON.stringify(signature(previous)) === JSON.stringify(signature(values)), 'hybrid_provenance_boundary_conflict');
          }
        }
      } else state.observations.set(key, values);
    }
    scopes.push({ ...scope, complete, times: new Set([...groups].filter(([,rows]) => rows.length).map(([time]) => time)) });
    state.observationScopes.set(id(request), scopes);
  }
  function verifyAqi(rows, request, state) {
    for (const row of rows) {
      check(id(row) === id(request) && row.algorithm_version === HISTORY_JSON_ALGORITHM, 'hybrid_aqi_identity_or_algorithm_conflict');
      const key = `${id(request)}|${row.timestamp_hour_utc}`;
      const signature = JSON.stringify(Object.keys(row).filter(key => /^(daqi_|eaqi_|period_|timestamp_|algorithm_version)/.test(key))
        .sort().map(key => [key,row[key]]));
      check(!state.aqi.has(key) || state.aqi.get(key) === signature, 'hybrid_aqi_boundary_conflict');
      state.aqi.set(key, signature);
    }
  }
  function incomplete(section, interval, reason) {
    section.response_complete = false;
    section.partial_reasons = [...(section.partial_reasons || []), reason];
    section.gap_ranges = [...(section.gap_ranges || []), { ...interval, reason }];
  }
  function adapt(result, request, parts, state, interval, month, mode) {
    check(result.identity_valid && id(result.identity) === id(request), 'hybrid_authoritative_identity_conflict');
    const selected = json.selectionFor(request, month, state.json), isJson = Boolean(selected.manifest);
    check(!result.raw?.continuity?.enabled, 'hybrid_continuity_authority_unsupported');
    if (parts.aqi) check(result.aqi.algorithm_version === HISTORY_JSON_ALGORITHM
      && result.aqi.calculation_source === 'calculated_from_observations', 'hybrid_algorithm_incompatible');
    const sections = {};
    for (const kind of ['observations','aqi']) {
      if (!parts[kind]) { sections[kind] = { enabled: false, rows: [] }; continue; }
      const original = result[kind];
      check(original?.enabled === true && Array.isArray(original.rows), 'hybrid_section_invalid');
      if (original.error) emit('hybrid_fallback_rejected', { month, kind,
        selected_source: isJson ? 'historical_json' : 'calculated_fallback_missing_json', error: original.error,
        reason: 'selected_source_failure_is_not_unpublished_month' });
      const start = mode === 'current' ? original.stable_head_start_utc || interval.start_utc : interval.start_utc;
      const end = mode === 'current' ? original.stable_head_end_utc || interval.end_utc : interval.end_utc;
      check(start >= interval.start_utc && start < end && end === interval.end_utc, 'hybrid_stable_head_bounds_invalid');
      check(original.rows.every(row => {
        const time = kind === 'aqi' ? row.timestamp_hour_utc : timestamp(row);
        return id(row) === id(request) && Number.isFinite(Date.parse(time))
          && (kind === 'aqi' ? time > start : time >= start) && time <= end;
      }), 'hybrid_row_identity_or_bounds_invalid');
      const section = { ...original, gap_ranges: [...(original.gap_ranges || [])],
        upstream_response_complete: result.raw?.response_complete,
        upstream_partial_reasons: result.raw?.partial_reasons || [], source_diagnostics: result.raw?.source,
        partial_reasons: [...(original.partial_reasons || [])], rows: original.rows.filter(row => {
          const time = kind === 'aqi' ? row.timestamp_hour_utc : timestamp(row);
          return kind === 'aqi' ? time > start && time <= end : time >= start && time <= end;
        }) };
      const provisional = !isJson && (result.raw?.observations?.source_counts?.ingest || 0) > 0;
      const publicationIncomplete = isJson && (kind === 'observations' ? selected.manifest.completeness.observations !== true
        : ['daqi','eaqi'].some(index => selected.manifest.completeness[index].evaluated_complete !== true));
      if (publicationIncomplete) {
        section.response_complete = false; section.partial_reasons.push('hybrid_selected_publication_incomplete');
      }
      const upstreamIncomplete = !isJson && (provisional || (result.raw?.response_complete === false
        && ['observations','aqi'].filter(kind => parts[kind]).every(kind => result[kind]?.response_complete === true)));
      if (upstreamIncomplete) {
        section.response_complete = false;
        section.partial_reasons.push(...(result.raw?.partial_reasons || []),
          provisional ? 'unpublished_ingest_history' : 'hybrid_upstream_incomplete');
      }
      if (kind === 'observations') {
        verifyObservations(section.rows, request, state, { start_utc: start, end_utc: end },
          original.response_complete === true, result.raw?.terminal_dependencies);
        const counts = new Map();
        section.rows = section.rows.filter(row => timestamp(row) < end || end === state.range.endIso).map(row => {
          const time = timestamp(row), key = JSON.stringify([time,row.value,row.station_id,row.timeseries_id]);
          const occurrence = counts.get(key) || 0; counts.set(key, occurrence+1);
          return { ...row, chart_observation_id: `${key}|${occurrence}`,
            ...(time === end ? { hybrid_observation_role: 'terminal_dependency' } : {}) };
        });
      } else {
        verifyAqi(section.rows, request, state);
        section.rows = [...new Map(section.rows.map(row => [row.timestamp_hour_utc,row])).values()];
      }
      let generationUnverified = false;
      if (!isJson) {
        // Expected generation is configuration, not observed proof. Missing public
        // dependency tags must remain explicitly incomplete rather than guessed.
        const tags = transport.get(result.raw)?.history_tags;
        section.history_dependency_tags = tags || null;
        const dependencies = [...String(tags || '').matchAll(/(?:^|,)[^,]*history-(v[23])-ts-(\d+)(?=,|$)/g)];
        const expected = options.sourceGeneration || 'v3';
        if (dependencies.length) check(dependencies.every(match => match[1] === expected && Number(match[2]) === request.timeseries_id), 'hybrid_source_generation_conflict');
        generationUnverified = !dependencies.length;
        if (generationUnverified) incomplete(section, { start_utc: start, end_utc: end }, 'hybrid_calculated_generation_unverified');
      }
      const affected = [];
      for (const boundary of state.seams.get(id(request)) || []) {
        const interval = kind === 'observations'
          ? { start_utc: new Date(Date.parse(boundary)-1).toISOString(), end_utc: new Date(Date.parse(boundary)+1).toISOString() }
          : { start_utc: new Date(Date.parse(boundary)-HOUR).toISOString(),
            end_utc: new Date(Date.parse(boundary)+(request.pollutant === 'no2' ? 0 : 23*HOUR)).toISOString() };
        if (overlap({ start_utc: start, end_utc: end }, interval)) {
          const clipped = { start_utc: start > interval.start_utc ? start : interval.start_utc,
            end_utc: end < interval.end_utc ? end : interval.end_utc };
          incomplete(section, clipped, 'hybrid_boundary_authority_unavailable'); affected.push(clipped);
        }
      }
      if (kind === 'aqi') {
        section.completeness = Object.fromEntries(['daqi','eaqi'].map(index => [index, {
          ...original.completeness?.[index],
          evaluated_complete: (original.completeness?.[index]?.evaluated_complete ?? original.response_complete) === true
            && (!isJson || selected.manifest.completeness[index].evaluated_complete === true)
            && !generationUnverified && !upstreamIncomplete && !(state.seams.get(id(request)) || []).some(boundary => overlap(
              { start_utc: start, end_utc: end }, { start_utc: new Date(Date.parse(boundary)-HOUR).toISOString(),
                end_utc: new Date(Date.parse(boundary)+(index === 'daqi' && request.pollutant !== 'no2' ? 23*HOUR : 0)).toISOString() })),
          available_endpoint_count: section.rows.filter(row => row[`${index}_calculation_status`] === 'ok').length,
          unavailable_endpoint_count: section.rows.filter(row => row[`${index}_calculation_status`] !== 'ok').length,
        }]));
      }
      sections[kind] = { ...section, points: undefined, stable_head_start_utc: start, stable_head_end_utc: end };
      emit('hybrid_interval_settled', { month, source: isJson ? 'historical_json' : 'calculated_fallback_missing_json',
        kind, start_utc: start, end_utc: end, pub_id: selected.manifest?.pub_id, row_count: section.rows.length,
        response_complete: section.response_complete, has_gap: section.has_gap, gap_ranges: section.gap_ranges,
        partial_reasons: section.partial_reasons, upstream_partial_reasons: section.upstream_partial_reasons,
        history_dependency_tags: section.history_dependency_tags, source_diagnostics: section.source_diagnostics,
        completeness: section.completeness, boundary_incomplete_intervals: affected });
    }
    return { ...result, ...sections };
  }
  async function read(request, parts, signal, state, interval, month, mode) {
    assertFresh(state, signal);
    const selected = json.selectionFor(request, month, state.json), began = performance.now();
    const source = selected.manifest ? 'historical_json' : 'calculated_fallback_missing_json';
    const bounded = { ...request, ...interval, data_client_context: state.json };
    try {
      const result = selected.manifest
        ? await (mode === 'current' ? json.loadCurrent(bounded, parts, signal) : json.loadRange(bounded, parts, signal))
        : await (mode === 'current' ? normal.loadCurrent(bounded, parts, signal) : normal.loadOlder(bounded, parts, signal));
      assertFresh(state, signal);
      return adapt(result, request, parts, state, interval, month, mode);
    } catch (error) {
      emit('hybrid_interval_failed', { month, source, ...interval, error: error.message,
        status: error.ukAqHttpStatus, code: error.ukAqContractCode, fallback_rejected: true }); throw error;
    } finally { emit('hybrid_source_timing', { month, source, mode, ...interval, settlement_ms: performance.now()-began }); }
  }
  function combine(results, request, parts, mode) {
    const sections = {};
    for (const kind of ['observations','aqi']) {
      const items = results.map(result => result[kind]);
      sections[kind] = { enabled: parts[kind], rows: items.flatMap(section => section.rows || []),
        response_complete: items.every(section => section.response_complete === true),
        has_gap: items.some(section => section.has_gap === true), malformed: items.some(section => section.malformed === true),
        gap_ranges: items.flatMap(section => section.gap_ranges || []), partial_reasons: items.flatMap(section => section.partial_reasons || []),
        ...(items.some(section => section.error) ? { error: items.find(section => section.error).error } : {}),
        interval_diagnostics: items.map(metadata),
      };
      if (kind === 'aqi') Object.assign(sections[kind], { algorithm_version: HISTORY_JSON_ALGORITHM,
        calculation_source: 'calculated_from_observations', publication_source: 'hybrid_json_first',
        completeness: Object.fromEntries(['daqi','eaqi'].map(index => [index, {
          evaluated_complete: items.every(section => section.completeness?.[index]?.evaluated_complete === true),
          available_endpoint_count: items.reduce((sum, section) => sum+(section.completeness?.[index]?.available_endpoint_count || 0), 0),
          unavailable_endpoint_count: items.reduce((sum, section) => sum+(section.completeness?.[index]?.unavailable_endpoint_count || 0), 0),
        }])),
      });
    }
    const payload = { schema_version: 2, identity: request, ...sections,
      source: { mode: 'hybrid_json_first' }, guideline: results.find(result => result.raw?.guideline)?.raw.guideline };
    return Object.freeze({ ...calculated.normalizeResult(payload, request, parts, mode), source: 'hybrid-json-first' });
  }
  async function loadCurrent(rawRequest, rawParts, signal) {
    const request = requestIdentity(rawRequest), parts = calculated.normalizeParts(request, rawParts);
    const state = await contextFor(request, signal), month = historyMonthsFor(request).at(-1);
    const start = historyMonthBounds(month).start_utc;
    const interval = { start_utc: request.start_utc > start ? request.start_utc : start, end_utc: request.end_utc };
    const result = await read(request, { ...parts, priority: rawParts?.priority }, signal, state, interval, month, 'current');
    const combined = combine([result], request, parts, 'current'), heads = {};
    for (const kind of ['observations','aqi']) {
      const section = result[kind], headStart = section.stable_head_start_utc || interval.start_utc;
      const next = cursor(section) || (headStart > request.start_utc ? headStart : null);
      check(!next || (next === headStart && next > request.start_utc && next <= interval.end_utc), 'hybrid_cursor_invalid');
      heads[kind] = Object.freeze({ ...combined[kind], stable_head_start_utc: headStart,
        stable_head_end_utc: section.stable_head_end_utc || interval.end_utc, next_chunk_end_utc: next });
    }
    return Object.freeze({ ...combined, ...heads });
  }
  async function loadOlder(rawRequest, rawParts, signal) {
    const request = requestIdentity(rawRequest), parts = calculated.normalizeParts(request, rawParts);
    const state = await contextFor(request, signal), results = [];
    for (const month of historyMonthsFor(request)) {
      const bounds = historyMonthBounds(month), interval = {
        start_utc: request.start_utc > bounds.start_utc ? request.start_utc : bounds.start_utc,
        end_utc: request.end_utc < bounds.end_utc ? request.end_utc : bounds.end_utc,
      };
      // A caller's stable head is never moved to make a calculated request fit.
      check(request.stable_head_start_utc && interval.end_utc <= request.stable_head_start_utc, 'hybrid_older_overlaps_stable_head');
      results.push(await read(request, { ...parts, priority: rawParts?.priority }, signal, state, interval, month, 'older'));
    }
    return combine(results, request, parts, 'older');
  }
  return Object.freeze({ kind: 'hybrid-json-first', prepareLoad, loadCurrent, loadOlder,
    cacheIdentity(entry, _range, context = latest) {
      const state = contexts.get(context); return state ? state.months.map(month => sourceKey(entry, month, state)).join(';') : 'unselected';
    },
    selectionExpiresAt(context = latest) { const state = contexts.get(context); return state ? json.selectionExpiresAt(state.json) : 0; },
    prefetchAqi(request, signal) { return loadCurrent(request, { observations: false, aqi: true, priority: 2 }, signal); },
  });
}
export default { createHybridHistoryClient };
