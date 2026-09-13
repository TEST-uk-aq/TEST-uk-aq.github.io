(() => {
  "use strict";

  const endpoint = "/api/media/articles?limit=6";
  const desktopQuery = window.matchMedia("(min-width: 768px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const carousel = document.querySelector("[data-homepage-media-carousel]");
  const content = document.querySelector("[data-homepage-media-content]");
  const mobileTeaser = document.querySelector("[data-homepage-media-mobile]");
  const mobileContent = document.querySelector("[data-homepage-media-mobile-content]");
  const rotationMs = 8000;
  let articles = [];
  let currentIndex = 0;
  let rotationTimer = null;
  let loaded = false;

  if (!carousel || !content || !mobileTeaser || !mobileContent) return;

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
      display: new Intl.DateTimeFormat("en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
      }).format(date),
    };
  }

  function usableArticle(article) {
    const canonicalUrl = safeHttpUrl(article?.canonical_url);
    const title = text(article?.display_title) || text(article?.title);
    return canonicalUrl && title;
  }

  function stopRotation() {
    if (rotationTimer !== null) window.clearTimeout(rotationTimer);
    rotationTimer = null;
  }

  function scheduleRotation() {
    stopRotation();
    if (
      articles.length < 2 ||
      reducedMotionQuery.matches ||
      document.hidden
    ) return;
    rotationTimer = window.setTimeout(() => {
      showArticle(currentIndex + 1);
      scheduleRotation();
    }, rotationMs);
  }

  function addTextElement(tagName, className, value) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function appendSource(container, className, article, publisher) {
    const source = document.createElement("div");
    source.className = className;
    source.append(addTextElement("span", "", publisher));
    const published = articleDate(article.published_at);
    if (published) {
      const separator = addTextElement("span", "", " · ");
      separator.setAttribute("aria-hidden", "true");
      const date = addTextElement("time", "", published.display);
      date.dateTime = published.machine;
      source.append(separator, date);
    }
    container.append(source);
  }

  function articleLink(article, className, publisher, title) {
    const link = document.createElement("a");
    link.className = className;
    link.href = safeHttpUrl(article.canonical_url);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Read “${text(article.title) || title}” on ${publisher}, opens in a new tab`);
    return link;
  }

  function showMobileArticle(article, publisher, title) {
    const card = articleLink(article, "homepage-media-mobile-card", publisher, title);
    appendSource(card, "homepage-media-mobile-source", article, publisher);
    const headline = document.createElement("h3");
    headline.className = "homepage-media-mobile-title";
    headline.append(addTextElement("span", "homepage-media-mobile-title-text", title));
    card.append(headline);
    const icon = document.createElement("img");
    icon.className = "homepage-media-mobile-link-icon";
    icon.src = "/images/Link-Icon-wider-white.png";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    card.append(icon);
    mobileContent.replaceChildren(card, createControls("homepage-media-mobile-controls"));
  }

  function createControls(extraClass = "") {
    const controls = document.createElement("div");
    controls.className = ["homepage-media-carousel-controls", extraClass].filter(Boolean).join(" ");
    const previous = addTextElement("button", "homepage-media-carousel-button", "◀");
    previous.type = "button";
    previous.setAttribute("aria-label", "Previous article");
    previous.addEventListener("click", () => {
      showArticle(currentIndex - 1);
      scheduleRotation();
    });
    const dots = document.createElement("div");
    dots.className = "homepage-media-carousel-dots";
    articles.forEach((_item, index) => {
      const dot = addTextElement("button", "homepage-media-carousel-dot", index === currentIndex ? "●" : "○");
      dot.type = "button";
      dot.setAttribute("aria-label", `Show article ${index + 1}`);
      if (index === currentIndex) dot.setAttribute("aria-current", "true");
      dot.addEventListener("click", () => {
        showArticle(index);
        scheduleRotation();
      });
      dots.append(dot);
    });
    const next = addTextElement("button", "homepage-media-carousel-button", "▶");
    next.type = "button";
    next.setAttribute("aria-label", "Next article");
    next.addEventListener("click", () => {
      showArticle(currentIndex + 1);
      scheduleRotation();
    });
    controls.append(previous, dots, next);
    return controls;
  }

  function showArticle(nextIndex) {
    if (!articles.length) return;
    currentIndex = (nextIndex + articles.length) % articles.length;
    const article = articles[currentIndex];
    const title = text(article.display_title) || text(article.title);
    const publisher = text(article.publisher) || "Publisher";

    if (!desktopQuery.matches) {
      showMobileArticle(article, publisher, title);
      return;
    }

    const card = articleLink(article, "homepage-media-carousel-card", publisher, title);

    const imageUrl = safeHttpUrl(article.preview_image_url, true);
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "homepage-media-carousel-image";
      image.src = imageUrl;
      image.alt = "";
      image.decoding = "async";
      image.addEventListener("error", () => image.remove(), { once: true });
      card.append(image);
    }

    const gradient = document.createElement("div");
    gradient.className = "homepage-media-carousel-card-gradient";
    gradient.setAttribute("aria-hidden", "true");
    card.append(gradient);

    const cue = document.createElement("div");
    cue.className = "homepage-media-carousel-cue";
    cue.setAttribute("aria-hidden", "true");
    cue.append(addTextElement("span", "homepage-media-carousel-cue-text", `Read on ${publisher}`));
    const cueIcon = document.createElement("img");
    cueIcon.className = "homepage-media-carousel-cue-icon";
    cueIcon.src = "/images/Link-Icon-wider-white.png";
    cueIcon.alt = "";
    cue.append(cueIcon);
    card.append(cue);

    const overlay = document.createElement("div");
    overlay.className = "homepage-media-carousel-overlay";
    appendSource(overlay, "homepage-media-carousel-source", article, publisher);
    overlay.append(addTextElement("h3", "homepage-media-carousel-title", title));
    card.append(overlay);

    content.replaceChildren(card, createControls());
  }

  async function loadArticles() {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("media_unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload?.articles)) throw new Error("invalid_media_response");
      articles = payload.articles.filter(usableArticle);
      if (!articles.length) throw new Error("no_usable_articles");
      showArticle(0);
      updatePresentation();
    } catch (_error) {
      articles = [];
      content.replaceChildren();
      mobileContent.replaceChildren();
      carousel.hidden = true;
      mobileTeaser.hidden = true;
    }
  }

  function updatePresentation() {
    if (!loaded) {
      loaded = true;
      loadArticles();
      return;
    }
    if (articles.length) {
      carousel.hidden = !desktopQuery.matches;
      mobileTeaser.hidden = desktopQuery.matches;
      showArticle(currentIndex);
      scheduleRotation();
      return;
    }
    stopRotation();
    carousel.hidden = true;
    mobileTeaser.hidden = true;
  }

  desktopQuery.addEventListener("change", updatePresentation);
  reducedMotionQuery.addEventListener("change", scheduleRotation);
  document.addEventListener("visibilitychange", scheduleRotation);
  updatePresentation();
})();
