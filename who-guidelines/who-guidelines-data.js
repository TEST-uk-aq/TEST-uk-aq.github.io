const API_URL =
  "/api/aq/who-daily-series?pollutant=pm25&network_code=gov_uk_aurn&selection=random";
const CLASSIFICATIONS = new Set([
  "within_guideline",
  "above_guideline",
  "not_enough_data",
]);
const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function loadWhoDailySeries() {
  const response = await fetch(API_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`WHO daily-series request failed (${response.status})`);
  }
  return normalizeWhoDailySeries(await response.json());
}

export function normalizeWhoDailySeries(payload) {
  const meta = payload?.meta;
  const station = payload?.station;
  const timeseries = payload?.timeseries;
  const sourceDays = payload?.data;
  if (!meta || !station || !timeseries || !Array.isArray(sourceDays)) {
    throw new Error("WHO daily-series response is incomplete");
  }
  if (meta.pollutant !== "pm25" || meta.network_code !== "gov_uk_aurn") {
    throw new Error("WHO daily-series response has an unsupported scope");
  }
  const startDay = parseIsoDay(meta.window_start_day_utc);
  const endDay = parseIsoDay(meta.window_end_day_utc);
  const asOfDay = parseIsoDay(meta.as_of_day_utc);
  if (
    meta.window_days !== 365 || endDay.key !== asOfDay.key ||
    addUtcDays(startDay.key, 364) !== endDay.key
  ) {
    throw new Error(
      "WHO daily-series response does not describe a 365-day window",
    );
  }
  if (sourceDays.length !== 365) {
    throw new Error("WHO daily-series response must contain 365 days");
  }

  const guideline = Number(meta.who_daily_guideline_ugm3);
  if (!Number.isFinite(guideline) || guideline <= 0) {
    throw new Error("WHO daily-series response is missing its guideline value");
  }
  const timeseriesId = Number(timeseries.timeseries_id);
  if (!Number.isInteger(timeseriesId) || timeseriesId <= 0) {
    throw new Error("WHO daily-series response has an invalid timeseries ID");
  }

  const days = sourceDays.map((sourceDay, index) =>
    normalizeDay(sourceDay, startDay.key, index)
  );
  return Object.freeze({
    pollutant: "pm25",
    pollutantLabel: "PM2.5",
    guideline,
    asOfDayUtc: asOfDay.key,
    windowStartDayUtc: startDay.key,
    windowEndDayUtc: endDay.key,
    station: Object.freeze({
      id: station.station_id ?? null,
      ref: cleanText(station.station_ref),
      displayName: cleanText(station.display_name) || "Unnamed station",
    }),
    network: Object.freeze({
      code: "gov_uk_aurn",
      label: cleanText(station.network_label) || "GOV.UK AURN",
    }),
    timeseries: Object.freeze({
      id: timeseriesId,
      ref: cleanText(timeseries.timeseries_ref),
    }),
    days: Object.freeze(days),
  });
}

function normalizeDay(sourceDay, windowStartDayUtc, index) {
  const parsed = parseIsoDay(sourceDay?.day_utc);
  if (parsed.key !== addUtcDays(windowStartDayUtc, index)) {
    throw new Error("WHO daily-series dates are not complete and ordered");
  }
  const isMissing = sourceDay?.is_missing === true;
  const classification = sourceDay?.classification ?? null;
  const mean = sourceDay?.daily_mean_ugm3 ?? null;
  const provenance = sourceDay?.source_validation_status ?? null;

  if (typeof sourceDay?.is_missing !== "boolean") {
    throw new Error("A WHO day has no missing marker");
  }
  if (isMissing) {
    if (classification !== null || mean !== null) {
      throw new Error("A missing WHO day contains scientific values");
    }
  } else {
    if (!CLASSIFICATIONS.has(classification)) {
      throw new Error("A WHO day has an invalid classification");
    }
    if (classification === "not_enough_data") {
      if (mean !== null) {
        throw new Error("An incomplete WHO day contains a daily mean");
      }
    } else if (typeof mean !== "number" || !Number.isFinite(mean) || mean < 0) {
      throw new Error("A classified WHO day has an invalid daily mean");
    }
  }
  if (provenance !== null && provenance !== "R" && provenance !== "P") {
    throw new Error("A WHO day has an invalid provenance status");
  }

  return Object.freeze({
    index,
    dayUtc: parsed.key,
    date: parsed.date,
    year: parsed.date.getUTCFullYear(),
    month: parsed.date.getUTCMonth(),
    dayOfMonth: parsed.date.getUTCDate(),
    weekdayMondayZero: (parsed.date.getUTCDay() + 6) % 7,
    dailyMeanUgm3: mean,
    classification,
    isMissing,
    sourceValidationStatus: provenance,
  });
}

export function parseIsoDay(value) {
  if (typeof value !== "string" || !ISO_DAY_PATTERN.test(value)) {
    throw new Error("Invalid UTC day in WHO daily-series response");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Invalid UTC calendar date in WHO daily-series response");
  }
  return { key: value, date };
}

export function addUtcDays(dayUtc, amount) {
  const date = new Date(`${dayUtc}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatDisplayDate(
  dayUtc,
  options = { day: "numeric", month: "long", year: "numeric" },
) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" })
    .format(new Date(`${dayUtc}T00:00:00.000Z`));
}

function cleanText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}
