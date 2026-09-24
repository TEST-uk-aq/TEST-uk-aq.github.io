# Wood Burning page contract

## Status

**Authoritative future implementation contract for the Wood Burning page.**

The existing `/wood-burning/` route shell may remain while the fuller page is designed and implemented on TEST.

This contract fixes the agreed page hierarchy, Black Carbon summary presentation, opening animation/video treatment, Black Carbon location map, paired Summer/Winter BC/UV diurnal charts, monthly-series colour/legend interaction, responsive ordering and scientific/presentation boundaries. Detailed editorial copy, later chart extensions and campaign-specific content may still be refined later within these boundaries.

## Scope

This contract governs the public presentation for:

```text
/wood-burning/
```

It defines:

- the standard UK AQ page-title treatment;
- the opening 16:9 explanatory animation/video;
- video hosting/delivery and fallback formats;
- video autoplay, mute, captions and reduced-motion behaviour;
- the initial page content hierarchy;
- the three Black Carbon summary cards;
- responsive relocation of those summary cards on mobile;
- the compact UK-outline Black Carbon sensor map;
- map marker colour, expansion and labelling behaviour;
- paired six-month Summer/Winter diurnal charts for each sensor, initially centred on Black Carbon and backed by the BC/UV derived product;
- support in the chart data boundary for `bc`, `uv370` and derived `uvpm`;
- shared Y-axis behaviour within each sensor's chart pair;
- shared horizontal Y-grid presentation;
- six solid-colour monthly series with an interactive legend and no series symbols in the initial implementation;
- six-sensor pagination and mobile chart stacking;
- the page's use of the canonical `black_carbon` network identity;
- the shared-footer Black Carbon attribution dependency;
- the current exclusion of Black Carbon from the Hex Map;
- scientific boundaries around what the map and Black Carbon observations may imply.

It does not yet define:

- final production wording for every explanatory section;
- chart types beyond the paired Summer/Winter diurnal comparison defined here;
- user-selectable historical chart windows or comparison controls;
- Clean Air Night-specific analysis or campaign calls to action;
- a general-purpose public raw Black Carbon historical-series API;
- Black Carbon inclusion in Hex Map views;
- the exact UI/control for switching the paired charts between `bc`, `uv370` and `uvpm`.

## Route and shared navigation

The public route remains:

```text
/wood-burning/
```

The shared sidebar label remains:

```text
Wood Burning
```

Shared navigation ordering, icon geometry, drawer behaviour and route highlighting remain owned by [sidebar-navigation-contract.md](sidebar-navigation-contract.md).

The Wood Burning page MUST use the normal shared UK AQ shell and MUST NOT introduce a page-specific duplicate sidebar or footer.

## Page title

The visible page title MUST use the supplied one-line artwork:

```text
/images/UK-AQ-wood-burning-1line.png
```

The page MUST NOT switch to the two-line artwork at narrower widths.

The title MUST follow the established Hex Map / AQ in the News title treatment:

- occupy the standard UK AQ top-of-page title position;
- preserve a semantic accessible `<h1>` for "Wood Burning";
- shrink responsively to fit available horizontal space;
- preserve image aspect ratio;
- avoid overlap with the hamburger/menu control;
- avoid overlap with the shared UK AQ home logo;
- avoid clipping or viewport overflow.

The shared UK AQ logo and hamburger MUST NOT be moved merely to accommodate this title.

## Opening animation/video

The opening explanatory visual MUST be a **16:9** video/animation placed prominently near the top of the page immediately below the standard page-title area.

The video is an explanatory enhancement rather than the only source of essential information. Important claims or concepts shown in the animation MUST also be available in page text or captions.

### Hosting and delivery

Production video files SHOULD be served from Cloudflare R2 through a UK AQ custom media hostname rather than committed as large binary assets in the GitHub Pages repository.

The intended delivery pattern is conceptually:

```text
GitHub Pages HTML/CSS/JS
        |
        v
native <video>
        |
        v
UK AQ media hostname
        |
        v
Cloudflare cache / R2
```

The exact R2 bucket and hostname configuration is an infrastructure decision, but the page implementation MUST consume a stable HTTPS media URL and MUST NOT depend on YouTube/Vimeo for this opening animation.

### Video formats

The page SHOULD provide:

1. H.265 / HEVC MP4 as the preferred higher-efficiency source where the browser/platform can play it;
2. H.264 MP4 as the broad-compatibility fallback.

The H.264 source MUST remain available so playback does not depend on HEVC support.

Additional formats such as WebM/AV1 are not required for the initial phase.

### Default playback behaviour

The video MUST:

- use a 16:9 presentation area;
- autoplay where browser policy permits;
- start muted;
- loop;
- use `playsinline`;
- use a static poster image before video playback is ready;
- avoid browser-default controls if custom controls are provided;
- remain usable if autoplay is blocked.

### Sound control

A visible custom sound/mute control MUST be provided.

Initial state:

```text
Muted
```

The control MUST clearly communicate the current sound state and be keyboard accessible.

Toggling sound MUST affect audio only. It MUST NOT implicitly force captions on or off because captions have their own independent CC control.

### Captions / subtitles

The animation SHOULD use a separate WebVTT subtitle/caption track rather than permanently burning captions into the video.

A visible custom **CC** control MUST allow the user to independently turn captions on and off.

Initial caption state SHOULD be:

```text
On
```

because the video autoplays muted.

The CC control MUST remain independent from the sound/mute control:

- users may have sound off + captions on;
- sound on + captions on;
- sound on + captions off;
- sound off + captions off.

The user's interaction should not cause unrelated video controls to reset.

### Reduced motion

When `prefers-reduced-motion: reduce` applies, the page MUST NOT automatically run the looping animation.

The static poster/first-frame presentation SHOULD remain visible instead. Explicit user-initiated playback MAY still be supported.

Reduced-motion behaviour MUST NOT remove access to the explanatory information supplied elsewhere in the page.

## Agreed page hierarchy

The initial fuller page SHOULD progress from explanation to measurements/evidence rather than present itself as a dashboard first.

The agreed conceptual order is:

```text
Page title
Opening 16:9 animation/video
Short introduction
Black Carbon monitoring / UK location-map section
Summer/Winter BC/UV sensor charts
What is Black Carbon?
Wood burning and air pollution
What does the evidence show?
Monitoring and limitations
Summary cards on mobile
Related UK AQ pages / further information
Shared footer
```

At desktop/tablet widths the summary cards may appear much higher, as defined below.

The final written copy for the explanatory sections may be refined later, but implementation MUST preserve the basic information architecture unless this contract is updated.

## Short introduction

Immediately following the opening animation/video, the page SHOULD provide a concise introduction explaining why wood burning, particulate pollution and Black Carbon are being discussed together.

The introduction MUST NOT imply that every Black Carbon observation is caused by domestic wood burning.

Detailed wording remains editorially open.

## Black Carbon network identity

The canonical monitoring-network code for this page is:

```text
black_carbon
```

with current display name:

```text
Black Carbon
```

The page MUST use the canonical public-network identity supplied by the existing network/data contracts. It MUST NOT identify Black Carbon as AURN merely because both are official UK-AIR/Defra data sources.

Public display of Black Carbon data on this page is conditional on the network being eligible for public display under the existing public-network catalogue contract.

The page MUST NOT treat `public_display_enabled` as meaning that Black Carbon is automatically eligible for every UK AQ product. Product-specific eligibility remains explicit, including the Hex Map exclusion below.

## Black Carbon monitoring section

The page MUST include a dedicated monitoring section that combines concise explanatory information with the compact Black Carbon location map.

At desktop/tablet widths this section SHOULD support a two-column presentation, with explanatory/monitoring information occupying the larger content area and the compact UK map positioned on the right-hand side.

The map is intentionally a small supporting visual in its resting state rather than a dominant full-width map.

## Black Carbon sensor map

The initial map MUST be a simplified **geographical UK outline**, not a normal tiled web basemap.

### Geographic outline

The map MUST:

- show the United Kingdom outline in a restrained dark-grey stroke;
- include England, Scotland, Wales and Northern Ireland;
- not present the Republic of Ireland as part of the map;
- avoid roads, terrain, administrative shading, place-name clutter and conventional basemap tiles;
- preserve real geographical relationships between eligible Black Carbon monitoring locations.

If map geometry includes surrounding context for technical clipping/projection purposes, the Republic of Ireland MUST NOT be drawn as a normal visible land outline comparable with the UK.

SVG is the preferred presentation technology for this initial map because the requirement is a lightweight outline, sensor points and labels rather than pan/zoom mapping.

### Sensor markers

The map MUST render one marker per eligible current public Black Carbon sensor location.

Sensor dots MUST use the standard UK AQ blue:

```text
#3C78AC
```

Marker colour MUST indicate "UK AQ monitoring location" only.

The marker colour MUST NOT encode:

- concentration;
- health risk;
- AQI;
- completeness;
- source attribution;
- administrative-area status.

The map is a **monitoring-location map**, not a pollution heat map.

### Resting size

On desktop/tablet the map SHOULD remain relatively compact while at rest so it supports, rather than dominates, the surrounding explanation.

It SHOULD sit on the right-hand side of the monitoring section where practical.

### Expansion on desktop

On pointer-capable desktop/tablet layouts, hovering the map MAY smoothly enlarge it so sensor geography is easier to inspect.

Keyboard focus MUST provide an equivalent expanded state. Expansion MUST NOT be hover-only.

The expansion MUST:

- remain visually stable;
- avoid forcing disruptive page reflow where practical;
- preserve the UK outline and marker geometry;
- provide enough space for location labels to become legible;
- remain dismissible simply by leaving hover/focus state.

The implementation SHOULD prefer a CSS/SVG expansion treatment rather than introducing a full interactive mapping library solely for this behaviour.

### Labels

In the expanded state, monitoring locations SHOULD be labelled with their user-facing station/location names.

Where labels would collide, short leader lines and/or sensible label offsets MAY be used.

Individual markers MAY also expose their location name on hover/focus.

Labels MUST describe the monitoring location only. They MUST NOT imply the measured value represents the surrounding town, region or administrative area.

### Mobile interaction

Below `768px`, hover cannot be assumed.

The mobile map SHOULD therefore use an explicit tap interaction:

- tap/activate to expand;
- tap a close/dismiss affordance or activate again to return to the compact state.

The map MUST NOT unexpectedly expand merely because the user scrolls across it.

Keyboard and assistive-technology operation MUST remain possible.

Detailed measurement popups, historical values inside the map and map-to-chart interaction remain deferred.

## Summer/Winter BC/UV sensor charts

Immediately below the Black Carbon monitoring/location-map section, the page MUST provide paired diurnal line charts for the current public Black Carbon sensors.

The initial presentation may centre on Black Carbon, but the chart data boundary MUST support the three profile properties supplied by the dedicated derived product:

```text
bc
uv370
uvpm
```

`uvpm` is not a stored canonical observation series. It is the derived exact-timestamp difference `uv370 - bc` defined by [../cache_proxy/bc-uv-diurnal-contract.md](../cache_proxy/bc-uv-diurnal-contract.md).

The exact first-release control for switching between these properties remains a presentation decision. The page MUST NOT implement a separate browser-side derivation path for `uvpm`.

The purpose of this section is to show how the typical selected BC/UV concentration profile through the day differs across the warmer and colder halves of the year at each monitoring site.

### Seasonal presentation

For page presentation, the two six-month halves are labelled:

- **Summer** = April through September;
- **Winter** = October through March.

These labels are deliberate presentation shorthand and MUST NOT be described as formal meteorological-season definitions.

The chart headings SHOULD make the covered months/years explicit, for example:

```text
Summer · Apr–Sep 2026
Winter · Oct 2025–Mar 2026
```

The Winter period therefore normally spans two calendar years.

The implementation MUST select coherent six-month periods from available Black Carbon history rather than mixing arbitrary months from different seasonal halves.

### Per-sensor chart pair

Each sensor is presented as one chart group/row containing:

1. a Summer chart;
2. a Winter chart.

At viewport widths of `768px` and above, the two charts SHOULD appear side by side in one sensor row where the available width permits.

Below `768px`, the two charts MUST stack vertically within the same sensor group:

```text
Sensor name

Summer
[ chart ]

Winter
[ chart ]
```

The sensor identity MUST remain visually associated with both charts so users do not mistake adjacent chart pairs for different monitoring sites.

### Monthly lines

Each Summer chart MAY contain up to six monthly lines:

```text
Apr, May, Jun, Jul, Aug, Sep
```

Each Winter chart MAY contain up to six monthly lines:

```text
Oct, Nov, Dec, Jan, Feb, Mar
```

A monthly line represents the mean of the accepted Black Carbon readings available for each **GMT hour-ending** slot within that month.

The X axis MUST use the same 24 hourly positions for both charts:

```text
01:00 through 24:00 GMT hour ending
```

The chart MUST NOT silently shift hourly buckets for British Summer Time. Using GMT hour-ending slots is intentional so the Summer and Winter profiles remain directly comparable.

If a month lacks accepted observations for a particular GMT hour-ending slot, the chart MUST preserve that absence rather than fabricate or interpolate a monthly mean.

The chart legend SHOULD use concise month labels because the chart heading already establishes the relevant year or year pair.

### Monthly series styling and legend interaction

The Wood Burning charts MUST follow the shared line-chart presentation rules in [`shared-line-chart-presentation-contract.md`](shared-line-chart-presentation-contract.md), including subtle horizontal dotted/short-dash grid lines aligned with visible Y-axis ticks and no general vertical grid.

The six monthly series within each Summer or Winter chart MUST initially be distinguished by **colour only**.

For the initial implementation:

- all monthly data lines MUST be solid;
- use six visually distinguishable colours;
- do not add point symbols/markers merely to identify the six months;
- do not assign six different dash patterns;
- the ordered colour sequence MUST be deterministic from the first through sixth month of each half-year;
- Summer and Winter MAY reuse the same six-position colour sequence because each chart has its own explicit month legend.

The compact legend labels SHOULD remain:

```text
Summer: Apr May Jun Jul Aug Sep
Winter: Oct Nov Dec Jan Feb Mar
```

The year/year-pair remains in the chart heading rather than being repeated on every legend item.

Each month legend item MUST be an interactive control with useful mouse, keyboard and touch operation.

Selecting a month MUST:

- keep that month's line at full prominence;
- visually subdue the other five monthly lines without removing them;
- show the selected legend control using the same established **light-blue selected-control treatment used by Hex Map controls**;
- expose selected state accessibly, for example with `aria-pressed` or equivalent semantics.

At mobile widths, the legend item itself MUST provide the practical touch target. The user MUST NOT be expected to accurately tap a thin chart line to select a month.

Pointer hover/focus over a legend item or eligible plotted line MAY provide the same temporary emphasis on desktop, but the persistent selection action MUST remain available by click/tap and keyboard.

The initial implementation MUST NOT add month symbols. Symbols or an additional line-pattern distinction may be reconsidered only if real TEST use demonstrates that the colour-plus-interactive-legend treatment is insufficient.

### Shared Y-axis within each sensor pair

The Summer and Winter charts for the **same sensor** MUST use exactly the same Y-axis minimum, maximum and tick positions.

The shared scale MUST be resolved from the combined Summer + Winter values for that sensor pair and the currently displayed property so differences between the two halves of the year are visually comparable.

For `bc` and `uv370`, the Y-axis minimum SHOULD normally remain zero. For derived `uvpm`, finite negative values are valid and MUST remain visible; its pair-specific Y-axis minimum MUST extend below zero when required by the displayed data.

The Y-axis maximum SHOULD use a sensible rounded ceiling above the highest plotted value in either chart of that sensor pair.

The page MUST NOT independently auto-scale the Summer and Winter charts for the same sensor.

A single global Y-axis scale across every sensor on the page is **not required**. Different sensors MAY use different pair-specific Y-axis ranges so a high-concentration site does not flatten meaningful variation at lower-concentration sites.

The Y axis MUST clearly identify the currently displayed property and use `ug/m3` as supplied by the BC/UV product contract.

### Chart explanation and completeness note

The chart section MUST include a concise explanation that each line shows the mean concentration for the selected BC/UV property for each GMT hour-ending period during that month.

It MUST also state that:

- Summer and Winter charts for the same monitoring site share one vertical scale;
- missing source observations can reduce the amount of data contributing to a monthly/hourly mean;
- differing data completeness between months can affect visual comparisons;
- the charts describe measured Black Carbon patterns at the monitoring site and do not by themselves attribute those patterns to domestic wood burning.

The UI SHOULD avoid presenting provisional or incomplete months as equally complete without an appropriate data-completeness indication.

### Sensor pagination

The chart section MUST show a maximum of **six sensors per page**.

Each sensor consumes one Summer/Winter chart pair, so a full desktop page contains at most:

```text
6 sensor groups
12 charts
```

The sensor order MUST be deterministic. Alphabetical station/location name ordering is acceptable unless the canonical network/data product supplies an explicit presentation order.

Pagination MUST allow the user to move to the next and previous sensor page where applicable.

The UI SHOULD expose the current page and total number of sensor pages, for example:

```text
Previous    Page 1 of 3    Next
```

It MAY additionally show a sensor range such as:

```text
Showing sensors 1–6 of 14
```

Pagination controls SHOULD be available at both the top and bottom of the chart collection when there is more than one page, so users do not need to scroll through all charts merely to move to another sensor page.

Pagination MUST change only the displayed sensor groups. It MUST NOT change the seasonal definitions or aggregation semantics.

### Data/API boundary

The targeted pre-implementation check has established that the existing station-history/observation-history browser path is not an efficient or currently compatible boundary for this page's twelve-month profile aggregation.

The owning derived product is therefore:

```text
GET /api/aq/bc-uv/diurnal
```

defined by [../cache_proxy/bc-uv-diurnal-contract.md](../cache_proxy/bc-uv-diurnal-contract.md).

The website MUST consume that compact derived product rather than:

- scraping UK-AIR source files;
- extending the general AQI/station-history browser machinery merely for this page;
- downloading a year of raw hourly observations per sensor;
- calculating monthly GMT-hour means in the browser;
- deriving `uvpm` in the browser.

The product supplies `bc`, `uv370` and derived `uvpm` monthly/hour-ending aggregates plus completeness/provenance counts.

The page MAY paginate the returned sensor population client-side in groups of six. Pagination MUST NOT cause a raw-history request per sensor.

## Initial summary cards

The Wood Burning page has **three** summary cards.

The agreed card labels/concepts are:

1. **Black Carbon sensors**
2. **Reporting on latest day**
3. **Locations covered**

A fourth card for a network-wide latest or median Black Carbon concentration is explicitly **not** part of this phase.

### Black Carbon sensors

This card represents the size of the current public Black Carbon network shown by the page.

The count MUST be derived from canonical Black Carbon station/network metadata rather than hard-coded.

Historical/retired stations MUST NOT be added merely because they exist in the long-term Black Carbon history catalogue.

The exact station-eligibility query remains owned by the future page data/API contract, but it MUST represent the current public page population rather than the complete historical station inventory.

### Reporting on latest day

This card represents how many sensors in the page's current public Black Carbon population have an accepted Black Carbon observation on the latest Black Carbon observation date available to the page.

It is deliberately **not** labelled or presented as "Reporting now".

The latest day is a network/data availability concept, not the browser's current calendar day.

A stale or delayed source day MUST therefore remain visibly historical rather than being described as live/current reporting.

### Locations covered

This card represents distinct geographical locations covered by the current public Black Carbon sensor population.

The UI MUST NOT invent a locality grouping by ad-hoc string parsing of station names.

The exact canonical grouping rule for a "location" MUST be defined by the page's data/API implementation before this card is made data-bearing. Until then, the label and intended concept are authoritative but the numerical aggregation rule is deliberately deferred.

## Summary-card responsive placement

At viewport widths of `768px` and above, the three-card summary section SHOULD appear relatively high on the page, associated with the introductory/monitoring portion of the page and before the deeper explanatory/evidence sections.

Below `768px`, the summary-card section MUST move towards the bottom of the page, following the same broad mobile-priority principle used by the Hex Map rather than forcing dashboard-style statistics ahead of primary content.

The intended mobile order is:

```text
Title
16:9 animation
Introduction
Black Carbon map / monitoring section
Summer/Winter sensor charts
What is Black Carbon?
Wood burning and air pollution
What does the evidence show?
Monitoring and limitations
Three summary cards
Related UK AQ pages / further information
Footer
```

The same underlying card values MUST be used at all responsive widths. Responsive presentation MUST NOT introduce separate mobile calculations or APIs.

## What is Black Carbon?

The page SHOULD include a compact explanatory section describing Black Carbon as a component of particulate pollution produced by incomplete combustion.

This section MUST make clear that Black Carbon is **not specific to domestic wood burning**.

Other combustion sources, including road transport and other fuel combustion, may contribute to Black Carbon observations.

The page MUST NOT attribute a measured Black Carbon concentration to wood burning merely because it appears on the Wood Burning page.

## Wood burning and air pollution

The page SHOULD include an educational section explaining the relationship between wood burning and air pollution.

The structure may use short visual/text blocks rather than one long uninterrupted article.

Topics may include:

- particulate emissions from wood combustion;
- PM2.5;
- Black Carbon;
- incomplete combustion;
- indoor and outdoor pollution pathways;
- how smoke can affect neighbouring properties and the wider outdoor environment.

Final wording and supporting illustrations remain editorial decisions, but claims MUST remain evidence-based and appropriately qualified.

## What does the evidence show?

The page SHOULD reserve a distinct evidence/research section rather than mixing research claims invisibly into general explanatory copy.

This section may later surface:

- UK evidence;
- emissions-inventory evidence;
- peer-reviewed research;
- relevant UK AQ Research-page links.

The detailed source set and final research presentation remain deferred.

## Monitoring and limitations

The page MUST include a clear limitations section.

It SHOULD explain in plain language that:

- Black Carbon monitoring is sparse compared with common regulated pollutants such as PM2.5;
- a monitoring site measures conditions at its own location;
- a site reading does not represent an entire town, authority, region or the whole UK;
- source attribution generally cannot be inferred from concentration alone;
- weather and other combustion sources affect measured concentrations;
- the latest available Black Carbon day may lag the browser's current date.

This section is important to prevent the map and current observations from being interpreted as broader spatial/source claims than the data supports.

## Related UK AQ pages / further information

The lower page MAY provide links/cards to relevant UK AQ sections such as:

- Hex Map;
- Sensor Map;
- WHO Guidelines;
- NAEI Data;
- Research;
- AQ in the News.

Exact ordering and card styling remain presentation decisions and SHOULD reuse existing UK AQ link/card conventions where practical.

## Shared footer attribution

Black Carbon uses the same Defra/UK-AIR Crown copyright and Open Government Licence attribution family as GOV.UK AURN.

Shared footer behaviour is owned by [site-footer-attribution-contract.md](site-footer-attribution-contract.md).

For Black Carbon, that contract requires:

- a `Black Carbon` pill keyed to `network_code = black_carbon`;
- the Black Carbon pill to share the existing Defra/UK-AIR attribution box with the `GOV.UK AURN` pill;
- each pill's visibility to follow its own public-network-catalogue presence independently;
- the shared Defra/OGL wording to remain visible when either AURN or Black Carbon is applicable;
- the complete Defra/UK-AIR attribution box to disappear only when neither network is applicable after valid catalogue filtering.

The Wood Burning page MUST use the shared footer implementation. It MUST NOT create a second page-local Black Carbon licence block.

## Hex Map exclusion

Black Carbon is **not** part of the Hex Map product in this phase.

Even when `black_carbon` is public-display enabled for the Wood Burning page and shared footer, the Hex Map MUST NOT automatically expose it as:

- a selectable Hex Map network;
- a UK-wide current pollution layer;
- a Countries & Regions layer;
- a Local Authority layer;
- a constituency layer;
- a Hex Map current sensor/chart mode.

This exclusion is deliberate because the Black Carbon source has daily rather than live/current availability and the sparse monitoring network is not well represented by administrative-area or hex aggregation.

Public-network catalogue membership therefore MUST NOT by itself force Black Carbon into the Hex Map's product-specific network set.

A later decision MAY add Black Carbon to some Hex Map surface, but that requires a separate explicit contract update.

## Data and scientific boundaries

The website MUST consume canonical Black Carbon identities and accepted observation products from their owning backend contracts.

The page MUST NOT:

- calculate or invent a Black Carbon AQI;
- imply that Black Carbon markers represent area-wide concentrations;
- infer live/current status from the browser clock;
- fabricate missing observations;
- use retired historical stations to inflate the current network summary;
- attribute a Black Carbon observation to domestic wood burning without source-attribution evidence;
- turn the UK outline map into a heat map or spatial interpolation;
- treat a null compact-ingest latest-value field as proof that Black Carbon R2 history is absent.

The Black Carbon ingest identity contract and R2 history contracts remain authoritative for source identity, station/timeseries identity, observation history and verification status.

## Implementation ownership

Expected website implementation ownership is:

```text
TEST-uk-aq/TEST-uk-aq.github.io/wood-burning/
TEST-uk-aq/TEST-uk-aq.github.io/sidebar.js
TEST-uk-aq/TEST-uk-aq.github.io/site-footer.css
```

A page-specific Wood Burning JavaScript/CSS module MAY be introduced for the video controls, responsive ordering, SVG map interaction, chart rendering and chart pagination.

The shared sidebar/footer logic MUST remain shared.

Large video binaries SHOULD remain outside the website Git repository and be served from the agreed R2/media delivery path.

Any backend/API work required to supply summary counts, current locations or historical Black Carbon observations belongs to the owning cache/data/API area and requires its own contract update rather than being embedded as ad-hoc website data logic.

## Structural validation before implementation

Before implementation, validate only the load-bearing structure:

- `black_carbon` can be distinguished from `gov_uk_aurn` in the public network catalogue;
- the shared footer can support two independently gated pills in one Defra/UK-AIR attribution box;
- current public Black Carbon stations have usable geographical coordinates for the location map;
- the selected UK outline geometry can represent England, Scotland, Wales and Northern Ireland without visually including the Republic of Ireland as part of the UK map;
- sensor coordinates can be projected into the chosen SVG geometry;
- the website can obtain the required current station population without treating the complete historical Black Carbon catalogue as current;
- the custom video controls can independently manage mute state and the WebVTT caption track using native browser video APIs;
- the dedicated `/api/aq/bc-uv/diurnal` product can supply six-month Summer/Winter GMT hour-ending aggregates for `bc`, `uv370` and derived `uvpm` without browser-side raw-history aggregation;
- a pair-specific shared Y-axis can be derived from the combined Summer/Winter aggregate values for each sensor;
- the current public sensor population can be deterministically paginated at a maximum of six sensor groups per page;
- product-specific Hex Map filtering can exclude `black_carbon` even when it is public elsewhere.

The exact "Locations covered" grouping rule is a genuinely required targeted decision/check before that numerical card is implemented.

The chart-data pre-implementation check is complete. It established that a dedicated compact derived product is required; that boundary is now defined by [../cache_proxy/bc-uv-diurnal-contract.md](../cache_proxy/bc-uv-diurnal-contract.md).

No broad speculative pre-deployment functional test suite should be created.

## TEST functional acceptance

After implementation/deployment, functional and visual acceptance MUST use the real TEST website and real TEST Black Carbon metadata/data.

Acceptance SHOULD confirm:

- the page uses the normal shared shell and `/wood-burning/` route;
- the one-line Wood Burning title uses the normal UK AQ title position and shrinks without overlapping shared chrome;
- the opening visual maintains a 16:9 presentation;
- supported browsers select/play an appropriate HEVC or H.264 source;
- autoplay begins muted where browser policy permits;
- sound/mute and CC controls work independently;
- captions come from the separate track and default on for muted autoplay;
- reduced-motion users do not receive automatic looping animation;
- the compact UK map is on the right at desktop/tablet widths where layout permits;
- the map shows the UK outline without presenting the Republic of Ireland as part of the map;
- eligible Black Carbon sensors are positioned geographically;
- sensor dots use UK AQ blue `#3C78AC`;
- marker colour does not encode concentration or AQI;
- desktop pointer hover and keyboard focus can expose the enlarged map/labels;
- mobile provides an explicit tap-based expansion/dismiss interaction;
- each displayed sensor has one Summer and one Winter diurnal chart;
- Summer represents April–September and Winter represents October–March, with the covered months/years visible to the user;
- monthly lines use GMT hour-ending slots from 01:00 through 24:00;
- horizontal dotted/short-dash grid lines align with visible Y-axis ticks and no general vertical grid is added;
- each six-month chart uses six solid colour-distinguished monthly lines with no symbols in the initial implementation;
- selecting a month via the legend highlights it, subdues the other five, and uses the established Hex Map light-blue selected-control treatment;
- the legend selection works by mouse, keyboard and touch, with a practical mobile touch target;
- chart data is supplied by `/api/aq/bc-uv/diurnal`, not browser-side raw-history aggregation;
- the page data layer can consume `bc`, `uv370` and derived `uvpm` without inventing a `uvpm` timeseries identity;
- Summer and Winter charts for the same sensor use the same Y-axis range and tick positions;
- different sensors may use different pair-specific Y-axis ranges;
- missing source observations are not fabricated/interpolated into monthly hourly means;
- no more than six sensor groups are displayed per chart page;
- chart pagination moves deterministically between sensor groups and provides previous/next navigation when required;
- mobile stacks Summer and Winter charts vertically within each sensor group;
- desktop/tablet places the three-card summary relatively high in the page;
- mobile places the three summary cards after the main explanatory/limitations content;
- no fourth network-median/latest-concentration card is present;
- retired historical stations are not accidentally presented as the current network;
- limitations text prevents source/spatial over-interpretation;
- Black Carbon remains excluded from Hex Map product surfaces;
- the shared Black Carbon footer attribution continues to follow the public-network catalogue.
