# Wood Burning page contract

## Status

**Authoritative future implementation contract for the initial Wood Burning page phase.**

The existing `/wood-burning/` route shell may remain until this phase is implemented and accepted on TEST.

This contract intentionally fixes only the decisions already agreed for the initial page structure and Black Carbon presentation. The main explanatory content, detailed chart design and later campaign-specific content remain deferred.

## Scope

This contract governs the initial public presentation for:

```text
/wood-burning/
```

It defines:

- the initial Black Carbon summary-card set;
- responsive placement of those summary cards;
- the initial geographical Black Carbon sensor map;
- the page's use of the canonical `black_carbon` network identity;
- the shared-footer Black Carbon attribution dependency;
- the current exclusion of Black Carbon from the Hex Map;
- the boundary between the initial page shell and later Wood Burning / Clean Air Night content decisions.

It does not yet define:

- the full explanatory/editorial content of the page;
- detailed chart types, controls, comparison periods or annotations;
- Clean Air Night campaign-specific sections;
- map popup/detail-card content;
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

## Initial summary cards

The initial Wood Burning page has **three** summary cards.

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

At viewport widths of `768px` and above, the three-card summary section SHOULD appear near the top of the Wood Burning page, following the page heading/introductory shell and before the main detailed page content.

Below `768px`, the summary section MUST move after the primary Wood Burning page content and before the shared site footer.

This mobile relocation is intentional. Mobile users should reach the primary page content without first having to scroll through the summary-card set.

The same underlying card values MUST be used at all responsive widths. Responsive presentation MUST NOT introduce separate mobile calculations or APIs.

## Black Carbon sensor map

The initial page MUST include a compact real geographical map showing where the current public Black Carbon sensors are located.

The initial map presentation MUST:

- use geographical coordinates rather than a schematic or administrative-area diagram;
- render one simple point/marker per eligible Black Carbon sensor location;
- use a restrained basemap and marker treatment so sensor geography is the primary purpose;
- avoid implying a Black Carbon health threshold or AQI band through marker colour;
- avoid Local Authority, constituency or hex-area shading;
- avoid presenting the network as a continuous spatial surface.

The initial map is a **location map**, not a pollution heat map.

Detailed popup content, selected-marker behaviour, historical values inside the map and map-to-chart interaction remain deferred.

Implementation SHOULD reuse established website mapping technology and shared data identities where practical rather than create a separate incompatible mapping stack.

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

A later decision MAY add Black Carbon to some Hex Map surface, but that requires a separate explicit contract update covering at minimum:

- which Hex Map views are appropriate;
- how non-live/latest-available dates are communicated;
- whether charts anchor to yesterday or another latest-available date;
- what happens when the latest source day is delayed;
- whether any area aggregation is scientifically and visually appropriate.

This contract does **not** authorise a yesterday-anchored Black Carbon Hex Map chart mode because Black Carbon is currently excluded from the Hex Map.

## Main page content boundary

The following decisions remain intentionally open for a later Wood Burning page contract update:

- the full text/content hierarchy;
- Wood Burning versus Clean Air Night branding balance;
- historical Black Carbon charts;
- chart date-window controls;
- comparison/baseline methodology;
- explanatory sections on wood burning and Black Carbon;
- event/night-specific analysis;
- annotations and calls to action;
- UV 370 nm presentation;
- map popup and drill-down content.

Implementation MUST NOT fill these undecided areas with invented production content merely to complete the initial structural phase.

## Data and scientific boundaries

The website MUST consume canonical Black Carbon identities and accepted observation products from their owning backend contracts.

The page MUST NOT:

- calculate or invent a Black Carbon AQI;
- imply that Black Carbon markers represent area-wide concentrations;
- infer live/current status from the browser clock;
- fabricate missing observations;
- use retired historical stations to inflate the current network summary;
- treat a null compact-ingest latest-value field as proof that Black Carbon R2 history is absent.

The Black Carbon ingest identity contract and R2 history contracts remain authoritative for source identity, station/timeseries identity, observation history and verification status.

## Implementation ownership

Expected website implementation ownership is:

```text
TEST-uk-aq/TEST-uk-aq.github.io/wood-burning/
TEST-uk-aq/TEST-uk-aq.github.io/sidebar.js
TEST-uk-aq/TEST-uk-aq.github.io/site-footer.css
```

A future page-specific JavaScript/CSS module MAY be introduced where needed, but shared sidebar/footer logic MUST remain shared.

Any backend/API work required to supply summary counts, locations or historical Black Carbon observations belongs to the owning cache/data/API area and requires its own contract update rather than being embedded as ad-hoc website data logic.

## Structural validation before implementation

Before implementation, validate only the load-bearing structure:

- `black_carbon` can be distinguished from `gov_uk_aurn` in the public network catalogue;
- the shared footer can support two independently gated pills in one Defra/UK-AIR attribution box;
- current public Black Carbon stations have usable geographical coordinates for the location map;
- the website can obtain the required current station population without treating the complete historical Black Carbon catalogue as current;
- product-specific Hex Map filtering can exclude `black_carbon` even when it is public elsewhere.

The exact "Locations covered" grouping rule is a genuinely required targeted decision/check before that numerical card is implemented.

Do not create a broad speculative pre-deployment test suite.

## TEST functional acceptance

After implementation/deployment, functional and visual acceptance MUST use the real TEST website and real TEST Black Carbon metadata/data.

Acceptance SHOULD confirm:

- the page uses the normal shared shell and `/wood-burning/` route;
- desktop/tablet shows the three-card summary near the top;
- mobile places the summary after the primary page content;
- no fourth network-median/latest-concentration card is present;
- the geographical map plots the intended current public Black Carbon sensors as points;
- markers do not use an invented concentration/AQI colour scale;
- retired historical stations are not accidentally presented as the current network;
- `black_carbon` public visibility enables the shared Black Carbon footer pill;
- the AURN and Black Carbon footer pills respond independently to catalogue membership;
- the shared Defra/OGL wording remains correct when either pill is visible;
- Black Carbon does not appear in the Hex Map network/product surfaces in this phase.
