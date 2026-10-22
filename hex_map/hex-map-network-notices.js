import { subscribeNotices } from "../shared/site-notice-store.js";
import { renderMessage, warningIcon } from "../shared/site-notice-message.js";

// Presentation adapter only: never reads or writes network selection/panel state.
export function createNetworkNotices(list, panel) {
  const entries = new Map();
  const tooltip = document.createElement("div");
  tooltip.id = "network-notice-popover";
  tooltip.className = "site-notice-tooltip";
  tooltip.setAttribute("role", "region");
  tooltip.hidden = true;
  const body = document.createElement("div");
  body.className = "site-notice-message";
  tooltip.append(body);
  document.body.append(tooltip);
  let configuration = null;
  let active = null;
  let latched = false;
  let closeTimer;
  let frame;
  let suppressFocus = false;

  function close(restoreFocus = false) {
    clearTimeout(closeTimer);
    if (!active) return;
    const trigger = active.button;
    active = null;
    latched = false;
    tooltip.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    cancelAnimationFrame(frame);
    if (restoreFocus && trigger.isConnected) {
      suppressFocus = true;
      trigger.focus({ preventScroll: true });
      suppressFocus = false;
    }
  }

  function position() {
    if (!active) return;
    const rect = active.button.getBoundingClientRect();
    if (!active.button.isConnected || panel.hidden || document.body.classList.contains("hex-chart-mode")
        || !active.button.getClientRects().length) { close(); return; }
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft || 0) + 8;
    const topEdge = (viewport?.offsetTop || 0) + 8;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const rightEdge = leftEdge + width - 16;
    const bottomEdge = topEdge + height - 16;
    const panelRect = panel.getBoundingClientRect();
    if (rect.bottom < Math.max(topEdge, panelRect.top) || rect.top > Math.min(bottomEdge, panelRect.bottom)) {
      close();
      return;
    }
    tooltip.style.maxWidth = `${Math.max(0, width - 16)}px`;
    // Prefer below, then above; scroll long copy within the available viewport.
    const below = bottomEdge - rect.bottom - 6;
    const above = rect.top - topEdge - 6;
    const useBelow = below >= Math.min(240, tooltip.scrollHeight) || below >= above;
    tooltip.style.maxHeight = `${Math.max(44, useBelow ? below : above)}px`;
    const box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(leftEdge, Math.min(rect.left, rightEdge - box.width))}px`;
    tooltip.style.top = `${Math.max(topEdge, Math.min(useBelow ? rect.bottom + 6 : rect.top - box.height - 6, bottomEdge - box.height))}px`;
    // The existing panel owner may reparent or move its anchor without resize.
    // Track only while a popover is visible; no competing panel positioning.
    frame = requestAnimationFrame(position);
  }

  function open(entry) {
    clearTimeout(closeTimer);
    if (active === entry) return;
    close();
    active = entry;
    renderMessage(body, entry.message);
    tooltip.setAttribute("aria-label", `Network notice: ${entry.label}`);
    entry.button.setAttribute("aria-expanded", "true");
    tooltip.hidden = false;
    position();
  }

  function deferClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (latched || tooltip.matches(":hover") || active?.button.matches(":hover")
          || tooltip.contains(document.activeElement) || active?.button === document.activeElement) return;
      close();
    }, 250);
  }

  function removeEntry(code, entry) {
    const focused = entry.button === document.activeElement || (active === entry && tooltip.contains(document.activeElement));
    if (active === entry) close();
    entry.button.remove();
    entries.delete(code);
    if (focused) {
      const input = entry.row.querySelector("input:not(:disabled)");
      (input || panel.querySelector("button:not(:disabled)"))?.focus({ preventScroll: true });
    }
  }

  function syncRows() {
    for (const [code, entry] of entries) {
      if (!entry.row.isConnected || !configuration?.network_notices[code]?.enabled) removeEntry(code, entry);
    }
    for (const row of list.querySelectorAll("[data-network-code]")) {
      const code = row.dataset.networkCode;
      const notice = configuration?.network_notices[code];
      if (!notice?.enabled) continue;
      const message = notice.message ?? configuration.site_notice.message;
      let entry = entries.get(code);
      if (entry) {
        if (entry.message !== message) {
          entry.message = message;
          if (active === entry) renderMessage(body, message);
        }
        continue;
      }
      const name = row.querySelector(".network-name");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "network-notice-trigger";
      button.title = ""; // Do not inherit the row's separate sensor-count title.
      button.setAttribute("aria-label", `Notice for ${name.textContent}`);
      button.setAttribute("aria-controls", tooltip.id);
      button.setAttribute("aria-expanded", "false");
      button.append(warningIcon());
      entry = { row, button, label: name.textContent, message };
      entries.set(code, entry);
      name.after(button);
      button.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") open(entry); });
      button.addEventListener("pointerleave", deferClose);
      button.addEventListener("focus", () => { if (!suppressFocus) open(entry); });
      button.addEventListener("blur", deferClose);
      button.addEventListener("mousedown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (active === entry && latched) close();
        else { open(entry); latched = true; }
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Tab" && !event.shiftKey && active === entry) {
          const link = tooltip.querySelector("a");
          if (link) { event.preventDefault(); link.focus(); }
        }
      });
    }
  }

  tooltip.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  tooltip.addEventListener("pointerleave", deferClose);
  tooltip.addEventListener("focusout", deferClose);
  // This portal lives outside the panel so overflow cannot clip it. Its own
  // interactions must never be interpreted as outside-panel clicks.
  for (const type of ["mousedown", "click"]) tooltip.addEventListener(type, (event) => event.stopPropagation());
  tooltip.addEventListener("keydown", (event) => {
    if (!active || event.key !== "Tab") return;
    const links = Array.from(tooltip.querySelectorAll("a"));
    if (event.shiftKey && document.activeElement === links[0]) {
      event.preventDefault();
      suppressFocus = true;
      active.button.focus();
      suppressFocus = false;
    } else if (!event.shiftKey && document.activeElement === links.at(-1)) {
      const controls = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]'))
        .filter((node) => !node.disabled && node.getClientRects().length && !tooltip.contains(node));
      const next = controls[controls.indexOf(active.button) + 1];
      if (next) { event.preventDefault(); close(); next.focus(); }
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (active && !active.button.contains(event.target) && !tooltip.contains(event.target)) close();
  }, true);
  document.addEventListener("focusin", (event) => {
    if (active && !active.button.contains(event.target) && !tooltip.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (active && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close(tooltip.contains(document.activeElement));
    }
  }, true);
  subscribeNotices((next) => { configuration = next; syncRows(); });
  return { syncRows };
}
