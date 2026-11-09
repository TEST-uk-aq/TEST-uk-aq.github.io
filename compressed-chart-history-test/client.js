// Data-source adapter only. Shared chart/calculation/normalisation owners stay canonical.
import { calculatedClient } from "../shared/station-chart/station-chart-runtime.js";
const DIGEST = /^[0-9a-f]{64}$/, HOUR = 3_600_000;
const abortError = () => new DOMException("Obsolete chart request", "AbortError");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sameIdentity = (left, right) => ["connector_id", "station_id", "timeseries_id", "pollutant_code"].every(key => left?.[key] === right?.[key]);
function endpoint(base, route, query = {}) {
  const url = new URL(`${base}/chart-history-prototype/${route}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}
async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function readBody(response, maxBytes) {
  assert(response.body, "prototype_response_body_missing");
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      assert(bytes <= maxBytes, "prototype_decoded_byte_budget");
      chunks.push(chunk.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const raw = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  return raw;
}
export async function fetchPrototypeJson({ base, route, query, environment, fetchApi, signal, record, expected = null, maxBytes = 64 * 1024 }) {
  const requestId = crypto.randomUUID(), started = performance.now();
  let response;
  try {
    response = await fetchApi(endpoint(base, route, query), { credentials: "include", cache: "no-store", signal,
      headers: { Accept: "application/json", "X-UK-AQ-Prototype-Request-ID": requestId } });
  } catch (error) {
    record({ type: "request_failure", route, request_id: requestId, status: null,
      elapsed_ms: performance.now() - started, aborted: error.name === "AbortError" });
    throw error;
  }
  const headersAt = performance.now();
  if (!response.ok) {
    record({ type: "request_failure", route, request_id: requestId, status: response.status, elapsed_ms: headersAt - started });
    await response.body?.cancel();
    throw new Error(`prototype_http_${response.status}`);
  }
  assert(response.headers.get("X-UK-AQ-Prototype-Environment") === environment, "prototype_environment_mismatch");
  const raw = await readBody(response, maxBytes), transferredAt = performance.now();
  if (signal?.aborted) throw abortError();
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)), parsedAt = performance.now();
  if (expected) {
    assert(raw.byteLength === expected.json_byte_size && await digest(raw) === expected.json_sha256, "prototype_decoded_identity_mismatch");
    assert(response.headers.get("X-UK-AQ-Prototype-Object-SHA256") === expected.sha256, "prototype_compressed_identity_mismatch");
  }
  record({ type: "request", route, request_id: response.headers.get("X-UK-AQ-Prototype-Request-ID") || requestId,
    status: response.status, response_ms: headersAt - started, body_ms: transferredAt - headersAt,
    parse_ms: parsedAt - transferredAt, identity_check_ms: performance.now() - parsedAt, decoded_bytes: raw.byteLength,
    compressed_bytes: Number(response.headers.get("X-UK-AQ-Prototype-Compressed-Bytes")) || null,
    r2_operations: Number(response.headers.get("X-UK-AQ-Prototype-R2-Reads")) || null,
    publication: response.headers.get("X-UK-AQ-Prototype-Publication"), cache: response.headers.get("X-UK-AQ-Prototype-Cache"),
    aqi_source: response.headers.get("X-UK-AQ-Prototype-AQI-Source"), worker_cpu_ms: null });
  return { payload, response, bytes: raw.byteLength };
}
export async function loadCatalog(options) {
  const { payload } = await fetchPrototypeJson({ ...options, route: "manifest", query: {} });
  assert(payload.schema_version === 2 && payload.kind === "uk_aq_compressed_chart_catalog"
    && payload.environment === options.environment && payload.source_generation === "v3"
    && payload.source_mode === "exploratory_canonical_source_as_read" && DIGEST.test(payload.config_sha256)
    && Array.isArray(payload.samples) && payload.samples.length > 0 && payload.samples.length <= 6, "prototype_catalog_invalid");
  assert(new Set(payload.samples.map(sample => sample.id)).size === payload.samples.length, "prototype_duplicate_sample");
  for (const sample of payload.samples) {
    assert(sample.identity && [sample.identity.connector_id, sample.identity.station_id, sample.identity.timeseries_id].every(value => Number.isSafeInteger(value) && value > 0)
      && ["pm25", "pm10", "no2"].includes(sample.identity.pollutant_code) && typeof sample.station_label === "string"
      && (sample.publication_sha256 === null || DIGEST.test(sample.publication_sha256))
      && Array.isArray(sample.views) && sample.views.length > 0 && sample.views.length <= 8
      && sample.views.every(view => Number.isFinite(Date.parse(view.start_utc)) && Date.parse(view.end_utc) > Date.parse(view.start_utc)
        && view.start_utc >= sample.start_utc && view.end_utc <= sample.end_utc), "prototype_sample_config_invalid");
  }
  return payload;
}
// Bounded transport-object reuse, not a second chart cache. Concurrent daily
// requests share one fetch/decode; aborting one consumer cannot cancel another.
export function createPublicationStore(record) {
  const entries = new Map();
  let retainedBytes = 0;
  function remove(key, entry) {
    if (entries.get(key) !== entry) return;
    entries.delete(key);
    if (entry.settled) retainedBytes -= entry.bytes || 0;
  }
  function trim() {
    for (const [key, entry] of entries) {
      if (entries.size <= 20 && retainedBytes <= 64 * 1024 ** 2) break;
      if (entry.settled && entry.consumers.size === 0) remove(key, entry);
    }
    assert(entries.size <= 26, "prototype_inflight_object_budget");
  }
  function get(key, loader, signal) {
    if (signal?.aborted) return Promise.reject(abortError());
    let entry = entries.get(key);
    if (!entry) {
      trim();
      assert(entries.size < 26, "prototype_inflight_object_budget");
      entry = { controller: new AbortController(), consumers: new Set(), settled: false, bytes: 0 };
      entries.set(key, entry);
      entry.promise = Promise.resolve().then(() => loader(entry.controller.signal)).then(result => {
        entry.settled = true; entry.bytes = result.bytes;
        if (entries.get(key) === entry) retainedBytes += entry.bytes;
        trim(); return result.payload;
      }, error => { remove(key, entry); throw error; });
    } else {
      entries.delete(key); entries.set(key, entry);
      record({ type: "transport_object_reuse", key, state: entry.settled ? "decoded" : "in_flight" });
    }
    trim();
    const token = {};
    entry.consumers.add(token);
    return new Promise((resolve, reject) => {
      let finished = false;
      const release = () => {
        entry.consumers.delete(token); signal?.removeEventListener("abort", aborted);
        if (!entry.settled && entry.consumers.size === 0) { entry.controller.abort(); remove(key, entry); }
        trim();
      };
      const aborted = () => { if (finished) return; finished = true; release(); reject(abortError()); };
      signal?.addEventListener("abort", aborted, { once: true });
      entry.promise.then(value => { if (finished) return; finished = true; release(); resolve(value); },
        error => { if (finished) return; finished = true; release(); reject(error); });
    });
  }
  return { get, clear() { for (const entry of entries.values()) entry.controller.abort(); entries.clear(); retainedBytes = 0; } };
}
export function createJsonHistoryClient({ base, catalog, environment, fetchApi, record, store }) {
  const manifestOptions = sample => ({ base, environment, fetchApi, record, route: "manifest", query: { sample: sample.id } });
  async function publicationFor(sample, signal) {
    const key = `${catalog.config_sha256}:${sample.id}:${sample.publication_sha256}:manifest`;
    const publication = await store.get(key, async innerSignal => {
      const result = await fetchPrototypeJson({ ...manifestOptions(sample), signal: innerSignal });
      const value = result.payload;
      assert(value.schema_version === 3 && value.kind === "uk_aq_compressed_chart_publication"
        && value.publication_state === "published_complete" && value.environment === environment
        && value.config_sha256 === catalog.config_sha256 && value.publication_sha256 === sample.publication_sha256
        && value.source_generation === catalog.source_generation && value.source_mode === catalog.source_mode
        && value.managed_publication_eligible === false && value.aqi_source === "precomputed_compressed_json"
        && value.algorithm?.version === catalog.algorithm_version && sameIdentity(value.identity, sample.identity)
        && Array.isArray(value.pairs) && value.pairs.length > 0 && value.pairs.length <= 5, "prototype_publication_invalid");
      let cursor = sample.start_utc;
      for (const pair of value.pairs) {
        assert(pair.start_utc === cursor && Date.parse(pair.end_exclusive_utc) > Date.parse(pair.start_utc)
          && pair.publication_id === value.publication_id && pair.source_evidence_sha256 === value.evidence?.sha256
          && pair.source_complete === true && pair.context_complete === true, "prototype_pair_spine_invalid");
        for (const part of ["observations", "aqi"]) assert(DIGEST.test(pair[part]?.sha256) && DIGEST.test(pair[part]?.json_sha256)
          && pair[part].json_byte_size > 0 && pair[part].json_byte_size <= 16 * 1024 ** 2
          && pair[part].byte_size > 0 && pair[part].byte_size <= 2 * 1024 ** 2, "prototype_pair_descriptor_invalid");
        assert(pair.aqi.response_complete === true, "prototype_aqi_source_incomplete");
        cursor = pair.end_exclusive_utc;
      }
      assert(Date.parse(cursor) === Date.parse(sample.end_utc) + 1, "prototype_terminal_coverage_missing");
      assert(result.response.headers.get("X-UK-AQ-Prototype-Publication") === sample.publication_sha256, "prototype_publication_changed");
      return result;
    }, signal);
    return publication;
  }
  async function payloadFor(sample, publication, pair, part, signal) {
    const key = `${environment}:${catalog.config_sha256}:${sample.id}:${sample.publication_sha256}:${pair.month_utc}:${part}`;
    return store.get(key, async innerSignal => {
      const result = await fetchPrototypeJson({ base, environment, fetchApi, record, signal: innerSignal,
        route: part === "aqi" ? "aqi" : "month", query: { sample: sample.id, publication: sample.publication_sha256, month_utc: pair.month_utc },
        expected: pair[part], maxBytes: 16 * 1024 ** 2 });
      const value = result.payload;
      assert(result.response.headers.get("X-UK-AQ-Prototype-Publication") === sample.publication_sha256
        && result.response.headers.get("X-UK-AQ-Prototype-AQI-Source") === "precomputed_compressed_json"
        && value.schema_version === 2 && value.publication_id === publication.publication_id
        && value.config_sha256 === catalog.config_sha256 && value.source_mode === catalog.source_mode
        && value.environment === environment && value.managed_publication_eligible === false
        && sameIdentity(value.identity, sample.identity) && value.source?.source_evidence?.sha256 === publication.evidence.sha256
        && JSON.stringify(value.algorithm) === JSON.stringify(publication.algorithm)
        && value.coverage?.requested_start_utc === pair.start_utc && value.coverage.requested_end_exclusive_utc === pair.end_exclusive_utc
        && value.coverage.complete === true, "prototype_payload_identity_conflict");
      assert(part === "aqi" ? value.kind === "uk_aq_compressed_chart_aqi_month" && value.aqi?.response_complete === true
        && Array.isArray(value.aqi.rows) && value.aqi.rows.length === pair.aqi.row_count
        : value.kind === "uk_aq_compressed_chart_history_month" && Array.isArray(value.observations)
          && value.observations.length === pair.observations.row_count && JSON.stringify(value.row_columns) === JSON.stringify([
            "observed_at_utc", "value", "station_id", "source_status", "verification_status", "timeseries_id", "embedded_verification_status", "source_status_provenance"]), "prototype_payload_shape_invalid");
      return result;
    }, signal);
  }
  async function load(rawRequest, rawParts, signal, mode) {
    const originalRequest = calculatedClient.normalizeRequest(rawRequest);
    const request = mode === "current" && Date.parse(originalRequest.end_utc) - Date.parse(originalRequest.start_utc) > 24 * HOUR
      ? { ...originalRequest, start_utc: new Date(Date.parse(originalRequest.end_utc) - 24 * HOUR).toISOString() } : originalRequest;
    const parts = calculatedClient.normalizeParts(request, rawParts);
    const sample = catalog.samples.find(entry => entry.identity.connector_id === request.connector_id && entry.identity.station_id === request.station_id
      && entry.identity.timeseries_id === request.timeseries_id && entry.identity.pollutant_code === request.pollutant);
    assert(sample && sample.publication_sha256 && request.start_utc >= sample.start_utc && request.end_utc <= sample.end_utc,
      "prototype_request_outside_configured_publication");
    const publication = await publicationFor(sample, signal);
    const payload = { schema_version: 2, identity: { ...sample.identity, pollutant: request.pollutant }, continuity: publication.continuity };
    const requestedParts = ["observations", "aqi"].filter(part => parts[part]);
    const partResults = await Promise.allSettled(requestedParts.map(async part => {
      const pairs = publication.pairs.filter(pair => Date.parse(pair.start_utc) <= Date.parse(request.end_utc)
        && Date.parse(pair.end_exclusive_utc) - 1 >= Date.parse(request.start_utc) + (part === "aqi" ? 1 : 0));
      assert(pairs.length > 0, "prototype_range_unavailable");
      const values = await Promise.all(pairs.map(pair => payloadFor(sample, publication, pair, part, signal)));
      if (signal?.aborted) throw abortError();
      const began = performance.now();
      if (part === "observations") {
        const rows = values.flatMap(value => value.observations.filter(row => row[0] >= request.start_utc && row[0] <= request.end_utc).map(row => ({
          connector_id: sample.identity.connector_id, station_id: row[2], timeseries_id: row[5], pollutant_code: request.pollutant,
          observed_at: row[0], value: row[1], source_status: row[3], verification_status: row[4],
          embedded_verification_status: row[6], source_status_provenance: row[7] })));
        const present = new Set(rows.map(row => Math.ceil(Date.parse(row.observed_at) / HOUR) * HOUR));
        const gaps = [];
        for (let hour = Math.floor(Date.parse(request.start_utc) / HOUR) * HOUR + HOUR; hour <= Date.parse(request.end_utc); hour += HOUR) {
          if (!present.has(hour)) gaps.push({ start_utc: new Date(hour - HOUR).toISOString(), end_utc: new Date(hour).toISOString() });
        }
        payload.observations = { enabled: true, rows, response_complete: true, has_gap: gaps.length > 0, gap_ranges: gaps, partial_reasons: [],
          stable_head_start_utc: request.start_utc, stable_head_end_utc: request.end_utc,
          source_counts: { experimental_precomputed_json: rows.length } };
      } else {
        const rows = values.flatMap(value => value.aqi.rows.filter(row => row.timestamp_hour_utc > request.start_utc && row.timestamp_hour_utc <= request.end_utc));
        const batches = values.flatMap(value => value.coverage.daily_batches.filter(batch => batch.endpoint_end_utc > request.start_utc && batch.endpoint_start_utc <= request.end_utc));
        const seen = new Set();
        for (const row of rows) { assert(!seen.has(row.timestamp_hour_utc), "prototype_overlapping_aqi_endpoints"); seen.add(row.timestamp_hour_utc); }
        const expectedCount = Math.floor(Date.parse(request.end_utc) / HOUR) - Math.floor(Date.parse(request.start_utc) / HOUR);
        assert(rows.length === expectedCount && batches.every(batch => batch.response_complete && batch.context_complete), "prototype_aqi_endpoint_or_context_incomplete");
        payload.aqi = { ...values[0].aqi, rows, response_complete: true, has_gap: batches.some(batch => batch.has_gap),
          partial_reasons: [...new Set(batches.flatMap(batch => batch.partial_reasons))],
          gap_ranges: values.flatMap(value => value.aqi.gap_ranges.filter(gap => gap.end_utc > request.start_utc && gap.start_utc < request.end_utc)),
          output_start_utc: request.start_utc, output_end_utc: request.end_utc,
          source_counts: { calculated_from_observations: rows.length } };
      }
      record({ type: "part_settled", part, sample_id: sample.id, range: { start_utc: request.start_utc, end_utc: request.end_utc },
        publication: sample.publication_sha256, response_complete: payload[part].response_complete,
        normalize_ms: performance.now() - began, rows: payload[part].rows.length,
        available_daqi: part === "aqi" ? payload.aqi.rows.filter(row => row.daqi_calculation_status === "ok").length : null,
        available_eaqi: part === "aqi" ? payload.aqi.rows.filter(row => row.eaqi_calculation_status === "ok").length : null });
    }));
    if (signal?.aborted) throw abortError();
    for (let index = 0; index < partResults.length; index++) {
      const result = partResults[index], part = requestedParts[index];
      if (result.status !== "rejected") continue;
      if (part !== "aqi" || !payload.observations) throw result.reason;
      payload.aqi = { enabled: true, rows: [], response_complete: false, has_gap: true, error: true, identity_valid: false,
        gap_ranges: [], partial_reasons: ["precomputed_aqi_transport_or_identity_failure"] };
      record({ type: "aqi_failure", error: result.reason.message, sample_id: sample.id });
    }
    for (const part of requestedParts) {
      payload[part].stable_head_start_utc = request.start_utc;
      payload[part].stable_head_end_utc = request.end_utc;
      if (mode === "current" && request.start_utc > originalRequest.start_utc) payload[part][`next_older_${part === "aqi" ? "aqi" : "observation"}_chunk_end_utc`] = request.start_utc;
    }
    const began = performance.now(), normalized = calculatedClient.normalizeResult(payload, originalRequest, parts, mode);
    record({ type: "normalizer", duration_ms: performance.now() - began, identity_valid: normalized.identity_valid });
    return normalized;
  }
  return Object.freeze({ kind: "calculated", loadCurrent: (request, parts, signal) => load(request, parts, signal, "current"),
    loadOlder: (request, parts, signal) => load(request, parts, signal, "older"),
    prefetchAqi: (request, signal) => load({ ...request, include_observations: false, include_aqi: true }, { observations: false, aqi: true }, signal, "current") });
}
