import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import "../shared/domain/canonical-current-rows.js";

const html = readFileSync(new URL("../sensor_map/index.html", import.meta.url), "utf8");
const functionStart = html.indexOf("        function getNetworkLabel(row) {");
const functionEnd = html.indexOf("        function groupStationRows(rows) {", functionStart);

assert.notEqual(functionStart, -1, "Sensor Map station helpers must be present");
assert.notEqual(functionEnd, -1, "Sensor Map grouping helper must follow the station helpers");

const stationHelperSource = html.slice(functionStart, functionEnd);
const loadStationHelpers = new Function(
  "canonicalRows",
  "normalizeText",
  "normalizeStationId",
  "normalizeLabelKey",
  `${stationHelperSource}
  return { getStationSummary, makeStationRecord, mergeReadingIntoStation };`,
);

const normalizeText = (value) => String(value ?? "").trim();
const {
  getStationSummary,
  makeStationRecord,
  mergeReadingIntoStation,
} = loadStationHelpers(
  globalThis.UkAqCanonicalCurrentRows,
  normalizeText,
  (value) => normalizeText(value) || null,
  (value) => normalizeText(value).toLowerCase(),
);

function makeRecord(row, coords, keyPrefix, allowTopLevelId = false) {
  return makeStationRecord(getStationSummary(row, allowTopLevelId), coords, keyPrefix);
}

test("canonical reading identity survives the Sensor Map geometry merge", () => {
  const geometry = makeRecord({
    id: 301,
    display_name: "Cardiff Centre AURN",
    station_label: "Cardiff Centre AURN",
    network_name: "GOV.UK AURN",
  }, { lat: 51.4816, lon: -3.1791 }, "geometry", true);
  const reading = makeRecord({
    station_id: 301,
    display_name: "Cardiff Centre WAQN",
    station_label: "Cardiff Centre WAQN",
    canonical_station_label: "Cardiff Centre",
    site_networks: [
      { network_id: 1, network_code: "gov_uk_aurn", network_label: "GOV.UK AURN" },
      { network_id: 7, network_code: "waqn", network_label: "Welsh AQN" },
    ],
  }, null, "reading");
  reading.latestReadings.set("PM2.5", { value: 12, observed_ms: 1_780_000_000_000 });
  reading.latestObservedAt = "2026-10-03T10:00:00Z";
  reading.latestObservedMs = 1_780_000_000_000;

  mergeReadingIntoStation(geometry, reading);

  assert.equal(geometry.stationName, "Cardiff Centre");
  assert.equal(geometry.network, "GOV.UK AURN + Welsh AQN");
  assert.equal(geometry.lat, 51.4816);
  assert.equal(geometry.lon, -3.1791);
  assert.equal(geometry.latestReadings.get("PM2.5").value, 12);
  assert.equal(geometry.latestObservedAt, "2026-10-03T10:00:00Z");
});

test("an explicit empty canonical membership is not replaced by geometry scalar identity", () => {
  const geometry = makeRecord({
    id: 401,
    display_name: "Geometry station",
    station_label: "Geometry station",
    network_name: "Welsh AQN",
  }, { lat: 52, lon: -3 }, "geometry", true);
  const reading = makeRecord({
    station_id: 401,
    canonical_station_label: "Canonical station",
    station_label: "Source station",
    site_networks: [],
  }, null, "reading");

  mergeReadingIntoStation(geometry, reading);

  assert.equal(geometry.stationName, "Canonical station");
  assert.equal(geometry.network, "Unknown");
});

test("rows without canonical fields retain the existing geometry presentation fallback", () => {
  const geometry = makeRecord({
    id: 501,
    display_name: "Geometry source station",
    station_label: "Shared source label",
    network_name: "Geometry source network",
  }, { lat: 53, lon: -2 }, "geometry", true);
  const reading = makeRecord({
    station_id: 501,
    display_name: "Reading source station",
    station_label: "Shared source label",
    connector_label: "Reading source network",
  }, null, "reading");

  mergeReadingIntoStation(geometry, reading);

  assert.equal(geometry.stationName, "Geometry source station");
  assert.equal(geometry.network, "Geometry source network");
});
