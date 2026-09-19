import coordinator from "./hex-map-coordinator.js";
import networkController from "./hex-map-network-controller.js";
import urlState from "./hex-map-url-state.js";
import crController from "./hex-map-cr-controller.js";
import search from "./hex-map-search.js";
import pageMode from "./hex-map-page-mode.js";

function initHexMapToolbarController(root) {
  "use strict";

  if (!root?.document || !root.document.body.classList.contains("hex-map-page")) return;
  if (root.UkAqHexMapToolbarController) return;

  if (!coordinator?.getActiveMap
      || !coordinator?.getMapSettings
      || !coordinator?.registerActiveMapPresenter
      || !urlState?.switchToUk
      || !urlState?.switchToCr
      || !urlState?.setCrRegion
      || !pageMode?.getMode) {
    throw new Error("Hex Map toolbar dependencies must load before the toolbar controller.");
  }

  const tabUk = root.document.getElementById("tab-uk");
  const tabCr = root.document.getElementById("tab-cr");
  const panelUk = root.document.getElementById("tab-panel-uk");
  const panelCr = root.document.getElementById("tab-panel-cr");
  const tabBar = root.document.querySelector(".tab-bar");
  const tabSlots = {
    uk: panelUk?.querySelector("[data-tab-slot]"),
    cr: panelCr?.querySelector("[data-tab-slot]"),
  };
  const toolbar = root.document.getElementById("main-toolbar");
  const chartRangeToolbar = toolbar?.querySelector("label.chart-range-toolbar") || null;
  const toolbarSlots = {
    uk: root.document.getElementById("uk-toolbar-slot"),
    cr: root.document.getElementById("cr-toolbar-slot"),
  };
  const toolbarTabUk = root.document.getElementById("toolbar-tab-uk");
  const toolbarTabCr = root.document.getElementById("toolbar-tab-cr");
  const viewControl = toolbar?.querySelector(".segmented--view") || null;
  const regionSection = root.document.getElementById("toolbar-region-section");
  const regionTrigger = root.document.getElementById("toolbar-region-trigger");
  const regionLabel = root.document.getElementById("toolbar-region-label");
  const regionMenu = root.document.getElementById("toolbar-region-menu");
  const popoverWrap = root.document.getElementById("toolbar-popover-wrap");
  const pollutantSelector = root.document.getElementById("pollutant-selector");
  const windowStepper = root.document.getElementById("window-stepper");
  const toolbarViewGroup = toolbar?.querySelector(".toolbar-control-group--view") || null;
  const pollutantGroup = toolbar?.querySelector(".pollutant-control-group") || null;
  const toolbarStatusActions = toolbar?.querySelector(".toolbar-status-actions") || null;
  const windowStepperPrev = windowStepper?.querySelector("[data-window-step='prev']");
  const windowStepperNext = windowStepper?.querySelector("[data-window-step='next']");
  const windowStepperValueBox = windowStepper?.querySelector(".window-stepper-value-box");
  const toolbarSearchRow = toolbar?.querySelector("[data-toolbar-search-row]") || null;
  const toolbarNetworksSlot = toolbar?.querySelector("[data-toolbar-networks-slot]") || null;

  const WINDOW_ORDER = ["3h", "6h", "1d", "7d", "all"];
  const WINDOW_LABELS_FALLBACK = {
    "3h": "3 Hours",
    "6h": "6 Hours",
    "1d": "1 Day",
    "7d": "7 Days",
    all: "No Limit",
  };
  const reduceMotionQuery = typeof root.matchMedia === "function"
    ? root.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const mobileLayoutQuery = typeof root.matchMedia === "function"
    ? root.matchMedia("(max-width: 767px)")
    : null;
  const SENSOR_TABLE_COMPACT_WIDTH = 860;
  const TOOLBAR_LAYOUT_PROMOTION_MARGIN = 8;
  const TOOLBAR_LAYOUT_HOLD_MARGIN = 4;
  const mobileMounts = {
    uk: {
      left: panelUk?.querySelector("[data-mobile-map-controls-left]") || null,
      centre: panelUk?.querySelector("[data-mobile-map-controls-centre]") || null,
      right: panelUk?.querySelector("[data-mobile-map-controls-right]") || null,
      pollutant: panelUk?.querySelector("[data-mobile-map-controls-pollutant]") || null,
      region: panelUk?.querySelector("[data-mobile-map-controls-region]") || null,
      status: panelUk?.querySelector("[data-mobile-map-status-row]") || null,
    },
    cr: {
      left: panelCr?.querySelector("[data-mobile-map-controls-left]") || null,
      centre: panelCr?.querySelector("[data-mobile-map-controls-centre]") || null,
      right: panelCr?.querySelector("[data-mobile-map-controls-right]") || null,
      pollutant: panelCr?.querySelector("[data-mobile-map-controls-pollutant]") || null,
      region: panelCr?.querySelector("[data-mobile-map-controls-region]") || null,
      status: panelCr?.querySelector("[data-mobile-map-status-row]") || null,
    },
  };
  const mobileChartMounts = {
    uk: {
      network: panelUk?.querySelector("[data-mobile-chart-network]") || null,
      pollutant: panelUk?.querySelector("[data-mobile-chart-pollutant]") || null,
      range: panelUk?.querySelector("[data-mobile-chart-range]") || null,
      panel: panelUk?.querySelector("[data-mobile-chart-networks-panel]") || null,
    },
    cr: {
      network: panelCr?.querySelector("[data-mobile-chart-network]") || null,
      pollutant: panelCr?.querySelector("[data-mobile-chart-pollutant]") || null,
      range: panelCr?.querySelector("[data-mobile-chart-range]") || null,
      panel: panelCr?.querySelector("[data-mobile-chart-networks-panel]") || null,
    },
  };
  const mobileSensorListMounts = {
    uk: {
      toolbar: panelUk?.querySelector("[data-mobile-sensor-list-toolbar]") || null,
      select: panelUk?.querySelector("[data-mobile-sensor-select-mount]") || null,
      sort: panelUk?.querySelector("[data-mobile-sensor-sort-mount]") || null,
    },
    cr: {
      toolbar: panelCr?.querySelector("[data-mobile-sensor-list-toolbar]") || null,
      select: panelCr?.querySelector("[data-mobile-sensor-select-mount]") || null,
      sort: panelCr?.querySelector("[data-mobile-sensor-sort-mount]") || null,
    },
  };
  const mobileSensorListControls = {
    uk: {
      select: panelUk?.querySelector(".chart-selector-header-actions") || null,
      sort: panelUk?.querySelector(".mobile-sensor-sort") || null,
    },
    cr: {
      select: panelCr?.querySelector(".chart-selector-header-actions") || null,
      sort: panelCr?.querySelector(".mobile-sensor-sort") || null,
    },
  };
  const networkAnchors = {
    uk: root.document.getElementById("uk-networks-pill-anchor"),
    cr: root.document.getElementById("cr-networks-pill-anchor"),
  };
  const mapSearches = {
    uk: panelUk?.querySelector(".map-search[data-map-kind='uk']") || null,
    cr: panelCr?.querySelector(".map-search[data-map-kind='cr']") || null,
  };
  Object.entries(mobileMounts).forEach(([mapKey, mounts]) => {
    mounts.search = (mapKey === "uk" ? panelUk : panelCr)?.querySelector("[data-mobile-map-search]") || null;
  });
  const mainToolbarRelocationNodes = [
    viewControl,
    regionSection,
    pollutantSelector,
    windowStepper,
    chartRangeToolbar,
    ...Object.values(mapSearches),
  ].filter(Boolean);
  const sensorListRelocationNodes = [
    ...Object.values(mobileSensorListControls).flatMap((controls) => [controls.select, controls.sort]),
  ].filter(Boolean);
  const relocationNodes = [...mainToolbarRelocationNodes, ...sensorListRelocationNodes];
  const originalMarkers = new Map();

  [...relocationNodes, ...Object.values(networkAnchors).filter(Boolean)].forEach((node) => {
    if (!node.parentNode || originalMarkers.has(node)) return;
    const marker = root.document.createComment(`uk-aq-original-host:${node.id || node.className}`);
    node.parentNode.insertBefore(marker, node);
    originalMarkers.set(node, marker);
  });

  let mounted = false;
  let regionPopoverOpen = false;
  let prefersReducedMotion = Boolean(reduceMotionQuery?.matches);
  let windowStepperKey = null;
  let windowStepperTimer = null;
  let toolbarLayoutFrame = null;
  const sensorListPresentationByMap = { uk: null, cr: null };

  function normalizeWindowKey(value) {
    return WINDOW_ORDER.includes(value) ? value : "6h";
  }

  function getWindowLabel(key) {
    return WINDOW_LABELS_FALLBACK[key] || WINDOW_LABELS_FALLBACK["6h"];
  }

  function readSharedWindowKey() {
    return normalizeWindowKey(coordinator.getMapSettings().window);
  }

  function setStepperButtons(windowKey) {
    if (!windowStepperPrev || !windowStepperNext || !windowStepper) return;
    const index = WINDOW_ORDER.indexOf(windowKey);
    windowStepperPrev.disabled = index <= 0;
    windowStepperNext.disabled = index >= WINDOW_ORDER.length - 1;
    windowStepper.dataset.window = windowKey;
  }

  function resetWindowStepperValue(label) {
    if (!windowStepperValueBox) return;
    if (windowStepperTimer) {
      root.clearTimeout(windowStepperTimer);
      windowStepperTimer = null;
    }
    windowStepperValueBox.classList.remove("is-animating", "is-moving-prev", "is-moving-next");
    windowStepperValueBox.innerHTML = `<span class="window-stepper-value" data-window-value>${label}</span>`;
  }

  function animateWindowStepper(label, direction) {
    if (!windowStepperValueBox || prefersReducedMotion) {
      resetWindowStepperValue(label);
      return;
    }
    if (windowStepperTimer) {
      root.clearTimeout(windowStepperTimer);
      windowStepperTimer = null;
    }
    const valueNodes = Array.from(windowStepperValueBox.querySelectorAll("[data-window-value]"));
    const currentNode = valueNodes[valueNodes.length - 1];
    if (!currentNode) {
      resetWindowStepperValue(label);
      return;
    }
    if (valueNodes.length > 1) {
      valueNodes.slice(0, -1).forEach((node) => node.remove());
    }
    const incomingNode = root.document.createElement("span");
    incomingNode.className = `window-stepper-value window-stepper-value--incoming ${
      direction === "next" ? "from-right" : "from-left"
    }`;
    incomingNode.setAttribute("data-window-value", "");
    incomingNode.textContent = label;
    currentNode.classList.add("window-stepper-value--outgoing");
    windowStepperValueBox.appendChild(incomingNode);
    windowStepperValueBox.classList.remove("is-moving-prev", "is-moving-next");
    windowStepperValueBox.classList.add(direction === "next" ? "is-moving-next" : "is-moving-prev");
    root.requestAnimationFrame(() => {
      windowStepperValueBox.classList.add("is-animating");
    });
    windowStepperTimer = root.setTimeout(() => {
      resetWindowStepperValue(label);
    }, 210);
  }

  function renderWindowStepper(options = {}) {
    if (!windowStepperValueBox) return;
    const nextKey = readSharedWindowKey();
    const nextLabel = getWindowLabel(nextKey);
    const previousKey = windowStepperKey;
    windowStepperKey = nextKey;
    setStepperButtons(nextKey);
    if (!previousKey || options.force || previousKey === nextKey) {
      resetWindowStepperValue(nextLabel);
      return;
    }
    const previousIndex = WINDOW_ORDER.indexOf(previousKey);
    const nextIndex = WINDOW_ORDER.indexOf(nextKey);
    animateWindowStepper(nextLabel, nextIndex > previousIndex ? "next" : "prev");
  }

  function renderRegionPopover() {
    if (regionMenu) regionMenu.hidden = !regionPopoverOpen;
    regionTrigger?.classList.toggle("open", regionPopoverOpen);
    regionTrigger?.setAttribute("aria-expanded", String(regionPopoverOpen));
  }

  function setRegionPopoverOpen(open) {
    regionPopoverOpen = Boolean(open);
    renderRegionPopover();
    if (regionPopoverOpen) renderRegion();
  }

  function closeRegionPopover() {
    setRegionPopoverOpen(false);
  }

  function getCurrentRegion() {
    return crController?.getRegion?.() || null;
  }

  function renderRegion() {
    const current = getCurrentRegion();
    if (!current) return;
    if (regionLabel) regionLabel.textContent = current;
    regionMenu?.querySelectorAll("[data-region]").forEach((item) => {
      item.classList.toggle("active", item.dataset.region === current);
    });
  }

  function isMobileMapMode() {
    return Boolean(mobileLayoutQuery?.matches && pageMode.getMode() === "map");
  }

  function isMobileChartMode() {
    return Boolean(mobileLayoutQuery?.matches && pageMode.getMode() === "chart");
  }

  function isCompactSensorList(mapKey) {
    if (mobileLayoutQuery?.matches) return false;
    const panel = mapKey === "cr" ? panelCr : panelUk;
    const tableWrap = panel?.querySelector(".sensor-table-wrap");
    return Boolean(tableWrap && tableWrap.clientWidth > 0 && tableWrap.clientWidth < SENSOR_TABLE_COMPACT_WIDTH);
  }

  function setSensorListToolbarPresentation(toolbar, presentation) {
    if (!toolbar) return;
    if (presentation) {
      toolbar.dataset.sensorListPresentation = presentation;
    } else {
      delete toolbar.dataset.sensorListPresentation;
    }
  }

  function notifySensorListPresentation(mapKey, presentation) {
    if (sensorListPresentationByMap[mapKey] === presentation) return;
    sensorListPresentationByMap[mapKey] = presentation;
    root.dispatchEvent(new CustomEvent("hexsensorlistpresentationchange", { detail: { mapKey, presentation } }));
  }

  function restoreNode(node) {
    const marker = originalMarkers.get(node);
    if (!node || !marker?.parentNode) return false;
    if (node.previousSibling === marker) return true;
    marker.parentNode.insertBefore(node, marker.nextSibling);
    return true;
  }

  function restoreMainToolbarControls() {
    if (toolbar) {
      delete toolbar.dataset.hexToolbarSearchActive;
    }
    mainToolbarRelocationNodes.forEach(restoreNode);
    Object.values(networkAnchors).forEach(restoreNode);
  }

  function restoreSensorListControls() {
    sensorListRelocationNodes.forEach(restoreNode);
  }

  function toolbarCssPixels(name, fallback) {
    if (!toolbar) return fallback;
    const value = Number.parseFloat(root.getComputedStyle(toolbar).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function writeToolbarWidthVariable(name, value) {
    if (!toolbar || !Number.isFinite(value) || value <= 0) return;
    toolbar.style.setProperty(name, `${value.toFixed(2)}px`);
  }

  function measureToolbarGeometry() {
    if (!toolbar || !pollutantGroup || !windowStepper || !toolbarStatusActions) return null;

    const toolbarStyle = root.getComputedStyle(toolbar);
    const toolbarPaddingInline =
      (Number.parseFloat(toolbarStyle.paddingLeft) || 0)
      + (Number.parseFloat(toolbarStyle.paddingRight) || 0);
    const readWidth = (element) => element?.getBoundingClientRect().width || 0;
    toolbar.classList.add("hex-toolbar-measuring");
    const viewWidth = readWidth(toolbarViewGroup);
    const pollutantWidth = readWidth(pollutantGroup);
    const windowWidth = readWidth(windowStepper);
    const chartRangeWidth = readWidth(chartRangeToolbar);
    const statusWidth = readWidth(toolbarStatusActions);
    const networksWidth = pageMode.getMode() === "map" ? readWidth(toolbarNetworksSlot) : 0;

    toolbar.classList.add("hex-toolbar-measuring-wide-view");
    const viewWideWidth = readWidth(toolbarViewGroup) || viewWidth;
    toolbar.classList.remove("hex-toolbar-measuring-wide-view");
    toolbar.classList.remove("hex-toolbar-measuring");

    writeToolbarWidthVariable("--hex-toolbar-view-width", viewWidth);
    writeToolbarWidthVariable("--hex-toolbar-view-wide-width", viewWideWidth);
    writeToolbarWidthVariable("--hex-toolbar-pollutant-width", pollutantWidth);
    writeToolbarWidthVariable("--hex-toolbar-window-width", windowWidth);
    writeToolbarWidthVariable("--hex-toolbar-chart-range-width", chartRangeWidth);

    return {
      viewWidth,
      viewWideWidth,
      pollutantWidth,
      windowWidth,
      chartRangeWidth,
      statusWidth,
      networksWidth,
      /* clientWidth includes padding. Grid tracks only receive the content
         box inside that padding, so do not overstate the usable fit width. */
      availableWidth: Math.max(
        0, toolbar.clientWidth - toolbarPaddingInline
      ),
      columnGap: toolbarCssPixels("--hex-toolbar-column-gap", 4),
      dividerSpace: toolbarCssPixels("--hex-toolbar-divider-space", 12),
    };
  }

  function toolbarLayoutRequirements(mode, geometry) {
    const gap = geometry.columnGap;
    const divider = geometry.dividerSpace;
    if (mode === "chart") {
      return {
        "chart-wide":
          geometry.pollutantWidth
          + geometry.windowWidth
          + geometry.chartRangeWidth
          + geometry.statusWidth
          + (2 * divider)
          + (3 * gap),
        "chart-compact":
          Math.max(
            geometry.pollutantWidth + divider + geometry.windowWidth + gap,
            geometry.chartRangeWidth,
          )
          + geometry.statusWidth
          + gap,
        "chart-narrow":
          Math.max(
            geometry.pollutantWidth,
            geometry.windowWidth + divider,
          )
          + Math.max(geometry.statusWidth, geometry.chartRangeWidth)
          + gap,
        "chart-wrapped": Math.max(
          geometry.pollutantWidth,
          geometry.statusWidth,
          geometry.windowWidth + geometry.chartRangeWidth + divider + gap,
        ),
      };
    }

    return {
      "map-wide":
        geometry.viewWideWidth
        + geometry.pollutantWidth
        + geometry.windowWidth
        + geometry.statusWidth
        + (2 * divider)
        + (4 * gap),
      "map-compact": Math.max(
        geometry.viewWidth
          + geometry.pollutantWidth
          + geometry.statusWidth
          + divider
          + (3 * gap),
        geometry.windowWidth + geometry.networksWidth + gap,
      ),
      "map-intermediate": Math.max(
        geometry.viewWidth + geometry.statusWidth + gap,
        geometry.pollutantWidth
          + geometry.windowWidth
          + geometry.networksWidth
          + divider
          + (3 * gap),
      ),
      "map-narrow": Math.max(
        geometry.viewWidth + geometry.statusWidth + gap,
        geometry.pollutantWidth + geometry.networksWidth + gap,
        geometry.windowWidth,
      ),
    };
  }

  function chooseToolbarLayout(mode, geometry) {
    const states = mode === "chart"
      ? ["chart-wide", "chart-compact", "chart-narrow", "chart-wrapped", "chart-stacked"]
      : ["map-wide", "map-compact", "map-intermediate", "map-narrow", "map-wrapped"];
    const requirements = toolbarLayoutRequirements(mode, geometry);
    const current = toolbar?.dataset.toolbarLayout || "";
    const currentIndex = states.indexOf(current);

    for (let index = 0; index < states.length - 1; index += 1) {
      const state = states[index];
      let required = requirements[state];
      if (!Number.isFinite(required)) continue;

      if (currentIndex < 0 || index < currentIndex) {
        required += TOOLBAR_LAYOUT_PROMOTION_MARGIN;
      } else if (index === currentIndex) {
        required -= TOOLBAR_LAYOUT_HOLD_MARGIN;
      }

      if (geometry.availableWidth >= required) return state;
    }
    return states[states.length - 1];
  }

  function clearToolbarLayoutState() {
    if (toolbarLayoutFrame !== null) {
      root.cancelAnimationFrame(toolbarLayoutFrame);
      toolbarLayoutFrame = null;
    }
    if (!toolbar) return;
    toolbar.classList.remove("hex-toolbar-measuring", "hex-toolbar-measuring-wide-view");
    delete toolbar.dataset.toolbarLayout;
  }

  function syncToolbarLayoutState() {
    if (!toolbar || mobileLayoutQuery?.matches) {
      clearToolbarLayoutState();
      return null;
    }
    const geometry = measureToolbarGeometry();
    if (!geometry) return null;
    const mode = pageMode.getMode() === "chart" ? "chart" : "map";
    const nextLayout = chooseToolbarLayout(mode, geometry);
    if (toolbar.dataset.toolbarLayout !== nextLayout) {
      toolbar.dataset.toolbarLayout = nextLayout;
    }
    return nextLayout;
  }

  function scheduleToolbarLayout() {
    if (!toolbar || mobileLayoutQuery?.matches) {
      clearToolbarLayoutState();
      return;
    }
    if (toolbarLayoutFrame !== null) return;
    toolbarLayoutFrame = root.requestAnimationFrame(() => {
      toolbarLayoutFrame = null;
      syncToolbarLayoutState();
    });
  }

  function sensorListPresentation(mapKey) {
    if (mobileLayoutQuery?.matches) {
      return pageMode.getMode() === "chart" ? "narrow-chart" : "narrow-map";
    }
    if (isCompactSensorList(mapKey)) {
      return pageMode.getMode() === "chart" ? "compact-chart" : "compact-map";
    }
    return pageMode.getMode() === "chart" ? "full-chart" : "full-map";
  }

  function syncSensorListSpecificPresentation(mapKey, options = {}) {
    const normalizedMapKey = mapKey === "cr" ? "cr" : "uk";
    const presentation = sensorListPresentation(normalizedMapKey);
    if (!options.force && sensorListPresentationByMap[normalizedMapKey] === presentation) {
      return false;
    }

    restoreSensorListControls();
    Object.values(mobileSensorListMounts).forEach((candidate) => {
      if (!candidate?.toolbar) return;
      candidate.toolbar.hidden = true;
      setSensorListToolbarPresentation(candidate.toolbar, null);
    });

    const mounts = mobileSensorListMounts[normalizedMapKey];
    const controls = mobileSensorListControls[normalizedMapKey];
    const compactOrNarrow = presentation.startsWith("compact-") || presentation.startsWith("narrow-");
    if (compactOrNarrow && mounts?.toolbar && mounts?.sort) {
      if (presentation.endsWith("chart") && controls?.select && mounts.select) {
        mounts.select.appendChild(controls.select);
      }
      if (controls?.sort) mounts.sort.appendChild(controls.sort);
      setSensorListToolbarPresentation(mounts.toolbar, presentation);
      mounts.toolbar.hidden = false;
    }

    if (toolbar) toolbar.dataset.hexSensorListPresentation = presentation;
    notifySensorListPresentation(normalizedMapKey, presentation);
    return true;
  }

  function syncDesktopMainToolbarPresentation(mapKey) {
    const normalizedMapKey = mapKey === "cr" ? "cr" : "uk";
    restoreMainToolbarControls();
    const activeNetworkAnchor = networkAnchors[normalizedMapKey];
    if (activeNetworkAnchor && toolbarNetworksSlot
        && activeNetworkAnchor.parentElement !== toolbarNetworksSlot) {
      toolbarNetworksSlot.appendChild(activeNetworkAnchor);
    }
    const activeSearch = mapSearches[normalizedMapKey];
    if (pageMode.getMode() === "map" && activeSearch && toolbarSearchRow) {
      toolbarSearchRow.appendChild(activeSearch);
      toolbar.dataset.hexToolbarSearchActive = "true";
    }
  }

  function renderMobileViewAccessibility(mapKey, mobileMapMode) {
    const isUk = mapKey === "uk";
    const activeButton = isUk ? toolbarTabUk : toolbarTabCr;
    const inactiveButton = isUk ? toolbarTabCr : toolbarTabUk;

    if (mobileMapMode) {
      activeButton?.setAttribute(
        "aria-label",
        isUk
          ? "View: United Kingdom constituencies. Switch to Countries and Regions local authorities."
          : "View: Countries and Regions local authorities. Switch to United Kingdom constituencies.",
      );
      activeButton?.setAttribute("tabindex", "0");
      inactiveButton?.removeAttribute("aria-label");
      inactiveButton?.setAttribute("tabindex", "-1");
      return;
    }

    [toolbarTabUk, toolbarTabCr].forEach((button) => {
      button?.removeAttribute("aria-label");
      button?.removeAttribute("tabindex");
    });
  }

  function relocateStatusRefreshForMap(mapKey, mobileStatusHost = null) {
    const isUk = mapKey === "uk";
    const statusSlot = root.document.getElementById("toolbar-status-slot");
    const refreshSlot = root.document.getElementById("toolbar-refresh-slot");
    const activeStatus = root.document.getElementById(isUk ? "status-pill-uk" : "status-pill-cr");
    const activeRefresh = root.document.getElementById(isUk ? "refresh" : "cr-refresh");
    const inactiveStatus = root.document.getElementById(isUk ? "status-pill-cr" : "status-pill-uk");
    const inactiveRefresh = root.document.getElementById(isUk ? "cr-refresh" : "refresh");
    const inactiveTopbar = root.document.querySelector(
      isUk ? "#tab-panel-cr .map-topbar" : "#tab-panel-uk .map-topbar",
    );
    if (inactiveTopbar) {
      if (inactiveStatus && inactiveStatus.parentElement !== inactiveTopbar) {
        inactiveTopbar.insertBefore(inactiveStatus, inactiveTopbar.firstChild);
      }
      if (inactiveRefresh && inactiveRefresh.parentElement !== inactiveTopbar) {
        inactiveTopbar.insertBefore(inactiveRefresh, inactiveTopbar.firstChild?.nextSibling || null);
      }
    }
    const activeStatusHost = mobileStatusHost || statusSlot;
    const activeRefreshHost = mobileStatusHost || refreshSlot;
    if (activeStatusHost && activeStatus && activeStatus.parentElement !== activeStatusHost) {
      activeStatusHost.appendChild(activeStatus);
    }
    if (activeRefreshHost && activeRefresh && activeRefresh.parentElement !== activeRefreshHost) {
      activeRefreshHost.appendChild(activeRefresh);
    }
  }

  function syncResponsivePresentation(mapKey = coordinator.getActiveMap()) {
    const chartMapKey = pageMode.getState?.().chartMapKey;
    const normalizedMapKey = chartMapKey === "cr" || (chartMapKey !== "uk" && mapKey === "cr") ? "cr" : "uk";
    const mobileMapMode = isMobileMapMode();
    const mobileChartMode = isMobileChartMode();
    const mounts = mobileMounts[normalizedMapKey];
    const chartMounts = mobileChartMounts[normalizedMapKey];

    if (mobileChartMode && chartMounts?.network && chartMounts?.pollutant && chartMounts?.range && chartMounts?.panel) {
      const inactiveMapKey = normalizedMapKey === "uk" ? "cr" : "uk";
      restoreMainToolbarControls();
      relocateStatusRefreshForMap(normalizedMapKey);
      restoreNode(networkAnchors[inactiveMapKey]);
      const activeNetworkAnchor = networkAnchors[normalizedMapKey];
      if (activeNetworkAnchor && activeNetworkAnchor.parentElement !== chartMounts.network) {
        chartMounts.network.appendChild(activeNetworkAnchor);
      }
      if (pollutantSelector && pollutantSelector.parentElement !== chartMounts.pollutant) {
        chartMounts.pollutant.appendChild(pollutantSelector);
      }
      if (chartRangeToolbar && chartRangeToolbar.parentElement !== chartMounts.range) {
        chartMounts.range.appendChild(chartRangeToolbar);
      }
      syncSensorListSpecificPresentation(normalizedMapKey, { force: true });
      root.document.body.classList.remove("mobile-map-controls-active");
      root.document.body.classList.add("mobile-chart-controls-active");
      renderMobileViewAccessibility(normalizedMapKey, false);
      networkController?.syncPanelForActiveScope?.();
      clearToolbarLayoutState();
      return true;
    }

    root.document.body.classList.remove("mobile-chart-controls-active");

    if (!mobileMapMode || !mounts?.left || !mounts?.centre || !mounts?.right || !mounts?.pollutant || !mounts?.region || !mounts?.search || !mounts?.status) {
      syncDesktopMainToolbarPresentation(normalizedMapKey);
      Object.values(mobileMounts).forEach((candidate) => {
        candidate.region?.closest(".mobile-map-controls-row--tertiary")?.classList.remove("has-region-control");
      });
      relocateStatusRefreshForMap(normalizedMapKey);
      syncSensorListSpecificPresentation(normalizedMapKey, { force: true });
      root.document.body.classList.remove("mobile-map-controls-active");
      renderMobileViewAccessibility(normalizedMapKey, false);
      networkController?.syncPanelForActiveScope?.();
      scheduleToolbarLayout();
      return false;
    }

    restoreMainToolbarControls();
    const inactiveMapKey = normalizedMapKey === "uk" ? "cr" : "uk";
    restoreNode(networkAnchors[inactiveMapKey]);
    restoreNode(mapSearches[inactiveMapKey]);
    if (viewControl && viewControl.parentElement !== mounts.left) mounts.left.appendChild(viewControl);
    if (regionSection && regionSection.parentElement !== mounts.region) mounts.region.appendChild(regionSection);
    mounts.region.closest(".mobile-map-controls-row--tertiary")?.classList.toggle("has-region-control", normalizedMapKey === "cr");
    if (windowStepper && windowStepper.parentElement !== mounts.centre) {
      mounts.centre.appendChild(windowStepper);
    }
    const activeSearch = mapSearches[normalizedMapKey];
    if (activeSearch && activeSearch.parentElement !== mounts.search) mounts.search.appendChild(activeSearch);
    relocateStatusRefreshForMap(normalizedMapKey, mounts.status);
    const activeNetworkAnchor = networkAnchors[normalizedMapKey];
    if (activeNetworkAnchor && activeNetworkAnchor.parentElement !== mounts.right) {
      mounts.right.appendChild(activeNetworkAnchor);
    }
    if (pollutantSelector && pollutantSelector.parentElement !== mounts.pollutant) {
      mounts.pollutant.appendChild(pollutantSelector);
    }
    syncSensorListSpecificPresentation(normalizedMapKey, { force: true });
    root.document.body.classList.add("mobile-map-controls-active");
    renderMobileViewAccessibility(normalizedMapKey, true);
    networkController?.syncPanelForActiveScope?.();
    clearToolbarLayoutState();
    return true;
  }

  function presentActiveMap(mapKey) {
    if (mapKey !== "uk" && mapKey !== "cr") return;
    const isUk = mapKey === "uk";
    search?.syncActiveTabInput?.(mapKey);
    tabUk?.setAttribute("aria-selected", isUk ? "true" : "false");
    tabCr?.setAttribute("aria-selected", isUk ? "false" : "true");

    const targetTabSlot = isUk ? tabSlots.uk : tabSlots.cr;
    if (tabBar && targetTabSlot && tabBar.parentElement !== targetTabSlot) {
      targetTabSlot.appendChild(tabBar);
    }
    const targetToolbarSlot = isUk ? toolbarSlots.uk : toolbarSlots.cr;
    if (toolbar && targetToolbarSlot && toolbar.parentElement !== targetToolbarSlot) {
      targetToolbarSlot.appendChild(toolbar);
    }
    if (panelUk) panelUk.hidden = !isUk;
    if (panelCr) panelCr.hidden = isUk;

    toolbarTabUk?.classList.toggle("active", isUk);
    toolbarTabCr?.classList.toggle("active", !isUk);
    regionSection?.classList.toggle("visible", !isUk);
    networkController?.syncPanelForActiveScope?.();
    syncResponsivePresentation(mapKey);
    if (!isUk) renderRegion();
  }

  function renderActiveMap() {
    presentActiveMap(coordinator.getActiveMap());
  }

  function render() {
    renderActiveMap();
    renderRegion();
    renderRegionPopover();
    renderWindowStepper({ force: true });
  }

  function navigateToUk() {
    urlState.switchToUk({ updateUrl: true, push: true });
  }

  function navigateToCr() {
    urlState.switchToCr(null, { updateUrl: true, push: true });
  }

  function handleToolbarViewClick(targetMapKey) {
    if (isMobileMapMode()) {
      if (coordinator.getActiveMap() === "uk") navigateToCr();
      else navigateToUk();
      return;
    }
    if (targetMapKey === "cr") navigateToCr();
    else navigateToUk();
  }

  function handleWindowStepperClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("button[data-window-step]")
      : null;
    if (!button || button.disabled) return;
    const currentKey = readSharedWindowKey();
    const currentIndex = WINDOW_ORDER.indexOf(currentKey);
    const offset = button.dataset.windowStep === "next" ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(WINDOW_ORDER.length - 1, currentIndex + offset));
    const nextKey = WINDOW_ORDER[nextIndex];
    if (nextKey === currentKey) return;
    coordinator.updateMapSettings({ window: nextKey }, { source: "window-stepper" });
  }

  function mount() {
    if (mounted) return false;
    mounted = true;

    coordinator.registerActiveMapPresenter(presentActiveMap);
    tabUk?.addEventListener("click", navigateToUk);
    tabCr?.addEventListener("click", navigateToCr);
    toolbarTabUk?.addEventListener("click", () => handleToolbarViewClick("uk"));
    toolbarTabCr?.addEventListener("click", () => handleToolbarViewClick("cr"));
    windowStepper?.addEventListener("click", handleWindowStepperClick);
    root.addEventListener("mapsettingschange", (event) => {
      if (event.detail?.window) {
        renderWindowStepper();
        scheduleToolbarLayout();
      }
    });
    root.addEventListener("crregionchange", () => {
      renderRegion();
      scheduleToolbarLayout();
    });
    root.addEventListener("hexpagemodechange", () => {
      syncResponsivePresentation(coordinator.getActiveMap());
    });

    if (mobileLayoutQuery) {
      const handleMobileLayoutChange = () => {
        closeRegionPopover();
        syncResponsivePresentation(coordinator.getActiveMap());
      };
      if (typeof mobileLayoutQuery.addEventListener === "function") {
        mobileLayoutQuery.addEventListener("change", handleMobileLayoutChange);
      } else if (typeof mobileLayoutQuery.addListener === "function") {
        mobileLayoutQuery.addListener(handleMobileLayoutChange);
      }
    }

    if (typeof root.ResizeObserver === "function") {
      let sensorListResizeQueued = false;
      const sensorListResizeObserver = new root.ResizeObserver(() => {
        if (sensorListResizeQueued) return;
        sensorListResizeQueued = true;
        root.requestAnimationFrame(() => {
          sensorListResizeQueued = false;
          syncSensorListSpecificPresentation(coordinator.getActiveMap());
        });
      });
      [panelUk, panelCr].forEach((panel) => {
        const tableWrap = panel?.querySelector(".sensor-table-wrap");
        if (tableWrap) sensorListResizeObserver.observe(tableWrap);
      });

      let lastToolbarObservedWidth = null;
      const toolbarGeometryObserver = new root.ResizeObserver((entries) => {
        let geometryChanged = false;
        entries.forEach((entry) => {
          if (entry.target === toolbar) {
            const width = entry.contentRect?.width ?? toolbar?.getBoundingClientRect().width ?? 0;
            if (lastToolbarObservedWidth === null || Math.abs(width - lastToolbarObservedWidth) >= 0.5) {
              lastToolbarObservedWidth = width;
              geometryChanged = true;
            }
            return;
          }
          geometryChanged = true;
        });
        if (geometryChanged) scheduleToolbarLayout();
      });
      [
        toolbar,
        toolbarStatusActions,
        toolbarNetworksSlot,
        chartRangeToolbar,
      ].filter(Boolean).forEach((element) => toolbarGeometryObserver.observe(element));
    } else {
      root.addEventListener("resize", scheduleToolbarLayout, { passive: true });
    }

    if (reduceMotionQuery) {
      const handleMotionChange = (event) => {
        prefersReducedMotion = Boolean(event.matches);
        renderWindowStepper({ force: true });
      };
      if (typeof reduceMotionQuery.addEventListener === "function") {
        reduceMotionQuery.addEventListener("change", handleMotionChange);
      } else if (typeof reduceMotionQuery.addListener === "function") {
        reduceMotionQuery.addListener(handleMotionChange);
      }
    }

    regionTrigger?.addEventListener("click", () => {
      networkController?.closePanel?.();
      setRegionPopoverOpen(!regionPopoverOpen);
    });
    root.document.addEventListener("mousedown", (event) => {
      if (popoverWrap && !popoverWrap.contains(event.target)) closeRegionPopover();
    });
    root.document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeRegionPopover();
    });
    regionMenu?.querySelectorAll("[data-region]").forEach((item) => {
      item.addEventListener("click", () => {
        const region = item.dataset.region;
        closeRegionPopover();
        if (!region) return;
        urlState.setCrRegion(region, { updateUrl: true, push: true });
        renderRegion();
      });
    });

    renderRegionPopover();
    renderRegion();
    renderWindowStepper({ force: true });
    syncResponsivePresentation(coordinator.getActiveMap());
    if (!mobileLayoutQuery?.matches) syncToolbarLayoutState();
    root.document.fonts?.ready?.then?.(() => {
      scheduleToolbarLayout();
    });
    return true;
  }

  const api = Object.freeze({
    mount,
    render,
    renderActiveMap,
    renderRegion,
    renderWindowStepper,
    syncResponsivePresentation,
    closeRegionPopover,
  });

  root.UkAqHexMapToolbarController = api;
}

initHexMapToolbarController(globalThis);
if (!crController || !search || !globalThis.UkAqHexMapToolbarController?.mount) {
  throw new Error("Hex Map toolbar controller failed to initialise.");
}
export default globalThis.UkAqHexMapToolbarController;
