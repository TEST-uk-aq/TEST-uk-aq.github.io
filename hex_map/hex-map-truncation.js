const TARGET_SELECTOR = "[data-hex-truncation]";
const SENSOR_IDENTITY_SELECTOR = ".sensor-identity-cell";
const TOOLTIP_ID = "hex-map-truncation-tooltip";
const SENSOR_TABLE_COMPACT_WIDTH = 860;

function createHexMapTruncation(root = globalThis) {
  const documentRef = root.document;
  if (!documentRef) return Object.freeze({ mount() {}, refresh() {} });

  let mounted = false;
  let tooltip = null;
  let shownTarget = null;
  let resizeObserver = null;
  let identityRefreshFrame = null;
  const observed = new Set();
  const observedIdentities = new Set();

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
    if (!target.isConnected || target.getClientRects().length === 0) return false;
    return target.dataset.hexTruncationForced === "true"
      || target.scrollWidth > target.clientWidth + 1
      || target.scrollHeight > target.clientHeight + 1;
  }

  function tooltipText(target) {
    return target.dataset.hexTruncationFullText || target.textContent.trim();
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
    tooltipElement.textContent = tooltipText(target);
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

  function truncatedDescendants(target) {
    if (!(target instanceof Element)) return [];
    return Array.from(target.querySelectorAll(`${TARGET_SELECTOR}[data-hex-truncated="true"]`));
  }

  function descendantTargets(target) {
    if (!(target instanceof Element)) return [];
    return Array.from(target.querySelectorAll(TARGET_SELECTOR));
  }

  function showFocusOwnerTooltip(target) {
    const descendants = truncatedDescendants(target);
    if (!descendants.length) {
      hide();
      return false;
    }
    const tooltipElement = getTooltip();
    tooltipElement.textContent = descendants.map(tooltipText).filter(Boolean).join(" · ");
    if (!tooltipElement.textContent) {
      hide();
      return false;
    }
    tooltipElement.hidden = false;
    target.setAttribute("aria-describedby", TOOLTIP_ID);
    shownTarget = target;
    positionTooltip(target, tooltipElement);
    return true;
  }

  function isFocusOwner(target) {
    return target instanceof Element && target.matches("[data-hex-truncation-focus-owner]");
  }

  function refreshFocusOwnerTooltip(target) {
    descendantTargets(target).forEach((descendant) => syncTarget(descendant));
    return showFocusOwnerTooltip(target);
  }

  function refreshShownTooltip() {
    if (!shownTarget) return;
    if (!shownTarget.isConnected) {
      hide(shownTarget);
      return;
    }
    if (isFocusOwner(shownTarget)) {
      refreshFocusOwnerTooltip(shownTarget);
      return;
    }
    syncTarget(shownTarget);
    show(shownTarget);
  }

  function getSensorIdentityParts(identity) {
    const sensor = identity.querySelector(".sensor-name-button");
    const network = identity.querySelector(".sensor-network-text--compact");
    if (!sensor || !network) return null;
    if (identity.dataset.hexIdentitySensorText === undefined) {
      identity.dataset.hexIdentitySensorText = sensor.textContent.trim();
    }
    if (identity.dataset.hexIdentityNetworkText === undefined) {
      identity.dataset.hexIdentityNetworkText = network.textContent.trim();
    }
    return {
      sensor,
      network,
      sensorText: identity.dataset.hexIdentitySensorText,
    };
  }

  function shouldPresentResponsiveIdentity(identity) {
    if (root.matchMedia?.("(max-width: 767px)").matches) return true;
    const tableWrap = identity.closest(".sensor-table-wrap");
    return Boolean(tableWrap && tableWrap.getBoundingClientRect().width > 0
      && tableWrap.getBoundingClientRect().width < SENSOR_TABLE_COMPACT_WIDTH);
  }

  function identityLineHeight(identity) {
    const styles = root.getComputedStyle(identity);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    if (Number.isFinite(lineHeight)) return lineHeight;
    return Number.parseFloat(styles.fontSize) * 1.25;
  }

  function restoreSensorIdentityText(identity, parts) {
    const { sensor, network, sensorText } = parts;
    if (sensor.textContent !== sensorText) sensor.textContent = sensorText;
    if (network.textContent !== identity.dataset.hexIdentityNetworkText) {
      network.textContent = identity.dataset.hexIdentityNetworkText;
    }
    delete sensor.dataset.hexTruncationForced;
    delete sensor.dataset.hexTruncationFullText;
    if (sensor.dataset.hexIdentityAddedAriaLabel === "true") {
      sensor.removeAttribute("aria-label");
      delete sensor.dataset.hexIdentityAddedAriaLabel;
    }
  }

  function setSensorIdentityText(parts, text, truncated) {
    const { sensor, sensorText } = parts;
    if (sensor.textContent !== text) sensor.textContent = text;
    if (!truncated) return;
    sensor.dataset.hexTruncationForced = "true";
    sensor.dataset.hexTruncationFullText = sensorText;
    if (!sensor.hasAttribute("aria-label")) {
      sensor.setAttribute("aria-label", sensorText);
      sensor.dataset.hexIdentityAddedAriaLabel = "true";
    }
  }

  function fitsWithinTwoLines(identity) {
    const lineHeight = identityLineHeight(identity);
    return identity.scrollHeight <= (lineHeight * 2) + 1;
  }

  function truncateSensorIdentity(identity, parts) {
    const characters = Array.from(parts.sensorText);
    let low = 0;
    let high = characters.length;
    let best = 0;
    while (low <= high) {
      const midpoint = Math.floor((low + high) / 2);
      setSensorIdentityText(parts, `${characters.slice(0, midpoint).join("").trimEnd()}…`, true);
      if (fitsWithinTwoLines(identity)) {
        best = midpoint;
        low = midpoint + 1;
      } else {
        high = midpoint - 1;
      }
    }
    const wordBoundary = characters.slice(0, best).join("").trimEnd().lastIndexOf(" ");
    const preferredLength = wordBoundary > 0 ? wordBoundary : best;
    setSensorIdentityText(parts, `${characters.slice(0, preferredLength).join("").trimEnd()}…`, true);
  }

  function syncSensorIdentity(identity) {
    if (!identity.isConnected || identity.getClientRects().length === 0) return;
    const parts = getSensorIdentityParts(identity);
    if (!parts) return;
    restoreSensorIdentityText(identity, parts);
    if (!shouldPresentResponsiveIdentity(identity)) {
      delete identity.dataset.hexIdentityLayout;
      return;
    }
    identity.dataset.hexIdentityLayout = "inline";
    if (identity.scrollWidth <= identity.clientWidth + 1) return;
    identity.dataset.hexIdentityLayout = "wrapped";
    if (!fitsWithinTwoLines(identity)) truncateSensorIdentity(identity, parts);
    descendantTargets(identity).forEach((target) => syncTarget(target));
  }

  function refreshSensorIdentities() {
    observedIdentities.forEach((identity) => syncSensorIdentity(identity));
  }

  function scheduleSensorIdentityRefresh() {
    if (identityRefreshFrame !== null) return;
    identityRefreshFrame = root.requestAnimationFrame(() => {
      identityRefreshFrame = null;
      refreshSensorIdentities();
      refreshShownTooltip();
    });
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    documentRef.addEventListener("pointerover", (event) => show(targetFor(event.target)));
    documentRef.addEventListener("pointerout", (event) => {
      const target = targetFor(event.target);
      if (target && !target.contains(event.relatedTarget)) hide(target);
    });
    documentRef.addEventListener("focusin", (event) => {
      const target = targetFor(event.target);
      if (target) show(target);
      else if (event.target instanceof Element && event.target.matches("[data-hex-truncation-focus-owner]")) refreshFocusOwnerTooltip(event.target);
    });
    documentRef.addEventListener("focusout", (event) => {
      const target = targetFor(event.target);
      const owner = event.target instanceof Element && event.target.matches("[data-hex-truncation-focus-owner]")
        ? event.target
        : null;
      if (target && !target.contains(event.relatedTarget)) hide(target);
      else if (owner && !owner.contains(event.relatedTarget)) hide(owner);
    });
    root.addEventListener("resize", () => {
      scheduleSensorIdentityRefresh();
      refreshShownTooltip();
    }, { passive: true });
    if (typeof root.ResizeObserver === "function") {
      resizeObserver = new root.ResizeObserver((entries) => {
        let refreshIdentities = false;
        entries.forEach((entry) => {
          if (!entry.target.isConnected) {
            resizeObserver.unobserve(entry.target);
            observed.delete(entry.target);
            observedIdentities.delete(entry.target);
            return;
          }
          if (observed.has(entry.target)) syncTarget(entry.target);
          if (observedIdentities.has(entry.target)) refreshIdentities = true;
        });
        if (refreshIdentities) scheduleSensorIdentityRefresh();
        refreshShownTooltip();
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
    observedIdentities.forEach((identity) => {
      if (!identity.isConnected) {
        resizeObserver.unobserve(identity);
        observedIdentities.delete(identity);
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
    const identities = [];
    if (scope instanceof Element && scope.matches(SENSOR_IDENTITY_SELECTOR)) identities.push(scope);
    if (scope?.querySelectorAll) identities.push(...scope.querySelectorAll(SENSOR_IDENTITY_SELECTOR));
    identities.forEach((identity) => {
      if (resizeObserver && !observedIdentities.has(identity)) {
        resizeObserver.observe(identity);
        observedIdentities.add(identity);
      }
      syncSensorIdentity(identity);
    });
  }

  return Object.freeze({ mount, refresh });
}

const truncation = createHexMapTruncation();
globalThis.UkAqHexMapTruncation = truncation;

export default truncation;
