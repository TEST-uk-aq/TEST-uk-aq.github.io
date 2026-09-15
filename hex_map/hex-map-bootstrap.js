import "./hex-map-website-debug.js";
import "./hex-map-uk-controller.js";
import "./hex-map-cr-controller.js";
import toolbar from "./hex-map-toolbar-controller.js";
import urlState from "./hex-map-url-state.js";
import search from "./hex-map-search.js";
import zoomPan from "./hex-map-zoom-pan.js";
import pollutantAvailability from "./hex-map-pollutant-availability.js";
import mobileMapLayout from "./hex-map-mobile-map-layout.js";
import { formatRegionDisplayName } from "../shared/domain/regions-module.js";

function keepMobileNetworksPanelOpen() {
  const mobileLayoutQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 767px)")
    : null;

  document.body.addEventListener("mousedown", (event) => {
    if (!mobileLayoutQuery?.matches) return;
    const panel = document.getElementById("networks-panel-floating");
    if (!panel || panel.hidden) return;
    const target = event.target;
    if (panel.contains(target)) return;
    if (target instanceof Element && target.closest("[data-networks-pill]")) return;
    event.stopPropagation();
  });
}

function keepMobileNetworkRowsStable() {
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 767px) {
      .hex-map-page .networks-panel-floating.is-inline .network-option,
      body.hex-map-page.hex-chart-mode .networks-panel-floating .network-option {
        min-height: 58px;
        padding: 6px;
      }

      .hex-map-page .mobile-sensor-list-toolbar .mobile-sensor-sort select {
        flex: 0 0 auto;
        width: auto;
        min-width: 0;
        max-width: calc(100vw - 5.5rem);
      }
    }
  `;
  document.head.appendChild(style);
}

function refineMobileMapControls() {
  const mobileLayoutQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 767px)")
    : null;
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 767px) {
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--primary,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--primary:has(.mobile-map-controls--region .toolbar-region-section.visible) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left {
        grid-column: 1 / span 2;
        width: 100%;
        min-width: 0;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view {
        width: 100%;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button:not(.active),
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button.active {
        width: 100%;
        height: 60px;
        min-height: 60px;
        padding: 6px 7px;
        overflow: hidden;
        grid-template-rows: auto auto;
        grid-template-areas:
          "main"
          "sub";
        align-content: center;
        justify-items: center;
        text-align: center;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .view-button-main {
        grid-area: main;
        order: initial;
        width: 100%;
        font-size: clamp(0.68rem, 3vw, 0.78rem);
        font-weight: 700;
        line-height: 1.05;
        white-space: normal;
        text-align: center;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .view-button-sub {
        grid-area: sub;
        order: initial;
        width: 100%;
        font-size: clamp(0.52rem, 2.3vw, 0.60rem);
        font-weight: 600;
        line-height: 1.05;
        white-space: normal;
        text-align: center;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region {
        grid-column: 3;
        width: 100%;
        min-width: 0;
        justify-self: stretch;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .toolbar-region-section.visible,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-wrap,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-trigger {
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-trigger {
        height: 60px;
        min-height: 60px;
        padding: 5px 7px;
        gap: 4px;
        font-size: 0.70rem;
        line-height: 1.04;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-menu {
        left: auto;
        right: 0;
        width: 142px;
        max-width: calc(100vw - 16px);
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-item,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-group-head {
        white-space: normal;
        line-height: 1.15;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary.has-region-control {
        grid-template-columns: minmax(0, 1fr) clamp(150px, 40vw, 164px);
        gap: 6px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--centre {
        align-items: center;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--right {
        width: clamp(150px, 40vw, 164px);
        min-width: clamp(150px, 40vw, 164px);
        justify-self: end;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--right > .networks-pill-anchor,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--right .networks-pill {
        width: 100%;
        max-width: 100%;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .networks-pill-text {
        overflow: visible;
        text-overflow: clip;
        white-space: nowrap;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--centre .window-stepper {
        --window-stepper-value-width: 62px;
        --window-stepper-control-width: 106px;
        display: flex;
        width: auto;
        height: 44px;
        min-width: 0;
        align-items: center;
        gap: 4px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--centre .window-stepper-label {
        position: static;
        top: auto;
        grid-column: auto;
        grid-row: auto;
        order: 0;
        flex: 0 0 auto;
        margin: 0;
        font-size: 0.56rem;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.04em;
        text-align: left;
        text-transform: uppercase;
        white-space: nowrap;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--centre .window-stepper-control {
        order: 1;
        grid-column: auto;
        grid-row: auto;
        width: var(--window-stepper-control-width);
        height: 44px;
        grid-template-columns: 22px var(--window-stepper-value-width) 22px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--centre .window-stepper-value-box {
        width: var(--window-stepper-value-width);
        min-width: var(--window-stepper-value-width);
        max-width: var(--window-stepper-value-width);
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--centre .window-stepper-arrow--left,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--centre .window-stepper-arrow--right {
        justify-self: center;
        justify-content: center;
        padding-left: 0;
        padding-right: 0;
      }
    }
  `;
  document.head.appendChild(style);

  const regionLabel = document.getElementById("toolbar-region-label");
  const regionMenu = document.getElementById("toolbar-region-menu");
  const syncRegionLabel = () => {
    if (!regionLabel) return;
    const activeRegion = regionMenu?.querySelector("[data-region].active");
    let canonicalLabel = activeRegion?.dataset.region || activeRegion?.textContent?.trim() || regionLabel.dataset.fullRegion || regionLabel.textContent.trim();
    if (!canonicalLabel) return;
    regionLabel.dataset.fullRegion = canonicalLabel;
    const displayLabel = formatRegionDisplayName(canonicalLabel);
    regionLabel.textContent = displayLabel;
    regionLabel.setAttribute("aria-label", displayLabel);
  };

  syncRegionLabel();
  window.addEventListener("crregionchange", () => window.requestAnimationFrame(syncRegionLabel));
  if (typeof mobileLayoutQuery?.addEventListener === "function") {
    mobileLayoutQuery.addEventListener("change", () => window.requestAnimationFrame(syncRegionLabel));
  } else if (typeof mobileLayoutQuery?.addListener === "function") {
    mobileLayoutQuery.addListener(() => window.requestAnimationFrame(syncRegionLabel));
  }
}

function showMobileNetworkSelectionCount() {
  const mobileLayoutQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 767px)")
    : null;
  const dropdownCount = document.getElementById("network-dropdown-count");

  const sync = () => {
    if (!mobileLayoutQuery?.matches || !dropdownCount) return;
    const count = dropdownCount.textContent?.trim();
    if (!count) return;
    document.querySelectorAll("[data-networks-pill] .networks-pill-text").forEach((text) => {
      text.textContent = `Networks · ${count}`;
    });
  };

  sync();
  if (dropdownCount) {
    new MutationObserver(sync).observe(dropdownCount, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  window.addEventListener("networkselectionchange", () => window.requestAnimationFrame(sync));
  window.addEventListener("pollutantcapabilitychange", () => window.requestAnimationFrame(sync));
  if (typeof mobileLayoutQuery?.addEventListener === "function") {
    mobileLayoutQuery.addEventListener("change", () => window.requestAnimationFrame(sync));
  } else if (typeof mobileLayoutQuery?.addListener === "function") {
    mobileLayoutQuery.addListener(() => window.requestAnimationFrame(sync));
  }
}

toolbar.mount();
pollutantAvailability.mount();
urlState.bootstrap();
search.mount();
zoomPan.mount();
keepMobileNetworksPanelOpen();
keepMobileNetworkRowsStable();
mobileMapLayout?.mount?.();
refineMobileMapControls();
showMobileNetworkSelectionCount();
