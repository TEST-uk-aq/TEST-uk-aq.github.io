import "./hex-map-website-debug.js";
import "./hex-map-uk-controller.js";
import "./hex-map-cr-controller.js";
import toolbar from "./hex-map-toolbar-controller.js";
import urlState from "./hex-map-url-state.js";
import search from "./hex-map-search.js";
import zoomPan from "./hex-map-zoom-pan.js";
import pollutantAvailability from "./hex-map-pollutant-availability.js";

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

toolbar.mount();
pollutantAvailability.mount();
urlState.bootstrap();
search.mount();
zoomPan.mount();
keepMobileNetworksPanelOpen();
