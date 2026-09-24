/**
 * Deterministic, illustrative-only fixture shaped like the future compact
 * /api/aq/bc-uv/diurnal product. Nothing in this file is a real observation.
 * Replace this module at the data-provider boundary; do not derive production
 * UVPM or fetch raw history in the page renderer.
 */
const STATIONS = [
  ["example-01", "Example monitoring site 1", 55.86, -4.25, true],
  ["example-02", "Example monitoring site 2", 54.98, -1.61, true],
  ["example-03", "Example monitoring site 3", 53.48, -2.24, true],
  ["example-04", "Example monitoring site 4", 53.40, -2.99, false],
  ["example-05", "Example monitoring site 5", 52.49, -1.90, true],
  ["example-06", "Example monitoring site 6", 51.48, -3.18, true],
  ["example-07", "Example monitoring site 7", 51.51, -0.13, true],
  ["example-08", "Example monitoring site 8", 54.60, -5.93, false],
];

const MONTHS = [
  ["Oct", 2025, 10], ["Nov", 2025, 11], ["Dec", 2025, 12],
  ["Jan", 2026, 1], ["Feb", 2026, 2], ["Mar", 2026, 3],
  ["Apr", 2026, 4], ["May", 2026, 5], ["Jun", 2026, 6],
  ["Jul", 2026, 7], ["Aug", 2026, 8], ["Sep", 2026, 9],
];

function illustrativeValue(stationIndex, monthNumber, hourEnding, property) {
  const hour = hourEnding % 24;
  const evening = Math.exp(-Math.pow((hour - 20) / 3.4, 2));
  const morning = Math.exp(-Math.pow((hour - 8) / 2.7, 2));
  const seasonal = [10, 11, 12, 1, 2, 3].includes(monthNumber) ? 1.55 : 0.82;
  const wave = Math.sin((hour + monthNumber + stationIndex) * Math.PI / 12);
  const base = (0.34 + stationIndex * 0.055) * seasonal + evening * 1.28 * seasonal + morning * 0.48 + wave * 0.08;
  if (property === "uv370") return Math.max(0, base * 1.21 + 0.18 + evening * 0.16);
  if (property === "uvpm") return base * 0.21 - 0.19 + wave * 0.12;
  return Math.max(0, base);
}

function buildProfiles(stationIndex) {
  const profiles = { bc: [], uv370: [], uvpm: [] };
  Object.keys(profiles).forEach((property) => {
    MONTHS.forEach(([month, year, monthNumber], monthIndex) => {
      const points = Array.from({ length: 24 }, (_, hourIndex) => {
        const hourEnding = hourIndex + 1;
        const deliberatelyMissing = (stationIndex + monthIndex + hourEnding) % 41 === 0;
        return {
          hour_ending: hourEnding,
          mean_ugm3: deliberatelyMissing ? null : Number(illustrativeValue(stationIndex, monthNumber, hourEnding, property).toFixed(3)),
          observation_count: deliberatelyMissing ? 0 : 20 + ((stationIndex * 7 + monthIndex * 3 + hourEnding) % 10),
        };
      });
      profiles[property].push({ month, year, month_number: monthNumber, points });
    });
  });
  return profiles;
}

export const WOOD_BURNING_DEMO_DATA = Object.freeze({
  fixture: true,
  network_code: "black_carbon",
  source_through_day: "2026-03-31",
  units: "µg/m³",
  stations: STATIONS.map(([id, name, latitude, longitude, reportsLatestDay], index) => ({
    station_id: id,
    station_name: name,
    latitude,
    longitude,
    reports_latest_day: reportsLatestDay,
    profiles: buildProfiles(index),
  })),
});
