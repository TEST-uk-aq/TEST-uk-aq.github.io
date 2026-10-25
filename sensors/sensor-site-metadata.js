import domain from "../shared/station-chart/station-chart-domain-module.js";

const SNAPSHOT_POLLUTANTS = new Set(["pm25", "pm10", "no2"]);
const canonicalFields = ["match_id", "uk_air_ref", "canonical_station_label", "site_networks"];

function pollutant(row) {
  return domain.normalizePollutant(row?.observed_property_code ?? row?.pollutant_label ?? row?.phenomenon_label);
}

function sourceKey(row) {
  const connector = domain.positiveInteger(row?.connector_id);
  const station = domain.positiveInteger(row?.station_id);
  const timeseries = domain.positiveInteger(row?.timeseries_id ?? row?.id);
  return connector && station && timeseries ? `${connector}:${station}:${timeseries}` : null;
}

// The legacy stations-chart response omits physical-site metadata. Reuse the
// existing public projection, joining exact source identities only. No names,
// coordinates, site_networks memberships or history values establish a match.
export async function loadSensorSiteMetadata(rows, { baseUrl, fetchApi, signal }) {
  const needed = new Set(rows.filter(row => !Object.hasOwn(row, "match_id"))
    .map(pollutant).filter(value => SNAPSHOT_POLLUTANTS.has(value)));
  const metadata = new Map();
  let unavailable = false;
  await Promise.all(Array.from(needed, async value => {
    try {
      const url = new URL(`${baseUrl}/latest-snapshot`);
      url.searchParams.set("pollutant", value);
      url.searchParams.set("window", "all");
      const response = await fetchApi(url.toString(), { signal });
      if (!response.ok) throw new Error("site_metadata_request_failed");
      const payload = await response.json();
      if (domain.normalizePollutant(payload?.pollutant) !== value || payload?.window !== "all"
        || !Array.isArray(payload?.data)) throw new Error("site_metadata_identity_invalid");
      for (const row of payload.data) {
        const key = sourceKey(row);
        if (key && Object.hasOwn(row, "match_id")) metadata.set(`${value}:${key}`, row);
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      // Missing projection never authorises inferred grouping or another site.
      unavailable = true;
    }
  }));
  return {
    unavailable,
    rows: rows.map(row => {
      if (Object.hasOwn(row, "match_id")) return row;
      const canonical = metadata.get(`${pollutant(row)}:${sourceKey(row)}`);
      if (!canonical) return row;
      const fields = Object.fromEntries(canonicalFields.map(field => [field, canonical[field]]));
      return { ...row, ...fields };
    }),
  };
}
