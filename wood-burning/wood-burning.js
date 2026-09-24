import { WOOD_BURNING_DEMO_DATA as data } from "./wood-burning-demo-data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const PAGE_SIZE = 6;
const COLOURS = ["#3C78AC", "#D17C2F", "#667A2E", "#8A5CA8", "#C54B63", "#168C8C"];
const PROPERTY_LABELS = { bc: "Black Carbon", uv370: "UV 370 nm", uvpm: "UVPM" };
const WINTER = new Set([10, 11, 12, 1, 2, 3]);
let page = 0;
let property = "bc";

const element = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};

function mountMap() {
  const svg = document.querySelector("#monitoring-map-svg");
  // Simplified from Natural Earth 1:10m Admin 0 UK geometry (public domain):
  // https://www.naturalearthdata.com/downloads/10m-cultural-vectors/
  // The separate land shapes intentionally include Great Britain and Northern
  // Ireland only; the Republic of Ireland is not drawn.
  const outline = element("g", { fill: "#e3e5e5", stroke: "#4b555c", "stroke-width": "2.1", "stroke-linejoin": "round" });
  outline.append(
    element("path", { d: "M183 34 205 48 199 65 219 72 210 90 226 103 214 122 226 137 211 150 216 171 199 185 205 204 193 219 203 238 195 257 207 276 198 297 207 313 198 331 205 348 193 363 191 383 178 399 169 420 152 436 132 444 118 437 124 419 112 407 126 389 125 370 139 358 132 342 148 326 145 305 157 289 154 270 167 252 160 233 172 216 166 196 177 180 167 160 178 145 166 126 178 111 164 94 174 78 164 61Z" }),
    element("path", { d: "M102 276 116 283 114 301 126 313 118 329 101 326 92 341 76 335 70 318 78 300 91 298Z" }),
    element("path", { d: "M136 444 151 450 146 463 128 468 113 461 100 466 88 456 98 444 116 449Z" }),
    element("path", { d: "M80 221 95 225 99 239 91 253 75 249 64 260 51 251 55 234 67 225Z" }),
    element("path", { d: "M195 19 204 25 199 34 190 32Z" })
  );
  svg.append(outline);
  const project = (lat, lon) => ({ x: 58 + ((lon + 8.2) / 10.4) * 170, y: 448 - ((lat - 49.8) / 9.2) * 405 });
  const labelOffsets = [[10,-9],[10,-5],[10,-4],[-117,2],[10,5],[-118,9],[10,8],[-115,-8]];
  data.stations.forEach((station, index) => {
    const { x, y } = project(station.latitude, station.longitude);
    const [dx, dy] = labelOffsets[index];
    const anchor = dx < 0 ? "end" : "start";
    const endX = x + dx + (dx < 0 ? -3 : 3);
    svg.append(element("line", { class: "wb-map-leader", x1: x, y1: y, x2: endX, y2: y + dy }));
    const dot = element("circle", { class: "wb-map-dot", cx: x, cy: y, r: 5, tabindex: "0" });
    dot.append(element("title")); dot.firstChild.textContent = station.station_name;
    svg.append(dot);
    const label = element("text", { class: "wb-map-label", x: x + dx, y: y + dy + 3, "text-anchor": anchor });
    label.textContent = station.station_name.replace("Example monitoring ", "Example ");
    svg.append(label);
  });

  const shell = document.querySelector("#monitoring-map-shell");
  const toggle = document.querySelector("#map-toggle");
  const setExpanded = (expanded) => {
    shell.classList.toggle("is-expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Close monitoring map" : "Expand monitoring map";
  };
  toggle.addEventListener("click", () => setExpanded(!shell.classList.contains("is-expanded")));
  shell.addEventListener("keydown", (event) => { if (event.key === "Escape") { setExpanded(false); toggle.focus(); } });
}

function niceScale(station) {
  const values = station.profiles[property].flatMap((month) => month.points.map((point) => point.mean_ugm3)).filter(Number.isFinite);
  const rawMin = property === "uvpm" ? Math.min(0, ...values) : 0;
  const rawMax = Math.max(0.1, ...values);
  const span = rawMax - rawMin;
  const rough = span / 4;
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

function renderChart(station, months, heading, scale) {
  const card = document.createElement("section");
  card.className = "wb-chart-card";
  card.innerHTML = `<h4>${heading}</h4>`;
  const width = 520, height = 270, margin = { top: 12, right: 14, bottom: 39, left: 52 };
  const x = (hour) => margin.left + ((hour - 1) / 23) * (width - margin.left - margin.right);
  const y = (value) => height - margin.bottom - ((value - scale.min) / (scale.max - scale.min)) * (height - margin.top - margin.bottom);
  const svg = element("svg", { class: "wb-chart-svg", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${heading} illustrative ${PROPERTY_LABELS[property]} monthly profiles for ${station.station_name}` });
  scale.ticks.forEach((tick) => {
    svg.append(element("line", { class: "wb-grid-line", x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick) }));
    const label = element("text", { class: "wb-axis-label", x: margin.left - 8, y: y(tick) + 3, "text-anchor": "end" }); label.textContent = Number(tick.toFixed(2)); svg.append(label);
  });
  svg.append(element("line", { class: "wb-axis-line", x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom }));
  svg.append(element("line", { class: "wb-axis-line", x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom }));
  [1, 6, 12, 18, 24].forEach((hour) => { const tick = element("text", { class: "wb-axis-label", x: x(hour), y: height - 18, "text-anchor": "middle" }); tick.textContent = `${String(hour).padStart(2,"0")}:00`; svg.append(tick); });
  const unit = element("text", { class: "wb-axis-title", x: 12, y: 10 }); unit.textContent = "µg/m³"; svg.append(unit);
  const xTitle = element("text", { class: "wb-axis-title", x: (margin.left + width - margin.right) / 2, y: height - 3, "text-anchor": "middle" }); xTitle.textContent = "GMT hour ending"; svg.append(xTitle);
  months.forEach((month, index) => svg.append(element("path", { class: "wb-month-line", d: linePath(month.points, x, y), stroke: COLOURS[index], "data-month": month.month })));
  card.append(svg);
  const legend = document.createElement("div"); legend.className = "wb-legend"; legend.setAttribute("aria-label", `${heading} months`);
  let selected = null;
  const emphasise = (month, temporary = false) => {
    svg.querySelectorAll(".wb-month-line").forEach((line) => {
      const active = !month || line.dataset.month === month;
      line.classList.toggle("is-subdued", !active);
      line.classList.toggle("is-emphasised", Boolean(month && active));
    });
    if (!temporary) legend.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.month === selected)));
  };
  months.forEach((month, index) => {
    const button = document.createElement("button"); button.type = "button"; button.dataset.month = month.month; button.textContent = month.month; button.style.setProperty("--series-colour", COLOURS[index]); button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => { selected = selected === month.month ? null : month.month; emphasise(selected); });
    button.addEventListener("mouseenter", () => emphasise(month.month, true)); button.addEventListener("mouseleave", () => emphasise(selected, true));
    button.addEventListener("focus", () => emphasise(month.month, true)); button.addEventListener("blur", () => emphasise(selected, true)); legend.append(button);
  });
  card.append(legend);
  svg.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect(); const svgX = (event.clientX - rect.left) * width / rect.width;
    const hour = Math.max(1, Math.min(24, Math.round(1 + ((svgX - margin.left) / (width - margin.left - margin.right)) * 23)));
    const candidates = months.map((month) => ({ month, point: month.points[hour - 1] })).filter((item) => Number.isFinite(item.point?.mean_ugm3));
    if (!candidates.length) return;
    const svgY = (event.clientY - rect.top) * height / rect.height;
    candidates.sort((a,b) => Math.abs(y(a.point.mean_ugm3)-svgY)-Math.abs(y(b.point.mean_ugm3)-svgY));
    let tooltip = card.querySelector(".wb-tooltip"); if (!tooltip) { tooltip = document.createElement("div"); tooltip.className = "wb-tooltip"; card.append(tooltip); }
    const best = candidates[0]; tooltip.innerHTML = `<strong>${best.month.month}</strong><br>${String(hour).padStart(2,"0")}:00 GMT · ${best.point.mean_ugm3.toFixed(2)} µg/m³`;
    tooltip.style.left = `${Math.max(12, Math.min(88, (event.clientX-rect.left)/rect.width*100))}%`; tooltip.style.top = `${(event.clientY-rect.top)/rect.height*100}%`;
  });
  svg.addEventListener("pointerleave", () => card.querySelector(".wb-tooltip")?.remove());
  return card;
}

function render() {
  const container = document.querySelector("#sensor-charts"); container.replaceChildren();
  data.stations.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).forEach((station) => {
    const group = document.createElement("article"); group.className = "wb-sensor-group";
    group.innerHTML = `<header><h3>${station.station_name}</h3><span class="wb-sensor-meta">Illustrative data · through ${data.source_through_day}</span></header>`;
    const pair = document.createElement("div"); pair.className = "wb-chart-pair";
    const profiles = station.profiles[property]; const summer = profiles.filter((month) => !WINTER.has(month.month_number)); const winter = profiles.filter((month) => WINTER.has(month.month_number)); const scale = niceScale(station);
    pair.append(renderChart(station, summer, "Summer · Apr–Sep 2026", scale), renderChart(station, winter, "Winter · Oct 2025–Mar 2026", scale)); group.append(pair); container.append(group);
  });
  const pages = Math.ceil(data.stations.length / PAGE_SIZE);
  document.querySelectorAll("[data-pagination]").forEach((nav, index) => {
    nav.setAttribute("role", "navigation"); nav.setAttribute("aria-label", `${index ? "Lower" : "Upper"} sensor chart pagination`);
    nav.innerHTML = `<button type="button" data-direction="-1" ${page === 0 ? "disabled" : ""}>Previous</button><span aria-live="polite">Page ${page + 1} of ${pages}</span><button type="button" data-direction="1" ${page === pages - 1 ? "disabled" : ""}>Next</button>`;
    nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { page += Number(button.dataset.direction); render(); document.querySelector("#charts-title").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }));
  });
}

function placeSummary() {
  const summary = document.querySelector("#wb-summary");
  const anchor = document.querySelector(matchMedia("(max-width: 767px)").matches ? "#summary-low-anchor" : "#summary-high-anchor");
  anchor.after(summary);
}

document.querySelector("#summary-sensors").textContent = data.stations.length;
document.querySelector("#summary-reporting").textContent = data.stations.filter((station) => station.reports_latest_day).length;
document.querySelector("#property-select").addEventListener("change", (event) => { property = event.target.value; page = 0; render(); });
const media = matchMedia("(max-width: 767px)"); media.addEventListener?.("change", placeSummary);
placeSummary(); mountMap(); render();
