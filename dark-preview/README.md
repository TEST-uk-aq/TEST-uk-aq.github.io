# Dark slate preview

Three isolated presentation experiments, based on the existing Homepage,
Hex Map and current News markup at main `3419cfb40de6d075499ebfb830ea3ff5f829372a`.
The homepage and Hex markup are unchanged from workspace revision `b89969a`;
the News markup includes main's separate News by Email link.

Preview routes after a separately authorised TEST deployment:

- `/dark-preview/`
- `/dark-preview/hex-map/`
- `/dark-preview/news/`

## Files and ownership

All additions live here. No existing file, asset, workflow or configuration is
changed. Removing `dark-preview/` removes the entire experiment.

- `index.html`: homepage copy; retains its original inline WHO presentation logic.
- `hex-map/index.html`: Hex Map shell; uses the original application bootstrap.
- `news/index.html`: News shell; uses the original News implementation.
- `css/dark-theme.css`: scoped surface/text/control/tooltip/chart-chrome colours.
- `preview-navigation.js`: remaps same-origin Home, Hex Map and News links,
  including links created asynchronously by the original scripts; corrects sidebar
  active state and retains the News email fragment handoff to `/news-by-email/`.
- `README.md`: review and acceptance notes.

`preview-navigation.js` does not intercept clicks or replace sidebar state.
It preserves query strings, fragments, targets and normal browser link behaviour.
Other destinations, including Sensor Map, station charts and News by Email, use
normal site pages. Original sidebar hover, pin, navigation handoff and mobile
breakpoints remain source-owned.

## Shared implementation reused

The original `/sidebar.js`, `/site-footer.css`, `/bottom-nav.css`, `/site-ui.css`,
`/mobile.css` and beta-notice assets still own the shared shell and interactions.
The homepage reuses `/styles.css`, `/dashboard.js`, its three homepage carousel /
table-layout scripts, and the shared domain, catalogue and auth modules.
The Hex Map reuses `/hex_map/hex-map.css`, `/hex_map/hex-map-bootstrap.js` and its
existing module graph, `/chart-core.js`, D3 and the sole shared station-chart
subsystem. News reuses `/news/news.css`, `/news/news.js`, `/news/subscription.css`
and `/news/subscription.js`. All images and publisher thumbnails retain their
original sources and pixels. No image brightness/inversion treatment is added.

Original data clients continue to use the same-origin `/api/aq` and `/api/media`
routes and the shared deployment-injected authentication configuration. Unused
page-local project/key constants are omitted: these new HTML files are not part
of the injector's explicit target list. The optional homepage debug-log flag
uses the original script's default (off); shared Hex diagnostics are unchanged. No environment values, backend
routes, browser theme setting, URL theme parameter or alternate-environment
fallback is added. Existing supported query parameters remain unchanged.

Air-quality heat stops, no-data swatches, reading dots, pollutant-circle colours,
WHO percentage scale, DAQI/EAQI segment fills, observations and calculations are
unchanged. Only the map canvas, neutral outlines, surrounding controls and chart
chrome receive dark styling. The original scientific chart renderer is reused.

The existing Pages staging, initial-loader discovery and content-hash discovery
pick up these new pages/assets without configuration changes. No hand-maintained
asset version query strings are introduced.

## Validation and remaining acceptance

Focused local checks covered HTML IDs and original script parity, unchanged
inline script syntax, local resource resolution, preview navigation paths,
JavaScript syntax, CSS parsing/selector support and primary token contrast.
The current-main Media email config, initial-loader and content-hash helpers
also succeeded on an isolated staging copy: 18 HTML documents and 95 first-party
assets, including the preview pages and their two new assets.
No generated staging output or speculative test suite is committed.

Functional and visual acceptance remains for real TEST operation after a
separately authorised deployment. Check Home refresh/WHO tabs/carousels, sidebar
hover/pin/drawer and cross-preview links; Hex search, filters, networks, UK/C&R,
zoom/selection, refresh, tooltips, legends and station charts; News search,
Grid/List, sort, pagination, image failure states and publisher links. Check
representative mobile, tablet and desktop widths, keyboard focus and reduced
motion. Data/API behaviour is shared, not independently reimplemented or mocked.

Known limits: the HTML is a snapshot and will not automatically acquire later
markup changes; shared scripts/styles continue to follow the normal website.
These pages require hosted same-origin APIs/authentication. A plain filesystem
preview is not an API environment. No deployment or real TEST browser acceptance
was performed in this task.

## Artwork recommendations

The original blue UK AQ wordmarks remain unchanged. Their darker blue strokes
may benefit from separately supplied lighter companions on slate:
`/images/UK-AQ-Logo-v3-1line.svg`,
`/sidebar-images/UK-AQ-Logo-v3-2Lines.svg`,
`/images/UK-AQ-hex-map.svg`, `/images/UK-AQ-NEWS-1line.svg`, the homepage
`/images/UK-AQ-latest-news-air-quality.png` and
`/images/UK-AQ-latest-news-air-quality-1-line.png`, and blue sidebar/action icons.

Partner logos containing dark lettering, especially
`/sidebar-images/openaq_logo.svg`,
`/sidebar-images/breathelondon_logo_v2.svg` and
`/sidebar-images/scomm_logo_text.svg`, would benefit from approved versions for
dark backgrounds. Small light mats preserve the original partner artwork where
needed meanwhile. Publisher article thumbnails need no theme-specific variants.
No artwork was generated, edited or replaced.

No system/data contract change is proposed. This is an isolated presentation
experiment; documentation handover is unnecessary unless a permanent theme or
site-wide theme mechanism is later requested.
