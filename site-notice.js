import { subscribeNotices } from "./shared/site-notice-store.js";
import { renderMessage, warningIcon } from "./shared/site-notice-message.js";

for (const mount of document.querySelectorAll("[data-ukaq-site-notice]")) {
  mount.append(warningIcon());
  const message = document.createElement("div");
  message.className = "site-notice-message";
  mount.append(message);
  subscribeNotices((config) => {
    const notice = config?.site_notice;
    if (notice?.enabled) renderMessage(message, notice.message);
    mount.hidden = !notice?.enabled;
  });
}
