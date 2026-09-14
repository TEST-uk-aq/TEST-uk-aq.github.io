import {
  attachDayMarkerNavigation,
  createDayDetail,
  createDayMarker,
} from "./who-guidelines-markers.js";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function renderMonthRows(container, model) {
  const scroller = document.createElement("div");
  scroller.className = "who-wide-scroller";
  scroller.tabIndex = 0;
  scroller.setAttribute(
    "aria-label",
    "Month rows; scroll horizontally to see all dates",
  );
  const rows = document.createElement("div");
  rows.className = "who-month-rows";

  const header = document.createElement("div");
  header.className = "who-month-row who-month-row-header";
  header.appendChild(labelCell("Month"));
  for (let day = 1; day <= 31; day += 1) {
    const dayLabel = document.createElement("div");
    dayLabel.className = "who-month-row-header-day";
    dayLabel.textContent = String(day);
    header.appendChild(dayLabel);
  }
  rows.appendChild(header);

  for (const group of groupedMonths(model.days)) {
    const row = document.createElement("div");
    row.className = "who-month-row";
    row.appendChild(
      labelCell(
        MONTH_FORMAT.format(new Date(Date.UTC(group.year, group.month, 1))),
      ),
    );
    const daysByNumber = new Map(
      group.days.map((day) => [day.dayOfMonth, day]),
    );
    const daysInMonth = new Date(Date.UTC(group.year, group.month + 1, 0))
      .getUTCDate();
    for (let dayNumber = 1; dayNumber <= 31; dayNumber += 1) {
      const cell = document.createElement("div");
      cell.className = "who-month-row-day";
      const day = daysByNumber.get(dayNumber);
      if (day) {
        cell.appendChild(createDayMarker(day, model.guideline, day.index));
      } else {
        cell.classList.add(
          dayNumber > daysInMonth ? "is-impossible" : "is-outside-window",
        );
      }
      row.appendChild(cell);
    }
    rows.appendChild(row);
  }

  scroller.appendChild(rows);
  container.replaceChildren(scroller, createDayDetail());
  attachDayMarkerNavigation(container, model.days);
}

function labelCell(text) {
  const cell = document.createElement("div");
  cell.className = "who-month-row-label";
  cell.textContent = text;
  return cell;
}

function groupedMonths(days) {
  const groups = [];
  for (const day of days) {
    const key = `${day.year}-${day.month}`;
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, year: day.year, month: day.month, days: [] };
      groups.push(group);
    }
    group.days.push(day);
  }
  return groups;
}
