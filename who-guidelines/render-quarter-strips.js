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

export function renderQuarterStrips(container, model) {
  const strips = splitIntoFour(model.days);
  const stripList = document.createElement("div");
  stripList.className = "who-quarter-strips";

  strips.forEach((days, stripIndex) => {
    const section = document.createElement("section");
    section.className = "who-quarter-strip";
    const heading = document.createElement("h3");
    heading.textContent = `Strip ${stripIndex + 1}`;
    section.appendChild(heading);
    const scroller = document.createElement("div");
    scroller.className = "who-wide-scroller";
    scroller.tabIndex = 0;
    scroller.setAttribute(
      "aria-label",
      `Quarter strip ${stripIndex + 1}; scroll horizontally to see all dates`,
    );

    const grid = document.createElement("div");
    grid.className = "who-quarter-grid";
    grid.style.setProperty("--who-quarter-days", String(days.length));
    days.forEach((day, column) => {
      if (column === 0 || day.dayOfMonth === 1) {
        const month = document.createElement("span");
        month.className = "who-quarter-month-label";
        month.style.gridColumn = String(column + 1);
        month.textContent = MONTH_FORMAT.format(day.date);
        grid.appendChild(month);
      }
      const cell = document.createElement("div");
      cell.className = "who-quarter-day";
      if (day.dayOfMonth === 1) cell.classList.add("is-month-start");
      cell.style.gridColumn = String(column + 1);
      cell.appendChild(createDayMarker(day, model.guideline, day.index));
      grid.appendChild(cell);
    });
    scroller.appendChild(grid);
    section.appendChild(scroller);
    stripList.appendChild(section);
  });

  container.replaceChildren(stripList, createDayDetail());
  attachDayMarkerNavigation(container, model.days);
}

function splitIntoFour(days) {
  const baseLength = Math.floor(days.length / 4);
  const remainder = days.length % 4;
  const result = [];
  let offset = 0;
  for (let index = 0; index < 4; index += 1) {
    const length = baseLength + (index < remainder ? 1 : 0);
    result.push(days.slice(offset, offset + length));
    offset += length;
  }
  return result;
}
