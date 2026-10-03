import "../shared/domain/canonical-current-rows.js";

const helper = globalThis.UkAqCanonicalCurrentRows;

export const groupCanonicalRows = helper.groupCanonicalRows;
export const resolveCanonicalSiteKey = helper.resolveCanonicalSiteKey;
export const resolveCanonicalStationName = helper.resolveCanonicalStationName;

export function collectCanonicalNetworkEntries(row, catalog) {
  return helper.collectCanonicalNetworkEntries(row, catalog, { requireLiveMap: true });
}

export function formatCanonicalNetworkLabel(row, catalog) {
  return helper.formatCanonicalNetworkLabel(row, catalog, { requireLiveMap: true });
}
