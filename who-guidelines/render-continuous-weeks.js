import { addUtcDays } from "./who-guidelines-data.js";
import {
  attachDayMarkerNavigation,
  createDayDetail,
  createDayMarker,
} from "./who-guidelines-markers.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

export function renderContinuousWeeks(container, model) {
  const daysByKey = new Map(model.days.map((day) => [day.dayUtc, day]));
  const startOffset = model.days[0].weekdayMondayZero;
  const gridStart = addUtcDays(model.windowStartDayUtc, -startOffset);
  const weekCount = Math.ceil((startOffset + model.days.length) / 7);

  const scroller = document.createElement("div");
  scroller.className = "who-wide-scroller";
  scroller.tabIndex = 0;
  scroller.setAttribute(
    "aria-label",
    "Continuous weeks; scroll horizontally to see the whole year",
  );
  const grid = document.createElement("div");
  grid.className = "who-weeks-grid";
  grid.style.setProperty("--who-week-count", String(weekCount));

  const corner = document.createElement("span");
  corner.className = "who-weeks-corner";
  grid.appendChild(corner);
  const labelledWeeks = new Set();
  for (const day of model.days) {
    if (day.dayOfMonth !== 1 && day.index !== 0) continue;
    const daysFromGridStart = Math.round(
      (day.date.getTime() - new Date(`${gridStart}T00:00:00.000Z`).getTime()) /
        86_400_000,
    );
    const week = Math.floor(daysFromGridStart / 7);
    if (labelledWeeks.has(week)) continue;
    labelledWeeks.add(week);
    const label = document.createElement("span");
    label.className = "who-week-month-label";
    label.style.gridColumn = String(week + 2);
    label.textContent = MONTH_FORMAT.format(day.date);
    grid.appendChild(label);
  }

  WEEKDAYS.forEach((weekday, weekdayIndex) => {
    const label = document.createElement("span");
    label.className = "who-weekday-label";
    label.style.gridRow = String(weekdayIndex + 2);
    label.textContent = weekday;
    grid.appendChild(label);
  });

  for (let week = 0; week < weekCount; week += 1) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const key = addUtcDays(gridStart, week * 7 + weekday);
      const cell = document.createElement("div");
      cell.className = "who-week-cell";
      cell.style.gridColumn = String(week + 2);
      cell.style.gridRow = String(weekday + 2);
      const day = daysByKey.get(key);
      if (day) {
        cell.appendChild(createDayMarker(day, model.guideline, day.index));
      } else {
        cell.classList.add("is-outside-window");
      }
      grid.appendChild(cell);
    }
  }

  scroller.appendChild(grid);
  container.replaceChildren(scroller, createDayDetail());
  attachDayMarkerNavigation(container, model.days);
}
