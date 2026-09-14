(() => {
  "use strict";

  const endpoint = "/api/media/articles";
  const statusElement = document.getElementById("news-status");
  const errorElement = document.getElementById("news-error");
  const emptyElement = document.getElementById("news-empty");
  const listElement = document.getElementById("news-list");
  const countElement = document.getElementById("news-count");
  const retryButton = document.getElementById("news-retry");

  function safeHttpUrl(value, httpsOnly = false) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value);
      if (httpsOnly ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol)) {
        return null;
      }
      return url.href;
    } catch (_error) {
      return null;
    }
  }

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function articleDate(value) {
    if (typeof value !== "string") return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return {
      machine: date.toISOString(),
      display: new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date),
    };
  }

  function externalLink(url, className, label) {
    const link = document.createElement("a");
    link.className = className;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function buildArticleCard(article) {
    const cardItem = document.createElement("article");
    cardItem.className = "news-card-item";

    const articleUrl = safeHttpUrl(article?.canonical_url);
    const imageUrl = safeHttpUrl(article?.preview_image_url, true);
    const title = text(article?.title) || "Untitled article";
    const displayTitle = text(article?.display_title) || title;
    const publisher = text(article?.publisher) || "Publisher not supplied";

    const card = articleUrl
      ? externalLink(articleUrl, "news-card", "")
      : document.createElement("div");
    card.classList.add("news-card");
    if (articleUrl) {
      card.setAttribute(
        "aria-label",
        `Read “${title}” on ${publisher}, opens in a new tab`,
      );
      card.title = `${title} — ${publisher}`;
    }
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "news-card-image";
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => image.remove(), { once: true });
      card.append(image);
    }

    const gradient = document.createElement("div");
    gradient.className = "news-card-gradient";
    gradient.setAttribute("aria-hidden", "true");
    card.append(gradient);

    const externalCue = document.createElement("div");
    externalCue.className = "news-card-external-cue";
    externalCue.setAttribute("aria-hidden", "true");
    externalCue.textContent = `Read on ${publisher} ↗`;
    card.append(externalCue);

    const overlay = document.createElement("div");
    overlay.className = "news-card-overlay";

    const sourceRow = document.createElement("div");
    sourceRow.className = "news-card-source-row";
    const publisherElement = document.createElement("span");
    publisherElement.textContent = publisher;
    sourceRow.append(publisherElement);

    const published = articleDate(article?.published_at);
    if (published) {
      const separator = document.createElement("span");
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "·";
      const dateElement = document.createElement("time");
      dateElement.dateTime = published.machine;
      dateElement.textContent = published.display;
      sourceRow.append(separator, dateElement);
    }
    overlay.append(sourceRow);

    const heading = document.createElement("h3");
    heading.className = "news-card-title";
    heading.textContent = displayTitle;
    overlay.append(heading);

    card.append(overlay);
    cardItem.append(card);
    return cardItem;
  }

  function showOnly(element) {
    [statusElement, errorElement, emptyElement, listElement].forEach((candidate) => {
      candidate.hidden = candidate !== element;
    });
  }

  async function loadArticles() {
    countElement.hidden = true;
    showOnly(statusElement);
    retryButton.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Media API returned ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.articles)) throw new Error("Invalid Media response");

      listElement.replaceChildren(...payload.articles.map(buildArticleCard));
      if (!payload.articles.length) {
        showOnly(emptyElement);
        return;
      }
      countElement.textContent = `${payload.articles.length} ${payload.articles.length === 1 ? "article" : "articles"}`;
      countElement.hidden = false;
      showOnly(listElement);
    } catch (_error) {
      showOnly(errorElement);
    } finally {
      retryButton.disabled = false;
    }
  }

  retryButton.addEventListener("click", loadArticles);
  loadArticles();
})();
