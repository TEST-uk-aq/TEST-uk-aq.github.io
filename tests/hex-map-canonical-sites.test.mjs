import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCanonicalNetworkLabel,
  groupCanonicalRows,
  resolveCanonicalStationName,
} from "../hex_map/hex-map-canonical-sites.js";

const sharedHelper = globalThis.UkAqCanonicalCurrentRows;

const catalog = [
  { id: 1, code: "gov_uk_aurn", label: "GOV.UK AURN", live_map_enabled: true },
  { id: 7, code: "waqn", label: "Welsh AQN", live_map_enabled: true },
  { id: 10, code: "hidden", label: "Hidden", live_map_enabled: false },
];

test("groups by match_id and chooses the newest representative", () => {
  const rows = [
    { id: 10, match_id: 20, station_id: 30, connector_id: 9, network_code: "waqn", last_value_at: "2026-10-03T10:00:00Z" },
    { id: 11, match_id: 20, station_id: 31, connector_id: 1, network_code: "gov_uk_aurn", last_value_at: "2026-10-03T09:00:00Z" },
  ];

  const groups = groupCanonicalRows(rows);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].row.id, 10);
});

test("prefers AURN then stable ascending source identities for timestamp ties", () => {
  const rows = [
    { id: 20, match_id: 5, station_id: 8, connector_id: 9, network_code: "waqn", last_value_at: "2026-10-03T10:00:00Z" },
    { id: 30, match_id: 5, station_id: 9, connector_id: 2, network_code: "gov_uk_aurn", last_value_at: "2026-10-03T10:00:00Z" },
    { id: 10, match_id: 5, station_id: 7, connector_id: 1, network_code: "gov_uk_aurn", last_value_at: "2026-10-03T10:00:00Z" },
  ];

  assert.equal(groupCanonicalRows(rows)[0].row.id, 10);
});

test("uses canonical label and all live canonical site memberships", () => {
  const row = {
    display_name: "WAQN Cardiff Centre",
    canonical_station_label: "Cardiff Centre",
    site_networks: [
      { network_id: 7, network_code: "waqn", network_label: "Wrong label" },
      { network_id: 10, network_code: "hidden", network_label: "Hidden" },
      { network_id: 1, network_code: "gov_uk_aurn", network_label: "Wrong label" },
    ],
  };

  assert.equal(resolveCanonicalStationName(row), "Cardiff Centre");
  assert.equal(formatCanonicalNetworkLabel(row, catalog), "GOV.UK AURN + Welsh AQN");
});

test("shared all-public consumers retain canonical memberships regardless of live-map flag", () => {
  const row = {
    network_id: 1,
    network_code: "gov_uk_aurn",
    network_label: "GOV.UK AURN",
    site_networks: [
      { network_id: 1, network_code: "gov_uk_aurn", network_label: "GOV.UK AURN" },
      { network_id: 10, network_code: "hidden", network_label: "Hidden" },
    ],
  };

  assert.equal(
    sharedHelper.formatCanonicalNetworkLabel(row),
    "GOV.UK AURN + Hidden",
  );
});

test("shared grouping leaves unmatched stations separate", () => {
  const groups = sharedHelper.groupCanonicalRows([
    { id: 1, match_id: null, station_id: 100, last_value_at: "2026-10-03T10:00:00Z" },
    { id: 2, match_id: null, station_id: 101, last_value_at: "2026-10-03T10:00:00Z" },
  ]);

  assert.deepEqual(groups.map((group) => group.key), ["station:100", "station:101"]);
});

test("invalid numeric match identities fall back to station identity", () => {
  const groups = sharedHelper.groupCanonicalRows([
    { id: 1, match_id: 0, station_id: 100, last_value_at: "2026-10-03T10:00:00Z" },
    { id: 2, match_id: -1, station_id: 101, last_value_at: "2026-10-03T10:00:00Z" },
  ]);

  assert.deepEqual(groups.map((group) => group.key), ["station:100", "station:101"]);
});

test("an explicit empty current membership set is not replaced with scalar history", () => {
  const row = {
    network_id: 7,
    network_code: "waqn",
    network_label: "Welsh AQN",
    site_networks: [],
  };

  assert.deepEqual(sharedHelper.collectCanonicalNetworkEntries(row), []);
});

test("a live-map catalogue with no eligible entries does not leak scalar membership", () => {
  const row = {
    network_id: 10,
    network_code: "hidden",
    network_label: "Hidden",
  };

  assert.deepEqual(
    sharedHelper.collectCanonicalNetworkEntries(row, [catalog[2]], { requireLiveMap: true }),
    [],
  );
});
