const SVG_NS = "http://www.w3.org/2000/svg";
const PAGE_SIZE = 6;
const COLOURS = ["#3C78AC", "#D17C2F", "#667A2E", "#8A5CA8", "#C54B63", "#168C8C"];
const PROPERTY_LABELS = { bc: "Black Carbon", uv370: "UV 370 nm", uvpm: "UVPM" };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAP_PROJECTION = Object.freeze({ minimumLongitude: -8.7, maximumLatitude: 60.95,
  cosineStandardLatitude: 0.5682028519825839, scale: 44.12556053811657, offsetX: 47.11697248163364, offsetY: 14 });
let data = null;
let page = 0;
let property = "bc";

const element = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};
const validDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const nextMonth = (month) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
};
const monthIdentity = (month) => {
  const [year, number] = month.split("-").map(Number);
  return number >= 4 && number <= 9
    ? { season: "Summer", season_year: year }
    : { season: "Winter", season_year: number >= 10 ? year : year - 1 };
};

function validateProduct(value) {
  const fail = () => { throw new Error("Invalid BC/UV data response"); };
  if (!value || value.contract_version !== 1 || value.network_code !== "black_carbon"
      || !validDay(value.source_through_day) || !Number.isFinite(Date.parse(value.generated_at))
      || JSON.stringify(value.properties) !== JSON.stringify(["bc", "uv370", "uvpm"])
      || !Array.isArray(value.months) || !value.months.length || !Array.isArray(value.sensors)) fail();
  value.months.forEach((entry, index) => {
    if (!entry || typeof entry.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.month)
        || (index && entry.month !== nextMonth(value.months[index - 1].month))
        || entry.month > value.source_through_day.slice(0, 7)
        || entry.season !== monthIdentity(entry.month).season
        || entry.season_year !== monthIdentity(entry.month).season_year
        || !Number.isSafeInteger(entry.expected_source_days) || entry.expected_source_days < 1
        || typeof entry.complete_calendar_month !== "boolean") fail();
  });
  const ids = new Set();
  value.sensors.forEach((sensor) => {
    if (!sensor || !Number.isSafeInteger(sensor.station_id) || ids.has(sensor.station_id)
        || typeof sensor.station_ref !== "string" || !sensor.station_ref
        || typeof sensor.name !== "string" || !sensor.name.trim()
        || sensor.network_code !== "black_carbon"
        || !Number.isFinite(sensor.latitude) || !Number.isFinite(sensor.longitude)
        || sensor.latitude < 49 || sensor.latitude > 61 || sensor.longitude < -9 || sensor.longitude > 2.5
        || !sensor.timeseries_ids || Object.hasOwn(sensor.timeseries_ids, "uvpm")
        || !["bc", "uv370"].every((key) => sensor.timeseries_ids[key] === null
          || Number.isSafeInteger(sensor.timeseries_ids[key]) && sensor.timeseries_ids[key] > 0)
        || !["bc", "uv370"].some((key) => sensor.timeseries_ids[key] !== null)) fail();
    ids.add(sensor.station_id);
    for (const key of value.properties) {
      const profiles = sensor.profiles?.[key];
      if (!Array.isArray(profiles) || profiles.length !== value.months.length) fail();
      profiles.forEach((profile, index) => {
        if (profile?.month !== value.months[index].month || !Array.isArray(profile.points)
            || profile.points.length !== 24 || !Number.isSafeInteger(profile.observed_source_days)
            || profile.observed_source_days < 0 || profile.observed_source_days > value.months[index].expected_source_days
            || profile.expected_source_days !== value.months[index].expected_source_days
            || typeof profile.complete !== "boolean") fail();
        profile.points.forEach((point, hour) => {
          if (point?.month !== profile.month || point.hour_ending !== hour + 1
              || !Number.isSafeInteger(point.observation_count) || point.observation_count < 0
              || !Number.isSafeInteger(point.ratified_count) || !Number.isSafeInteger(point.provisional_count)
              || point.ratified_count < 0 || point.provisional_count < 0
              || point.ratified_count + point.provisional_count !== point.observation_count
              || (point.observation_count === 0
                ? point.mean_ugm3 !== null || point.source_validation_status !== null
                : !Number.isFinite(point.mean_ugm3)
                  || point.source_validation_status !== (point.provisional_count ? "P" : "R"))) fail();
        });
      });
    }
  });
  return value;
}

function selectedPeriod(season) {
  const matches = data.months.filter((entry) => entry.season === season);
  if (!matches.length) return { months: [], heading: `${season} · no period available`, complete: false };
  const year = matches.at(-1).season_year;
  const months = data.months.map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.season === season && entry.season_year === year);
  const full = months.length === 6 && months.every((entry) => entry.complete_calendar_month);
  const first = months[0].month;
  const last = months.at(-1).month;
  const label = first.slice(0, 4) === last.slice(0, 4)
    ? `${MONTH_NAMES[Number(first.slice(5)) - 1]}–${MONTH_NAMES[Number(last.slice(5)) - 1]} ${last.slice(0, 4)}`
    : `${MONTH_NAMES[Number(first.slice(5)) - 1]} ${first.slice(0, 4)}–${MONTH_NAMES[Number(last.slice(5)) - 1]} ${last.slice(0, 4)}`;
  return { months, heading: `${season} · ${label}${full ? "" : " (partial period)"}`, complete: full };
}

function initializeMap() {
  const svg = document.querySelector("#monitoring-map-svg");
  svg.replaceChildren(element("image", { href: "./uk-monitoring-map.svg", x: 0, y: 0, width: 360, height: 520,
    preserveAspectRatio: "xMidYMid meet" }), element("g", { class: "wb-map-stations" }));
  const shell = document.querySelector("#monitoring-map-shell");
  const toggle = document.querySelector("#map-toggle");
  const setExpanded = (expanded) => {
    shell.classList.toggle("is-expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Close monitoring map" : "Expand monitoring map";
  };
  toggle.addEventListener("click", () => setExpanded(!shell.classList.contains("is-expanded")));
  shell.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setExpanded(false);
    (toggle.offsetParent ? toggle : document.querySelector("#property-select")).focus();
  });
}

function renderMapStations() {
  const markers = document.querySelector("#monitoring-map-svg .wb-map-stations");
  markers.replaceChildren();
  if (!data) return;
  const project = (lat, lon) => ({
    x: MAP_PROJECTION.offsetX + (lon - MAP_PROJECTION.minimumLongitude) * MAP_PROJECTION.cosineStandardLatitude * MAP_PROJECTION.scale,
    y: MAP_PROJECTION.offsetY + (MAP_PROJECTION.maximumLatitude - lat) * MAP_PROJECTION.scale,
  });
  const stations = data.sensors.map((station) => ({ station, ...project(station.latitude, station.longitude) }));
  // Deterministic two-column label placement; the geographic dots stay at exact projected coordinates.
  for (const side of ["left", "right"]) {
    const column = stations.filter((item) => (item.x > 180 ? "right" : "left") === side)
      .sort((a, b) => a.y - b.y || a.station.station_id - b.station.station_id);
    const gap = Math.min(16, 490 / Math.max(column.length, 1));
    column.forEach((item, index) => {
      const low = 18 + index * gap;
      const high = 500 - (column.length - index - 1) * gap;
      const labelY = Math.max(low, Math.min(high, item.y));
      const labelX = side === "left" ? 8 : 352;
      markers.append(element("line", { class: "wb-map-leader", x1: item.x, y1: item.y, x2: labelX, y2: labelY }));
      const label = element("text", { class: "wb-map-label", x: labelX, y: labelY + 3,
        "text-anchor": side === "left" ? "start" : "end" });
      label.textContent = item.station.name;
      markers.append(label);
    });
  }
  stations.forEach(({ station, x, y }) => {
    const dot = element("circle", { class: "wb-map-dot", cx: x, cy: y, r: 5, tabindex: 0,
      "aria-label": `${station.name} monitoring location` });
    const title = element("title"); title.textContent = station.name; dot.append(title); markers.append(dot);
  });
}

function niceScale(months) {
  const values = months.flatMap((month) => month.points.map((point) => point.mean_ugm3)).filter(Number.isFinite);
  const rawMin = property === "uvpm" ? Math.min(0, ...values) : 0;
  const rawMax = Math.max(0.1, ...values);
  const rough = (rawMax - rawMin) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  const min = property === "uvpm" && rawMin < 0 ? Math.floor(rawMin / step) * step : 0;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = [];
  for (let value = min; value <= max + step / 10; value += step) ticks.push(Number(value.toFixed(8)));
  return { min, max, ticks };
}

function linePath(points, x, y) {
  let path = "";
  let open = false;
  points.forEach((point) => {
    if (!Number.isFinite(point.mean_ugm3)) { open = false; return; }
    path += `${open ? "L" : "M"}${x(point.hour_ending).toFixed(2)},${y(point.mean_ugm3).toFixed(2)}`;
    open = true;
  });
  return path;
}

function renderChart(station, period, scale) {
  const card = document.createElement("section"); card.className = "wb-chart-card";
  const heading = document.createElement("h4"); heading.textContent = period.heading; card.append(heading);
  const width = 520, height = 270, margin = { top: 12, right: 14, bottom: 39, left: 52 };
  const x = (hour) => margin.left + ((hour - 1) / 23) * (width - margin.left - margin.right);
  const y = (value) => height - margin.bottom - ((value - scale.min) / (scale.max - scale.min)) * (height - margin.top - margin.bottom);
  const svg = element("svg", { class: "wb-chart-svg", viewBox: `0 0 ${width} ${height}`, role: "img",
    "aria-label": `${period.heading} ${PROPERTY_LABELS[property]} monthly profiles for ${station.name}` });
  scale.ticks.forEach((tick) => {
    svg.append(element("line", { class: "wb-grid-line", x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick) }));
    const label = element("text", { class: "wb-axis-label", x: margin.left - 8, y: y(tick) + 3, "text-anchor": "end" });
    label.textContent = Number(tick.toFixed(2)); svg.append(label);
  });
  svg.append(element("line", { class: "wb-axis-line", x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom }));
  svg.append(element("line", { class: "wb-axis-line", x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom }));
  [1, 6, 12, 18, 24].forEach((hour) => { const tick = element("text", { class: "wb-axis-label", x: x(hour), y: height - 18, "text-anchor": "middle" }); tick.textContent = `${String(hour).padStart(2, "0")}:00`; svg.append(tick); });
  const unit = element("text", { class: "wb-axis-title", x: 12, y: 10 }); unit.textContent = `${PROPERTY_LABELS[property]} · µg/m³`; svg.append(unit);
  const xTitle = element("text", { class: "wb-axis-title", x: (margin.left + width - margin.right) / 2, y: height - 3, "text-anchor": "middle" }); xTitle.textContent = "GMT hour ending"; svg.append(xTitle);
  const months = period.months.map((entry) => ({ ...station.profiles[property][entry.index], identity: entry }));
  months.forEach((month) => svg.append(element("path", { class: "wb-month-line", d: linePath(month.points, x, y),
    stroke: COLOURS[(Number(month.month.slice(5)) - (period.heading.startsWith("Summer") ? 4 : 10) + 12) % 12], "data-month": month.month })));
  card.append(svg);
  if (!months.some((month) => month.points.some((point) => point.observation_count))) {
    const empty = document.createElement("p"); empty.className = "wb-completeness"; empty.textContent = "No observations for this period."; card.append(empty);
  }
  const legend = document.createElement("div"); legend.className = "wb-legend"; legend.setAttribute("aria-label", `${period.heading} months`);
  let selected = null;
  const emphasise = (month, temporary = false) => {
    svg.querySelectorAll(".wb-month-line").forEach((line) => {
      const active = !month || line.dataset.month === month;
      line.classList.toggle("is-subdued", !active);
      line.classList.toggle("is-emphasised", Boolean(month && active));
    });
    if (!temporary) legend.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.month === selected)));
  };
  months.forEach((month) => {
    const label = MONTH_NAMES[Number(month.month.slice(5)) - 1];
    const button = document.createElement("button"); button.type = "button"; button.dataset.month = month.month;
    button.textContent = label;
    button.style.setProperty("--series-colour", COLOURS[(Number(month.month.slice(5)) - (period.heading.startsWith("Summer") ? 4 : 10) + 12) % 12]);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${label} ${month.month.slice(0, 4)}${month.complete ? "" : ", incomplete observations"}`);
    button.addEventListener("click", () => { selected = selected === month.month ? null : month.month; emphasise(selected); });
    button.addEventListener("mouseenter", () => emphasise(month.month, true)); button.addEventListener("mouseleave", () => emphasise(selected, true));
    button.addEventListener("focus", () => emphasise(month.month, true)); button.addEventListener("blur", () => emphasise(selected, true)); legend.append(button);
  });
  card.append(legend);
  const coverage = document.createElement("p"); coverage.className = "wb-completeness";
  coverage.textContent = months.length ? months.map((month) => `${MONTH_NAMES[Number(month.month.slice(5)) - 1]}: ${month.observed_source_days}/${month.expected_source_days} days${month.complete ? "" : " (incomplete)"}`).join(" · ") : "No months available for this season.";
  card.append(coverage);
  svg.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect(); const svgX = (event.clientX - rect.left) * width / rect.width;
    const hour = Math.max(1, Math.min(24, Math.round(1 + ((svgX - margin.left) / (width - margin.left - margin.right)) * 23)));
    const candidates = months.map((month) => ({ month, point: month.points[hour - 1] })).filter((item) => Number.isFinite(item.point?.mean_ugm3));
    if (!candidates.length) return;
    const svgY = (event.clientY - rect.top) * height / rect.height;
    candidates.sort((a, b) => Math.abs(y(a.point.mean_ugm3) - svgY) - Math.abs(y(b.point.mean_ugm3) - svgY));
    let tooltip = card.querySelector(".wb-tooltip"); if (!tooltip) { tooltip = document.createElement("div"); tooltip.className = "wb-tooltip"; card.append(tooltip); }
    const best = candidates[0];
    tooltip.replaceChildren();
    const title = document.createElement("strong"); title.textContent = best.month.month; tooltip.append(title, document.createElement("br"),
      `${String(hour).padStart(2, "0")}:00 GMT · ${best.point.mean_ugm3.toFixed(2)} µg/m³ · ${best.point.observation_count} observations`);
    tooltip.style.left = `${Math.max(12, Math.min(88, (event.clientX - rect.left) / rect.width * 100))}%`;
    tooltip.style.top = `${(event.clientY - rect.top) / rect.height * 100}%`;
  });
  svg.addEventListener("pointerleave", () => card.querySelector(".wb-tooltip")?.remove());
  return card;
}

function render() {
  const container = document.querySelector("#sensor-charts"); container.replaceChildren();
  const summer = selectedPeriod("Summer"), winter = selectedPeriod("Winter");
  data.sensors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((station) => {
    const group = document.createElement("article"); group.className = "wb-sensor-group";
    const header = document.createElement("header"), name = document.createElement("h3"), meta = document.createElement("span");
    name.textContent = station.name; meta.className = "wb-sensor-meta"; meta.textContent = `Station ${station.station_ref} · source through ${data.source_through_day}`;
    header.append(name, meta); group.append(header);
    const pair = document.createElement("div"); pair.className = "wb-chart-pair";
    const chosen = [...summer.months, ...winter.months].map((entry) => station.profiles[property][entry.index]);
    const scale = niceScale(chosen);
    pair.append(renderChart(station, summer, scale), renderChart(station, winter, scale)); group.append(pair); container.append(group);
  });
  const pages = Math.ceil(data.sensors.length / PAGE_SIZE);
  document.querySelectorAll("[data-pagination]").forEach((nav, index) => {
    nav.replaceChildren(); nav.hidden = pages <= 1;
    nav.setAttribute("role", "navigation"); nav.setAttribute("aria-label", `${index ? "Lower" : "Upper"} sensor chart pagination`);
    const previous = document.createElement("button"), next = document.createElement("button"), label = document.createElement("span");
    previous.type = next.type = "button"; previous.textContent = "Previous"; next.textContent = "Next";
    previous.disabled = page === 0; next.disabled = page === pages - 1;
    label.setAttribute("aria-live", "polite"); label.textContent = `Page ${page + 1} of ${pages}`;
    for (const [button, direction] of [[previous, -1], [next, 1]]) button.addEventListener("click", () => {
      page += direction; render(); document.querySelector("#charts-title").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    nav.append(previous, label, next);
  });
}

function placeSummary() {
  const summary = document.querySelector("#wb-summary");
  const anchor = document.querySelector(matchMedia("(max-width: 767px)").matches ? "#summary-low-anchor" : "#summary-high-anchor");
  anchor.after(summary);
}

function status(message, retry = false) {
  const box = document.querySelector("#data-status"); box.replaceChildren(); box.hidden = !message;
  if (!message) return;
  box.append(document.createTextNode(message));
  if (retry) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = "Retry";
    button.addEventListener("click", load); box.append(button);
  }
}

async function load() {
  data = null;
  document.querySelector("#summary-sensors").textContent = "—";
  document.querySelector("#source-day").textContent = "";
  document.querySelector("#sensor-charts").replaceChildren();
  renderMapStations();
  document.querySelectorAll("[data-pagination]").forEach((nav) => { nav.replaceChildren(); nav.hidden = true; });
  status("Loading Black Carbon monitoring data…");
  try {
    const base = window.ukAqSharedAuth?.cacheBaseUrl;
    if (!base) throw new Error("Cache API configuration is unavailable");
    const response = await window.ukAqFetchCacheApi(`${base}/bc-uv/diurnal`, { headers: { Accept: "application/json" } });
    if (response.status === 404) { status("Black Carbon profiles are not available yet. Please try again later.", true); return; }
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    data = validateProduct(await response.json());
    data.sensors.sort((a, b) => a.name.localeCompare(b.name, "en-GB") || a.station_id - b.station_id);
    document.querySelector("#summary-sensors").textContent = String(data.sensors.length);
    document.querySelector("#source-day").textContent = `Source observations through ${data.source_through_day} (GMT).`;
    if (!data.sensors.length) { status("No eligible Black Carbon monitoring stations are available."); return; }
    page = 0; renderMapStations(); render(); status("");
  } catch (_error) {
    data = null; renderMapStations(); status("Black Carbon profiles could not be loaded. Please try again.", true);
  }
}

document.querySelector("#property-select").addEventListener("change", (event) => { property = event.target.value; page = 0; if (data) render(); });
const media = matchMedia("(max-width: 767px)"); media.addEventListener?.("change", placeSummary);
placeSummary(); initializeMap(); load();
