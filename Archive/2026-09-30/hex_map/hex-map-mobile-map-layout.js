import urlState from "./hex-map-url-state.js";

function initHexMapMobileMapLayout(root) {
  "use strict";

  if (!root?.document || !document.body.classList.contains("hex-map-page")) return null;

  const mobileLayoutQuery = typeof root.matchMedia === "function"
    ? root.matchMedia("(max-width: 767px)")
    : null;
  const ukButton = document.getElementById("toolbar-tab-uk");
  const crButton = document.getElementById("toolbar-tab-cr");
  let mounted = false;
  let viewObserver = null;
  let viewportFrameGeneration = 0;
  let viewportFrameRafId = null;
  let viewportFrameTimerId = null;

  const VIEWPORT_FRAME_MARGIN = 12;
  const VIEWPORT_FRAME_RETRY_MS = 75;
  const VIEWPORT_FRAME_MAX_ATTEMPTS = 24;
  const VIEWPORT_FRAME_STABLE_SAMPLES = 4;
  const VIEWPORT_FRAME_STABLE_TOLERANCE = 1;

  const MOBILE_STYLE = `
    @media (max-width: 767px) {
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--primary {
        grid-template-columns: minmax(0, 1fr);
        align-items: stretch;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--primary:has(.mobile-map-controls--region .toolbar-region-section.visible) {
        grid-template-columns: minmax(0, 1fr) clamp(112px, 34vw, 132px);
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left {
        width: auto;
        min-width: 0;
        align-items: stretch;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view {
        display: grid;
        width: min(100%, 246px);
        min-width: 0;
        height: auto;
        grid-template-columns: minmax(46px, 0.55fr) minmax(92px, 1.45fr);
        gap: 4px;
        padding: 0;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button:not(.active),
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button.active {
        position: relative;
        display: grid;
        width: 100%;
        min-width: 0;
        min-height: 44px;
        place-content: center;
        gap: 2px;
        padding: 5px 6px;
        border: 1px solid var(--ukaq-control-selectable-border);
        border-radius: 9px;
        background: var(--ukaq-control-selectable-bg);
        color: var(--ukaq-control-selectable-text);
        text-align: center;
        cursor: pointer;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button.active {
        border-color: var(--ukaq-control-selected-border);
        background: var(--ukaq-control-selected-bg);
        color: var(--ukaq-control-selected-text);
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button::before,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button::after,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button.active::before,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button.active::after {
        content: none;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .view-button-main {
        display: block;
        min-width: 0;
        font-size: clamp(0.66rem, 3vw, 0.76rem);
        font-weight: 700;
        line-height: 1.05;
        white-space: nowrap;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .view-button-sub {
        display: block;
        min-width: 0;
        font-size: clamp(0.54rem, 2.45vw, 0.62rem);
        font-weight: 600;
        line-height: 1.05;
        white-space: nowrap;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region {
        width: clamp(112px, 34vw, 132px);
        min-width: 0;
        justify-self: end;
        align-items: stretch;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region:not(:has(.toolbar-region-section.visible)) {
        display: none;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .toolbar-region-section.visible,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-wrap,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-trigger {
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-trigger {
        height: auto;
        min-height: 44px;
        padding: 5px 7px;
        gap: 5px;
        line-height: 1.08;
        white-space: normal;
        text-align: left;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region #toolbar-region-label {
        min-width: 0;
        white-space: normal;
        overflow-wrap: normal;
        word-break: normal;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-menu {
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-item,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-group-head {
        white-space: normal;
        line-height: 1.15;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary.has-region-control {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 136px;
        align-items: center;
        gap: 8px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--centre {
        width: auto;
        min-width: 0;
        justify-self: start;
        align-items: flex-start;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--right {
        position: static;
        width: 136px;
        min-width: 136px;
        justify-self: end;
        align-items: flex-end;
        transform: none;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--right > .networks-pill-anchor {
        margin-right: 0;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--right .networks-pill {
        max-width: 136px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--utility {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;

  function installStyles() {
    if (document.getElementById("hex-map-mobile-map-layout-style")) return;
    const style = document.createElement("style");
    style.id = "hex-map-mobile-map-layout-style";
    style.textContent = MOBILE_STYLE;
    document.head.appendChild(style);
  }

  function rearrangeMobileRows() {
    document.querySelectorAll("[data-mobile-map-controls-row]").forEach((shell) => {
      const primary = shell.querySelector(".mobile-map-controls-row--primary");
      const tertiary = shell.querySelector(".mobile-map-controls-row--tertiary");
      const left = shell.querySelector("[data-mobile-map-controls-left]");
      const right = shell.querySelector("[data-mobile-map-controls-right]");
      const region = shell.querySelector("[data-mobile-map-controls-region]");
      const centre = shell.querySelector("[data-mobile-map-controls-centre]");
      const networksPanelMount = shell.querySelector("[data-mobile-map-networks-panel]");

      if (!primary || !tertiary || !left || !right || !region || !centre) return;

      primary.append(left, region);
      tertiary.append(centre, right);
      tertiary.classList.add("mobile-map-controls-row--window-network");

      if (networksPanelMount && networksPanelMount.previousElementSibling !== tertiary) {
        tertiary.insertAdjacentElement("afterend", networksPanelMount);
      }
    });
  }

  function setMobileViewLabels() {
    const isMobile = Boolean(mobileLayoutQuery?.matches);
    const ukMain = ukButton?.querySelector(".view-button-main");
    const ukSub = ukButton?.querySelector(".view-button-sub");
    const crMain = crButton?.querySelector(".view-button-main");
    const crSub = crButton?.querySelector(".view-button-sub");

    if (ukMain) ukMain.textContent = isMobile ? "UK" : "United Kingdom";
    if (ukSub) ukSub.textContent = "Constituencies";
    if (crMain) crMain.textContent = isMobile ? "Countries/Regions" : "Countries & Regions";
    if (crSub) crSub.textContent = "Local Authorities";
  }

  function syncMobileViewAccessibility() {
    if (!mobileLayoutQuery?.matches || !document.body.classList.contains("mobile-map-controls-active")) return;
    if (ukButton) {
      if (ukButton.getAttribute("tabindex") !== "0") ukButton.setAttribute("tabindex", "0");
      if (ukButton.getAttribute("aria-label") !== "View United Kingdom constituencies") {
        ukButton.setAttribute("aria-label", "View United Kingdom constituencies");
      }
    }
    if (crButton) {
      if (crButton.getAttribute("tabindex") !== "0") crButton.setAttribute("tabindex", "0");
      if (crButton.getAttribute("aria-label") !== "View Countries and Regions local authorities") {
        crButton.setAttribute("aria-label", "View Countries and Regions local authorities");
      }
    }
  }

  function handleMobileViewClick(event, targetMapKey) {
    if (!mobileLayoutQuery?.matches || !document.body.classList.contains("mobile-map-controls-active")) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const targetButton = targetMapKey === "cr" ? crButton : ukButton;
    if (targetButton?.classList.contains("active")) return;

    if (targetMapKey === "cr") {
      urlState.switchToCr(null, { updateUrl: true, push: true });
    } else {
      urlState.switchToUk({ updateUrl: true, push: true });
    }

    root.requestAnimationFrame(() => {
      rearrangeMobileRows();
      setMobileViewLabels();
      syncMobileViewAccessibility();
    });
  }

  function clearViewportFrameHandles() {
    if (viewportFrameRafId !== null) {
      root.cancelAnimationFrame(viewportFrameRafId);
      viewportFrameRafId = null;
    }
    if (viewportFrameTimerId !== null) {
      root.clearTimeout(viewportFrameTimerId);
      viewportFrameTimerId = null;
    }
  }

  function cancelViewportFrame() {
    viewportFrameGeneration += 1;
    clearViewportFrameHandles();
  }

  function normalizeMapKey(value) {
    const mapKey = String(value || "").trim().toLowerCase();
    return mapKey === "uk" || mapKey === "cr" ? mapKey : null;
  }

  function visualViewportBounds() {
    const visualViewport = root.visualViewport;
    const offsetTop = Number.isFinite(visualViewport?.offsetTop)
      ? visualViewport.offsetTop
      : 0;
    const height = Number.isFinite(visualViewport?.height) && visualViewport.height > 0
      ? visualViewport.height
      : (root.innerHeight || document.documentElement.clientHeight || 0);
    if (!height) return null;
    return {
      top: offsetTop + VIEWPORT_FRAME_MARGIN,
      bottom: offsetTop + height - VIEWPORT_FRAME_MARGIN,
      height,
    };
  }

  function measurableRect(element) {
    if (!element || element.hidden || !element.getClientRects().length) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function measureSelectedAreaFrame(mapKey) {
    if (document.body.classList.contains("hex-chart-mode")) return null;
    const panel = document.getElementById(mapKey === "cr"
      ? "cr-map-inline-sensor-panel"
      : "map-inline-sensor-panel");
    const tableBody = document.getElementById(mapKey === "cr"
      ? "cr-sensor-table-body"
      : "sensor-table-body");
    const canvasWrap = panel?.closest(".map-canvas-wrap") || null;
    const selectedHex = canvasWrap?.querySelector(".hex.is-selected") || null;
    const firstSensor = tableBody?.querySelector("tr:not(.sensor-row-divider)") || null;
    const emptyMessage = document.getElementById(mapKey === "cr" ? "cr-details-empty" : "details-empty");
    if (!canvasWrap?.classList.contains("hex-selected")) return null;

    const panelRect = measurableRect(panel);
    const hexRect = measurableRect(selectedHex);
    const sensorTargetRect = measurableRect(firstSensor) || measurableRect(emptyMessage);
    const viewport = visualViewportBounds();
    if (!panelRect || !hexRect || !sensorTargetRect || !viewport) return null;

    return {
      start: hexRect.top,
      end: sensorTargetRect.bottom,
      viewport,
      signature: [
        panelRect.top,
        panelRect.height,
        hexRect.top,
        hexRect.height,
        sensorTargetRect.top,
        sensorTargetRect.height,
        viewport.top,
        viewport.height,
      ],
    };
  }

  function measureChartFrame(mapKey) {
    if (!document.body.classList.contains("hex-chart-mode")) return null;
    const panel = document.getElementById(`${mapKey}-hex-chart-mode`);
    const chartWrap = document.getElementById(`${mapKey}-hex-chart-wrap`);

    const panelRect = measurableRect(panel);
    const chartRect = measurableRect(chartWrap);
    const viewport = visualViewportBounds();
    if (!panelRect || !chartRect || !viewport) return null;

    return {
      start: panelRect.top,
      end: chartRect.bottom,
      viewport,
      signature: [
        panelRect.top,
        panelRect.height,
        chartRect.top,
        chartRect.height,
        viewport.top,
        viewport.height,
      ],
    };
  }

  function geometryIsStable(previous, next) {
    return Boolean(
      previous
      && next
      && previous.length === next.length
      && next.every((value, index) => (
        Math.abs(value - previous[index]) <= VIEWPORT_FRAME_STABLE_TOLERANCE
      )),
    );
  }

  function calculateFrameDelta(measurement) {
    const minimumDelta = measurement.end - measurement.viewport.bottom;
    const maximumDelta = measurement.start - measurement.viewport.top;
    if (minimumDelta <= maximumDelta) {
      return Math.min(maximumDelta, Math.max(minimumDelta, 0));
    }
    return minimumDelta;
  }

  function queueViewportFrameAttempt(request, delay = 0) {
    if (request.generation !== viewportFrameGeneration) return;
    const queueAnimationFrame = () => {
      if (request.generation !== viewportFrameGeneration) return;
      viewportFrameRafId = root.requestAnimationFrame(() => {
        viewportFrameRafId = null;
        runViewportFrameAttempt(request);
      });
    };
    if (delay > 0) {
      viewportFrameTimerId = root.setTimeout(() => {
        viewportFrameTimerId = null;
        queueAnimationFrame();
      }, delay);
      return;
    }
    queueAnimationFrame();
  }

  function runViewportFrameAttempt(request) {
    if (request.generation !== viewportFrameGeneration) return;
    if (!mobileLayoutQuery?.matches) {
      cancelViewportFrame();
      return;
    }

    const measurement = request.kind === "chart"
      ? measureChartFrame(request.mapKey)
      : measureSelectedAreaFrame(request.mapKey);
    request.attempt += 1;

    if (!measurement) {
      if (request.attempt < VIEWPORT_FRAME_MAX_ATTEMPTS) {
        queueViewportFrameAttempt(request, VIEWPORT_FRAME_RETRY_MS);
      }
      return;
    }

    if (geometryIsStable(request.previousSignature, measurement.signature)) {
      request.stableSamples += 1;
    } else {
      request.stableSamples = 1;
    }
    request.previousSignature = measurement.signature;
    if (request.stableSamples < VIEWPORT_FRAME_STABLE_SAMPLES) {
      if (request.attempt < VIEWPORT_FRAME_MAX_ATTEMPTS) {
        queueViewportFrameAttempt(request, VIEWPORT_FRAME_RETRY_MS);
      }
      return;
    }

    const deltaY = calculateFrameDelta(measurement);
    if (Math.abs(deltaY) < 1) return;
    const reduceMotion = root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    root.scrollBy({
      top: deltaY,
      left: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  function scheduleViewportFrame(kind, mapKeyValue) {
    const mapKey = normalizeMapKey(mapKeyValue);
    cancelViewportFrame();
    if (!mapKey || !mobileLayoutQuery?.matches) return false;
    const request = {
      attempt: 0,
      generation: viewportFrameGeneration,
      kind,
      mapKey,
      previousSignature: null,
      stableSamples: 0,
    };
    queueViewportFrameAttempt(request);
    return true;
  }

  function frameSelectedArea(mapKey) {
    return scheduleViewportFrame("area", mapKey);
  }

  function frameChart(mapKey) {
    return scheduleViewportFrame("chart", mapKey);
  }

  function handleLayoutChange() {
    if (!mobileLayoutQuery?.matches) {
      cancelViewportFrame();
    }
    rearrangeMobileRows();
    setMobileViewLabels();
    root.requestAnimationFrame(syncMobileViewAccessibility);
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    installStyles();
    rearrangeMobileRows();
    setMobileViewLabels();
    syncMobileViewAccessibility();

    ukButton?.addEventListener("click", (event) => handleMobileViewClick(event, "uk"), true);
    crButton?.addEventListener("click", (event) => handleMobileViewClick(event, "cr"), true);

    if (typeof mobileLayoutQuery?.addEventListener === "function") {
      mobileLayoutQuery.addEventListener("change", handleLayoutChange);
    } else if (typeof mobileLayoutQuery?.addListener === "function") {
      mobileLayoutQuery.addListener(handleLayoutChange);
    }

    viewObserver = new MutationObserver(() => {
      setMobileViewLabels();
      syncMobileViewAccessibility();
    });
    [ukButton, crButton].filter(Boolean).forEach((button) => {
      viewObserver.observe(button, { attributes: true, attributeFilter: ["class", "aria-label", "tabindex"] });
    });
  }

  return Object.freeze({
    mount,
    rearrangeMobileRows,
    frameSelectedArea,
    frameChart,
    cancelViewportFrame,
  });
}

const mobileMapLayout = initHexMapMobileMapLayout(globalThis);
globalThis.UkAqHexMapMobileMapLayout = mobileMapLayout;
export default mobileMapLayout;
