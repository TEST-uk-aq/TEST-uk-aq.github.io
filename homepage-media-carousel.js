(() => {
  "use strict";

  // Homepage media is a generation-pinned latest-six snapshot. Desktop and mobile share
  // this one state, refresh loop and rotation timer; background failures retain the card shown.
  const versionEndpoint = "/api/media/articles/homepage/version";
  const feedEndpoint = (generation) => `/api/media/articles/homepage?generation=${encodeURIComponent(generation)}`;
  const desktopQuery = window.matchMedia("(min-width: 768px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const carousel = document.querySelector("[data-homepage-media-carousel]");
  const content = document.querySelector("[data-homepage-media-content]");
  const mobileTeaser = document.querySelector("[data-homepage-media-mobile]");
  const mobileContent = document.querySelector("[data-homepage-media-mobile-content]");
  const rotationMs = 8000;
  const imageFallbackDelayMs = 2000;
  const transitionMs = 500;
  const freshnessMs = 15 * 60 * 1000;
  let articles = [];
  let currentIndex = 0;
  let rotationTimer = null;
  let freshnessTimer = null;
  let activeGeneration = null;
  let lastSuccessfulVersionCheckAt = 0;
  let nextFreshnessCheckNotBefore = 0;
  let refreshInFlight = null;
  let transitionInFlight = false;
  let navigationToken = 0;
  let desktopCard = null;
  const imageStates = new Map();
  const desktopCards = new Set();

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
    const raw = text(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/.exec(raw);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) return null;
    return {
      machine: raw,
      display: `${match[3]}/${match[2]}/${match[1]}`,
    };
  }

  function usableArticle(article) {
    const id = Number(article?.id);
    const canonicalUrl = safeHttpUrl(article?.canonical_url);
    const title = text(article?.display_title) || text(article?.title);
    return Number.isSafeInteger(id) && id > 0 && canonicalUrl && title;
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
      navigateTo(currentIndex + 1);
    }, rotationMs);
  }

  function stopFreshnessChecks() {
    if (freshnessTimer !== null) window.clearTimeout(freshnessTimer);
    freshnessTimer = null;
  }

  function nextFreshnessCheckAt() {
    return Math.max(lastSuccessfulVersionCheckAt + freshnessMs, nextFreshnessCheckNotBefore);
  }

  function scheduleFreshnessCheck() {
    stopFreshnessChecks();
    if (document.hidden || !articles.length) return;
    const delay = Math.max(0, nextFreshnessCheckAt() - Date.now());
    freshnessTimer = window.setTimeout(async () => {
      await refreshArticles(false);
      scheduleFreshnessCheck();
    }, delay);
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
      navigateTo(currentIndex - 1);
    });
    const dots = document.createElement("div");
    dots.className = "homepage-media-carousel-dots";
    articles.forEach((_item, index) => {
      const dot = addTextElement("button", "homepage-media-carousel-dot", index === currentIndex ? "●" : "○");
      dot.type = "button";
      dot.setAttribute("aria-label", `Show article ${index + 1}`);
      if (index === currentIndex) dot.setAttribute("aria-current", "true");
      dot.addEventListener("click", () => {
        navigateTo(index);
      });
      dots.append(dot);
    });
    const next = addTextElement("button", "homepage-media-carousel-button", "▶");
    next.type = "button";
    next.setAttribute("aria-label", "Next article");
    next.addEventListener("click", () => {
      navigateTo(currentIndex + 1);
    });
    controls.append(previous, dots, next);
    return controls;
  }

  function imageStateFor(article) {
    const imageUrl = safeHttpUrl(article.preview_image_url, true);
    if (!imageUrl) {
      return {
        status: "missing",
        image: null,
        ready: Promise.resolve(),
        subscribe: () => () => {},
      };
    }
    const key = `${article.id}:${imageUrl}`;
    if (imageStates.has(key)) return imageStates.get(key);
    const listeners = new Set();
    let resolveDisplayable;
    let isDisplayable = false;
    const state = {
      status: "loading",
      image: null,
      ready: new Promise(resolve => { resolveDisplayable = resolve; }),
      subscribe(listener) {
        if (!["loading", "timed-out"].includes(state.status)) return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const markDisplayable = () => {
      if (isDisplayable) return;
      isDisplayable = true;
      resolveDisplayable();
    };
    const notify = (terminal = false) => {
      const currentListeners = Array.from(listeners);
      if (terminal) listeners.clear();
      currentListeners.forEach(listener => listener());
    };
    let fallbackTimer = null;
    imageStates.set(key, state);
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", async () => {
      if (["ready", "failed"].includes(state.status)) return;
      if (typeof image.decode === "function") {
        try {
          await image.decode();
        } catch (_error) {
          if (!image.complete || !image.naturalWidth) return;
        }
      }
      if (state.status === "failed") return;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
      state.status = "ready";
      state.image = image;
      markDisplayable();
      notify(true);
    }, { once: true });
    image.addEventListener("error", () => {
      if (["ready", "failed"].includes(state.status)) return;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
      state.status = "failed";
      state.image = null;
      markDisplayable();
      notify(true);
    }, { once: true });
    fallbackTimer = window.setTimeout(() => {
      if (state.status !== "loading") return;
      fallbackTimer = null;
      state.status = "timed-out";
      markDisplayable();
      notify();
    }, imageFallbackDelayMs);
    image.src = imageUrl;
    return state;
  }

  function attachReadyImage(card, state) {
    if (state.status !== "ready" || !state.image) return;
    const image = state.image.cloneNode();
    image.className = "homepage-media-carousel-image";
    image.alt = "";
    card.prepend(image);
    requestAnimationFrame(() => image.classList.add("is-ready"));
  }

  function buildDesktopCard(article, allowLoadingState = false) {
    const title = text(article.display_title) || text(article.title);
    const publisher = text(article.publisher) || "Publisher";
    const card = articleLink(article, "homepage-media-carousel-card", publisher, title);
    const state = imageStateFor(article);
    if (allowLoadingState && state.status === "loading") card.classList.add("is-image-loading");
    attachReadyImage(card, state);
    const updateImage = () => {
      if (card.querySelector(".homepage-media-carousel-image")) return;
      card.classList.remove("is-image-loading");
      attachReadyImage(card, state);
    };
    const unsubscribe = state.subscribe(updateImage);
    card.cleanupImageState = () => {
      unsubscribe();
      desktopCards.delete(card);
    };
    desktopCards.add(card);

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

    return card;
  }

  function renderDesktopInitial() {
    desktopCards.forEach(card => card.cleanupImageState());
    const stage = document.createElement("div");
    stage.className = "homepage-media-carousel-stage";
    desktopCard = buildDesktopCard(articles[currentIndex], true);
    stage.append(desktopCard);
    content.replaceChildren(stage, createControls());
    imageStateFor(articles[(currentIndex + 1) % articles.length]);
  }

  async function navigateTo(nextIndex) {
    if (!articles.length || transitionInFlight) return;
    const targetIndex = (nextIndex + articles.length) % articles.length;
    if (!desktopQuery.matches) {
      currentIndex = targetIndex;
      const article = articles[currentIndex];
      showMobileArticle(article, text(article.publisher) || "Publisher", text(article.display_title) || text(article.title));
      scheduleRotation();
      return;
    }
    if (targetIndex === currentIndex) {
      scheduleRotation();
      return;
    }
    stopRotation();
    transitionInFlight = true;
    const token = ++navigationToken;
    const state = imageStateFor(articles[targetIndex]);
    await state.ready;
    if (token !== navigationToken || !desktopQuery.matches) return;
    const stage = content.querySelector(".homepage-media-carousel-stage");
    if (!stage || !desktopCard) {
      transitionInFlight = false;
      updatePresentation();
      return;
    }
    const incoming = buildDesktopCard(articles[targetIndex]);
    incoming.classList.add("is-entering");
    stage.append(incoming);
    void incoming.offsetWidth;
    incoming.classList.remove("is-entering");
    desktopCard.classList.add("is-leaving");
    const outgoing = desktopCard;
    await new Promise(resolve => window.setTimeout(resolve, reducedMotionQuery.matches ? 0 : transitionMs));
    outgoing.cleanupImageState?.();
    outgoing.remove();
    desktopCard = incoming;
    currentIndex = targetIndex;
    content.replaceChildren(stage, createControls());
    transitionInFlight = false;
    imageStateFor(articles[(currentIndex + 1) % articles.length]);
    scheduleRotation();
  }

  function showArticle(nextIndex) {
    if (!articles.length) return;
    currentIndex = (nextIndex + articles.length) % articles.length;
    const article = articles[currentIndex];
    if (!desktopQuery.matches) {
      desktopCards.forEach(card => card.cleanupImageState());
      desktopCard = null;
      showMobileArticle(article, text(article.publisher) || "Publisher", text(article.display_title) || text(article.title));
      return;
    }
    renderDesktopInitial();
  }

  function updatePresentation() {
    navigationToken += 1;
    transitionInFlight = false;
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

  function hideMedia() {
    stopRotation();
    stopFreshnessChecks();
    desktopCards.forEach(card => card.cleanupImageState());
    desktopCard = null;
    content.replaceChildren();
    mobileContent.replaceChildren();
    carousel.hidden = true;
    mobileTeaser.hidden = true;
  }

  function validGeneration(value) {
    return Number.isSafeInteger(value) && value > 0;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    if (!response.ok) {
      const error = new Error("media_unavailable");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function refreshArticles(initial) {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const version = await fetchJson(versionEndpoint);
          const generation = Number(version?.generation);
          if (!validGeneration(generation)) throw new Error("invalid_media_generation");
          lastSuccessfulVersionCheckAt = Date.now();
          nextFreshnessCheckNotBefore = 0;

          if (generation === activeGeneration && articles.length) return;
          let payload;
          try {
            payload = await fetchJson(feedEndpoint(generation));
          } catch (error) {
            if (error?.status === 409 && attempt === 0) continue;
            throw error;
          }
          if (!Array.isArray(payload?.articles)) throw new Error("invalid_media_response");
          const nextArticles = payload.articles.filter(usableArticle);
          if (!nextArticles.length) throw new Error("no_usable_articles");
          const selectedId = articles[currentIndex]?.id;
          articles = nextArticles;
          activeGeneration = generation;
          const selectedIndex = articles.findIndex(article => article.id === selectedId);
          currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
          updatePresentation();
          scheduleFreshnessCheck();
          return;
        }
        throw new Error("stale_media_generation");
      } catch (_error) {
        if (initial) {
          articles = [];
          activeGeneration = null;
          hideMedia();
        } else {
          nextFreshnessCheckNotBefore = Date.now() + freshnessMs;
        }
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  desktopQuery.addEventListener("change", updatePresentation);
  reducedMotionQuery.addEventListener("change", scheduleRotation);
  document.addEventListener("visibilitychange", async () => {
    scheduleRotation();
    if (document.hidden) {
      stopFreshnessChecks();
      return;
    }
    if (Date.now() >= nextFreshnessCheckAt()) {
      await refreshArticles(false);
    }
    scheduleFreshnessCheck();
  });
  refreshArticles(true);
})();
