// Experimental data adapter only; chart, cache, normalization and AQI display stay shared.
import { calculatedClient } from "../shared/station-chart/station-chart-runtime.js";

const identity = Object.freeze({ connector_id: 1, station_id: 248, timeseries_id: 212, pollutant: "pm25" });
const samples = Object.freeze({
  "v3-september-2026": { generation: "v3", start: "2026-09-01T00:00:00.000Z", end: "2026-10-01T00:00:00.000Z" },
  "v3-2026-09-01": { generation: "v3", start: "2026-09-01T00:00:00.000Z", end: "2026-09-02T00:00:00.000Z" },
  "v2-2026-09-01": { generation: "v2", start: "2026-09-01T00:00:00.000Z", end: "2026-09-02T00:00:00.000Z" },
});
const digest = /^[0-9a-f]{64}$/;
function assert(value, code) { if (!value) throw new Error(code); }
function url(base, route, values) {
  const result = new URL(`${base}/chart-history-prototype/${route}`);
  for (const [key, value] of Object.entries(values)) result.searchParams.set(key, String(value));
  return result;
}
async function fetchJson(fetchApi, requestUrl, signal, record) {
  const id = crypto.randomUUID();
  const began = performance.now();
  const response = await fetchApi(requestUrl, { credentials: "include", signal,
    headers: { Accept: "application/json", "X-UK-AQ-Prototype-Request-ID": id } });
  const headersAt = performance.now();
  if (!response.ok) {
    record({ type: "request_failure", route: new URL(requestUrl).pathname,
      request_id: response.headers.get("X-UK-AQ-Prototype-Request-ID") || id,
      status: response.status, response_ms: Math.round(headersAt - began) });
    throw new Error(`prototype_http_${response.status}`);
  }
  const body = await response.text();
  const transferredAt = performance.now();
  const parsed = JSON.parse(body);
  const parsedAt = performance.now();
  record({ type: "request", route: new URL(requestUrl).pathname, request_id: response.headers.get("X-UK-AQ-Prototype-Request-ID") || id,
    response_ms: Math.round(headersAt - began), transfer_ms: Math.round(transferredAt - headersAt),
    parse_ms: Math.round(parsedAt - transferredAt), decoded_bytes: new TextEncoder().encode(body).length,
    compressed_bytes: Number(response.headers.get("X-UK-AQ-Prototype-Compressed-Bytes")) || null,
    r2_reads: Number(response.headers.get("X-UK-AQ-Prototype-R2-Reads")) || null,
    publication: response.headers.get("X-UK-AQ-Prototype-Publication") || null,
    object_sha256: response.headers.get("X-UK-AQ-Prototype-Object-SHA256") || null,
    aqi_source: response.headers.get("X-UK-AQ-Prototype-AQI-Source") || null,
    cache: response.headers.get("X-UK-AQ-Prototype-Cache") || response.headers.get("X-UK-AQ-Cache") || null,
    downloaded_objects: response.headers.get("Content-Encoding") === "gzip" ? 1 : 0,
    aqi_worker_wall_ms: Number(response.headers.get("X-UK-AQ-Prototype-AQI-Wall-MS")) || null });
  return { payload: parsed, response };
}

export async function loadPublication({ base, sampleId, fetchApi, record }) {
  const sample = Object.hasOwn(samples, sampleId) ? samples[sampleId] : null;
  assert(sample, "prototype_sample_invalid");
  const { payload } = await fetchJson(fetchApi, url(base, "manifest", { sample: sampleId }), undefined, record);
  const aqiSource = payload.aqi_source || "request_time_calculated";
  assert(payload.schema_version === 1 && payload.sample_id === sampleId
    && payload.source_generation === sample.generation && digest.test(payload.publication_sha256)
    && payload.interval?.start_utc === sample.start && payload.interval?.end_exclusive_utc === sample.end
    && payload.identity?.connector_id === 1 && payload.identity?.station_id === 248
    && payload.identity?.timeseries_id === 212 && payload.identity?.pollutant_code === "pm25"
    && digest.test(payload.object?.sha256) && digest.test(payload.object?.json_sha256)
    && (!payload.source_evidence_sha256 || digest.test(payload.source_evidence_sha256))
    && ["request_time_calculated", "precomputed_compressed_json"].includes(aqiSource)
    && (aqiSource !== "precomputed_compressed_json" || (
      digest.test(payload.aqi_object?.sha256) && digest.test(payload.aqi_object?.json_sha256)
      && payload.aqi_object.algorithm_version === "aqilevels_hourly_v2"
      && typeof payload.aqi_object.response_complete === "boolean")), "prototype_manifest_invalid");
  return Object.freeze({ ...payload, aqi_source: aqiSource, sample });
}

export function createJsonHistoryClient({ base, publication, fetchApi, record }) {
  const { sample_id: sampleId, publication_sha256: publicationSha, sample } = publication;
  async function load(rawRequest, rawParts, signal, mode) {
    const request = calculatedClient.normalizeRequest(rawRequest);
    const parts = calculatedClient.normalizeParts(request, rawParts);
    assert(request.connector_id === 1 && request.station_id === 248 && request.timeseries_id === 212
      && request.pollutant === "pm25" && request.start_utc >= sample.start && request.end_utc < sample.end,
    "prototype_request_outside_sample");
    const query = { sample: sampleId, publication: publicationSha, source_generation: sample.generation,
      start_utc: request.start_utc, end_utc: request.end_utc, ...identity };
    const payload = { schema_version: 2, identity: { ...identity, pollutant: "pm25" } };
    if (parts.observations) {
      const result = await fetchJson(fetchApi, url(base, "month", query), signal, record);
      assert(result.response.headers.get("X-UK-AQ-Prototype-Publication") === publicationSha,
        "prototype_publication_changed");
      if (result.response.headers.get("X-UK-AQ-Prototype-Object-SHA256"))
        assert(result.response.headers.get("X-UK-AQ-Prototype-Object-SHA256") === publication.object.sha256,
          "prototype_observation_object_changed");
      const month = result.payload, rows = month?.observations;
      assert(month.schema_version === 1 && month.kind === "uk_aq_compressed_chart_history_month"
        && month.source?.generation === sample.generation && month.identity?.timeseries_id === 212
        && month.identity?.station_id === 248 && month.coverage?.complete === true
        && (!publication.source_evidence_sha256 || month.source?.source_evidence?.sha256 === publication.source_evidence_sha256)
        && month.coverage.requested_start_utc === sample.start
        && month.coverage.requested_end_exclusive_utc === sample.end
        && Array.isArray(rows) && rows.length === publication.object.row_count, "prototype_month_invalid");
      assert(rows.every((row) => Array.isArray(row) && row.length === 5
        && (row[2] === null || row[2] === 248)), "prototype_observation_station_invalid");
      const normalizeStarted = performance.now();
      const transformed = rows.filter((row) => row[0] >= request.start_utc && row[0] <= request.end_utc)
        .map((row) => ({ ...identity, station_id: row[2], observed_at: row[0], value: row[1],
          source_status: row[3], verification_status: row[4] }));
      record({ type: "normalization", source: sampleId, row_count: transformed.length,
        duration_ms: Math.round(performance.now() - normalizeStarted) });
      const presentHours = new Set(transformed.map((row) => Math.floor(Date.parse(row.observed_at) / 3_600_000) * 3_600_000 + 3_600_000));
      let observationComplete = true;
      for (let hour = Math.floor(Date.parse(request.start_utc) / 3_600_000) * 3_600_000 + 3_600_000;
        hour <= Date.parse(request.end_utc); hour += 3_600_000) {
        if (!presentHours.has(hour)) { observationComplete = false; break; }
      }
      payload.observations = { enabled: true, rows: transformed, response_complete: observationComplete,
        has_gap: !observationComplete, partial_reasons: observationComplete ? [] : ["missing_visible_observation_hours"], stable_head_start_utc: request.start_utc,
        stable_head_end_utc: request.end_utc };
      record({ type: "observation_completeness", source: sampleId, response_complete: observationComplete,
        source_coverage_complete: month.coverage.complete, rows: transformed.length });
    }
    if (parts.aqi) {
      const result = await fetchJson(fetchApi, url(base, "aqi", query), signal, record);
      assert(result.response.headers.get("X-UK-AQ-Prototype-Publication") === publicationSha,
        "prototype_publication_changed");
      if (publication.aqi_source === "precomputed_compressed_json") {
        assert(result.response.headers.get("X-UK-AQ-Prototype-AQI-Source") === "precomputed_compressed_json"
          && result.response.headers.get("X-UK-AQ-Prototype-Object-SHA256") === publication.aqi_object.sha256,
        "prototype_aqi_object_changed");
        const month = result.payload;
        assert(month.schema_version === 2 && month.kind === "uk_aq_compressed_chart_aqi_month"
          && month.identity?.connector_id === 1 && month.identity?.station_id === 248
          && month.identity?.timeseries_id === 212 && month.identity?.pollutant_code === "pm25"
          && month.source?.generation === sample.generation
          && month.source?.algorithm_version === publication.aqi_object.algorithm_version
          && month.source?.source_evidence?.sha256 === publication.source_evidence_sha256
          && month.coverage?.requested_start_utc === sample.start
          && month.coverage?.requested_end_exclusive_utc === sample.end
          && Array.isArray(month.aqi?.rows) && month.aqi.rows.length === publication.aqi_object.row_count
          && Array.isArray(month.coverage?.daily_batches), "prototype_precomputed_aqi_invalid");
        const selectedBatches = month.coverage.daily_batches.filter((batch) =>
          batch.output_start_utc <= request.end_utc && batch.output_end_exclusive_utc > request.start_utc);
        assert(selectedBatches.length > 0, "prototype_aqi_range_missing");
        const selectedRows = month.aqi.rows.filter((row) => row.timestamp_hour_utc > request.start_utc
          && row.timestamp_hour_utc <= request.end_utc);
        const selectedGaps = (month.aqi.gap_ranges || []).filter((gap) =>
          gap.end_utc > request.start_utc && gap.start_utc < request.end_utc);
        const complete = selectedBatches.every((batch) => batch.response_complete)
          && selectedGaps.length === 0
          && selectedRows.every((row) => row.daqi_calculation_status === "ok" && row.eaqi_calculation_status === "ok");
        payload.aqi = { ...month.aqi, publication_sha256: publicationSha,
          source_evidence_sha256: publication.source_evidence_sha256,
          rows: selectedRows, response_complete: complete,
          has_gap: selectedGaps.length > 0 || selectedRows.some((row) =>
            row.daqi_calculation_status !== "ok" || row.eaqi_calculation_status !== "ok"),
          gap_ranges: selectedGaps,
          partial_reasons: complete ? [] : [...new Set(selectedBatches.flatMap((batch) => batch.partial_reasons || []))],
          output_start_utc: request.start_utc, output_end_utc: request.end_utc,
          source_counts: { calculated_from_observations: selectedRows.length } };
      } else payload.aqi = result.payload.aqi;
      assert(payload.aqi?.calculation_source === "calculated_from_observations", "prototype_aqi_invalid");
      record({ type: "aqi_completeness", source: sampleId, aqi_source: publication.aqi_source,
        response_complete: payload.aqi.response_complete, has_gap: payload.aqi.has_gap,
        partial_reasons: payload.aqi.partial_reasons, rows: payload.aqi.rows?.length || 0 });
    }
    const before = performance.now();
    const normalized = calculatedClient.normalizeResult(payload, request, parts, mode);
    record({ type: "normalizer", source: sampleId, duration_ms: Math.round(performance.now() - before),
      observations: normalized.observations?.points?.length || 0, aqi: normalized.aqi?.points?.length || 0 });
    return normalized;
  }
  return Object.freeze({ kind: "calculated", loadCurrent: (request, parts, signal) => load(request, parts, signal, "current"),
    loadOlder: (request, parts, signal) => load(request, parts, signal, "older"),
    prefetchAqi: (request, signal) => load({ ...request, include_observations: false, include_aqi: true },
      { observations: false, aqi: true }, signal, "current") });
}

export { identity, samples };
