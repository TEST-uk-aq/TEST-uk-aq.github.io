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

  function handleLayoutChange() {
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

  return Object.freeze({ mount, rearrangeMobileRows });
}

const mobileMapLayout = initHexMapMobileMapLayout(globalThis);
export default mobileMapLayout;
