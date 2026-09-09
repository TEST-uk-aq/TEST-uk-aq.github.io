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
    const card = document.createElement("article");
    card.className = "news-card";

    const articleUrl = safeHttpUrl(article?.canonical_url);
    const imageUrl = safeHttpUrl(article?.og_image_url, true);
    const title = text(article?.title) || "Untitled article";
    const publisher = text(article?.publisher) || "Publisher not supplied";

    if (articleUrl && imageUrl) {
      const imageLink = externalLink(articleUrl, "news-card-image-link", "");
      imageLink.setAttribute("aria-label", `Open “${title}” on ${publisher}`);
      const image = document.createElement("img");
      image.className = "news-card-image";
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => imageLink.remove(), { once: true });
      imageLink.append(image);
      card.append(imageLink);
    }

    const body = document.createElement("div");
    body.className = "news-card-body";

    const sourceRow = document.createElement("div");
    sourceRow.className = "news-card-source-row";
    const publisherElement = document.createElement("span");
    publisherElement.textContent = publisher;
    sourceRow.append(publisherElement);

    const published = articleDate(article?.published_at);
    if (published) {
      const dateElement = document.createElement("time");
      dateElement.dateTime = published.machine;
      dateElement.textContent = published.display;
      sourceRow.append(dateElement);
    }
    body.append(sourceRow);

    const heading = document.createElement("h3");
    heading.className = "news-card-title";
    if (articleUrl) {
      heading.append(externalLink(articleUrl, "", title));
    } else {
      heading.textContent = title;
    }
    body.append(heading);

    const author = text(article?.author);
    if (author) {
      const authorElement = document.createElement("p");
      authorElement.className = "news-card-text";
      authorElement.textContent = `By ${author}`;
      body.append(authorElement);
    }

    const summary = text(article?.summary);
    if (summary) {
      const summaryElement = document.createElement("p");
      summaryElement.className = "news-card-text";
      summaryElement.textContent = summary;
      body.append(summaryElement);
    }

    const whyItMatters = text(article?.why_it_matters);
    if (whyItMatters) {
      const context = document.createElement("p");
      context.className = "news-card-why";
      const label = document.createElement("strong");
      label.textContent = "Why it matters: ";
      context.append(label, whyItMatters);
      body.append(context);
    }

    const topics = Array.isArray(article?.topics)
      ? article.topics.map(text).filter(Boolean).slice(0, 20)
      : [];
    if (topics.length) {
      const topicList = document.createElement("ul");
      topicList.className = "news-topics";
      topicList.setAttribute("aria-label", "Topics");
      topics.forEach((topic) => {
        const item = document.createElement("li");
        item.className = "news-topic";
        item.textContent = topic;
        topicList.append(item);
      });
      body.append(topicList);
    }

    if (articleUrl) {
      body.append(
        externalLink(articleUrl, "news-original-link", `Read the original article at ${publisher}`),
      );
    }

    card.append(body);
    return card;
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
