# Shared station-chart frontend contract

## Authority

This is the authoritative frontend architecture and behaviour contract for UK AQ station charts.

It governs:

- shared station-chart modules;
- browser state ownership;
- observation and AQI loading orchestration;
- AQI-source switching;
- pollutant-context ownership;
- D3 rendering and chart interaction boundaries;
- cache and request-settlement behaviour in the browser;
- page-specific adapters;
- chart-local diagnostics and user-facing error behaviour.

The AQI and R2-history contracts remain authoritative for data meaning, source precedence, continuity, API fields, timestamps and AQI calculation rules.

Shared cross-page line-chart visual conventions are owned by [`../website_ui/shared-line-chart-presentation-contract.md`](../website_ui/shared-line-chart-presentation-contract.md). The station-chart renderer MUST follow that contract for horizontal Y-grid presentation without changing the data/controller ownership defined here.

## Realised architecture

The website has one shared station-chart subsystem used by both Hex Map and Sensors.

The subsystem provides:

1. one chart controller;
2. one browser cache and request-settlement model;
3. one AQI-source controller;
4. one pollutant-context controller;
5. one D3 renderer;
6. one calculated station-history data client;
7. one compatibility data client behind the same client interface;
8. one bounded diagnostics interface;
9. thin page adapters for page-specific controls and selection state.

Hex Map and Sensors MUST NOT maintain independent copies of chart loading, caching, AQI interpretation or rendering logic.

The former `/station_chart/` location was transitional during modularisation. It is not the canonical active implementation location.

## Active structure

The sole active shared implementation is under:

```text
/shared/station-chart/
```

The active structure is equivalent to:

```text
/shared/station-chart/
  station-chart-domain.js
  station-chart-cache.js
  station-history-client.js
  station-history-compatibility-client.js
  aqi-source-controller.js
  pollutant-context-controller.js
  station-chart-renderer.js
  station-chart-controller.js
  station-chart-diagnostics.js
  station-chart.css

/hex_map/
  hex-map-station-chart-adapter.js
  hex-map-station-chart-adapter-module.js
  hex-map-bootstrap.js
  index.html

/sensors/
  sensor-station-chart-adapter.js
  sensor-station-chart-adapter-module.js
  sensors-bootstrap.js
  index.html
```

Exact filenames may vary where an established filename is clearer. Responsibility boundaries and dependency direction are authoritative.

Narrow `*-module.js` interfaces or other compatibility interfaces MAY expose the canonical implementation to native ES-module consumers. They MUST delegate to or export the same implementation and MUST NOT create a second controller, renderer, cache, client state machine or AQI-source owner.

## Module format and compatibility

Shared chart code MUST live in external JavaScript files.

The active implementation uses native ES-module entry points and narrow compatibility boundaries where established shared code still supports classic or UMD/CommonJS consumers.

The implementation MUST:

- use explicit imports/exports or a narrow documented compatibility facade;
- avoid arbitrary page globals;
- be loadable by Hex Map and Sensors;
- avoid copying the same function body into page files;
- avoid inline page scripts containing chart-controller, cache, request or D3 implementation.

A bounded global MAY remain where required by a classic/UMD consumer, Node/CommonJS harness, late-bound runtime instance or an otherwise harmful import cycle. It MUST delegate to one authoritative owner rather than maintain parallel mutable state.

D3 and `ChartCore` MAY remain intentional classic shared dependencies where required by the canonical renderer.

Page HTML may contain configuration and a small bootstrap only.

## Dependency direction

Dependencies MUST flow in one direction equivalent to:

```text
page adapter
  -> station-chart controller
      -> pollutant-context controller
      -> AQI-source controller
      -> cache
      -> data client
      -> renderer
      -> diagnostics
```

The renderer MUST NOT call the data client.

The data client MUST NOT manipulate the DOM.

The cache MUST NOT call fetch or D3.

The AQI-source controller MUST NOT draw observation lines.

Page adapters MUST NOT interpret Worker completeness or AQI calculation statuses.

## Shared domain module

`station-chart-domain.js` owns pure values and normalisation used across modules, including:

- authoritative sensor identity;
- chart range snapshots;
- selected sensor ordering;
- AQI-source identity;
- request generation identity;
- chart load reasons;
- terminal request outcomes;
- cache keys;
- canonical hour endpoints.

It MUST contain no DOM, D3, fetch or page-specific state.

A chart range used for an AQI-source-only switch MUST be an immutable snapshot of the currently displayed x-domain.

## Shared cache module

`station-chart-cache.js` is the sole owner of browser observation and AQI cache semantics.

It MUST keep observation and AQI data separately by authoritative identity, connector, pollutant and range.

For AQI it MUST distinguish:

```text
available rows
request settlement
response diagnostics
freshness
```

It MUST NOT use the existence of blank AQI hours as proof that the request was not performed.

### Successful calculated response settlement

For browser source-switch planning, a calculated AQI response is terminal and settled for its requested range when all of the following are true:

- the HTTP request succeeded;
- the response is parseable;
- the authoritative request identity is valid;
- the AQI section has the expected structural shape;
- no replacement conflict makes the result unsafe to use.

This remains true when:

- `response_complete=false`;
- `has_gap=true`;
- some DAQI or European AQI values are null;
- observations are missing for some hours;
- rolling samples are insufficient;
- the Worker returns a recognised or previously unseen calculation status or missing-reason string;
- the response contains valid rows for only part of the requested range;
- the response contains no valid AQI row for a period that was nevertheless successfully evaluated.

The browser MUST retain response diagnostics but MUST NOT maintain an exhaustive allow-list of Worker diagnostic strings as a condition of visible success.

Unknown calculation statuses, missing reasons or partial reasons MUST be recorded as bounded diagnostics. They MUST NOT by themselves turn an otherwise parseable successful AQI response into a user-facing failure.

The response MUST NOT be relabelled complete merely because it is settled for browser request planning.

### Retryable failure settlement

An AQI interval remains unsettled and retryable when the browser cannot safely use the response because of:

- network or HTTP failure;
- aborted or obsolete request before a usable terminal result;
- unparseable or structurally malformed response;
- invalid authoritative identity;
- unsafe conflicting replacement rows;
- another explicit contract failure that prevents accurate interpretation.

Manual Refresh, range change, cache expiry or a later normal chart load MAY retry such an interval.

Switching AQI source MUST NOT repeatedly request a successfully evaluated range merely because its AQI bands contain gaps.

## Data-client interface

All chart loads MUST consume one common client interface equivalent to:

```text
loadCurrent(request, parts, signal)
loadOlder(request, parts, signal)
prefetchAqi(request, signal)
```

The request MUST include:

```text
connector_id
timeseries_id
pollutant
start_utc
end_utc
include_observations
include_aqi
```

The calculated station-history client is the default active client when the feature is enabled.

The compatibility client MAY read the retained stored-AQI path, but it MUST return the same browser-facing result shape and use the same controller, cache, source-switch and renderer modules.

There MUST NOT be a separate compatibility chart controller or a second AQI-source state machine.

The compatibility client is a data-source adapter, not an alternative frontend architecture.

## Station-chart controller ownership

`station-chart-controller.js` is the sole owner of one chart instance's orchestration.

It owns:

- current selected sensor list and ordering;
- selected AQI source;
- displayed chart range;
- load generation;
- active request cancellation;
- current data client;
- chart lifecycle;
- foreground request priority;
- background AQI prefetch scheduling;
- interaction with the renderer.

Chart selection, chart range and AQI source are chart-owned state. Page adapters forward user intent but MUST NOT maintain competing authoritative copies.

The controller MUST expose an interface equivalent to:

```text
setSelection(entries, options?)
setAqiSource(stationId)
setRange(range)
replacePollutantContext(contextWithOptionalRange)
refresh()
resize(dimensions)
destroy()
```

Exact method names MAY differ while preserving the same ownership boundaries.

A page adapter MUST NOT call internal cache or renderer functions directly.

The controller MUST ensure obsolete work cannot commit visible output.

### Hex Map hour-aligned range endpoint

The Hex Map adapter owns conversion of the user's selected range label into a concrete immutable range snapshot before forwarding it to the shared station-chart controller. The controller remains the authoritative owner of the committed displayed range.

For Hex Map station charts, the range endpoint MUST be aligned to an hourly observation boundary rather than to the browser's current minute and second.

The rule is:

1. floor the current time to the current canonical hour boundary;
2. normally use the previous hour boundary as the chart endpoint;
3. if at least one sensor that is currently selected and plotted has an authoritative latest observation timestamp within the current hour, use the current hour boundary instead;
4. an unselected sensor MUST NOT extend the displayed range;
5. preserve the selected duration exactly, so moving the endpoint by one hour moves the start by the same amount.

This rule applies consistently to the Hex Map `12h`, `24h`, `7d`, `31d` and `90d` ranges.

The endpoint MUST be re-evaluated when any event can materially change either the current-hour availability of the plotted selection or the requested range:

- chart entry;
- explicit range change;
- Refresh after map/latest-state refresh;
- same-pollutant selected-sensor addition or removal;
- authoritative ready pollutant replacement.

When a selected-sensor change and range re-anchor occur together, the adapter SHOULD provide the concrete range snapshot with the same `setSelection()` operation so the controller can commit the selection and range under one load generation rather than performing two sequential history loads.

When an authoritative ready pollutant replacement changes current-hour availability, the Hex adapter MAY provide a replacement concrete range snapshot with the same `replacePollutantContext()` handoff. Loading and failed pollutant handoffs retain the existing concrete range until authoritative ready entries are available.

An AQI-source-only switch MUST continue to snapshot and preserve the exact already-displayed x-domain. It MUST NOT re-run this endpoint policy merely because the AQI source changed.

This Hex-specific endpoint policy does not authorise page adapters to maintain a competing authoritative chart range. They resolve range intent and provide an immutable snapshot; `station-chart-controller.js` owns the committed range and subsequent request/render orchestration.

## Pollutant-context ownership

The shared pollutant-context subsystem owns the chart's target/rendered pollutant transition state and coordinates atomic context replacement with `station-chart-controller.js`.

Target pollutant, rendered pollutant, load pollutant and pollutant-transition generation MUST remain distinct where required to reject obsolete work.

A page adapter may report target data readiness and provide authoritative target entries. It MUST NOT implement a second pollutant-transition state machine.

[`pollutant-switch-contract.md`](pollutant-switch-contract.md) is the narrower authority for user-visible pollutant replacement behaviour.

[`pollutant-context-handoff-contract.md`](pollutant-context-handoff-contract.md) is the narrower authority for the atomic controller handoff and its context guard.

## AQI-source controller ownership

`aqi-source-controller.js` is the sole owner of AQI-source-switch state.

It owns:

- source-switch generation or token;
- exact displayed-range snapshot;
- old-layer clearing;
- the approximately 50 millisecond transition;
- whether target AQI work is required;
- atomic staging and one visible commit;
- cancellation and obsolete-result rejection;
- AQI-local terminal diagnostics.

It MUST NOT own observation fetching, observation rendering, x-axis changes, y-axis changes or full-chart loading state.

### AQI-source switch sequence

For an already displayed chart:

1. snapshot the exact displayed x-domain;
2. invalidate any older source switch;
3. clear the old AQI layer immediately;
4. start the approximately 50 millisecond transition immediately;
5. inspect AQI settlement for the exact displayed range;
6. start no AQI request when the target range is settled;
7. start only required AQI requests when it is not settled;
8. never start an observation request solely because AQI source changed;
9. stage AQI results without visible per-chunk repaint;
10. wait only for the transition and required AQI work;
11. commit all available target-source AQI bands once;
12. leave hours without a valid AQI value blank;
13. return without repainting retained observation lines, symbols, axes or guideline layers.

A settled cached switch SHOULD normally finish in about 50 milliseconds plus one JavaScript and SVG update turn.

An uncached switch MAY take longer only while required AQI requests complete.

## Renderer ownership

`station-chart-renderer.js` is the sole owner of D3 and SVG chart drawing.

It owns:

- chart frame creation and destruction;
- x-axis and y-axis rendering;
- observation paths and symbols;
- AQI band layers;
- guideline and chart overlays;
- tooltip geometry and series highlighting;
- resize behaviour;
- incremental drawing methods.

It MUST expose narrow operations equivalent to:

```text
initialise(frame)
renderObservations(state)
renderAqi(state)
clearAqi()
renderAxes(state)
resize(dimensions)
destroy()
```

The renderer MUST NOT:

- fetch data;
- interpret API completeness;
- own request tokens;
- decide whether a range is settled;
- choose the AQI source;
- set page-wide status messages.

An AQI-only render MUST NOT rebuild observation paths or axes when the displayed range and y-domain are unchanged.

### Shared horizontal Y-grid

The renderer MUST draw the shared horizontal reference grid defined by [`../website_ui/shared-line-chart-presentation-contract.md`](../website_ui/shared-line-chart-presentation-contract.md):

- one subtle dotted/short-dash horizontal line for each visible Y-axis tick;
- grid geometry derived from the same authoritative Y-scale/tick positions as the rendered axis;
- grid behind observation paths, AQI/guideline overlays where appropriate, tooltips and interactive highlights;
- no general vertical grid lines.

This is a presentation-only change. It MUST NOT alter Y-domain calculation, tick values, observation values, AQI bands, guideline semantics, tooltip selection or chart request behaviour.

## Multi-series hover and tooltip interaction

Hover selection MUST follow the visible segmented series rather than an invisible continuous interpolation across gaps.

For a pointer position over the chart:

1. pointer X establishes the chart time to evaluate;
2. every visible rendered segmented series is evaluated at that time using its rendered segment semantics;
3. pointer Y selects the nearest eligible rendered series at that time;
4. the same selected series owns both highlight and tooltip content;
5. a gap between rendered segments MUST NOT be bridged by invisible interpolation.

`ChartCore` segment semantics remain authoritative for determining where a rendered series exists and how its visible segment is evaluated.

A tooltip MUST NOT name one series while another series is highlighted for the same pointer position.

## Diagnostics ownership

`station-chart-diagnostics.js` owns bounded chart diagnostics.

It MAY record:

- request timing;
- cache hit or miss;
- selected source identity;
- request and transition generation;
- request outcome;
- response completeness and gap metadata;
- unknown diagnostic values;
- visible commit count;
- whether observation work was started or awaited.

It MUST NOT log full observation or AQI row arrays.

Diagnostics MUST NOT be awaited by the visible AQI switch.

## User-facing message contract

AQI-source switching MUST NOT use the chart-wide red error banner.

The following are never chart-wide user-facing errors:

- missing AQI hours;
- incomplete rolling context;
- partial AQI response;
- unknown calculation status;
- unknown missing reason;
- unknown partial reason;
- a successfully evaluated range with no valid AQI band;
- a retryable AQI-only request failure while the observation chart remains usable.

For any of those cases, valid AQI bands are shown and unavailable intervals remain blank.

A confirmed AQI-only transport, parsing or identity failure MAY be represented by an AQI-local unavailable state inside the AQI band area, but it MUST NOT replace, obscure or relabel the observation chart and MUST NOT leave a stale page-wide message.

The existing page-wide chart message area remains available for failures that prevent the observation chart or selected sensor data from loading accurately.

Resize MUST neither create nor clear AQI request ownership. A resize only updates geometry.

## Loading-state contract

A settled AQI-source switch MUST NOT activate full-chart loading state.

An uncached AQI-source switch MAY show only an AQI-local loading state while keeping observation lines and controls usable.

Initial chart load, range change, Refresh and added-sensor observation loading MAY use the normal chart loading and progress behaviour.

Background AQI prefetch MUST NEVER delay visible chart completion.

## Page-adapter contract

### Hex Map adapter

`/hex_map/hex-map-station-chart-adapter.js` owns only Hex Map integration, including:

- deriving selected area and map context;
- providing ordered selected sensor entries;
- mapping Hex Map sensor symbols and chips;
- reporting target pollutant readiness and entries;
- forwarding AQI-source selection;
- forwarding chart-range and Refresh controls;
- mounting and destroying the shared chart controller;
- coordinating chart entry/exit with the Hex page-mode owner;
- synchronising Hex selection presentation where required.

It MUST NOT contain cache, fetch, AQI classification or D3 path logic.

It MUST NOT own browser history, Hex network selection or authoritative chart selection/range state.

### Sensors adapter

`/sensors/sensor-station-chart-adapter.js` owns only Sensors-page integration, including:

- constructing the single selected sensor entry;
- mounting the shared chart controller;
- forwarding range and Refresh controls;
- adapting page-specific labels and layout;
- translating Sensors page/list state into the shared chart interface.

It uses the same controller, data clients, cache and renderer as Hex.

The absence of a multi-sensor AQI-source selector is a page-adapter configuration, not a different chart implementation.

Sensors code MUST NOT depend on `/hex_map/` application modules.

## Event-listener and lifecycle contract

Each mounted chart instance MUST have one controller and one set of page-adapter listeners.

The adapter MUST remove listeners and call `destroy()` when the chart is replaced or the page mode changes where the page lifecycle requires destruction.

The architecture MUST NOT create duplicate source-change, resize, Refresh or range-change handlers.

Window resize MUST call the controller's resize operation and MUST NOT reload chart data unless the displayed range or data request genuinely changes.

## Page-shell boundary

`hex_map/index.html` and `sensors/index.html` are document shells and bootstrap surfaces for the shared chart.

They MUST NOT contain implementations of:

- station-history fetch clients;
- chart caches;
- AQI settlement classification;
- AQI-source switching;
- pollutant-transition state machines;
- D3 observation or AQI drawing;
- chart error ownership;
- station-chart request scheduling.

New station-chart behaviour MUST be implemented in the shared subsystem or the appropriate page adapter rather than reintroducing an inline chart implementation.

## No dual chart architecture

The realised architecture has one active chart controller and one active renderer.

Do not reintroduce:

- an independent Hex chart controller, cache or renderer;
- an independent Sensors chart controller, cache or renderer;
- a compatibility client as a second chart architecture;
- duplicated AQI-source or pollutant-context state machines;
- a page-local copy of station-history orchestration.

Compatibility clients and ESM interface modules MUST delegate to the authoritative implementation.

## Preserved behaviour

The shared chart architecture preserves:

- maximum selected-sensor count and symbol ordering;
- chart-range controls;
- existing concentration-line values;
- exact hour-ending AQI band alignment;
- DAQI and European AQI labels and colours;
- blank intervals for missing AQI;
- observation and AQI source precedence;
- continuity-aware calculated AQI;
- no browser-side AQI calculation;
- bounded network concurrency;
- newest-first historical work planning;
- ordered settlement where required;
- background AQI prefetch;
- exact displayed-range reuse during AQI-source switching;
- approximately 50 millisecond settled source-switch transition;
- no observation refetch or repaint for AQI-only source changes;
- feature-controlled compatibility data source;
- segmented multi-series hover semantics;
- TEST-only scope until separately approved for LIVE.

## Explicit non-goals

This contract does not:

- change Worker routes or response calculation;
- change AQI breakpoints, averaging or supported pollutants;
- change R2 object layouts;
- change continuity families or physical identity;
- create AQI rows in Supabase;
- redesign the map or sensor-list product;
- add a frontend framework;
- require TypeScript or a build system;
- introduce browser-side AQI calculation;
- remove the compatibility data source before the existing feature rollback requirement is deliberately retired;
- modify LIVE repositories.

## Structural validation

Before deployment, use only the smallest checks needed to establish structural viability:

- syntax or module-import parsing for changed files;
- one directly relevant existing shared-loader or chart harness when affected;
- confirmation that page adapters resolve their imports;
- `git diff --check`.

Do not create a broad speculative test suite for the refactor.

Functional validation occurs after deployment through real TEST pages.

## TEST operational acceptance

The modular chart is accepted when normal TEST operation confirms:

1. the Hex Map chart loads multiple selected sensors;
2. the Sensors page loads the same shared chart for one sensor;
3. a settled AQI source switch clears old bands and commits new bands once in about 50 milliseconds;
4. AQI gaps remain blank without a chart-wide red error;
5. changing AQI source starts no observation request;
6. retained observation lines and axes do not repaint during an AQI-only switch;
7. a first uncached AQI source may wait for AQI data, then becomes a fast cache hit;
8. resize changes geometry only and does not clear or create AQI errors;
9. range change and Refresh still perform their intended data loads;
10. compatibility mode uses the same controller and renderer;
11. no duplicate event listeners or visible double commits occur;
12. bounded diagnostics show one controller generation and one AQI commit for each switch;
13. multi-series hover highlights the same rendered segmented series named by the tooltip and does not bridge gaps invisibly.
14. subtle horizontal dotted/short-dash grid lines align exactly with visible Y-axis ticks and remain behind the plotted data without adding vertical grid lines.

## Rollback

Rollback is code-based:

- revert the affected website implementation commit or restore the previous accepted active page wiring through normal source control;
- retain the existing calculated-history feature controls and compatibility data source;
- do not alter Worker, R2 or database state to roll back a frontend module change;
- do not use archived page code as an active runtime fallback.
