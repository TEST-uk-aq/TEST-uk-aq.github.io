import { parseMessage } from "./site-notice-schema.js";

// Reuse nodes so a refresh does not discard a focused, still-present link.
export function renderMessage(container, message) {
  const paragraphs = parseMessage(message);
  paragraphs.forEach((tokens, pIndex) => {
    let paragraph = container.children[pIndex];
    if (!paragraph) {
      paragraph = document.createElement("p");
      container.append(paragraph);
    }
    tokens.forEach((token, index) => {
      const tag = token.href ? "A" : "SPAN";
      let node = paragraph.children[index];
      if (node?.tagName !== tag) {
        const replacement = document.createElement(tag.toLowerCase());
        if (node) node.replaceWith(replacement);
        else paragraph.append(replacement);
        node = replacement;
      }
      if (node.textContent !== token.text) node.textContent = token.text;
      if (token.href) {
        node.setAttribute("href", token.href);
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    while (paragraph.children.length > tokens.length) paragraph.lastElementChild.remove();
  });
  while (container.children.length > paragraphs.length) container.lastElementChild.remove();
}

export function warningIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const triangle = document.createElementNS(ns, "path");
  triangle.setAttribute("d", "M12 3 22 21H2Z");
  triangle.setAttribute("fill", "none");
  triangle.setAttribute("stroke", "currentColor");
  triangle.setAttribute("stroke-width", "2");
  const mark = document.createElementNS(ns, "path");
  mark.setAttribute("d", "M12 9v5m0 3v.5");
  mark.setAttribute("stroke", "currentColor");
  mark.setAttribute("stroke-width", "2.5");
  mark.setAttribute("stroke-linecap", "round");
  svg.append(triangle, mark);
  return svg;
}
