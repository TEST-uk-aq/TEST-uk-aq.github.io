import {
  attachDayMarkerNavigation,
  createDayDetail,
  createDayMarker,
} from "./who-guidelines-markers.js";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function renderCalendarMonths(container, model) {
  const months = groupedMonths(model.days);
  const grid = document.createElement("div");
  grid.className = "who-calendar-month-grid";

  months.forEach(({ year, month, days }) => {
    const section = document.createElement("section");
    section.className = "who-calendar-month";
    const heading = document.createElement("h3");
    heading.textContent = MONTH_FORMAT.format(
      new Date(Date.UTC(year, month, 1)),
    );
    section.appendChild(heading);

    const weekdayRow = document.createElement("div");
    weekdayRow.className = "who-calendar-weekdays";
    WEEKDAYS.forEach((weekday) => {
      const label = document.createElement("span");
      label.textContent = weekday;
      weekdayRow.appendChild(label);
    });
    section.appendChild(weekdayRow);

    const dayGrid = document.createElement("div");
    dayGrid.className = "who-calendar-days";
    const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) %
      7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const daysByNumber = new Map(days.map((day) => [day.dayOfMonth, day]));
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const dayNumber = cellIndex - firstWeekday + 1;
      const cell = document.createElement("div");
      cell.className = "who-calendar-day";
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cell.classList.add("is-calendar-empty");
      } else {
        const number = document.createElement("span");
        number.className = "who-calendar-day-number";
        number.textContent = String(dayNumber);
        cell.appendChild(number);
        const day = daysByNumber.get(dayNumber);
        if (day) {
          cell.appendChild(createDayMarker(day, model.guideline, day.index));
        } else {
          cell.classList.add("is-outside-window");
        }
      }
      dayGrid.appendChild(cell);
    }
    section.appendChild(dayGrid);
    grid.appendChild(section);
  });

  container.replaceChildren(grid, createDayDetail());
  attachDayMarkerNavigation(container, model.days);
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
