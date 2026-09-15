import "./hex-map-website-debug.js";
import "./hex-map-uk-controller.js";
import "./hex-map-cr-controller.js";
import toolbar from "./hex-map-toolbar-controller.js";
import urlState from "./hex-map-url-state.js";
import search from "./hex-map-search.js";
import zoomPan from "./hex-map-zoom-pan.js";
import pollutantAvailability from "./hex-map-pollutant-availability.js";
import mobileMapLayout from "./hex-map-mobile-map-layout.js";

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
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--primary:has(.mobile-map-controls--region .toolbar-region-section.visible) {
        grid-template-columns: minmax(0, 1fr) clamp(104px, 31vw, 120px);
        gap: 6px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view {
        width: min(100%, 246px);
        grid-template-columns: 68px minmax(0, 1fr);
        gap: 4px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button,
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button:not(.active),
      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .segmented--view button.active {
        min-height: 52px;
        padding: 5px;
        overflow: hidden;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .view-button-main {
        order: 0;
        font-size: clamp(0.62rem, 2.8vw, 0.72rem);
        line-height: 1;
        white-space: normal;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--left .view-button-sub {
        order: 1;
        font-size: clamp(0.50rem, 2.25vw, 0.58rem);
        line-height: 1.02;
        white-space: normal;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region {
        width: clamp(104px, 31vw, 120px);
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-trigger {
        min-height: 52px;
        padding: 5px 7px;
        gap: 4px;
        font-size: 0.70rem;
        line-height: 1.04;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--region .popover-menu {
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
        grid-template-columns: minmax(0, 1fr) 136px;
        gap: 6px;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls-row--tertiary .mobile-map-controls--centre {
        align-items: center;
      }

      body.hex-map-page.mobile-map-controls-active .mobile-map-controls--centre .window-stepper {
        --window-stepper-value-width: 46px;
        --window-stepper-control-width: 94px;
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
        grid-template-columns: 24px var(--window-stepper-value-width) 24px;
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
    if (canonicalLabel === "Yorkshire & Humber") canonicalLabel = "Yorkshire and The Humber";
    if (!canonicalLabel) return;
    regionLabel.dataset.fullRegion = canonicalLabel;
    regionLabel.textContent = mobileLayoutQuery?.matches && canonicalLabel === "Yorkshire and The Humber"
      ? "Yorkshire & Humber"
      : canonicalLabel;
    regionLabel.setAttribute("aria-label", canonicalLabel);
  };

  syncRegionLabel();
  window.addEventListener("crregionchange", () => window.requestAnimationFrame(syncRegionLabel));
  if (typeof mobileLayoutQuery?.addEventListener === "function") {
    mobileLayoutQuery.addEventListener("change", () => window.requestAnimationFrame(syncRegionLabel));
  } else if (typeof mobileLayoutQuery?.addListener === "function") {
    mobileLayoutQuery.addListener(() => window.requestAnimationFrame(syncRegionLabel));
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
