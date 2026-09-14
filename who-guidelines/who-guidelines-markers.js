import { formatDisplayDate } from "./who-guidelines-data.js";

export function createDayMarker(day, guideline, rovingIndex = 0) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = markerClass(day);
  button.dataset.dayIndex = String(day.index);
  button.tabIndex = rovingIndex === 0 ? 0 : -1;
  const label = describeDay(day);
  button.setAttribute("aria-label", label);
  button.title = label;

  const visual = document.createElement("span");
  visual.className = "who-day-marker-visual";
  visual.setAttribute("aria-hidden", "true");
  const style = markerStyle(day, guideline);
  visual.style.setProperty("--who-marker-size", `${style.size}px`);
  visual.style.setProperty("--who-marker-colour", style.colour);
  button.appendChild(visual);
  return button;
}

export function attachDayMarkerNavigation(container, days) {
  const detail = container.querySelector("[data-who-day-detail]");
  const markers = Array.from(container.querySelectorAll(".who-day-marker"));
  if (!markers.length || !detail) return;

  const showDetail = (marker) => {
    const day = days[Number(marker.dataset.dayIndex)];
    if (day) detail.textContent = describeDay(day);
  };
  const moveFocus = (current, offset, absolute = null) => {
    const currentPosition = markers.indexOf(current);
    const nextPosition = absolute ??
      Math.max(0, Math.min(markers.length - 1, currentPosition + offset));
    const next = markers[nextPosition];
    if (!next) return;
    current.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
    showDetail(next);
  };

  container.addEventListener("focusin", (event) => {
    const marker = event.target.closest?.(".who-day-marker");
    if (marker && container.contains(marker)) showDetail(marker);
  });
  container.addEventListener("click", (event) => {
    const marker = event.target.closest?.(".who-day-marker");
    if (!marker || !container.contains(marker)) return;
    markers.forEach((item) => {
      item.tabIndex = item === marker ? 0 : -1;
    });
    showDetail(marker);
  });
  container.addEventListener("keydown", (event) => {
    const marker = event.target.closest?.(".who-day-marker");
    if (!marker || !container.contains(marker)) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in moves) {
      event.preventDefault();
      moveFocus(marker, moves[event.key]);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(marker, 0, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(marker, 0, markers.length - 1);
    }
  });
  showDetail(markers[0]);
}

export function createDayDetail() {
  const detail = document.createElement("p");
  detail.className = "who-day-detail";
  detail.dataset.whoDayDetail = "";
  detail.setAttribute("aria-live", "polite");
  return detail;
}

export function describeDay(day) {
  const date = formatDisplayDate(day.dayUtc, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let result;
  if (day.isMissing) {
    result = "Missing canonical WHO daily row";
  } else if (day.classification === "not_enough_data") {
    result = "Not enough data for a WHO daily mean";
  } else {
    const mean = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 })
      .format(day.dailyMeanUgm3);
    result = `${mean} micrograms per cubic metre; ${
      day.classification === "within_guideline" ? "within" : "above"
    } the WHO daily guideline`;
  }
  const provenance = day.sourceValidationStatus === "R"
    ? "Source validation: ratified (R)"
    : day.sourceValidationStatus === "P"
    ? "Source validation: provisional (P)"
    : "Source validation status unavailable";
  return `${date}: ${result}. ${provenance}.`;
}

function markerClass(day) {
  const state = day.isMissing
    ? "is-missing"
    : day.classification === "not_enough_data"
    ? "is-incomplete"
    : day.classification === "within_guideline"
    ? "is-within"
    : "is-above";
  const ratified = day.sourceValidationStatus === "R" ? " is-ratified" : "";
  return `who-day-marker ${state}${ratified}`;
}

function markerStyle(day, guideline) {
  if (day.isMissing) return { size: 6, colour: "#8b96a1" };
  if (day.classification === "not_enough_data") {
    return { size: 9, colour: "#aab2ba" };
  }
  if (day.classification === "within_guideline") {
    return { size: 10, colour: "#319b5f" };
  }
  const exceedanceRatio = Math.max(
    0,
    (day.dailyMeanUgm3 - guideline) / guideline,
  );
  const progression = 1 - Math.exp(-exceedanceRatio / 2);
  return {
    size: 11 + progression * 9,
    colour: `hsl(${360 - progression * 68} 72% ${48 - progression * 10}%)`,
  };
}
