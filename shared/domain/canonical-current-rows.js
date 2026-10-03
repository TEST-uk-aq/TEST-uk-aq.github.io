((global) => {
  "use strict";

  function nonEmpty(value) {
    const text = String(value ?? "").trim();
    return text || null;
  }

  function positiveIdentity(value) {
    const text = nonEmpty(value);
    if (text === null) return null;
    const number = Number(text);
    if (Number.isInteger(number) && number > 0) return number;
    return Number.isFinite(number) ? null : text;
  }

  function timestampMs(value) {
    const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  function sourceOrderValue(value) {
    if (value === null || value === undefined || String(value).trim() === "") {
      return { numeric: Number.POSITIVE_INFINITY, text: "" };
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return { numeric, text: "" };
    return { numeric: Number.POSITIVE_INFINITY, text: String(value) };
  }

  function compareSourceIdentity(left, right) {
    const leftOrder = sourceOrderValue(left);
    const rightOrder = sourceOrderValue(right);
    if (leftOrder.numeric !== rightOrder.numeric) return leftOrder.numeric - rightOrder.numeric;
    return leftOrder.text.localeCompare(rightOrder.text);
  }

  function networkCode(row) {
    return nonEmpty(row?.network_code ?? row?.station?.network_code)?.toLowerCase() || null;
  }

  function compareCanonicalRepresentatives(left, right, resolveTimestamp = defaultTimestamp) {
    const leftMs = timestampMs(resolveTimestamp(left));
    const rightMs = timestampMs(resolveTimestamp(right));
    if (leftMs !== rightMs) return rightMs - leftMs;
    const leftAurn = networkCode(left) === "gov_uk_aurn";
    const rightAurn = networkCode(right) === "gov_uk_aurn";
    if (leftAurn !== rightAurn) return leftAurn ? -1 : 1;
    const connectorOrder = compareSourceIdentity(left?.connector_id, right?.connector_id);
    if (connectorOrder !== 0) return connectorOrder;
    const stationOrder = compareSourceIdentity(
      left?.station_id ?? left?.station?.id,
      right?.station_id ?? right?.station?.id,
    );
    if (stationOrder !== 0) return stationOrder;
    return compareSourceIdentity(left?.id, right?.id);
  }

  function defaultTimestamp(row) {
    return row?.last_value_at || row?.observed_at || row?.latest_value_at || null;
  }

  function resolveCanonicalSiteKey(row, fallbackIndex = null) {
    const matchId = positiveIdentity(row?.match_id);
    if (matchId !== null) return `match:${matchId}`;
    const stationId = positiveIdentity(row?.station_id ?? row?.station?.id);
    if (stationId !== null) return `station:${stationId}`;
    return fallbackIndex === null ? null : `row:${fallbackIndex}`;
  }

  function groupCanonicalRows(rows, options = {}) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const resolveTimestamp = options.resolveTimestamp || defaultTimestamp;
    const resolveValue = options.resolveValue || (() => null);
    const groups = new Map();
    sourceRows.forEach((row, index) => {
      const key = resolveCanonicalSiteKey(row, index);
      const existing = groups.get(key);
      if (!existing || compareCanonicalRepresentatives(row, existing.row, resolveTimestamp) < 0) {
        groups.set(key, {
          key,
          row,
          value: resolveValue(row),
          timestamp: resolveTimestamp(row),
        });
      }
    });
    return Array.from(groups.values());
  }

  function resolveCanonicalStationName(row, fallback = "Unknown sensor") {
    return nonEmpty(row?.canonical_station_label)
      || nonEmpty(row?.display_name)
      || nonEmpty(row?.station_name)
      || nonEmpty(row?.station?.display_name)
      || fallback;
  }

  function normalizedCatalog(catalog, requireLiveMap) {
    return (Array.isArray(catalog) ? catalog : [])
      .filter((entry) => !requireLiveMap || entry?.live_map_enabled === true)
      .map((entry) => ({
        id: positiveIdentity(entry?.id ?? entry?.network_id),
        code: nonEmpty(entry?.code ?? entry?.network_code)?.toLowerCase() || null,
        label: nonEmpty(entry?.label ?? entry?.display_name ?? entry?.network_label),
      }))
      .filter((entry) => entry.code && entry.label);
  }

  function collectCanonicalNetworkEntries(row, catalog = [], options = {}) {
    const constrainToCatalog = Array.isArray(catalog) && catalog.length > 0;
    const canonicalCatalog = normalizedCatalog(catalog, options.requireLiveMap === true);
    const byId = new Map(canonicalCatalog.filter((entry) => entry.id !== null).map((entry) => [String(entry.id), entry]));
    const byCode = new Map(canonicalCatalog.map((entry) => [entry.code, entry]));
    const memberships = Array.isArray(row?.site_networks)
      ? row.site_networks
      : [{
        network_id: row?.network_id,
        network_code: row?.network_code,
        network_label: row?.network_label,
      }];
    const unique = new Map();
    memberships.forEach((membership) => {
      const memberId = positiveIdentity(membership?.network_id ?? membership?.id);
      const memberCode = nonEmpty(membership?.network_code ?? membership?.code)?.toLowerCase() || null;
      const fromCatalog = (memberId !== null ? byId.get(String(memberId)) : null)
        || (memberCode ? byCode.get(memberCode) : null);
      if (constrainToCatalog && !fromCatalog) return;
      const entry = fromCatalog
        ? { ...fromCatalog, id: fromCatalog.id ?? memberId }
        : {
          id: memberId,
          code: memberCode,
          label: nonEmpty(membership?.network_label ?? membership?.label),
        };
      if (!entry.code || !entry.label) return;
      unique.set(entry.id !== null ? `id:${entry.id}` : `code:${entry.code}`, entry);
    });
    return Array.from(unique.values()).sort((left, right) => {
      const idOrder = compareSourceIdentity(left.id, right.id);
      return idOrder || left.code.localeCompare(right.code);
    });
  }

  function formatCanonicalNetworkLabel(row, catalog = [], options = {}) {
    return collectCanonicalNetworkEntries(row, catalog, options)
      .map((entry) => entry.label)
      .join(" + ");
  }

  global.UkAqCanonicalCurrentRows = Object.freeze({
    collectCanonicalNetworkEntries,
    compareCanonicalRepresentatives,
    formatCanonicalNetworkLabel,
    groupCanonicalRows,
    resolveCanonicalSiteKey,
    resolveCanonicalStationName,
  });
})(globalThis);
