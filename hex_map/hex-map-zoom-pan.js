function initHexMapZoomPan(root) {
  "use strict";

  const MIN_SCALE = 0.8;
  const MAX_SCALE = 3;
  const STEP = 1.15;
  // Preserve bounded map movement at the default scale on narrow screens.
  const MOBILE_INITIAL_PAN_RATIO = 0.25;
  const TAP_MOVE_THRESHOLD = 8;
  const CLICK_SUPPRESSION_MS = 220;
  const mobileLayoutQuery = typeof root.matchMedia === "function"
    ? root.matchMedia("(max-width: 767px)")
    : null;
  const touchInteractionQuery = typeof root.matchMedia === "function"
    ? root.matchMedia("(hover: none) and (pointer: coarse)")
    : null;

  function isNarrowScreen() {
    return Boolean(mobileLayoutQuery?.matches);
  }

  function usesTouchGestures() {
    return isNarrowScreen() || Boolean(touchInteractionQuery?.matches);
  }

  function createHexMapZoomPanController() {
    const controls = Array.from(document.querySelectorAll("[data-map-zoom-controls]"));
    if (!controls.length) {
      return Object.freeze({});
    }

    const mapState = new Map();

    function getSvgElement(control) {
      const id = control.getAttribute("data-map-svg-id");
      if (!id) {
        return null;
      }
      return document.getElementById(id);
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function getState(svgId) {
      const state = mapState.get(svgId);
      if (state) {
        return state;
      }
      const initial = { scale: 1, tx: 0, ty: 0 };
      mapState.set(svgId, initial);
      return initial;
    }

    function clampPan(viewport, state) {
      const width = viewport.clientWidth || 0;
      const height = viewport.clientHeight || 0;
      const mobileBaseTx = isNarrowScreen() ? width * MOBILE_INITIAL_PAN_RATIO : 0;
      const mobileBaseTy = isNarrowScreen() ? height * MOBILE_INITIAL_PAN_RATIO : 0;
      const maxTx = Math.max(mobileBaseTx, ((state.scale - 1) * width) / 2);
      const maxTy = Math.max(mobileBaseTy, ((state.scale - 1) * height) / 2);
      return {
        scale: state.scale,
        tx: clamp(state.tx, -maxTx, maxTx),
        ty: clamp(state.ty, -maxTy, maxTy),
      };
    }

    function applyTransform(svg, viewport, nextState, animate = false) {
      const clampedScale = clamp(nextState.scale, MIN_SCALE, MAX_SCALE);
      const clampedState = clampPan(viewport, {
        scale: clampedScale,
        tx: nextState.tx,
        ty: nextState.ty,
      });
      mapState.set(svg.id, clampedState);
      svg.style.transformOrigin = "50% 50%";
      svg.style.transform = `translate(${clampedState.tx}px, ${clampedState.ty}px) scale(${clampedState.scale})`;
      svg.style.transition = animate ? "transform 0.18s ease" : "none";
    }

    function setScale(svg, viewport, nextScale, animate = true) {
      const current = getState(svg.id);
      applyTransform(svg, viewport, {
        scale: nextScale,
        tx: current.tx,
        ty: current.ty,
      }, animate);
    }

    function zoomAroundPoint(svg, viewport, factor, anchorX, anchorY, animate = false) {
      const current = getState(svg.id);
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      if (Math.abs(nextScale - current.scale) < 0.0001) {
        return;
      }
      const width = viewport.clientWidth || 0;
      const height = viewport.clientHeight || 0;
      const centerX = width / 2;
      const centerY = height / 2;
      const ratio = nextScale / current.scale;
      const nextTx = (current.tx * ratio) + ((anchorX - centerX) * (1 - ratio));
      const nextTy = (current.ty * ratio) + ((anchorY - centerY) * (1 - ratio));
      applyTransform(svg, viewport, {
        scale: nextScale,
        tx: nextTx,
        ty: nextTy,
      }, animate);
    }

    function resetView(svg, viewport) {
      applyTransform(svg, viewport, { scale: 1, tx: 0, ty: 0 }, true);
    }

    controls.forEach((control) => {
      const svg = getSvgElement(control);
      if (!svg || !svg.id) {
        return;
      }
      const canvasWrap = control.closest(".map-canvas-wrap");
      const viewport = canvasWrap ? canvasWrap.querySelector(".map-svg-viewport") : null;
      if (!viewport) {
        return;
      }
      resetView(svg, viewport);

      let drag = null;
      let suppressClickUntil = 0;
      let singleTouch = null;
      let touchGesture = null;
      let touchSequenceWasGesture = false;

      function getTouchByIdentifier(touches, identifier) {
        return Array.from(touches).find((touch) => touch.identifier === identifier) || null;
      }

      function getTouchMetrics(touches) {
        const first = touches[0];
        const second = touches[1];
        if (!first || !second) {
          return null;
        }
        const rect = viewport.getBoundingClientRect();
        return {
          distance: Math.max(1, Math.hypot(
            second.clientX - first.clientX,
            second.clientY - first.clientY,
          )),
          midpointX: ((first.clientX + second.clientX) / 2) - rect.left,
          midpointY: ((first.clientY + second.clientY) / 2) - rect.top,
        };
      }

      function beginTouchGesture(event) {
        const metrics = getTouchMetrics(event.touches);
        if (!metrics) {
          return false;
        }
        const current = getState(svg.id);
        touchGesture = {
          startDistance: metrics.distance,
          startMidpointX: metrics.midpointX,
          startMidpointY: metrics.midpointY,
          startScale: current.scale,
          startTx: current.tx,
          startTy: current.ty,
        };
        touchSequenceWasGesture = true;
        singleTouch = null;
        viewport.classList.add("is-dragging");
        suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
        event.preventDefault();
        return true;
      }

      control.addEventListener("click", (event) => {
        const button = event.target instanceof Element
          ? event.target.closest("[data-zoom-action]")
          : null;
        if (!button) {
          return;
        }
        const action = button.getAttribute("data-zoom-action");
        const current = getState(svg.id).scale;
        if (action === "in") {
          setScale(svg, viewport, current * STEP, true);
          return;
        }
        if (action === "out") {
          setScale(svg, viewport, current / STEP, true);
          return;
        }
        if (action === "reset") {
          resetView(svg, viewport);
        }
      });

      viewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        if (event.pointerType === "touch" && usesTouchGestures()) {
          return;
        }
        const current = getState(svg.id);
        if (current.scale <= 1.001) {
          return;
        }
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startTx: current.tx,
          startTy: current.ty,
          moved: false,
        };
        viewport.classList.add("is-dragging");
      });

      viewport.addEventListener("wheel", (event) => {
        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }
        const rect = viewport.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        const anchorX = event.clientX - rect.left;
        const anchorY = event.clientY - rect.top;
        const speed = 0.006;
        const factor = Math.exp(-event.deltaY * speed);
        zoomAroundPoint(svg, viewport, factor, anchorX, anchorY, false);
        event.preventDefault();
      }, { passive: false });

      let gestureStartScale = 1;
      viewport.addEventListener("gesturestart", (event) => {
        if (usesTouchGestures()) {
          return;
        }
        gestureStartScale = getState(svg.id).scale;
        event.preventDefault();
      }, { passive: false });

      viewport.addEventListener("gesturechange", (event) => {
        if (usesTouchGestures()) {
          return;
        }
        const rect = viewport.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        const anchorX = event.clientX - rect.left;
        const anchorY = event.clientY - rect.top;
        const targetScale = clamp(gestureStartScale * event.scale, MIN_SCALE, MAX_SCALE);
        const current = getState(svg.id);
        const factor = targetScale / current.scale;
        zoomAroundPoint(svg, viewport, factor, anchorX, anchorY, false);
        event.preventDefault();
      }, { passive: false });

      viewport.addEventListener("touchstart", (event) => {
        if (!usesTouchGestures()) {
          return;
        }
        if (event.touches.length >= 2) {
          beginTouchGesture(event);
          return;
        }
        const touch = event.touches[0];
        if (!touch) {
          return;
        }
        touchGesture = null;
        touchSequenceWasGesture = false;
        singleTouch = {
          identifier: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          moved: false,
        };
      }, { passive: false });

      viewport.addEventListener("touchmove", (event) => {
        if (!usesTouchGestures()) {
          return;
        }
        if (event.touches.length >= 2) {
          if (!touchGesture && !beginTouchGesture(event)) {
            return;
          }
          const metrics = getTouchMetrics(event.touches);
          if (!metrics || !touchGesture) {
            return;
          }
          const width = viewport.clientWidth || 0;
          const height = viewport.clientHeight || 0;
          if (!width || !height) {
            return;
          }
          const targetScale = clamp(
            touchGesture.startScale * (metrics.distance / touchGesture.startDistance),
            MIN_SCALE,
            MAX_SCALE,
          );
          const ratio = targetScale / touchGesture.startScale;
          applyTransform(svg, viewport, {
            scale: targetScale,
            tx: (touchGesture.startTx * ratio)
              + ((touchGesture.startMidpointX - (width / 2)) * (1 - ratio))
              + (metrics.midpointX - touchGesture.startMidpointX),
            ty: (touchGesture.startTy * ratio)
              + ((touchGesture.startMidpointY - (height / 2)) * (1 - ratio))
              + (metrics.midpointY - touchGesture.startMidpointY),
          }, false);
          suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
          event.preventDefault();
          return;
        }
        if (!singleTouch) {
          return;
        }
        const touch = getTouchByIdentifier(event.touches, singleTouch.identifier);
        if (!touch) {
          return;
        }
        if (Math.hypot(
          touch.clientX - singleTouch.startX,
          touch.clientY - singleTouch.startY,
        ) > TAP_MOVE_THRESHOLD) {
          singleTouch.moved = true;
          suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
        }
      }, { passive: false });

      function endTouch(event) {
        if (!usesTouchGestures()) {
          return;
        }
        if (touchGesture && event.touches.length < 2) {
          suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
          touchGesture = null;
          viewport.classList.remove("is-dragging");
        }
        if (singleTouch && !getTouchByIdentifier(event.touches, singleTouch.identifier)) {
          if (singleTouch.moved) {
            suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
          }
          singleTouch = null;
        }
        if (touchSequenceWasGesture && event.touches.length === 0) {
          suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
          touchSequenceWasGesture = false;
        }
      }

      viewport.addEventListener("touchend", endTouch);
      viewport.addEventListener("touchcancel", endTouch);

      window.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) {
          return;
        }
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) > 3) {
          drag.moved = true;
        }
        if (!drag.moved) {
          return;
        }
        applyTransform(svg, viewport, {
          scale: getState(svg.id).scale,
          tx: drag.startTx + dx,
          ty: drag.startTy + dy,
        }, false);
        event.preventDefault();
      }, { passive: false });

      function endDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) {
          return;
        }
        if (drag.moved) {
          suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
        }
        drag = null;
        viewport.classList.remove("is-dragging");
      }

      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);

      viewport.addEventListener("click", (event) => {
        if (performance.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);

      window.addEventListener("resize", () => {
        applyTransform(svg, viewport, getState(svg.id), false);
      });
    });

    return Object.freeze({});
  }

  // The Hex Map page mounts once; this controller and its listeners live for the document lifetime.
  let controller = null;

  return Object.freeze({
    mount() {
      if (!controller) {
        controller = createHexMapZoomPanController();
      }
      return controller;
    },
  });
}

const zoomPan = initHexMapZoomPan(globalThis);
export default zoomPan;
