import pageMode from "./hex-map-page-mode.js";

// One page-lifetime owner for UK and C&R selected-area document scrolling.
function initHexMapViewportFraming(root) {
  "use strict";

  if (!root?.document || !document.body.classList.contains("hex-map-page")) return null;

  let pendingMapKey = null;
  let viewportFrameGeneration = 0;
  let viewportFrameRafId = null;
  let viewportFrameTimerId = null;

  const VIEWPORT_FRAME_MARGIN = 12;
  const VIEWPORT_FRAME_RETRY_MS = 75;
  const VIEWPORT_FRAME_MAX_ATTEMPTS = 24;
  const VIEWPORT_FRAME_STABLE_SAMPLES = 4;
  const VIEWPORT_FRAME_STABLE_TOLERANCE = 1;

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

  function cancelViewportFrame(mapKey = null) {
    if (mapKey && mapKey !== pendingMapKey) return;
    pendingMapKey = null;
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
      visibleTop: offsetTop,
      visibleBottom: offsetTop + height,
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
    if (pageMode.isChartMode()) return null;
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
      start: Math.min(hexRect.top, sensorTargetRect.top),
      end: Math.max(hexRect.bottom, sensorTargetRect.bottom),
      sensorTop: sensorTargetRect.top,
      sensorBottom: sensorTargetRect.bottom,
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
    const { viewport, sensorTop, sensorBottom } = measurement;
    // Visibility itself has no inset: a fully visible row must never move the page.
    if (sensorTop >= viewport.visibleTop && sensorBottom <= viewport.visibleBottom) return 0;

    const frameMinimum = measurement.end - viewport.bottom;
    const frameMaximum = measurement.start - viewport.top;
    if (frameMinimum <= frameMaximum) {
      return Math.min(frameMaximum, Math.max(frameMinimum, 0));
    }
    // If both endpoints cannot fit, expose the row with the smallest scroll.
    const rowMinimum = sensorBottom - viewport.bottom;
    const rowMaximum = sensorTop - viewport.top;
    if (rowMinimum <= rowMaximum) {
      return Math.min(rowMaximum, Math.max(rowMinimum, 0));
    }
    return rowMinimum;
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
    if (pageMode.isChartMode()) {
      cancelViewportFrame();
      return;
    }

    const measurement = measureSelectedAreaFrame(request.mapKey);
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

  function frameSelectedArea(mapKeyValue) {
    const mapKey = normalizeMapKey(mapKeyValue);
    cancelViewportFrame();
    if (!mapKey || pageMode.isChartMode()) return false;
    pendingMapKey = mapKey;
    const request = {
      attempt: 0,
      generation: viewportFrameGeneration,
      mapKey,
      previousSignature: null,
      stableSamples: 0,
    };
    queueViewportFrameAttempt(request);
    return true;
  }

  // The page-mode owner emits synchronously, including on rapid chart entry/exit.
  // Invalidate the generation so an old map request cannot resume after returning.
  root.addEventListener("hexpagemodechange", cancelViewportFrameOnModeChange);
  function cancelViewportFrameOnModeChange() {
    cancelViewportFrame();
  }

  return Object.freeze({ frameSelectedArea, cancelViewportFrame });
}

const viewportFraming = initHexMapViewportFraming(globalThis);
export default viewportFraming;
