(() => {
  "use strict";

  const endpoint = "/api/media/articles";
  const viewPreferenceKey = "uk_aq_news_view_v1";
  const sessionStateKey = "uk_aq_news_session_v1";
  const refreshIntervalMs = 15 * 60 * 1000;
  const focusRefreshStaleMs = 2 * 60 * 1000;
  const mobileQuery = window.matchMedia("(max-width: 767px)");
  const statusElement = document.getElementById("news-status");
  const errorElement = document.getElementById("news-error");
  const emptyElement = document.getElementById("news-empty");
  const noResultsElement = document.getElementById("news-no-results");
  const toolbarElement = document.getElementById("news-toolbar");
  const feedElement = document.querySelector(".news-feed");
  const gridElement = document.getElementById("news-grid");
  const tableScrollElement = document.getElementById("news-table-scroll");
  const tableScrollControl = document.getElementById("news-table-scroll-control");
  const tableScrollLane = document.getElementById("news-table-scroll-lane");
  const tableScrollbar = document.getElementById("news-table-scrollbar");
  const tableScrollThumb = document.getElementById("news-table-scroll-thumb");
  const tableScrollLeftButton = document.getElementById("news-table-scroll-left");
  const tableScrollRightButton = document.getElementById("news-table-scroll-right");
  const tableBodyElement = document.getElementById("news-table-body");
  const resultsFooterElement = document.getElementById("news-results-footer");
  const resultsSummaryElement = document.getElementById("news-results-summary");
  const retryButton = document.getElementById("news-retry");
  const searchInput = document.getElementById("news-search-input");
  const searchClearButton = document.getElementById("news-search-clear");
  const searchFieldsDetails = document.getElementById("news-search-fields");
  const searchFieldsSummary = document.getElementById("news-search-fields-summary");
  const searchFieldInputs = Array.from(searchFieldsDetails.querySelectorAll('input[type="checkbox"]'));
  const suggestionsElement = document.getElementById("news-search-suggestions");
  const gridSortLabel = document.getElementById("news-grid-sort-label");
  const gridSortSelect = document.getElementById("news-grid-sort");
  const gridViewButton = document.getElementById("news-view-grid");
  const listViewButton = document.getElementById("news-view-list");
  const sortHeadingButtons = Array.from(document.querySelectorAll(".news-sort-heading"));
  const toolbarPageWrap = document.getElementById("news-toolbar-page-wrap");
  const toolbarPageCurrent = document.getElementById("news-toolbar-page-current");
  const toolbarPreviousPageButton = document.getElementById("news-toolbar-page-previous");
  const toolbarNextPageButton = document.getElementById("news-toolbar-page-next");
  const paginationElement = document.getElementById("news-pagination");
  const pageNumbersElement = document.getElementById("news-page-numbers");
  const previousPageButton = document.getElementById("news-page-previous");
  const nextPageButton = document.getElementById("news-page-next");

  const restoredSessionState = readSessionState();
  const state = {
    articles: [],
    view: readViewPreference(),
    search: restoredSessionState.search,
    searchFields: new Set(restoredSessionState.searchFields),
    sortKey: restoredSessionState.sortKey,
    sortDirection: restoredSessionState.sortDirection,
    page: restoredSessionState.page,
    selectedArticleId: restoredSessionState.selectedArticleId,
    pageSize: 10,
    suggestions: [],
    activeSuggestion: -1,
  };

  let resizeFrame = null;
  let tableScrollDrag = null;
  let articlesLoading = false;
  let lastSuccessfulRefreshAt = 0;
  let refreshTimer = null;
  const scrollEdgeTolerance = 3;
  const minimumScrollThumbWidth = 44;
  const imageFallbackDelayMs = 2000;

  function updateTableScrollState() {
    const isVisibleList = state.view === "list" && !tableScrollElement.hidden;
    const maxScrollLeft = Math.max(0, tableScrollElement.scrollWidth - tableScrollElement.clientWidth);
    const isScrollable = isVisibleList && maxScrollLeft > 0;
    const canScrollLeft = isScrollable && tableScrollElement.scrollLeft > scrollEdgeTolerance;
    const canScrollRight = isScrollable
      && tableScrollElement.scrollLeft < maxScrollLeft - scrollEdgeTolerance;
    tableScrollControl.hidden = !isScrollable;
    if (!isScrollable) return;
    const scrollLeft = Math.min(maxScrollLeft, Math.max(0, tableScrollElement.scrollLeft));
    tableScrollLane.style.setProperty("--news-table-viewport-width", `${tableScrollElement.clientWidth - 20}px`);
    const trackWidth = tableScrollbar.clientWidth;
    const thumbWidth = Math.min(trackWidth, Math.max(
      minimumScrollThumbWidth,
      trackWidth * tableScrollElement.clientWidth / tableScrollElement.scrollWidth,
    ));
    const thumbTravel = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft = maxScrollLeft ? thumbTravel * scrollLeft / maxScrollLeft : 0;
    tableScrollThumb.style.width = `${thumbWidth}px`;
    tableScrollThumb.style.transform = `translateX(${thumbLeft}px)`;
    tableScrollbar.setAttribute("aria-valuemax", String(Math.round(maxScrollLeft)));
    tableScrollbar.setAttribute("aria-valuenow", String(Math.round(scrollLeft)));
    tableScrollLeftButton.disabled = !canScrollLeft;
    tableScrollRightButton.disabled = !canScrollRight;
  }

  function setTableScrollFromTrackPosition(clientX, dragOffset = 0) {
    const trackRect = tableScrollbar.getBoundingClientRect();
    const thumbWidth = tableScrollThumb.getBoundingClientRect().width;
    const thumbTravel = Math.max(0, trackRect.width - thumbWidth);
    const thumbLeft = Math.min(thumbTravel, Math.max(0, clientX - trackRect.left - dragOffset));
    const maxScrollLeft = Math.max(0, tableScrollElement.scrollWidth - tableScrollElement.clientWidth);
    tableScrollElement.scrollLeft = thumbTravel ? maxScrollLeft * thumbLeft / thumbTravel : 0;
  }

  function scrollTableByPage(direction) {
    const distance = tableScrollElement.clientWidth * 0.75 * direction;
    const behaviour = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    tableScrollElement.scrollBy({ left: distance, behavior: behaviour });
  }

  function readViewPreference() {
    try {
      return localStorage.getItem(viewPreferenceKey) === "list" ? "list" : "grid";
    } catch (_error) {
      return "grid";
    }
  }

  function storeViewPreference() {
    try {
      localStorage.setItem(viewPreferenceKey, state.view);
    } catch (_error) {
      // The preference is optional when browser storage is unavailable.
    }
  }

  function readSessionState() {
    const defaults = {
      search: "",
      searchFields: ["title", "publication", "author"],
      sortKey: "published",
      sortDirection: "desc",
      page: 1,
      selectedArticleId: null,
    };
    try {
      const stored = JSON.parse(sessionStorage.getItem(sessionStateKey) || "null");
      if (!stored || typeof stored !== "object") return defaults;
      const allowedFields = new Set(["title", "publication", "author"]);
      const allowedSortKeys = new Set(["published", "title", "publication", "author"]);
      const searchFields = Array.isArray(stored.searchFields)
        ? stored.searchFields.filter(field => allowedFields.has(field))
        : defaults.searchFields;
      return {
        search: typeof stored.search === "string" ? stored.search : defaults.search,
        searchFields,
        sortKey: allowedSortKeys.has(stored.sortKey) ? stored.sortKey : defaults.sortKey,
        sortDirection: stored.sortDirection === "asc" ? "asc" : defaults.sortDirection,
        page: Number.isSafeInteger(stored.page) && stored.page > 0 ? stored.page : defaults.page,
        selectedArticleId: Number.isSafeInteger(stored.selectedArticleId) && stored.selectedArticleId > 0
          ? stored.selectedArticleId
          : null,
      };
    } catch (_error) {
      return defaults;
    }
  }

  function storeSessionState() {
    try {
      sessionStorage.setItem(sessionStateKey, JSON.stringify({
        search: state.search,
        searchFields: Array.from(state.searchFields),
        sortKey: state.sortKey,
        sortDirection: state.sortDirection,
        page: state.page,
        selectedArticleId: state.selectedArticleId,
      }));
    } catch (_error) {
      // Session state is optional when browser storage is unavailable.
    }
  }

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

  function normaliseArticle(article, index) {
    const originalTitle = text(article?.title) || "Untitled article";
    const publishedRaw = text(article?.published_at);
    const timestamp = Date.parse(publishedRaw);
    const numericId = Number(article?.id);
    return {
      id: Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null,
      stableIndex: index,
      canonicalUrl: safeHttpUrl(article?.canonical_url),
      originalTitle,
      displayTitle: text(article?.display_title) || originalTitle,
      publisher: text(article?.publisher) || "Publisher",
      author: text(article?.author),
      publishedRaw,
      publishedDate: articleDate(publishedRaw),
      publishedTimestamp: Number.isFinite(timestamp) ? timestamp : null,
      imageUrl: safeHttpUrl(article?.preview_image_url, true),
    };
  }

  function externalLink(article, className, visibleText = "") {
    if (!article.canonicalUrl) {
      const fallback = document.createElement("span");
      fallback.className = className;
      fallback.textContent = visibleText;
      return fallback;
    }
    const link = document.createElement("a");
    link.className = className;
    link.href = article.canonicalUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = visibleText;
    link.setAttribute(
      "aria-label",
      `Read “${article.originalTitle}” on ${article.publisher}, opens in a new tab`,
    );
    return link;
  }

  function appendImage(container, article, className) {
    if (!article.imageUrl) return;
    container.classList.add("is-image-loading");
    const image = document.createElement("img");
    image.className = className;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    const fallbackTimer = window.setTimeout(() => {
      container.classList.remove("is-image-loading");
    }, imageFallbackDelayMs);
    const reveal = async () => {
      if (typeof image.decode === "function") {
        try {
          await image.decode();
        } catch (_error) {
          if (!image.complete || !image.naturalWidth) return;
        }
      }
      window.clearTimeout(fallbackTimer);
      container.classList.remove("is-image-loading");
      image.classList.add("is-ready");
    };
    image.addEventListener("load", reveal, { once: true });
    image.addEventListener("error", () => {
      window.clearTimeout(fallbackTimer);
      container.classList.remove("is-image-loading");
      image.remove();
    }, { once: true });
    container.append(image);
    image.src = article.imageUrl;
  }

  function destinationCue(article) {
    const cue = document.createElement("span");
    cue.className = "news-destination-cue";
    cue.setAttribute("aria-hidden", "true");
    const cueText = document.createElement("span");
    cueText.textContent = `Read on ${article.publisher}`;
    const icon = document.createElement("img");
    icon.src = "/images/Link-Icon-wider-white.png";
    icon.alt = "";
    cue.append(cueText, icon);
    return cue;
  }

  function persistentLinkIcon() {
    const icon = document.createElement("img");
    icon.className = "news-persistent-link-icon";
    icon.src = "/images/Link-Icon-wider-white.png";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function appendDestinationIndicators(container, article) {
    if (!article.canonicalUrl) return;
    container.append(destinationCue(article), persistentLinkIcon());
  }

  function appendPublicationDate(container, article) {
    const publisher = document.createElement("span");
    publisher.textContent = article.publisher;
    container.append(publisher);
    if (!article.publishedDate) return;
    const separator = document.createElement("span");
    separator.textContent = "·";
    separator.setAttribute("aria-hidden", "true");
    const date = document.createElement("time");
    date.dateTime = article.publishedDate.machine;
    date.textContent = article.publishedDate.display;
    container.append(separator, date);
  }

  function buildGridCard(article) {
    const item = document.createElement("article");
    item.className = "news-grid-item";
    const card = externalLink(article, "news-grid-card");
    appendImage(card, article, "news-grid-image");

    const gradient = document.createElement("span");
    gradient.className = "news-grid-gradient";
    gradient.setAttribute("aria-hidden", "true");
    card.append(gradient);
    appendDestinationIndicators(card, article);

    const overlay = document.createElement("span");
    overlay.className = "news-grid-overlay";
    const source = document.createElement("span");
    source.className = "news-grid-source";
    appendPublicationDate(source, article);
    const heading = document.createElement("span");
    heading.className = "news-grid-title";
    heading.textContent = article.displayTitle;
    overlay.append(source, heading);
    card.append(overlay);

    const authorSpace = document.createElement("div");
    authorSpace.className = "news-grid-author-space";
    if (article.author) {
      const author = document.createElement("div");
      author.className = "news-grid-author";
      author.textContent = article.author;
      authorSpace.append(author);
    }
    item.append(card, authorSpace);
    return item;
  }

  function buildThumbnail(article) {
    const thumbnail = externalLink(article, "news-thumbnail");
    appendImage(thumbnail, article, "news-thumbnail-image");
    appendDestinationIndicators(thumbnail, article);
    return thumbnail;
  }

  function buildTableRow(article) {
    const row = document.createElement("tr");
    const imageCell = document.createElement("td");
    imageCell.append(buildThumbnail(article));

    const titleCell = document.createElement("td");
    titleCell.append(externalLink(article, "news-table-title-link", article.displayTitle));

    const publicationCell = document.createElement("td");
    publicationCell.textContent = article.publisher;

    const authorCell = document.createElement("td");
    authorCell.className = "news-table-author";
    if (article.author) {
      const author = document.createElement("span");
      author.className = "news-table-author-text";
      for (const part of article.author.match(/\S+|\s+/g) || []) {
        if (/^\s+$/.test(part)) {
          author.append(part);
        } else {
          const namePart = document.createElement("span");
          namePart.className = "news-table-author-part";
          namePart.textContent = part;
          author.append(namePart);
        }
      }
      author.title = article.author;
      authorCell.append(author);
    } else {
      const missing = document.createElement("span");
      missing.className = "news-table-missing-author";
      missing.textContent = "—";
      authorCell.append(missing);
    }

    const publishedCell = document.createElement("td");
    if (article.publishedDate) {
      const date = document.createElement("time");
      date.dateTime = article.publishedDate.machine;
      date.textContent = article.publishedDate.display;
      publishedCell.append(date);
    }
    row.append(imageCell, titleCell, publicationCell, authorCell, publishedCell);
    return row;
  }

  function normalisedSearch(value) {
    return text(value).toLocaleLowerCase("en-GB");
  }

  function articleMatches(article, query = normalisedSearch(state.search)) {
    if (state.selectedArticleId !== null) return article.id === state.selectedArticleId;
    if (!query) return true;
    if (
      state.searchFields.has("title") &&
      [article.displayTitle, article.originalTitle].some(value => normalisedSearch(value).includes(query))
    ) return true;
    if (
      state.searchFields.has("publication") &&
      normalisedSearch(article.publisher).includes(query)
    ) return true;
    return state.searchFields.has("author") && normalisedSearch(article.author).includes(query);
  }

  function stringSortValue(article, key) {
    if (key === "title") return article.displayTitle;
    if (key === "publication") return article.publisher;
    return article.author;
  }

  function stableArticleOrder(left, right) {
    if (left.id !== null && right.id !== null && left.id !== right.id) return right.id - left.id;
    return left.stableIndex - right.stableIndex;
  }

  function compareArticles(left, right) {
    if (state.sortKey === "published") {
      const leftValue = left.publishedTimestamp;
      const rightValue = right.publishedTimestamp;
      if (leftValue === null && rightValue !== null) return 1;
      if (leftValue !== null && rightValue === null) return -1;
      if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
        return state.sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }
      return stableArticleOrder(left, right);
    }

    const leftValue = text(stringSortValue(left, state.sortKey));
    const rightValue = text(stringSortValue(right, state.sortKey));
    if (!leftValue && rightValue) return 1;
    if (leftValue && !rightValue) return -1;
    const comparison = leftValue.localeCompare(rightValue, "en-GB", { sensitivity: "base" });
    if (comparison) return state.sortDirection === "asc" ? comparison : -comparison;
    return stableArticleOrder(left, right);
  }

  function filteredAndSortedArticles() {
    return state.articles.filter(article => articleMatches(article)).sort(compareArticles);
  }

  function gridColumnCount() {
    const styles = window.getComputedStyle(gridElement);
    const gridWidth = gridElement.clientWidth || feedElement.clientWidth;
    const minimum = Number.parseFloat(styles.getPropertyValue("--news-grid-min-column")) || 260;
    const gap = Number.parseFloat(styles.columnGap) || 20;
    return Math.max(1, Math.min(20, Math.floor((gridWidth + gap) / (minimum + gap))));
  }

  function pageSizeForCurrentView() {
    if (mobileQuery.matches) return 10;
    if (state.view === "list") return 20;
    const columns = gridColumnCount();
    return Math.max(columns, Math.floor(20 / columns) * columns);
  }

  function currentLogicalStart() {
    return Math.max(0, (state.page - 1) * state.pageSize);
  }

  function syncViewControls() {
    const isGrid = state.view === "grid";
    gridViewButton.setAttribute("aria-pressed", String(isGrid));
    listViewButton.setAttribute("aria-pressed", String(!isGrid));
    gridSortLabel.hidden = !isGrid;
  }

  function syncSortControls() {
    gridSortSelect.value = `${state.sortKey}:${state.sortDirection}`;
    sortHeadingButtons.forEach((button) => {
      const key = button.dataset.sortKey;
      const active = key === state.sortKey;
      const heading = button.closest("th");
      const arrow = button.querySelector(".news-sort-arrow");
      button.classList.toggle("is-active", active);
      heading.setAttribute(
        "aria-sort",
        active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none",
      );
      arrow.textContent = active ? (state.sortDirection === "asc" ? "▲" : "▼") : "";
      const label = button.firstElementChild.textContent;
      button.setAttribute(
        "aria-label",
        active
          ? `${label}, sorted ${state.sortDirection === "asc" ? "ascending" : "descending"}. Click to reverse.`
          : `${label}, click to sort.`,
      );
    });
  }

  function paginationItems(currentPage, totalPages) {
    if (mobileQuery.matches && totalPages > 3) {
      return [currentPage - 1, currentPage, currentPage + 1]
        .filter(page => page >= 1 && page <= totalPages);
    }
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_value, index) => index + 1);
    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const validPages = Array.from(pages).filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b);
    const items = [];
    validPages.forEach((page, index) => {
      if (index > 0 && page - validPages[index - 1] > 1) items.push("ellipsis");
      items.push(page);
    });
    return items;
  }

  function renderPagination(totalResults) {
    const totalPages = Math.max(1, Math.ceil(totalResults / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const hasResults = totalResults > 0;
    const isFirstPage = state.page === 1;
    const isLastPage = state.page === totalPages;
    const pageLabel = `Page ${state.page} of ${totalPages}`;

    toolbarPageWrap.hidden = !hasResults;
    if (hasResults) {
      toolbarPageCurrent.textContent = `${state.page} / ${totalPages}`;
      toolbarPageWrap.dataset.pageLabel = pageLabel;
      toolbarPageCurrent.title = pageLabel;
      toolbarPageCurrent.setAttribute("aria-label", pageLabel);
      toolbarPreviousPageButton.disabled = isFirstPage;
      toolbarNextPageButton.disabled = isLastPage;
    }

    paginationElement.hidden = totalPages <= 1;
    previousPageButton.disabled = isFirstPage;
    nextPageButton.disabled = isLastPage;
    const items = paginationItems(state.page, totalPages).map((item) => {
      if (item === "ellipsis") {
        const ellipsis = document.createElement("span");
        ellipsis.className = "news-page-ellipsis";
        ellipsis.textContent = "…";
        ellipsis.setAttribute("aria-hidden", "true");
        return ellipsis;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(item);
      button.setAttribute("aria-label", `Page ${item}`);
      if (item === state.page) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => changePage(item));
      return button;
    });
    pageNumbersElement.replaceChildren(...items);
  }

  function renderResultsSummary(start, displayedCount, matchingCount) {
    const totalCount = state.articles.length;
    const range = displayedCount > 1
      ? `${start + 1}–${start + displayedCount}`
      : displayedCount === 1 ? String(start + 1) : "0";
    if (matchingCount === totalCount) {
      resultsSummaryElement.textContent = `Showing ${range} of ${totalCount} ${totalCount === 1 ? "article" : "articles"}`;
    } else {
      resultsSummaryElement.textContent = `Showing ${range} of ${matchingCount} matching ${matchingCount === 1 ? "article" : "articles"} · ${totalCount} total`;
    }
    resultsFooterElement.hidden = false;
  }

  function hideResultSurfaces() {
    gridElement.hidden = true;
    tableScrollElement.hidden = true;
    tableScrollControl.hidden = true;
    noResultsElement.hidden = true;
    paginationElement.hidden = true;
    resultsFooterElement.hidden = true;
  }

  function renderResults(options = {}) {
    const logicalStart = Number.isFinite(options.logicalStart)
      ? Math.max(0, options.logicalStart)
      : currentLogicalStart();
    state.pageSize = pageSizeForCurrentView();
    if (options.preserveLogicalStart) state.page = Math.floor(logicalStart / state.pageSize) + 1;

    syncViewControls();
    syncSortControls();
    hideResultSurfaces();

    const filtered = filteredAndSortedArticles();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    if (!filtered.length) {
      gridElement.replaceChildren();
      tableBodyElement.replaceChildren();
      noResultsElement.hidden = false;
      renderPagination(0);
      renderResultsSummary(0, 0, 0);
      storeSessionState();
      return;
    }

    const start = (state.page - 1) * state.pageSize;
    const pageArticles = filtered.slice(start, start + state.pageSize);
    if (state.view === "grid") {
      tableBodyElement.replaceChildren();
      gridElement.replaceChildren(...pageArticles.map(buildGridCard));
      gridElement.hidden = false;
    } else {
      gridElement.replaceChildren();
      tableBodyElement.replaceChildren(...pageArticles.map(buildTableRow));
      tableScrollElement.hidden = false;
    }
    updateTableScrollState();
    renderResultsSummary(start, pageArticles.length, filtered.length);
    renderPagination(filtered.length);
    storeSessionState();
  }

  function changePage(page, { scrollToToolbar = true } = {}) {
    state.page = page;
    renderResults();
    if (scrollToToolbar) toolbarElement.scrollIntoView({ block: "start" });
  }

  function setView(view) {
    if (view === state.view) return;
    const logicalStart = currentLogicalStart();
    state.view = view;
    storeViewPreference();
    renderResults({ logicalStart, preserveLogicalStart: true });
  }

  function setSort(key, direction) {
    state.sortKey = key;
    state.sortDirection = direction;
    state.page = 1;
    closeSuggestions();
    renderResults();
  }

  function updateSearchFieldSummary() {
    const selected = searchFieldInputs.filter(input => input.checked).map(input => input.parentElement.textContent.trim());
    searchFieldsSummary.textContent = selected.length === 3 ? "All" : selected.length ? selected.join(", ") : "None";
    searchFieldsDetails.querySelector("summary").setAttribute(
      "aria-label",
      `Choose fields to search. ${selected.length === 3 ? "All fields selected" : selected.length ? `${selected.join(", ")} selected` : "No fields selected"}.`,
    );
  }

  function closeSuggestions() {
    state.suggestions = [];
    state.activeSuggestion = -1;
    suggestionsElement.hidden = true;
    suggestionsElement.replaceChildren();
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }

  function syncActiveSuggestion() {
    const buttons = Array.from(suggestionsElement.querySelectorAll(".news-search-suggestion"));
    buttons.forEach((button, index) => button.setAttribute("aria-selected", String(index === state.activeSuggestion)));
    if (state.activeSuggestion >= 0 && buttons[state.activeSuggestion]) {
      searchInput.setAttribute("aria-activedescendant", buttons[state.activeSuggestion].id);
      buttons[state.activeSuggestion].scrollIntoView({ block: "nearest" });
    } else {
      searchInput.removeAttribute("aria-activedescendant");
    }
  }

  function selectSuggestion(index) {
    const article = state.suggestions[index];
    if (!article) return;
    state.search = article.displayTitle;
    state.selectedArticleId = article.id;
    searchInput.value = state.search;
    searchClearButton.hidden = false;
    state.page = 1;
    closeSuggestions();
    renderResults();
    searchInput.blur();
  }

  function renderSuggestions() {
    const query = normalisedSearch(state.search);
    if (!query || document.activeElement !== searchInput) {
      closeSuggestions();
      return;
    }
    state.suggestions = filteredAndSortedArticles().slice(0, 5);
    state.activeSuggestion = -1;
    if (!state.suggestions.length) {
      closeSuggestions();
      return;
    }
    const rows = state.suggestions.map((article, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id = `news-search-suggestion-${index}`;
      button.className = "news-search-suggestion";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      const title = document.createElement("span");
      title.className = "news-search-suggestion-title";
      title.textContent = article.displayTitle;
      const metadata = document.createElement("span");
      metadata.className = "news-search-suggestion-meta";
      metadata.textContent = [article.publisher, article.author].filter(Boolean).join(" · ");
      button.append(title, metadata);
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", () => selectSuggestion(index));
      return button;
    });
    suggestionsElement.replaceChildren(...rows);
    suggestionsElement.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function updateSearch() {
    state.search = searchInput.value;
    state.selectedArticleId = null;
    state.page = 1;
    searchClearButton.hidden = !state.search;
    renderResults();
    renderSuggestions();
  }

  function showOnly(element) {
    [statusElement, errorElement, emptyElement].forEach((candidate) => {
      candidate.hidden = candidate !== element;
    });
    if (element) hideResultSurfaces();
  }

  async function fetchAllArticles() {
    const articles = [];
    const seenCursors = new Set();
    let before = null;
    do {
      const url = `${endpoint}?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Media API returned ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.articles)) throw new Error("Invalid Media response");
      articles.push(...payload.articles);
      before = typeof payload.next_before === "string" && payload.next_before ? payload.next_before : null;
      if (before) {
        if (seenCursors.has(before)) throw new Error("Repeated Media cursor");
        seenCursors.add(before);
      }
    } while (before !== null);
    return articles;
  }

  function clearRefreshTimer() {
    if (refreshTimer === null) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  function scheduleRefresh(delayMs = refreshIntervalMs) {
    clearRefreshTimer();
    if (document.hidden) return;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      if (!document.hidden) void loadArticles({ background: true });
    }, Math.max(0, delayMs));
  }

  function refreshIfStale() {
    if (document.hidden || articlesLoading) return;
    const age = lastSuccessfulRefreshAt
      ? Date.now() - lastSuccessfulRefreshAt
      : Number.POSITIVE_INFINITY;
    if (age >= focusRefreshStaleMs) {
      void loadArticles({ background: true });
      return;
    }
    scheduleRefresh(Math.max(0, refreshIntervalMs - age));
  }

  async function loadArticles({ background = false } = {}) {
    if (articlesLoading) return;
    articlesLoading = true;
    if (!background) {
      toolbarElement.hidden = true;
      showOnly(statusElement);
      retryButton.disabled = true;
      closeSuggestions();
    }
    try {
      const rawArticles = await fetchAllArticles();
      const uniqueArticles = [];
      const seenIds = new Set();
      rawArticles.forEach((article) => {
        const id = Number(article?.id);
        if (Number.isSafeInteger(id) && seenIds.has(id)) return;
        if (Number.isSafeInteger(id)) seenIds.add(id);
        uniqueArticles.push(article);
      });
      state.articles = uniqueArticles.map(normaliseArticle);
      lastSuccessfulRefreshAt = Date.now();
      if (!state.articles.length) {
        toolbarElement.hidden = true;
        showOnly(emptyElement);
        return;
      }
      showOnly(null);
      toolbarElement.hidden = false;
      renderResults();
    } catch (_error) {
      if (!background) {
        state.articles = [];
        toolbarElement.hidden = true;
        showOnly(errorElement);
      }
    } finally {
      articlesLoading = false;
      if (!background) retryButton.disabled = false;
      scheduleRefresh(refreshIntervalMs);
    }
  }

  gridViewButton.addEventListener("click", () => setView("grid"));
  listViewButton.addEventListener("click", () => setView("list"));
  gridSortSelect.addEventListener("change", () => {
    const [key, direction] = gridSortSelect.value.split(":");
    setSort(key, direction);
  });
  sortHeadingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sortKey;
      const direction = state.sortKey === key
        ? (state.sortDirection === "asc" ? "desc" : "asc")
        : (key === "published" ? "desc" : "asc");
      setSort(key, direction);
    });
  });
  searchInput.addEventListener("input", updateSearch);
  searchInput.addEventListener("focus", renderSuggestions);
  searchInput.addEventListener("blur", () => window.setTimeout(closeSuggestions, 0));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }
    if (!state.suggestions.length || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    if (event.key === "Enter") {
      if (state.activeSuggestion >= 0) {
        event.preventDefault();
        selectSuggestion(state.activeSuggestion);
      }
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    state.activeSuggestion = (state.activeSuggestion + delta + state.suggestions.length) % state.suggestions.length;
    syncActiveSuggestion();
  });
  searchClearButton.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    updateSearch();
  });
  searchFieldInputs.forEach((input) => {
    input.addEventListener("change", () => {
      state.searchFields = new Set(searchFieldInputs.filter(field => field.checked).map(field => field.value));
      state.selectedArticleId = null;
      state.page = 1;
      updateSearchFieldSummary();
      renderResults();
      renderSuggestions();
    });
  });
  searchFieldsDetails.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchFieldsDetails.open = false;
      searchFieldsDetails.querySelector("summary").focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!searchFieldsDetails.contains(event.target)) searchFieldsDetails.open = false;
  });
  toolbarPreviousPageButton.addEventListener("click", () => {
    changePage(state.page - 1, { scrollToToolbar: false });
  });
  toolbarNextPageButton.addEventListener("click", () => {
    changePage(state.page + 1, { scrollToToolbar: false });
  });
  previousPageButton.addEventListener("click", () => changePage(state.page - 1));
  nextPageButton.addEventListener("click", () => changePage(state.page + 1));
  retryButton.addEventListener("click", loadArticles);
  tableScrollElement.addEventListener("scroll", updateTableScrollState, { passive: true });
  tableScrollLeftButton.addEventListener("click", () => scrollTableByPage(-1));
  tableScrollRightButton.addEventListener("click", () => scrollTableByPage(1));
  tableScrollbar.addEventListener("pointerdown", (event) => {
    if (event.target === tableScrollThumb) return;
    const thumbWidth = tableScrollThumb.getBoundingClientRect().width;
    setTableScrollFromTrackPosition(event.clientX, thumbWidth / 2);
  });
  tableScrollThumb.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const thumbRect = tableScrollThumb.getBoundingClientRect();
    tableScrollDrag = { pointerId: event.pointerId, offset: event.clientX - thumbRect.left };
    tableScrollThumb.setPointerCapture(event.pointerId);
  });
  tableScrollThumb.addEventListener("pointermove", (event) => {
    if (!tableScrollDrag || event.pointerId !== tableScrollDrag.pointerId) return;
    setTableScrollFromTrackPosition(event.clientX, tableScrollDrag.offset);
  });
  tableScrollThumb.addEventListener("pointerup", (event) => {
    if (!tableScrollDrag || event.pointerId !== tableScrollDrag.pointerId) return;
    tableScrollDrag = null;
    tableScrollThumb.releasePointerCapture(event.pointerId);
  });
  tableScrollThumb.addEventListener("pointercancel", () => {
    tableScrollDrag = null;
  });
  tableScrollbar.addEventListener("keydown", (event) => {
    const keyDirections = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 };
    if (keyDirections[event.key]) {
      event.preventDefault();
      scrollTableByPage(keyDirections[event.key]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      tableScrollElement.scrollTo({
        left: event.key === "Home" ? 0 : tableScrollElement.scrollWidth,
        behavior: "auto",
      });
    }
  });

  function handleResize() {
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      if (!state.articles.length) return;
      const logicalStart = currentLogicalStart();
      const nextPageSize = pageSizeForCurrentView();
      if (nextPageSize !== state.pageSize) {
        renderResults({ logicalStart, preserveLogicalStart: true });
      }
      updateTableScrollState();
    });
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(handleResize);
    observer.observe(feedElement);
  } else {
    window.addEventListener("resize", handleResize, { passive: true });
  }
  mobileQuery.addEventListener("change", handleResize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearRefreshTimer();
    } else {
      refreshIfStale();
    }
  });
  window.addEventListener("focus", refreshIfStale);
  window.addEventListener("pagehide", storeSessionState);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshIfStale();
  });

  searchInput.value = state.search;
  searchClearButton.hidden = !state.search;
  searchFieldInputs.forEach((input) => {
    input.checked = state.searchFields.has(input.value);
  });
  updateSearchFieldSummary();
  syncViewControls();
  syncSortControls();
  loadArticles();
})();
