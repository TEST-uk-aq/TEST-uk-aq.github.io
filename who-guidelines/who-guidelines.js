import {
  formatDisplayDate,
  loadWhoDailySeries,
} from "./who-guidelines-data.js";
import { renderCalendarMonths } from "./render-calendar-months.js";
import { renderMonthRows } from "./render-month-rows.js";
import { renderContinuousWeeks } from "./render-continuous-weeks.js";
import { renderQuarterStrips } from "./render-quarter-strips.js";

async function initialise() {
  const status = document.getElementById("who-status");
  const error = document.getElementById("who-error");
  const content = document.getElementById("who-content");
  try {
    const model = await loadWhoDailySeries();
    populateContext(model);
    renderCalendarMonths(
      document.getElementById("calendar-months-view"),
      model,
    );
    renderMonthRows(document.getElementById("month-rows-view"), model);
    renderContinuousWeeks(
      document.getElementById("continuous-weeks-view"),
      model,
    );
    renderQuarterStrips(document.getElementById("quarter-strips-view"), model);
    status.hidden = true;
    error.hidden = true;
    content.hidden = false;
  } catch (loadError) {
    console.error("WHO guidelines page failed to initialise", loadError);
    status.hidden = true;
    content.hidden = true;
    error.hidden = false;
  }
}

function populateContext(model) {
  document.getElementById("who-station-name").textContent =
    model.station.displayName;
  document.getElementById("who-network-name").textContent = model.network.label;
  document.getElementById("who-timeseries-id").textContent = String(
    model.timeseries.id,
  );
  document.getElementById("who-window-start").textContent = formatDisplayDate(
    model.windowStartDayUtc,
  );
  document.getElementById("who-window-end").textContent = formatDisplayDate(
    model.windowEndDayUtc,
  );
  const statuses = new Set(model.days.map((day) => day.sourceValidationStatus));
  document.getElementById("who-provenance-note").textContent =
    statuses.size === 1 && statuses.has(null)
      ? "Daily ratified/provisional source status is not currently available for this series."
      : "A light-blue square identifies a day backed by authoritative ratified (R) source status.";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
} else {
  void initialise();
}
