(() => {
  const grid = document.querySelector("[data-blog-post-grid]");
  const pagination = document.querySelector("[data-blog-pagination]");
  if (!grid || !pagination) return;

  const posts = Array.from(grid.querySelectorAll("[data-blog-post]"));
  const previousButton = pagination.querySelector("[data-blog-previous]");
  const nextButton = pagination.querySelector("[data-blog-next]");
  const status = pagination.querySelector("[data-blog-page-status]");
  if (!posts.length || !previousButton || !nextButton || !status) return;

  let pageIndex = 0;
  let capacity = calculateCapacity();

  function calculateCapacity() {
    if (window.matchMedia("(max-width: 767px)").matches) return 2;
    const width = grid.getBoundingClientRect().width;
    if (width >= 1160) return 3;
    if (width >= 760) return 2;
    return 1;
  }

  function render() {
    const pageCount = Math.ceil(posts.length / capacity);
    pageIndex = Math.min(pageIndex, Math.max(0, pageCount - 1));
    const firstVisible = pageIndex * capacity;
    const lastVisible = firstVisible + capacity;

    posts.forEach((post, index) => {
      post.hidden = index < firstVisible || index >= lastVisible;
    });
    pagination.hidden = pageCount <= 1;
    previousButton.disabled = pageIndex === 0;
    nextButton.disabled = pageIndex >= pageCount - 1;
    status.textContent = `Page ${pageIndex + 1} of ${pageCount}`;
  }

  function movePage(offset) {
    pageIndex += offset;
    render();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    grid.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  }

  previousButton.addEventListener("click", () => movePage(-1));
  nextButton.addEventListener("click", () => movePage(1));

  function handleResize() {
    const firstVisible = pageIndex * capacity;
    const nextCapacity = calculateCapacity();
    if (nextCapacity === capacity) return;
    capacity = nextCapacity;
    pageIndex = Math.floor(firstVisible / capacity);
    render();
  }

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(grid);
  } else {
    window.addEventListener("resize", handleResize, { passive: true });
  }
  render();
})();
