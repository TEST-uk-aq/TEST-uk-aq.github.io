# Wood Burning page contract

## Status

**Authoritative future implementation contract for the Wood Burning page.**

The existing `/wood-burning/` route shell may remain while the fuller page is designed and implemented on TEST.

This contract fixes the agreed page hierarchy, Black Carbon summary presentation, opening animation/video treatment, Black Carbon location map, responsive ordering and scientific/presentation boundaries. Detailed editorial copy, historical chart design and campaign-specific content may still be refined later within these boundaries.

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
- the page's use of the canonical `black_carbon` network identity;
- the shared-footer Black Carbon attribution dependency;
- the current exclusion of Black Carbon from the Hex Map;
- scientific boundaries around what the map and Black Carbon observations may imply.

It does not yet define:

- final production wording for every explanatory section;
- historical Black Carbon chart types, controls or comparison periods;
- Clean Air Night-specific analysis or campaign calls to action;
- a public Black Carbon historical-series API;
- Black Carbon inclusion in Hex Map views;
- UV 370 nm public presentation.

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

Detailed measurement popups, historical charts and map-to-chart interaction remain deferred.

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

A page-specific Wood Burning JavaScript/CSS module MAY be introduced for the video controls, responsive ordering and SVG map interaction.

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
- product-specific Hex Map filtering can exclude `black_carbon` even when it is public elsewhere.

The exact "Locations covered" grouping rule is a genuinely required targeted decision/check before that numerical card is implemented.

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
- desktop/tablet places the three-card summary relatively high in the page;
- mobile places the three summary cards after the main explanatory/limitations content;
- no fourth network-median/latest-concentration card is present;
- retired historical stations are not accidentally presented as the current network;
- limitations text prevents source/spatial over-interpretation;
- Black Carbon remains excluded from Hex Map product surfaces;
- the shared Black Carbon footer attribution continues to follow the public-network catalogue.
