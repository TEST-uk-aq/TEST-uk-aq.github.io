# Homepage Media carousel

`homepage-media-carousel.js` reads the same-origin version discovery path, then its
generation-pinned fixed-six feed through the cache proxy. It has no direct Media origin,
database, or credential access. Initial version/feed failure hides both responsive views;
a later failed refresh keeps the last successful cards visible.

Desktop and mobile render the same article state. The selected article is retained by
stable ID when a new generation arrives. Rotation is eight seconds, while a visible page
checks the no-store version endpoint at most every 15 minutes and never keeps a timer while
hidden. The authoritative browser and cache/proxy behaviour is in the sibling system-docs
homepage Media and cache-proxy contracts.
