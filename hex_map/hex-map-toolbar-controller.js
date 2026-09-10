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
  const mobileMounts = {
    uk: {
      left: panelUk?.querySelector("[data-mobile-map-controls-left]") || null,
      centre: panelUk?.querySelector("[data-mobile-map-controls-centre]") || null,
      right: panelUk?.querySelector("[data-mobile-map-controls-right]") || null,
      status: panelUk?.querySelector("[data-mobile-map-status-row]") || null,
    },
    cr: {
      left: panelCr?.querySelector("[data-mobile-map-controls-left]") || null,
      centre: panelCr?.querySelector("[data-mobile-map-controls-centre]") || null,
      right: panelCr?.querySelector("[data-mobile-map-controls-right]") || null,
      status: panelCr?.querySelector("[data-mobile-map-status-row]") || null,
    },
  };
  const networkAnchors = {
    uk: root.document.getElementById("uk-networks-pill-anchor"),
    cr: root.document.getElementById("cr-networks-pill-anchor"),
  };
  const relocationNodes = [viewControl, regionSection, pollutantSelector, windowStepper]
    .filter(Boolean);
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

  function restoreNode(node) {
    const marker = originalMarkers.get(node);
    if (!node || !marker?.parentNode) return false;
    if (node.previousSibling === marker) return true;
    marker.parentNode.insertBefore(node, marker.nextSibling);
    return true;
  }

  function restoreDistributedControls() {
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
    const normalizedMapKey = mapKey === "cr" ? "cr" : "uk";
    const mobileMapMode = isMobileMapMode();
    const mounts = mobileMounts[normalizedMapKey];

    if (!mobileMapMode || !mounts?.left || !mounts?.centre || !mounts?.right || !mounts?.status) {
      restoreDistributedControls();
      relocateStatusRefreshForMap(normalizedMapKey);
      root.document.body.classList.remove("mobile-map-controls-active");
      renderMobileViewAccessibility(normalizedMapKey, false);
      return false;
    }

    const inactiveMapKey = normalizedMapKey === "uk" ? "cr" : "uk";
    restoreNode(networkAnchors[inactiveMapKey]);
    [viewControl, regionSection].forEach((node) => {
      if (node && node.parentElement !== mounts.left) mounts.left.appendChild(node);
    });
    if (windowStepper && windowStepper.parentElement !== mounts.centre) {
      mounts.centre.appendChild(windowStepper);
    }
    relocateStatusRefreshForMap(normalizedMapKey, mounts.status);
    const activeNetworkAnchor = networkAnchors[normalizedMapKey];
    if (activeNetworkAnchor && activeNetworkAnchor.parentElement !== mounts.right) {
      mounts.right.appendChild(activeNetworkAnchor);
    }
    if (pollutantSelector && pollutantSelector.parentElement !== mounts.right) {
      mounts.right.appendChild(pollutantSelector);
    }
    root.document.body.classList.add("mobile-map-controls-active");
    renderMobileViewAccessibility(normalizedMapKey, true);
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
      if (event.detail?.window) renderWindowStepper();
    });
    root.addEventListener("crregionchange", renderRegion);
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
