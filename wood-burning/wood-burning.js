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
// UK-AIR Black Carbon network site environment types, checked 17/11/2026.
// Source: https://uk-air.defra.gov.uk/networks/find-sites?action=results&group_id=16&view=advanced
// Exact UK-AIR station-reference lookup only: never infer a type from the name.
const UK_AIR_ENVIRONMENT_TYPES = Object.freeze({
  UKA00451: "Rural Background",
  UKA00503: "Urban Background",
  UKA00353: "Urban Background",
  UKA00212: "Urban Background",
  UKA00626: "Urban Traffic",
  UKA00655: "Urban Background",
  UKA01025: "Urban Background",
  UKA01090: "Urban Traffic",
  UKA00217: "Urban Background",
  UKA00614: "Rural Background",
  UKA01027: "Urban Background",
  UKA00481: "Rural Background",
  UKA00602: "Urban Traffic",
  UKA00576: "Urban Background",
  UKA00170: "Rural Background",
  UKA00570: "Urban Background",
  UKA00171: "Rural Background",
  UKA00656: "Urban Background",
  UKA00315: "Urban Traffic",
  UKA00253: "Urban Background",
  UKA00572: "Urban Background",
  UKA00213: "Urban Background",
  UKA01055: "Urban Background",
  UKA00445: "Rural Background",
  UKA00393: "Suburban Background",
  UKA00362: "Rural Background",
});
const MAP_MAX_ZOOM = 8;
const mapView = { zoom: 1, panX: 0, panY: 0, width: 360, height: 520, stations: [], markers: [],
  pointers: new Map(), dragged: false, interacting: false, suppressNextClick: false, choiceTrigger: null };

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
  svg.replaceChildren(element("g", { class: "wb-map-geography" }),
    element("g", { class: "wb-map-labels" }), element("g", { class: "wb-map-stations" }));
  svg.querySelector(".wb-map-geography").append(element("image", { href: "./uk-monitoring-map.svg",
    x: 0, y: 0, width: 360, height: 520 }));
  const shell = document.querySelector("#monitoring-map-shell");
  const toggle = document.querySelector("#map-toggle");
  const mobile = matchMedia("(max-width: 767px)");
  const updateView = () => {
    const expanded = mobile.matches ? shell.classList.contains("is-expanded")
      : mapView.interacting || shell.matches(":hover") || shell.contains(document.activeElement);
    shell.classList.toggle("is-map-open", expanded);
    document.querySelector(".wb-map-controls").hidden = !expanded;
    if (!expanded) closeMapChoices();
    requestAnimationFrame(layoutMap);
  };
  const setExpanded = (expanded) => {
    if (!expanded) {
      closeMapChoices();
      hideMapTooltip();
      mapView.pointers.clear();
      mapView.interacting = false;
      // Mobile WebKit can keep a tapped SVG/control in :focus or :hover.
      // Always clear the open state explicitly before recalculating layout.
      shell.classList.remove("is-map-open");
    }
    shell.classList.toggle("is-expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Close Black Carbon sensor map" : "Open Black Carbon sensor map";
    updateView();
  };
  // Handle the touch release directly. On iOS a visually pressed button can
  // occasionally miss its synthesised click after interaction with the SVG.
  // Ignore the corresponding click, but preserve mouse and keyboard clicks.
  let lastTouchToggleAt = -Infinity;
  toggle.addEventListener("pointerup", (event) => {
    if (!mobile.matches || !["touch", "pen"].includes(event.pointerType)) return;
    if (event.cancelable) event.preventDefault();
    lastTouchToggleAt = performance.now();
    setExpanded(!shell.classList.contains("is-expanded"));
  });
  toggle.addEventListener("click", (event) => {
    if (event.detail !== 0 && performance.now() - lastTouchToggleAt < 750) {
      event.preventDefault();
      return;
    }
    setExpanded(!shell.classList.contains("is-expanded"));
  });
  shell.addEventListener("pointerenter", updateView);
  shell.addEventListener("pointerleave", updateView);
  shell.addEventListener("focusin", updateView);
  shell.addEventListener("focusout", () => requestAnimationFrame(updateView));
  mobile.addEventListener?.("change", updateView);
  shell.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!document.querySelector("#map-choices").hidden) { closeMapChoices(); event.stopPropagation(); return; }
    setExpanded(false);
    (toggle.offsetParent ? toggle : document.querySelector("#property-select")).focus();
  });
  document.querySelector("#map-zoom-in").addEventListener("click", () => zoomMap(mapView.zoom * 1.6));
  document.querySelector("#map-zoom-out").addEventListener("click", () => zoomMap(mapView.zoom / 1.6));
  document.querySelector("#map-reset").addEventListener("click", () => {
    mapView.zoom = 1; mapView.panX = mapView.panY = 0; closeMapChoices(); layoutMap();
  });
  new ResizeObserver(() => layoutMap()).observe(document.querySelector(".wb-map-viewport"));
  document.fonts?.ready.then(layoutMap);
  svg.addEventListener("wheel", (event) => {
    if (!shell.classList.contains("is-map-open") || !(event.ctrlKey || event.metaKey || event.shiftKey)) return;
    event.preventDefault();
    zoomMap(mapView.zoom * Math.exp(-event.deltaY * (event.ctrlKey ? .015 : .002)), mapPoint(event));
  }, { passive: false });
  svg.addEventListener("pointerdown", (event) => {
    if (!shell.classList.contains("is-map-open") || event.button !== 0) return;
    mapView.suppressNextClick = false;
    closeMapChoices();
    if (!mapView.pointers.size) {
      mapView.dragged = false;
      mapView.startX = event.clientX; mapView.startY = event.clientY;
    }
    mapView.interacting = true;
    mapView.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.target.setPointerCapture(event.pointerId);
    if (mapView.pointers.size === 2) {
      mapView.pinch = pinchState();
      for (const pointerId of mapView.pointers.keys()) svg.setPointerCapture(pointerId);
    }
  });
  svg.addEventListener("pointermove", (event) => {
    const previous = mapView.pointers.get(event.pointerId);
    if (!previous) return;
    mapView.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (mapView.pointers.size === 2) {
      const pinch = pinchState();
      if (mapView.pinch) {
        const rect = svg.getBoundingClientRect();
        zoomMap(mapView.pinch.zoom * pinch.distance / mapView.pinch.distance,
          { x: (pinch.x - rect.left) * mapView.width / rect.width,
            y: (pinch.y - rect.top) * mapView.height / rect.height }, mapView.pinch);
      }
      mapView.dragged = true;
      return;
    }
    const rect = svg.getBoundingClientRect();
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    if (mapView.dragged || Math.hypot(event.clientX - mapView.startX, event.clientY - mapView.startY) > 6) {
      if (!mapView.dragged) svg.setPointerCapture(event.pointerId);
      mapView.dragged = true;
      mapView.panX += dx * mapView.width / rect.width;
      mapView.panY += dy * mapView.height / rect.height;
      layoutMap();
    }
  });
  const endPointer = (event) => {
    // Touch pointer capture can retarget the synthetic click away from a tiny SVG
    // marker. Resolve a stationary single-finger tap by screen-pixel distance.
    const previous = mapView.pointers.get(event.pointerId);
    const stationaryTap = event.type === "pointerup"
      && (event.pointerType === "touch" || event.pointerType === "pen")
      && mapView.pointers.size === 1 && !mapView.dragged && previous
      && Math.hypot(event.clientX - mapView.startX, event.clientY - mapView.startY) <= 6;
    if (stationaryTap) {
      const rect = svg.getBoundingClientRect();
      const hit = mapView.markers
        .filter((marker) => marker.node.style.visibility !== "hidden")
        .map((marker) => ({
          marker,
          distance: Math.hypot(
            rect.left + marker.x * rect.width / mapView.width - event.clientX,
            rect.top + marker.y * rect.height / 520 - event.clientY,
          ),
        }))
        .filter(({ distance }) => distance <= 24)
        .sort((a, b) => a.distance - b.distance)[0];
      if (hit) {
        mapView.suppressNextClick = true;
        hit.marker.activate();
      }
    }
    mapView.pointers.delete(event.pointerId);
    mapView.pinch = mapView.pointers.size === 2 ? pinchState() : null;
    if (!mapView.pointers.size) {
      mapView.interacting = false;
      requestAnimationFrame(updateView);
    }
  };
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);
  svg.addEventListener("click", (event) => {
    if ((mapView.dragged && event.detail) || mapView.suppressNextClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      mapView.suppressNextClick = false;
    }
  }, true);
  updateView();
}

function mapPoint(event) {
  const rect = document.querySelector("#monitoring-map-svg").getBoundingClientRect();
  return { x: (event.clientX - rect.left) * mapView.width / rect.width,
    y: (event.clientY - rect.top) * mapView.height / rect.height };
}

function pinchState() {
  const [a, b] = [...mapView.pointers.values()];
  const rect = document.querySelector("#monitoring-map-svg").getBoundingClientRect();
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
  return { x, y, anchorX: (x - rect.left) * mapView.width / rect.width,
    anchorY: (y - rect.top) * mapView.height / rect.height,
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: mapView.zoom,
    panX: mapView.panX, panY: mapView.panY };
}

function zoomMap(value, anchor = { x: mapView.width / 2, y: 260 }, pinch = null) {
  const zoom = Math.max(1, Math.min(MAP_MAX_ZOOM, value));
  const oldZoom = pinch?.zoom ?? mapView.zoom;
  const oldPanX = pinch?.panX ?? mapView.panX, oldPanY = pinch?.panY ?? mapView.panY;
  mapView.panX = anchor.x - mapView.width / 2 - ((pinch?.anchorX ?? anchor.x) - mapView.width / 2 - oldPanX) * zoom / oldZoom;
  mapView.panY = anchor.y - 260 - ((pinch?.anchorY ?? anchor.y) - 260 - oldPanY) * zoom / oldZoom;
  mapView.zoom = zoom;
  closeMapChoices(); layoutMap();
}

function closeMapChoices() {
  const choices = document.querySelector("#map-choices");
  if (choices.hidden) return;
  choices.hidden = true; choices.replaceChildren();
  mapView.choiceTrigger?.focus(); mapView.choiceTrigger = null;
}

function showMapChoices(stations, marker) {
  const choices = document.querySelector("#map-choices");
  choices.replaceChildren();
  const heading = document.createElement("strong"); heading.textContent = "Choose Black Carbon sensor"; choices.append(heading);
  stations.forEach(({ station }) => {
    const button = document.createElement("button"); button.type = "button";
    button.textContent = station.name; button.setAttribute("aria-label", `View charts for ${station.name}`);
    button.addEventListener("click", () => { choices.hidden = true; mapView.choiceTrigger = null; navigateToStation(station.station_id); });
    choices.append(button);
  });
  const viewport = document.querySelector(".wb-map-viewport");
  const rect = viewport.getBoundingClientRect();
  const svgRect = document.querySelector("#monitoring-map-svg").getBoundingClientRect();
  choices.style.left = `${Math.max(8, Math.min(rect.width - 220, marker.x * svgRect.width / mapView.width + svgRect.left - rect.left))}px`;
  choices.style.top = `${Math.max(8, Math.min(rect.height - 100, marker.y * svgRect.height / mapView.height + svgRect.top - rect.top))}px`;
  choices.hidden = false; mapView.choiceTrigger = marker.node;
  choices.querySelector("button").focus();
}

function navigateToStation(stationId) {
  if (!data) return;
  const index = data.sensors.findIndex((station) => station.station_id === stationId);
  if (index < 0) return;
  const destinationPage = Math.floor(index / PAGE_SIZE);
  if (page !== destinationPage) { page = destinationPage; render(); }
  const group = [...document.querySelectorAll("#sensor-charts .wb-sensor-group")]
    .find((node) => Number(node.dataset.stationId) === stationId);
  if (!group) return;
  const shell = document.querySelector("#monitoring-map-shell");
  const mobile = matchMedia("(max-width: 767px)").matches;
  if (mobile) {
    shell.classList.remove("is-expanded", "is-map-open");
    const toggle = document.querySelector("#map-toggle");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Open Black Carbon sensor map";
  }
  group.classList.add("is-map-destination");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (mobile) {
    // The expanded mobile map changes page height for 280 ms on close.
    // Scroll only after its transition settles, otherwise iOS can land
    // halfway down this two-chart card rather than at its station heading.
    setTimeout(() => requestAnimationFrame(() => {
      if (!group.isConnected) return;
      const top = window.scrollY + group.getBoundingClientRect().top - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      group.focus({ preventScroll: true });
    }), reducedMotion ? 0 : 330);
  } else {
    group.focus({ preventScroll: true });
    group.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
  setTimeout(() => group.classList.remove("is-map-destination"), reducedMotion ? 900 : 1800);
}

function stationAction(node, station) {
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "0");
  node.setAttribute("aria-label", `View charts for ${station.name}`);
  node.addEventListener("click", () => { if (!mapView.dragged) navigateToStation(station.station_id); });
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    navigateToStation(station.station_id);
  });
  return node;
}

function renderMapStations() {
  const markers = document.querySelector("#monitoring-map-svg .wb-map-stations");
  markers.replaceChildren(); mapView.markers = []; mapView.stations = [];
  if (!data) { layoutMap(); return; }
  const project = (lat, lon) => ({
    x: MAP_PROJECTION.offsetX + (lon - MAP_PROJECTION.minimumLongitude) * MAP_PROJECTION.cosineStandardLatitude * MAP_PROJECTION.scale,
    y: MAP_PROJECTION.offsetY + (MAP_PROJECTION.maximumLatitude - lat) * MAP_PROJECTION.scale,
  });
  mapView.stations = data.sensors.map((station) => ({ station, ...project(station.latitude, station.longitude) }));
  // Markers that cannot separate to a touch target at maximum zoom get a local choice.
  const groups = [];
  for (const item of mapView.stations) {
    const group = groups.find((members) => members.some((other) =>
      Math.hypot(item.x - other.x, item.y - other.y) * MAP_MAX_ZOOM < 22));
    if (group) group.push(item); else groups.push([item]);
  }
  groups.forEach((members) => {
    const marker = { members, x: 0, y: 0 };
    const name = members.map(({ station }) => station.name).join(", ");
    const node = element("g", { class: "wb-map-marker", role: "button", tabindex: 0,
      "aria-label": members.length === 1 ? `View charts for ${name}` : `Choose among ${members.length} stations: ${name}` });
    marker.node = node;
    const activate = (keyboard = false) => {
      if (mapView.dragged && !keyboard) return;
      if (members.length === 1) navigateToStation(members[0].station.station_id);
      else showMapChoices(members, marker);
    };
    marker.activate = activate;
    node.addEventListener("click", () => activate());
    node.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); activate(true);
    });
    node.addEventListener("pointerenter", () => showMapTooltip(name, marker));
    node.addEventListener("pointerleave", hideMapTooltip);
    node.addEventListener("focus", () => showMapTooltip(name, marker));
    node.addEventListener("blur", hideMapTooltip);
    node.append(element("circle", { class: "wb-map-hit", r: 12 }),
      element("circle", { class: "wb-map-dot", r: members.length > 1 ? 7 : 5 }));
    if (members.length > 1) {
      const count = element("text", { class: "wb-map-count", y: 3, "text-anchor": "middle", "aria-hidden": "true" });
      count.textContent = String(members.length); node.append(count);
    }
    markers.append(node); mapView.markers.push(marker);
  });
  layoutMap();
}

function showMapTooltip(name, marker) {
  if (!document.querySelector("#monitoring-map-shell").classList.contains("is-map-open")) return;
  const tooltip = document.querySelector("#map-tooltip");
  tooltip.textContent = name; tooltip.hidden = false;
  const viewport = document.querySelector(".wb-map-viewport").getBoundingClientRect();
  const svg = document.querySelector("#monitoring-map-svg").getBoundingClientRect();
  const x = marker.x * svg.width / mapView.width + svg.left - viewport.left;
  const y = marker.y * svg.height / mapView.height + svg.top - viewport.top;
  tooltip.style.left = `${Math.max(8, Math.min(viewport.width - tooltip.offsetWidth - 8, x - tooltip.offsetWidth / 2))}px`;
  tooltip.style.top = `${Math.max(8, y - tooltip.offsetHeight - 12)}px`;
}

function hideMapTooltip() { document.querySelector("#map-tooltip").hidden = true; }

function boxesOverlap(a, b, gap = 4) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

function layoutMap() {
  const svg = document.querySelector("#monitoring-map-svg");
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  mapView.width = 520 * rect.width / rect.height;
  svg.setAttribute("viewBox", `0 0 ${mapView.width} 520`);
  const z = mapView.zoom;
  const maxX = Math.min((z - 1) * (180 + mapView.width / 2 - 60), 180 * z + mapView.width / 2 - 120);
  const maxY = Math.min((z - 1) * 460, 260 * z + 140);
  mapView.panX = Math.max(-maxX, Math.min(maxX, mapView.panX));
  mapView.panY = Math.max(-maxY, Math.min(maxY, mapView.panY));
  const screen = (x, y) => ({ x: mapView.width / 2 + (x - 180) * z + mapView.panX,
    y: 260 + (y - 260) * z + mapView.panY });
  svg.querySelector(".wb-map-geography").setAttribute("transform",
    `translate(${mapView.width / 2 - 180 * z + mapView.panX} ${260 - 260 * z + mapView.panY}) scale(${z})`);
  mapView.markers.forEach((marker) => {
    const center = marker.members.reduce((sum, item) => ({ x: sum.x + item.x, y: sum.y + item.y }), { x: 0, y: 0 });
    const point = screen(center.x / marker.members.length, center.y / marker.members.length);
    marker.x = point.x; marker.y = point.y;
    marker.node.setAttribute("transform", `translate(${point.x} ${point.y})`);
    marker.node.style.visibility = point.x < -12 || point.x > mapView.width + 12 || point.y < -12 || point.y > 532 ? "hidden" : "visible";
  });
  const labels = svg.querySelector(".wb-map-labels"); labels.replaceChildren();
  const open = document.querySelector("#monitoring-map-shell").classList.contains("is-map-open");
  if (!open) { hideMapTooltip(); return; }
  const occupied = [];
  const points = mapView.stations.map((item) => ({ ...item, ...screen(item.x, item.y) }));
  const markerBoxes = mapView.markers.map((marker) => ({ x: marker.x - 7, y: marker.y - 7, width: 14, height: 14 }));
  const controls = document.querySelector(".wb-map-controls").getBoundingClientRect();
  markerBoxes.push({ x: (controls.left - rect.left) * mapView.width / rect.width,
    y: (controls.top - rect.top) * 520 / rect.height,
    width: controls.width * mapView.width / rect.width,
    height: controls.height * 520 / rect.height });
  points.sort((a, b) => a.station.station_id - b.station.station_id);
  for (const item of points) {
    if (item.x < 12 || item.x > mapView.width - 12 || item.y < 12 || item.y > 508) continue;
    const text = element("text", { class: "wb-map-label", x: 0, y: 0 }); text.textContent = item.station.name;
    labels.append(text);
    const bounds = text.getBBox(); text.remove();
    const placements = [
      { x: item.x + 11, y: item.y + 4 }, { x: item.x - bounds.width - 11, y: item.y + 4 },
      { x: item.x - bounds.width / 2, y: item.y - 13 },
      { x: item.x - bounds.width / 2, y: item.y + 19 },
    ];
    for (const position of placements) {
      const box = { x: position.x + bounds.x, y: position.y + bounds.y,
        width: bounds.width, height: bounds.height };
      if (box.x < 6 || box.y < 6 || box.x + box.width > mapView.width - 6 || box.y + box.height > 514
          || occupied.some((other) => boxesOverlap(box, other))
          || markerBoxes.some((other) => boxesOverlap(box, other, 2))) continue;
      const action = stationAction(element("g", { class: "wb-map-label-action" }), item.station);
      text.setAttribute("x", position.x); text.setAttribute("y", position.y);
      action.append(text); labels.append(action); occupied.push(box);
      break;
    }
  }
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
  const width = 520, height = 270, margin = { top: 12, right: 14, bottom: 39, left: 68 };
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
  const titleX = 25, titleY = (margin.top + height - margin.bottom) / 2;
  const unit = element("text", { class: "wb-axis-title wb-axis-title--y", x: titleX, y: titleY,
    "text-anchor": "middle", transform: `rotate(-90 ${titleX} ${titleY})` });
  unit.textContent = `${PROPERTY_LABELS[property]} µg/m³`; svg.append(unit);
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
    button.setAttribute("aria-label", `${label} ${month.month.slice(0, 4)}`);
    button.addEventListener("click", () => { selected = selected === month.month ? null : month.month; emphasise(selected); });
    button.addEventListener("mouseenter", () => emphasise(month.month, true)); button.addEventListener("mouseleave", () => emphasise(selected, true));
    button.addEventListener("focus", () => emphasise(month.month, true)); button.addEventListener("blur", () => emphasise(selected, true)); legend.append(button);
  });
  card.append(legend);
  const coverage = document.createElement("p"); coverage.className = "wb-completeness";
  coverage.textContent = months.length ? months.map((month) => `${MONTH_NAMES[Number(month.month.slice(5)) - 1]}: ${month.observed_source_days}/${month.expected_source_days} days`).join(" · ") : "No months available for this season.";
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
    const title = document.createElement("strong");
    title.textContent = `${MONTH_NAMES[Number(best.month.month.slice(5)) - 1]} ${best.month.month.slice(0, 4)}`;
    tooltip.append(title, document.createElement("br"),
      `${String(hour).padStart(2, "0")}:00 GMT · ${best.point.mean_ugm3.toFixed(2)} µg/m³ · ${best.point.observation_count} observations`);
    const cardRect = card.getBoundingClientRect();
    const chartLeft = rect.left - cardRect.left, chartTop = rect.top - cardRect.top;
    const left = Math.min(event.clientX - cardRect.left + 12, chartLeft + rect.width - tooltip.offsetWidth - 8);
    const above = event.clientY - cardRect.top - tooltip.offsetHeight - 12;
    const top = above >= chartTop + 8 ? above : event.clientY - cardRect.top + 12;
    tooltip.style.left = `${Math.max(chartLeft + 8, left)}px`;
    tooltip.style.top = `${Math.max(chartTop + 8, Math.min(chartTop + rect.height - tooltip.offsetHeight - 8, top))}px`;
  });
  svg.addEventListener("pointerleave", () => card.querySelector(".wb-tooltip")?.remove());
  return card;
}

function render() {
  const container = document.querySelector("#sensor-charts"); container.replaceChildren();
  const summer = selectedPeriod("Summer"), winter = selectedPeriod("Winter");
  data.sensors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((station) => {
    const group = document.createElement("article"); group.className = "wb-sensor-group";
    group.dataset.stationId = String(station.station_id);
    group.tabIndex = -1;
    const header = document.createElement("header"), name = document.createElement("h3"), meta = document.createElement("span");
    name.textContent = station.name;
    meta.className = "wb-sensor-meta";
    const environmentType = UK_AIR_ENVIRONMENT_TYPES[station.station_ref];
    meta.textContent = `${environmentType ? `${environmentType} · ` : ""}Station ${station.station_ref} · source through ${data.source_through_day}`;
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
  document.querySelector("#map-caption").textContent = "Loading Black Carbon sensors…";

  document.querySelector("#sensor-charts").replaceChildren();
  renderMapStations();
  document.querySelectorAll("[data-pagination]").forEach((nav) => { nav.replaceChildren(); nav.hidden = true; });
  status("Loading Black Carbon monitoring data…");
  try {
    const base = window.ukAqSharedAuth?.cacheBaseUrl;
    if (!base) throw new Error("Cache API configuration is unavailable");
    const response = await window.ukAqFetchCacheApi(`${base}/bc-uv/diurnal`, { headers: { Accept: "application/json" } });
    if (response.status === 404) {
      document.querySelector("#map-caption").textContent = "Black Carbon sensors";
      status("Black Carbon profiles are not available yet. Please try again later.", true);
      return;
    }
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    data = validateProduct(await response.json());
    data.sensors.sort((a, b) => a.name.localeCompare(b.name, "en-GB") || a.station_id - b.station_id);
    const sensorCount = data.sensors.length;
    document.querySelector("#map-caption").textContent =
      `${sensorCount} Black Carbon ${sensorCount === 1 ? "sensor" : "sensors"}`;

    if (!data.sensors.length) { status("No eligible Black Carbon sensors are available."); return; }
    page = 0; renderMapStations(); render(); status("");
    document.fonts?.ready.then(() => { if (data) renderMapStations(); });
  } catch (_error) {
    data = null;
    document.querySelector("#map-caption").textContent = "Black Carbon sensors";
    renderMapStations(); status("Black Carbon profiles could not be loaded. Please try again.", true);
  }
}

document.querySelector("#property-select").addEventListener("change", (event) => { property = event.target.value; page = 0; if (data) render(); });
initializeMap(); load();
