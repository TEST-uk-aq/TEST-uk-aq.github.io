// Authoritative Hex Map application URL and browser-history adapter.
import pollutantDomain from "../shared/domain/pollutants-module.js";
import networkController from "./hex-map-network-controller.js";

function initHexMapUrlState(root) {
  "use strict";

  if (!root?.document || !root.document.body.classList.contains("hex-map-page")) return;
  if (!pollutantDomain?.normalize || !networkController?.setUrlSelectionIntent) {
    throw new Error("Hex Map URL-state dependencies are unavailable.");
  }

  const REGION_OPTIONS = [
    "Northern Ireland", "Scotland", "Wales", "East Midlands", "East of England", "London",
    "North East", "North West", "South East", "South West", "West Midlands", "Yorkshire and The Humber",
  ];
  const REGION_LOOKUP = new Map(REGION_OPTIONS.map((name) => [name.toLowerCase(), name]));
  const METRICS = new Set(["mean", "median"]);
  const COLOR_SCALES = new Set(["linear", "power"]);
  const WINDOWS = new Set(["3h", "6h", "1d", "7d", "all"]);
  const CHART_RANGES = new Set(["12h", "24h", "7d", "31d", "90d"]);
  const DEFAULT_CR_REGION = "London";
  const DEFAULTS = Object.freeze({
    pollutant: "pm25", window: "6h", metric: "mean", colorScale: "power", chartRange: "24h",
  });

  let lastCrRegion = DEFAULT_CR_REGION;
  let bootstrapped = false;
  let applyingUrlState = false;
  let pendingRestore = null;

  function normalizeMap(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === "uk") return "UK";
    return REGION_LOOKUP.get(trimmed.toLowerCase()) || null;
  }

  function normalizeCrRegion(value) {
    const normalized = normalizeMap(value);
    return normalized && normalized !== "UK" ? normalized : null;
  }

  function normalizeArea(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized || null;
  }

  function parseNetworks(params) {
    if (!params.has("networks")) {
      return Object.freeze({ present: false, allSelected: false, codes: Object.freeze([]) });
    }
    const raw = String(params.get("networks") || "").trim().toLowerCase();
    if (raw === "all") {
      return Object.freeze({ present: true, allSelected: true, codes: Object.freeze([]) });
    }
    const codes = Array.from(new Set(raw.split(",")
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean)))
      .sort();
    return Object.freeze({ present: true, allSelected: false, codes: Object.freeze(codes) });
  }

  function parseState(search = root.location.search) {
    const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
    const map = normalizeMap(params.get("map")) || "UK";
    const mode = String(params.get("mode") || "").trim().toLowerCase() === "chart" ? "chart" : "map";
    return Object.freeze({
      map,
      pollutant: pollutantDomain.normalize(params.get("pollutant")) || DEFAULTS.pollutant,
      networks: parseNetworks(params),
      mapSettings: Object.freeze({
        metric: METRICS.has(params.get("metric")) ? params.get("metric") : DEFAULTS.metric,
        colorScale: COLOR_SCALES.has(params.get("color_scale")) ? params.get("color_scale") : DEFAULTS.colorScale,
        window: WINDOWS.has(params.get("window")) ? params.get("window") : DEFAULTS.window,
      }),
      area: normalizeArea(params.get("area")),
      mode,
      chartRange: mode === "chart" && CHART_RANGES.has(params.get("chart_range"))
        ? params.get("chart_range")
        : DEFAULTS.chartRange,
      present: Object.freeze({
        pollutant: params.has("pollutant"),
        window: params.has("window"),
        metric: params.has("metric"),
        colorScale: params.has("color_scale"),
        chartRange: params.has("chart_range"),
      }),
    });
  }

  const initialState = parseState();
  lastCrRegion = normalizeCrRegion(initialState.map) || DEFAULT_CR_REGION;

  function stateSnapshot(state = initialState) {
    return Object.freeze({
      ...state,
      networks: Object.freeze({ ...state.networks, codes: Object.freeze([...state.networks.codes]) }),
      mapSettings: Object.freeze({ ...state.mapSettings }),
      present: Object.freeze({ ...state.present }),
    });
  }

  function coordinator() {
    const value = root.UkAqHexMapCoordinator;
    if (!value?.getActiveMap || !value?.setActiveMap) throw new Error("Hex Map coordinator is unavailable.");
    return value;
  }

  function crController() {
    const value = root.crMap;
    if (!value?.setRegion) throw new Error("C&R Hex Map controller is unavailable.");
    return value;
  }

  function pageMode() {
    return root.UkAqHexMapPageMode || null;
  }

  function serializeBrowserUrl(url) {
    const search = url.search.replace(/([?&]networks=)([^&]*)/i, (_match, prefix, value) => (
      `${prefix}${value.replace(/%2C/gi, ",")}`
    ));
    return `${url.pathname}${search}${url.hash}`;
  }

  function writeUrl(url, options = {}) {
    if (applyingUrlState) return false;
    const current = `${root.location.pathname}${root.location.search}${root.location.hash}`;
    const next = serializeBrowserUrl(url);
    if (current === next) return false;
    if (options.push) root.history.pushState({}, "", next);
    else root.history.replaceState({}, "", next);
    return true;
  }

  function mutateUrl(mutator, options = {}) {
    const url = new URL(root.location.href);
    mutator(url.searchParams, url);
    return writeUrl(url, options);
  }

  function writeParameter(key, value, options = {}) {
    return mutateUrl((params) => {
      if (value === null || value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }, options);
  }

  function updateMapParam(value, options = {}) {
    return writeParameter("map", value, options);
  }

  function syncPollutant(value) {
    const pollutant = pollutantDomain.normalize(value);
    return pollutant ? writeParameter("pollutant", pollutant) : false;
  }

  function syncMetric(value) {
    return METRICS.has(value) ? writeParameter("metric", value) : false;
  }

  function syncColorScale(value) {
    return COLOR_SCALES.has(value) ? writeParameter("color_scale", value) : false;
  }

  function syncWindow(value) {
    return WINDOWS.has(value) ? writeParameter("window", value) : false;
  }

  function syncNetworks() {
    if (!networkController.isCatalogReady?.()) return false;
    return writeParameter("networks", networkController.getUrlSelectionValue());
  }

  function syncArea(value, options = {}) {
    return writeParameter("area", normalizeArea(value), { push: options.push !== false });
  }

  function syncMode(mode, chartRange = null) {
    const isChart = mode === "chart";
    const normalizedRange = CHART_RANGES.has(chartRange) ? chartRange : DEFAULTS.chartRange;
    return mutateUrl((params) => {
      if (isChart) {
        params.set("mode", "chart");
        params.set("chart_range", normalizedRange);
      } else {
        params.delete("mode");
        params.delete("chart_range");
      }
    });
  }

  function syncChartRange(value) {
    if (!pageMode()?.isChartMode?.()) return writeParameter("chart_range", null);
    return writeParameter("chart_range", CHART_RANGES.has(value) ? value : DEFAULTS.chartRange);
  }

  function noteCrRegion(value) {
    const normalized = normalizeCrRegion(value);
    if (!normalized) return false;
    lastCrRegion = normalized;
    return true;
  }

  function clearSelectionsForNavigation() {
    root.ukMap?.clearSelection?.({ updateUrl: false });
    root.crMap?.clearSelection?.({ updateUrl: false });
    root.hexChartMode?.exit?.({ updateUrl: false });
  }

  function writeGeography(value, options = {}) {
    return mutateUrl((params) => {
      params.set("map", value);
      params.delete("area");
      params.delete("mode");
      params.delete("chart_range");
    }, { push: Boolean(options.push) });
  }

  function syncCrRegion(value, options = {}) {
    const normalized = normalizeCrRegion(value);
    if (!normalized) return false;
    lastCrRegion = normalized;
    clearSelectionsForNavigation();
    writeGeography(normalized, { push: Boolean(options.push) });
    return true;
  }

  function setCrRegion(region, options = {}) {
    const normalized = normalizeCrRegion(region) || DEFAULT_CR_REGION;
    lastCrRegion = normalized;
    if (options.preserveSelection !== true) clearSelectionsForNavigation();
    crController().setRegion(normalized, { updateUrl: false });
    if (options.updateUrl !== false) writeGeography(normalized, { push: options.push !== false });
    return normalized;
  }

  function applyMap(mapValue, options = {}) {
    if (options.preserveSelection !== true) clearSelectionsForNavigation();
    if (mapValue === "UK") {
      coordinator().setActiveMap("uk", { source: options.source || "map" });
      if (options.updateUrl) writeGeography("UK", { push: Boolean(options.push) });
      return "UK";
    }
    const normalized = normalizeCrRegion(mapValue) || DEFAULT_CR_REGION;
    lastCrRegion = normalized;
    crController().setRegion(normalized, { updateUrl: false });
    coordinator().setActiveMap("cr", { source: options.source || "map" });
    if (options.updateUrl) writeGeography(normalized, { push: Boolean(options.push) });
    return normalized;
  }

  function switchToUk(options = {}) {
    return applyMap("UK", {
      updateUrl: options.updateUrl !== false, push: options.push !== false, source: options.source,
    });
  }

  function switchToCr(region, options = {}) {
    const target = normalizeCrRegion(region) || lastCrRegion || DEFAULT_CR_REGION;
    return applyMap(target, {
      updateUrl: options.updateUrl !== false, push: options.push !== false, source: options.source,
    });
  }

  function canonicalizeBaseState(state) {
    return mutateUrl((params) => {
      params.set("map", state.map);
      if (state.present.pollutant) params.set("pollutant", state.pollutant);
      else params.delete("pollutant");
      if (state.present.window) params.set("window", state.mapSettings.window);
      else params.delete("window");
      if (state.present.metric) params.set("metric", state.mapSettings.metric);
      else params.delete("metric");
      if (state.present.colorScale) params.set("color_scale", state.mapSettings.colorScale);
      else params.delete("color_scale");
      if (state.area) params.set("area", state.area);
      else params.delete("area");
      if (state.mode === "chart") {
        params.set("mode", "chart");
        if (state.present.chartRange) params.set("chart_range", state.chartRange);
        else params.delete("chart_range");
      } else {
        params.delete("mode");
        params.delete("chart_range");
      }
    });
  }

  function activeMapController(mapKey = coordinator().getActiveMap()) {
    return mapKey === "cr" ? root.crMap : root.ukMap;
  }

  function restoreStateIsReady(state) {
    if (!networkController.isCatalogReady?.()) return false;
    if (state.mode === "chart" && !root.hexChartMode?.enter) return false;
    const mapKey = state.map === "UK" ? "uk" : "cr";
    if (coordinator().getActiveMap() !== mapKey) return false;
    const restoreState = activeMapController(mapKey)?.getUrlRestoreState?.();
    if (!restoreState?.geometryReady || restoreState.dataStatus === "loading") return false;
    return restoreState.map === state.map
      && restoreState.pollutant === state.pollutant
      && restoreState.window === state.mapSettings.window;
  }

  function canonicalizeAppliedState() {
    const mapKey = coordinator().getActiveMap();
    const mapController = activeMapController(mapKey);
    const currentParams = new URLSearchParams(root.location.search);
    const actualMap = mapKey === "cr"
      ? (normalizeCrRegion(mapController?.getRegion?.()) || lastCrRegion || DEFAULT_CR_REGION)
      : "UK";
    const settings = coordinator().getMapSettings();
    const area = normalizeArea(mapKey === "cr"
      ? mapController?.getActiveAreaCode?.()
      : mapController?.getActivePconCode?.());
    const mode = pageMode()?.isChartMode?.(mapKey) ? "chart" : "map";
    const chartRange = root.hexChartMode?.getRangeLabel?.() || DEFAULTS.chartRange;
    mutateUrl((params) => {
      params.set("map", actualMap);
      if (currentParams.has("pollutant")) params.set("pollutant", coordinator().getPollutant());
      else params.delete("pollutant");
      if (currentParams.has("window")) params.set("window", settings.window);
      else params.delete("window");
      if (currentParams.has("metric")) params.set("metric", settings.metric);
      else params.delete("metric");
      if (currentParams.has("color_scale")) params.set("color_scale", settings.colorScale);
      else params.delete("color_scale");
      params.set("networks", networkController.getUrlSelectionValue());
      if (area) params.set("area", area);
      else params.delete("area");
      if (mode === "chart") {
        params.set("mode", "chart");
        params.set("chart_range", CHART_RANGES.has(chartRange) ? chartRange : DEFAULTS.chartRange);
      } else {
        params.delete("mode");
        params.delete("chart_range");
      }
    });
  }

  function attemptDependentRestore() {
    const state = pendingRestore;
    if (!state || !restoreStateIsReady(state)) return false;
    const mapKey = state.map === "UK" ? "uk" : "cr";
    const mapController = activeMapController(mapKey);
    let areaRestored = false;
    applyingUrlState = true;
    try {
      if (state.area) {
        areaRestored = mapKey === "cr"
          ? Boolean(mapController?.selectAreaByCode?.(state.area, { allowRegionSwitch: false, updateUrl: false }))
          : Boolean(mapController?.selectPconByCode?.(state.area, { updateUrl: false }));
      } else {
        mapController?.clearSelection?.({ updateUrl: false });
      }
      if (state.mode === "chart" && areaRestored) {
        const entered = root.hexChartMode?.enter?.({
          mapKey, initialRange: state.chartRange, updateUrl: false,
        });
        if (!entered) root.hexChartMode?.exit?.({ updateUrl: false });
      } else {
        root.hexChartMode?.exit?.({ updateUrl: false });
      }
    } finally {
      applyingUrlState = false;
    }
    pendingRestore = null;
    canonicalizeAppliedState();
    return true;
  }

  function applyParsedState(state, source) {
    pendingRestore = state;
    applyingUrlState = true;
    try {
      root.hexChartMode?.exit?.({ updateUrl: false });
      root.ukMap?.clearSelection?.({ updateUrl: false });
      root.crMap?.clearSelection?.({ updateUrl: false });
      networkController.setUrlSelectionIntent(state.networks, { source, notify: true });
      coordinator().setPollutant(state.pollutant, { source, updateUrl: false });
      coordinator().updateMapSettings(state.mapSettings, { source, updateUrl: false });
      applyMap(state.map, { updateUrl: false, push: false, preserveSelection: true, source });
    } finally {
      applyingUrlState = false;
    }
    canonicalizeBaseState(state);
    attemptDependentRestore();
  }

  function handlePopState() {
    applyParsedState(parseState(), "popstate");
  }

  function bootstrap() {
    if (bootstrapped) return false;
    bootstrapped = true;
    root.addEventListener("popstate", handlePopState);
    root.addEventListener("hexareachange", (event) => {
      if (!applyingUrlState && event.detail?.updateUrl !== false) {
        syncArea(event.detail?.areaCode || null, { push: event.detail?.push !== false });
      }
    });
    root.addEventListener("hexpagemodechange", (event) => {
      if (!applyingUrlState) {
        syncMode(event.detail?.mode === "chart" ? "chart" : "map", root.hexChartMode?.getRangeLabel?.());
      }
    });
    root.addEventListener("hexchartrangechange", (event) => {
      if (!applyingUrlState) syncChartRange(event.detail?.range);
    });
    root.addEventListener("hexmapdataready", attemptDependentRestore);
    root.addEventListener("hexchartadapterready", attemptDependentRestore);
    root.addEventListener("hexnetworkcatalogready", () => {
      syncNetworks();
      attemptDependentRestore();
    });
    root.addEventListener("networkselectionchange", () => {
      if (!applyingUrlState) syncNetworks();
      attemptDependentRestore();
    });

    pendingRestore = initialState;
    networkController.setUrlSelectionIntent(initialState.networks, { source: "initial-url", notify: false });
    applyMap(initialState.map, {
      updateUrl: false, push: false, preserveSelection: true, source: "initial-url",
    });
    canonicalizeBaseState(initialState);
    attemptDependentRestore();
    return true;
  }

  const api = Object.freeze({
    getInitialState: () => stateSnapshot(),
    getInitialCrRegion: () => normalizeCrRegion(initialState.map) || DEFAULT_CR_REGION,
    getLastCrRegion: () => lastCrRegion,
    getActiveTab: () => coordinator().getActiveMap(),
    switchToUk, switchToCr, setCrRegion, noteCrRegion, syncCrRegion,
    syncPollutant, syncNetworks, syncWindow, syncMetric, syncColorScale, syncArea, syncMode, syncChartRange,
    updateMapParam, handlePopState, bootstrap,
  });

  root.UkAqHexMapUrlState = api;
  root.mapTabController = Object.freeze({
    getActiveTab: () => api.getActiveTab(),
    switchToUk: (options) => api.switchToUk(options),
    switchToCr: (region, options) => api.switchToCr(region, options),
    setCrRegion: (region, options) => api.setCrRegion(region, options),
  });
  return api;
}

const urlState = initHexMapUrlState(globalThis);
export default urlState;
