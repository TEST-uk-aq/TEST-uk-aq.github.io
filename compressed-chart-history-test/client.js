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
    cache: response.headers.get("X-UK-AQ-Prototype-Cache") || response.headers.get("X-UK-AQ-Cache") || null,
    downloaded_objects: new URL(requestUrl).pathname.endsWith("/month") ? 1 : 0,
    aqi_worker_wall_ms: Number(response.headers.get("X-UK-AQ-Prototype-AQI-Wall-MS")) || null });
  return { payload: parsed, response };
}

export async function loadPublication({ base, sampleId, fetchApi, record }) {
  const sample = Object.hasOwn(samples, sampleId) ? samples[sampleId] : null;
  assert(sample, "prototype_sample_invalid");
  const { payload } = await fetchJson(fetchApi, url(base, "manifest", { sample: sampleId }), undefined, record);
  assert(payload.schema_version === 1 && payload.sample_id === sampleId
    && payload.source_generation === sample.generation && digest.test(payload.publication_sha256)
    && payload.interval?.start_utc === sample.start && payload.interval?.end_exclusive_utc === sample.end
    && payload.identity?.connector_id === 1 && payload.identity?.station_id === 248
    && payload.identity?.timeseries_id === 212 && payload.identity?.pollutant_code === "pm25"
    && digest.test(payload.object?.sha256) && digest.test(payload.object?.json_sha256), "prototype_manifest_invalid");
  return Object.freeze({ ...payload, sample });
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
      const month = result.payload, rows = month?.observations;
      assert(month.schema_version === 1 && month.kind === "uk_aq_compressed_chart_history_month"
        && month.source?.generation === sample.generation && month.identity?.timeseries_id === 212
        && month.identity?.station_id === 248 && month.coverage?.complete === true
        && month.coverage.requested_start_utc === sample.start
        && month.coverage.requested_end_exclusive_utc === sample.end
        && Array.isArray(rows) && rows.length === publication.object.row_count, "prototype_month_invalid");
      const normalizeStarted = performance.now();
      const transformed = rows.filter((row) => row[0] >= request.start_utc && row[0] <= request.end_utc)
        .map((row) => ({ ...identity, observed_at: row[0], value: row[1],
          source_status: row[3], verification_status: row[4] }));
      record({ type: "normalization", source: sampleId, row_count: transformed.length,
        duration_ms: Math.round(performance.now() - normalizeStarted) });
      payload.observations = { enabled: true, rows: transformed, response_complete: true,
        has_gap: false, partial_reasons: [], stable_head_start_utc: request.start_utc,
        stable_head_end_utc: request.end_utc };
    }
    if (parts.aqi) {
      const result = await fetchJson(fetchApi, url(base, "aqi", query), signal, record);
      assert(result.response.headers.get("X-UK-AQ-Prototype-Publication") === publicationSha,
        "prototype_publication_changed");
      payload.aqi = result.payload.aqi;
      assert(payload.aqi?.calculation_source === "calculated_from_observations", "prototype_aqi_invalid");
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
