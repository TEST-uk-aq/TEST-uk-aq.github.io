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
  const chartBackButton = root.document.getElementById("chart-back-to-map");
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
  const windowStepperPrev = windowStepper?.querySelector("[data-window-step='prev']");
  const windowStepperNext = windowStepper?.querySelector("[data-window-step='next']");
  const windowStepperValueBox = windowStepper?.querySelector(".window-stepper-value-box");

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
  const tabletSearchLayoutQuery = typeof root.matchMedia === "function"
    ? root.matchMedia("(min-width: 768px) and (max-width: 1200px)")
    : null;
  const SENSOR_TABLE_COMPACT_WIDTH = 860;
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
      back: panelUk?.querySelector("[data-mobile-chart-back]") || null,
      network: panelUk?.querySelector("[data-mobile-chart-network]") || null,
      pollutant: panelUk?.querySelector("[data-mobile-chart-pollutant]") || null,
      range: panelUk?.querySelector("[data-mobile-chart-range]") || null,
      panel: panelUk?.querySelector("[data-mobile-chart-networks-panel]") || null,
    },
    cr: {
      back: panelCr?.querySelector("[data-mobile-chart-back]") || null,
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
  const relocationNodes = [
    chartBackButton,
    viewControl,
    regionSection,
    pollutantSelector,
    windowStepper,
    chartRangeToolbar,
    ...Object.values(mapSearches),
    ...Object.values(mobileSensorListControls).flatMap((controls) => [controls.select, controls.sort]),
  ]
    .filter(Boolean);
  const originalMarkers = new Map();

  [...relocationNodes, ...Object.values(networkAnchors).filter(Boolean)].forEach((node) => {
    if (!node.parentNode || originalMarkers.has(node)) return;
    const marker = root.document.createComment(`uk-aq-original-host:${node.id || node.className}`);
    node.parentNode.insertBefore(marker, node);
    originalMarkers.set(node, marker);
  });

  const tabletSearchInlineStyles = new Map(
    Object.values(mapSearches)
      .filter(Boolean)
      .map((node) => [node, {
        position: node.style.position,
        top: node.style.top,
        right: node.style.right,
        left: node.style.left,
        width: node.style.width,
        maxWidth: node.style.maxWidth,
        zIndex: node.style.zIndex,
      }]),
  );
  const toolbarInlinePosition = toolbar?.style.position || "";

  let mounted = false;
  let regionPopoverOpen = false;
  let prefersReducedMotion = Boolean(reduceMotionQuery?.matches);
  let windowStepperKey = null;
  let windowStepperTimer = null;
  let tabletSearchLayoutFrame = null;
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

  function restoreTabletSearchInlineStyle(searchNode) {
    const original = tabletSearchInlineStyles.get(searchNode);
    if (!searchNode || !original) return;
    searchNode.style.position = original.position;
    searchNode.style.top = original.top;
    searchNode.style.right = original.right;
    searchNode.style.left = original.left;
    searchNode.style.width = original.width;
    searchNode.style.maxWidth = original.maxWidth;
    searchNode.style.zIndex = original.zIndex;
  }

  function clearTabletSearchPlacement() {
    if (tabletSearchLayoutFrame !== null) {
      root.cancelAnimationFrame(tabletSearchLayoutFrame);
      tabletSearchLayoutFrame = null;
    }
    Object.values(mapSearches).forEach(restoreTabletSearchInlineStyle);
    if (toolbar) toolbar.style.position = toolbarInlinePosition;
  }

  function scheduleTabletSearchPlacement(mapKey = coordinator.getActiveMap()) {
    if (mobileLayoutQuery?.matches) return;
    const normalizedMapKey = mapKey === "cr" ? "cr" : "uk";
    const activeSearch = mapSearches[normalizedMapKey];
    if (!activeSearch) return;

    clearTabletSearchPlacement();
    restoreNode(activeSearch);
    if (!tabletSearchLayoutQuery?.matches || pageMode.getMode() !== "map" || !toolbar) return;

    tabletSearchLayoutFrame = root.requestAnimationFrame(() => {
      tabletSearchLayoutFrame = null;
      const toolbarRight = toolbar.querySelector(".toolbar-right");
      if (!toolbarRight || !activeSearch.isConnected) return;

      const visibleRightItems = Array.from(toolbarRight.children)
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = typeof root.getComputedStyle === "function" ? root.getComputedStyle(node) : null;
          return rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden";
        });
      if (!visibleRightItems.length) return;

      const rightItemRects = visibleRightItems.map((node) => node.getBoundingClientRect());
      const rightContentLeft = Math.min(...rightItemRects.map((rect) => rect.left));
      const rightContentTop = Math.min(...rightItemRects.map((rect) => rect.top));
      const rightContentBottom = Math.max(...rightItemRects.map((rect) => rect.bottom));
      const rightContentHeight = rightContentBottom - rightContentTop;
      const toolbarRect = toolbar.getBoundingClientRect();
      const searchRect = activeSearch.getBoundingClientRect();
      if (!(toolbarRect.width > 0 && searchRect.width > 0 && searchRect.height > 0)) return;

      const toolbarStyle = typeof root.getComputedStyle === "function" ? root.getComputedStyle(toolbar) : null;
      const paddingLeft = Number.parseFloat(toolbarStyle?.paddingLeft || "0") || 0;
      const rowGap = Number.parseFloat(toolbarStyle?.columnGap || toolbarStyle?.gap || "8") || 8;
      const contentLeft = toolbarRect.left + paddingLeft;
      const availableWidth = rightContentLeft - rowGap - contentLeft;
      if (availableWidth + 1 < searchRect.width) return;

      const rowHasLeftControl = Array.from(toolbar.children).some((node) => {
        if (node === toolbarRight || node === activeSearch || node.classList.contains("toolbar-divider")) return false;
        const rect = node.getBoundingClientRect();
        const style = typeof root.getComputedStyle === "function" ? root.getComputedStyle(node) : null;
        if (rect.width <= 4 || rect.height <= 0 || style?.display === "none" || style?.visibility === "hidden") return false;
        const overlapsStatusRow = rect.bottom > rightContentTop + 2 && rect.top < rightContentBottom - 2;
        return overlapsStatusRow && rect.right > contentLeft + 2 && rect.left < rightContentLeft - rowGap;
      });
      if (rowHasLeftControl) return;

      toolbar.style.position = "relative";
      activeSearch.style.position = "absolute";
      activeSearch.style.top = `${rightContentTop - toolbarRect.top + ((rightContentHeight - searchRect.height) / 2)}px`;
      activeSearch.style.right = "auto";
      activeSearch.style.left = `${paddingLeft}px`;
      activeSearch.style.width = `${searchRect.width}px`;
      activeSearch.style.maxWidth = `${availableWidth}px`;
      activeSearch.style.zIndex = "70";
      toolbar.insertBefore(activeSearch, toolbarRight);
    });
  }

  function restoreDistributedControls() {
    clearTabletSearchPlacement();
    relocationNodes.forEach(restoreNode);
    Object.values(networkAnchors).forEach(restoreNode);
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
    const compactSensorList = isCompactSensorList(normalizedMapKey);
    const mounts = mobileMounts[normalizedMapKey];
    const chartMounts = mobileChartMounts[normalizedMapKey];
    const sensorListMounts = mobileSensorListMounts[normalizedMapKey];
    const sensorListControls = mobileSensorListControls[normalizedMapKey];

    if (mobileChartMode && chartMounts?.back && chartMounts?.network && chartMounts?.pollutant && chartMounts?.range && chartMounts?.panel && sensorListMounts?.toolbar && sensorListMounts?.select && sensorListMounts?.sort) {
      const inactiveMapKey = normalizedMapKey === "uk" ? "cr" : "uk";
      restoreDistributedControls();
      Object.values(mobileSensorListMounts).forEach((candidate) => {
        if (candidate?.toolbar) candidate.toolbar.hidden = true;
      });
      relocateStatusRefreshForMap(normalizedMapKey);
      restoreNode(networkAnchors[inactiveMapKey]);
      if (chartBackButton && chartBackButton.parentElement !== chartMounts.back) {
        chartMounts.back.appendChild(chartBackButton);
      }
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
      if (sensorListControls?.select && sensorListControls.select.parentElement !== sensorListMounts.select) {
        sensorListMounts.select.appendChild(sensorListControls.select);
      }
      if (sensorListControls?.sort && sensorListControls.sort.parentElement !== sensorListMounts.sort) {
        sensorListMounts.sort.appendChild(sensorListControls.sort);
      }
      setSensorListToolbarPresentation(sensorListMounts.toolbar, "narrow-chart");
      sensorListMounts.toolbar.hidden = false;
      notifySensorListPresentation(normalizedMapKey, "narrow-chart");
      root.document.body.classList.remove("mobile-map-controls-active");
      root.document.body.classList.add("mobile-chart-controls-active");
      renderMobileViewAccessibility(normalizedMapKey, false);
      networkController?.syncPanelForActiveScope?.();
      return true;
    }

    if (compactSensorList && sensorListMounts?.toolbar && sensorListMounts?.select && sensorListMounts?.sort) {
      restoreDistributedControls();
      Object.values(mobileSensorListMounts).forEach((candidate) => {
        if (candidate?.toolbar) {
          candidate.toolbar.hidden = true;
          setSensorListToolbarPresentation(candidate.toolbar, null);
        }
      });
      if (pageMode.getMode() === "chart" && sensorListControls?.select) {
        sensorListMounts.select.appendChild(sensorListControls.select);
      }
      if (sensorListControls?.sort) {
        sensorListMounts.sort.appendChild(sensorListControls.sort);
      }
      setSensorListToolbarPresentation(sensorListMounts.toolbar, pageMode.getMode() === "chart" ? "compact-chart" : "compact-map");
      sensorListMounts.toolbar.hidden = false;
      notifySensorListPresentation(
        normalizedMapKey,
        pageMode.getMode() === "chart" ? "compact-chart" : "compact-map",
      );
      if (pageMode.getMode() === "map") {
        relocateStatusRefreshForMap(normalizedMapKey);
        scheduleTabletSearchPlacement(normalizedMapKey);
      }
      return true;
    }

    root.document.body.classList.remove("mobile-chart-controls-active");
    Object.values(mobileSensorListMounts).forEach((candidate) => {
      if (candidate?.toolbar) {
        candidate.toolbar.hidden = true;
        setSensorListToolbarPresentation(candidate.toolbar, null);
      }
    });

    if (!mobileMapMode || !mounts?.left || !mounts?.centre || !mounts?.right || !mounts?.pollutant || !mounts?.region || !mounts?.search || !mounts?.status) {
      restoreDistributedControls();
      Object.values(mobileMounts).forEach((candidate) => {
        candidate.region?.closest(".mobile-map-controls-row--tertiary")?.classList.remove("has-region-control");
      });
      relocateStatusRefreshForMap(normalizedMapKey);
      scheduleTabletSearchPlacement(normalizedMapKey);
      root.document.body.classList.remove("mobile-map-controls-active");
      renderMobileViewAccessibility(normalizedMapKey, false);
      networkController?.syncPanelForActiveScope?.();
      if (!mobileLayoutQuery?.matches) {
        notifySensorListPresentation(normalizedMapKey, pageMode.getMode() === "chart" ? "full-chart" : "full-map");
      }
      return false;
    }

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
    restoreNode(sensorListControls?.sort);
    if (sensorListControls?.sort && sensorListMounts?.sort) {
      sensorListMounts.sort.appendChild(sensorListControls.sort);
      setSensorListToolbarPresentation(sensorListMounts.toolbar, "narrow-map");
      sensorListMounts.toolbar.hidden = false;
    }
    notifySensorListPresentation(normalizedMapKey, "narrow-map");
    root.document.body.classList.add("mobile-map-controls-active");
    renderMobileViewAccessibility(normalizedMapKey, true);
    networkController?.syncPanelForActiveScope?.();
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
        scheduleTabletSearchPlacement(coordinator.getActiveMap());
      }
    });
    root.addEventListener("crregionchange", () => {
      renderRegion();
      scheduleTabletSearchPlacement(coordinator.getActiveMap());
    });
    root.addEventListener("hexpagemodechange", () => {
      syncResponsivePresentation(coordinator.getActiveMap());
    });

    if (mobileLayoutQuery) {
      const handleMobileLayoutChange = () => {
        closeRegionPopover();
        networkController?.closePanel?.();
        syncResponsivePresentation(coordinator.getActiveMap());
      };
      if (typeof mobileLayoutQuery.addEventListener === "function") {
        mobileLayoutQuery.addEventListener("change", handleMobileLayoutChange);
      } else if (typeof mobileLayoutQuery.addListener === "function") {
        mobileLayoutQuery.addListener(handleMobileLayoutChange);
      }
    }

    root.addEventListener("resize", () => {
      if (mobileLayoutQuery?.matches) return;
      scheduleTabletSearchPlacement(coordinator.getActiveMap());
    });
    root.document.fonts?.ready?.then(() => {
      if (!mobileLayoutQuery?.matches) scheduleTabletSearchPlacement(coordinator.getActiveMap());
    });

    if (typeof root.ResizeObserver === "function") {
      let sensorListResizeQueued = false;
      const sensorListResizeObserver = new root.ResizeObserver(() => {
        if (sensorListResizeQueued) return;
        sensorListResizeQueued = true;
        root.requestAnimationFrame(() => {
          sensorListResizeQueued = false;
          syncResponsivePresentation(coordinator.getActiveMap());
        });
      });
      [panelUk, panelCr].forEach((panel) => {
        const tableWrap = panel?.querySelector(".sensor-table-wrap");
        if (tableWrap) sensorListResizeObserver.observe(tableWrap);
      });
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