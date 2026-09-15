const TARGET_SELECTOR = "[data-hex-truncation]";
const SENSOR_TABLE_WRAP_SELECTOR = ".sensor-table-wrap";
const TOOLTIP_ID = "hex-map-truncation-tooltip";
const SENSOR_TABLE_COMPACT_WIDTH = 860;
const IDENTITY_FIT_TOLERANCE_PX = 1;

function createHexMapTruncation(root = globalThis) {
  const documentRef = root.document;
  if (!documentRef) return Object.freeze({ mount() {}, refresh() {} });

  let mounted = false;
  let tooltip = null;
  let shownTarget = null;
  let resizeObserver = null;
  let identityRefreshFrame = null;
  const observed = new Set();
  const observedIdentityLists = new Set();

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
    return target.scrollWidth > target.clientWidth + 1
      || target.scrollHeight > target.clientHeight + 1;
  }

  function tooltipText(target) {
    return target.dataset.hexTruncationTooltip || target.textContent.trim();
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
    const sensor = identity.querySelector(".sensor-name-text");
    const network = identity.querySelector(".sensor-network-text--compact");
    if (!sensor || !network) return null;
    return { sensor, network };
  }

  function responsiveIdentityRegime(tableWrap) {
    if (root.matchMedia?.("(max-width: 767px)").matches) return "narrow";
    const width = tableWrap.getBoundingClientRect().width;
    return width > 0 && width < SENSOR_TABLE_COMPACT_WIDTH ? "compact" : null;
  }

  function identityLineHeight(identity) {
    const styles = root.getComputedStyle(identity);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    if (Number.isFinite(lineHeight)) return lineHeight;
    return Number.parseFloat(styles.fontSize) * 1.25;
  }

  function fitsInlineSensorIdentity(identity, parts) {
    const identityRect = identity.getBoundingClientRect();
    const networkRect = parts.network.getBoundingClientRect();
    if (identityRect.width <= 0 || networkRect.width <= 0) return false;
    return identity.scrollHeight <= identityLineHeight(identity) + IDENTITY_FIT_TOLERANCE_PX
      && identity.scrollWidth <= identity.clientWidth + IDENTITY_FIT_TOLERANCE_PX
      && parts.network.scrollWidth <= parts.network.clientWidth + IDENTITY_FIT_TOLERANCE_PX
      && networkRect.left >= identityRect.left - IDENTITY_FIT_TOLERANCE_PX
      && networkRect.right <= identityRect.right + IDENTITY_FIT_TOLERANCE_PX;
  }

  function sensorUsesSecondLine(parts) {
    const rects = Array.from(parts.sensor.getClientRects());
    const sensorRect = parts.sensor.getBoundingClientRect();
    return rects.length > 1
      || sensorRect.height > identityLineHeight(parts.sensor) + IDENTITY_FIT_TOLERANCE_PX;
  }

  function networkSharesSensorSecondLine(parts) {
    const sensorRects = Array.from(parts.sensor.getClientRects());
    const finalSensorRect = sensorRects[sensorRects.length - 1] || parts.sensor.getBoundingClientRect();
    const networkRect = parts.network.getBoundingClientRect();
    return networkRect.width > 0
      && Math.abs(networkRect.bottom - finalSensorRect.bottom) <= IDENTITY_FIT_TOLERANCE_PX;
  }

  function syncNetworkFinalLineState(identity, parts) {
    const sharesFinalSensorLine = networkSharesSensorSecondLine(parts);
    identity.dataset.hexNetworkSharesLine = sharesFinalSensorLine ? "true" : "false";
    if (!sharesFinalSensorLine) identity.dataset.hexNetworkOwnLine = "true";
  }

  function sensorIdentities(tableWrap) {
    return Array.from(tableWrap.querySelectorAll(
      ".sensor-table tbody tr:not(.sensor-row-divider) .sensor-identity-cell",
    )).filter((identity) => identity.isConnected);
  }

  function clearSensorIdentityMode(tableWrap, identities = sensorIdentities(tableWrap)) {
    delete tableWrap.dataset.hexIdentityMode;
    delete tableWrap.dataset.hexIdentityMeasuring;
    identities.forEach((identity) => {
      delete identity.dataset.hexIdentityMode;
      delete identity.dataset.hexIdentityMeasuring;
      delete identity.dataset.hexSensorWraps;
      delete identity.dataset.hexNetworkSharesLine;
      delete identity.dataset.hexNetworkOwnLine;
    });
  }

  function syncSensorIdentityList(tableWrap) {
    if (!tableWrap.isConnected || tableWrap.getClientRects().length === 0) return;
    const identities = sensorIdentities(tableWrap);
    const regime = responsiveIdentityRegime(tableWrap);
    clearSensorIdentityMode(tableWrap, identities);
    if (!identities.length || !regime) return;
    if (regime === "compact") {
      const rowParts = identities.map((identity) => ({ identity, parts: getSensorIdentityParts(identity) }))
        .filter(({ parts }) => Boolean(parts));
      rowParts.forEach(({ identity }) => {
        identity.dataset.hexIdentityMode = "inline";
      });
      const wrapped = rowParts.filter(({ identity, parts }) => !fitsInlineSensorIdentity(identity, parts));
      if (!wrapped.length) return;
      wrapped.forEach(({ identity }) => {
        identity.dataset.hexIdentityMode = "two-line";
        identity.dataset.hexIdentityMeasuring = "sensor-line";
      });
      wrapped.forEach(({ identity, parts }) => {
        identity.dataset.hexSensorWraps = sensorUsesSecondLine(parts) ? "true" : "false";
        identity.dataset.hexIdentityMeasuring = "network-line";
      });
      void identities[0]?.offsetWidth;
      wrapped.forEach(({ identity, parts }) => {
        if (identity.dataset.hexSensorWraps === "true") {
          syncNetworkFinalLineState(identity, parts);
        }
        delete identity.dataset.hexIdentityMeasuring;
      });
      return;
    }

    tableWrap.dataset.hexIdentityMode = "inline";
    const everyIdentityFits = identities.every((identity) => {
      const parts = getSensorIdentityParts(identity);
      return Boolean(parts && fitsInlineSensorIdentity(identity, parts));
    });
    if (everyIdentityFits) return;

    tableWrap.dataset.hexIdentityMode = "two-line";
    tableWrap.dataset.hexIdentityMeasuring = "sensor-line";
    const rowParts = identities.map((identity) => ({ identity, parts: getSensorIdentityParts(identity) }))
      .filter(({ parts }) => Boolean(parts));
    rowParts.forEach(({ identity, parts }) => {
      identity.dataset.hexSensorWraps = sensorUsesSecondLine(parts) ? "true" : "false";
    });
    tableWrap.dataset.hexIdentityMeasuring = "network-line";
    void tableWrap.offsetWidth;
    rowParts.forEach(({ identity, parts }) => {
      if (identity.dataset.hexSensorWraps !== "true") return;
      syncNetworkFinalLineState(identity, parts);
    });
    delete tableWrap.dataset.hexIdentityMeasuring;
  }

  function refreshSensorIdentityLists() {
    observedIdentityLists.forEach((tableWrap) => syncSensorIdentityList(tableWrap));
  }

  function scheduleSensorIdentityRefresh() {
    if (identityRefreshFrame !== null) return;
    const schedule = typeof root.requestAnimationFrame === "function"
      ? root.requestAnimationFrame.bind(root)
      : (callback) => (callback(), null);
    identityRefreshFrame = schedule(() => {
      identityRefreshFrame = null;
      refreshSensorIdentityLists();
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
        let refreshIdentityLists = false;
        entries.forEach((entry) => {
          if (!entry.target.isConnected) {
            resizeObserver.unobserve(entry.target);
            observed.delete(entry.target);
            observedIdentityLists.delete(entry.target);
            return;
          }
          if (observed.has(entry.target)) syncTarget(entry.target);
          if (observedIdentityLists.has(entry.target)) refreshIdentityLists = true;
        });
        if (refreshIdentityLists) scheduleSensorIdentityRefresh();
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
    observedIdentityLists.forEach((tableWrap) => {
      if (!tableWrap.isConnected) {
        resizeObserver.unobserve(tableWrap);
        observedIdentityLists.delete(tableWrap);
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
    const tableWraps = [];
    if (scope instanceof Element && scope.matches(SENSOR_TABLE_WRAP_SELECTOR)) tableWraps.push(scope);
    if (scope?.querySelectorAll) tableWraps.push(...scope.querySelectorAll(SENSOR_TABLE_WRAP_SELECTOR));
    tableWraps.forEach((tableWrap) => {
      if (resizeObserver && !observedIdentityLists.has(tableWrap)) {
        resizeObserver.observe(tableWrap);
        observedIdentityLists.add(tableWrap);
      }
      syncSensorIdentityList(tableWrap);
    });
  }

  return Object.freeze({ mount, refresh });
}

const truncation = createHexMapTruncation();
globalThis.UkAqHexMapTruncation = truncation;

export default truncation;
