const TARGET_SELECTOR = "[data-hex-truncation]";
const TOOLTIP_ID = "hex-map-truncation-tooltip";

function createHexMapTruncation(root = globalThis) {
  const documentRef = root.document;
  if (!documentRef) return Object.freeze({ mount() {}, refresh() {} });

  let mounted = false;
  let tooltip = null;
  let shownTarget = null;
  let resizeObserver = null;
  const observed = new Set();

  function getTooltip() {
    if (tooltip?.isConnected) return tooltip;
    tooltip = documentRef.getElementById(TOOLTIP_ID);
    if (!tooltip) {
      tooltip = documentRef.createElement("div");
      tooltip.id = TOOLTIP_ID;
      tooltip.className = "hex-map-truncation-tooltip";
      tooltip.setAttribute("role", "tooltip");
      tooltip.hidden = true;
      documentRef.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function isTruncated(target) {
    return target.scrollWidth > target.clientWidth + 1
      || target.scrollHeight > target.clientHeight + 1;
  }

  function restoreTabIndex(target) {
    if (target.dataset.hexTruncationAddedTabindex !== "true") return;
    if (target.getAttribute("role") === "button" && target.getAttribute("tabindex") === "0") {
      delete target.dataset.hexTruncationAddedTabindex;
      delete target.dataset.hexTruncationOriginalTabindex;
      return;
    }
    const original = target.dataset.hexTruncationOriginalTabindex;
    if (original) target.setAttribute("tabindex", original);
    else target.removeAttribute("tabindex");
    delete target.dataset.hexTruncationAddedTabindex;
    delete target.dataset.hexTruncationOriginalTabindex;
  }

  function syncTarget(target) {
    const truncated = isTruncated(target);
    target.dataset.hexTruncated = truncated ? "true" : "false";
    if (target.dataset.hexTruncationFocusable === "true") {
      if (truncated && !target.hasAttribute("tabindex")) {
        target.dataset.hexTruncationOriginalTabindex = "";
        target.dataset.hexTruncationAddedTabindex = "true";
        target.tabIndex = 0;
      } else if (!truncated) {
        restoreTabIndex(target);
      }
    }
    if (!truncated && shownTarget === target) hide(target);
    return truncated;
  }

  function positionTooltip(target, tooltipElement) {
    const rect = target.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, root.innerWidth - tooltipElement.offsetWidth - margin);
    const left = Math.min(Math.max(margin, rect.left), maxLeft);
    const above = rect.top - tooltipElement.offsetHeight - margin;
    const top = above >= margin
      ? above
      : Math.min(root.innerHeight - tooltipElement.offsetHeight - margin, rect.bottom + margin);
    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.top = `${Math.max(margin, top)}px`;
  }

  function show(target) {
    if (!target?.isConnected || target.dataset.hexTruncated !== "true") return;
    const tooltipElement = getTooltip();
    tooltipElement.textContent = target.textContent.trim();
    if (!tooltipElement.textContent) return;
    tooltipElement.hidden = false;
    target.setAttribute("aria-describedby", TOOLTIP_ID);
    shownTarget = target;
    positionTooltip(target, tooltipElement);
  }

  function hide(target = shownTarget) {
    if (!target || target !== shownTarget) return;
    target.removeAttribute("aria-describedby");
    const tooltipElement = getTooltip();
    tooltipElement.hidden = true;
    tooltipElement.textContent = "";
    shownTarget = null;
  }

  function targetFor(eventTarget) {
    return eventTarget instanceof Element ? eventTarget.closest(TARGET_SELECTOR) : null;
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    documentRef.addEventListener("pointerover", (event) => show(targetFor(event.target)));
    documentRef.addEventListener("pointerout", (event) => {
      const target = targetFor(event.target);
      if (target && !target.contains(event.relatedTarget)) hide(target);
    });
    documentRef.addEventListener("focusin", (event) => show(targetFor(event.target)));
    documentRef.addEventListener("focusout", (event) => {
      const target = targetFor(event.target);
      if (target && !target.contains(event.relatedTarget)) hide(target);
    });
    root.addEventListener("resize", () => {
      if (shownTarget) {
        syncTarget(shownTarget);
        show(shownTarget);
      }
    }, { passive: true });
    if (typeof root.ResizeObserver === "function") {
      resizeObserver = new root.ResizeObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.target.isConnected) {
            resizeObserver.unobserve(entry.target);
            observed.delete(entry.target);
            return;
          }
          syncTarget(entry.target);
        });
      });
    }
  }

  function pruneDisconnectedTargets() {
    if (!resizeObserver) return;
    observed.forEach((target) => {
      if (!target.isConnected) {
        resizeObserver.unobserve(target);
        observed.delete(target);
      }
    });
  }

  function refresh(scope = documentRef) {
    mount();
    pruneDisconnectedTargets();
    const targets = [];
    if (scope instanceof Element && scope.matches(TARGET_SELECTOR)) targets.push(scope);
    if (scope?.querySelectorAll) targets.push(...scope.querySelectorAll(TARGET_SELECTOR));
    targets.forEach((target) => {
      syncTarget(target);
      if (resizeObserver && !observed.has(target)) {
        resizeObserver.observe(target);
        observed.add(target);
      }
    });
  }

  return Object.freeze({ mount, refresh });
}

const truncation = createHexMapTruncation();
globalThis.UkAqHexMapTruncation = truncation;

export default truncation;
