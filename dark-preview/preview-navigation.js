/* Keep links created by the unchanged sidebar/dashboard within this experiment.
 * No click interception: query strings, fragments, modifier keys and targets keep
 * their native behaviour. Other destinations retain their original URLs.
 */
(() => {
  'use strict';
  if (!document.documentElement.classList.contains('dark-preview')) return;

  // The original News subscription helper recognises only /news/. Keep its
  // legacy fragment handoff working here without copying subscription logic.
  if (document.body.classList.contains('news-page')
      && /^#(confirm|manage|unsubscribe)(?:=(.*))?$/.test(location.hash)) {
    location.replace('/news-by-email/' + location.hash);
    return;
  }

  const routes = new Map([
    ['/', '/dark-preview/'],
    ['/index.html', '/dark-preview/'],
    ['/hex_map', '/dark-preview/hex-map/'],
    ['/hex_map/', '/dark-preview/hex-map/'],
    ['/hex_map/index.html', '/dark-preview/hex-map/'],
    ['/news', '/dark-preview/news/'],
    ['/news/', '/dark-preview/news/'],
    ['/news/index.html', '/dark-preview/news/'],
  ]);
  const currentPath = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');

  function updateLink(link) {
    const href = link.getAttribute('href');
    // In-page anchors and empty placeholders must keep their current meaning.
    if (!href || href.startsWith('#')) return;
    let url;
    try {
      url = new URL(href, document.baseURI);
    } catch (_) {
      return;
    }
    if (url.origin !== location.origin) return;
    const target = routes.get(url.pathname);
    if (target) {
      url.pathname = target;
      link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
    }
    if (link.classList.contains('uk-aq-nav-item')) {
      const active = url.pathname.replace(/index\.html$/, '').replace(/\/$/, '') === currentPath;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function updateTree(node) {
    if (!(node instanceof Element || node instanceof Document)) return;
    if (node.matches?.('a[href]')) updateLink(node);
    node.querySelectorAll('a[href]').forEach(updateLink);
  }

  updateTree(document);
  const observer = new MutationObserver((changes) => {
    changes.forEach((change) => {
      if (change.type === 'attributes') updateLink(change.target);
      else change.addedNodes.forEach(updateTree);
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
})();
