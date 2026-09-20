# Public website responsive UI contract

## Authority

This is the authoritative presentation and interaction contract for the public UK AQ website shell.

It governs shared responsive architecture, mobile operability and presentation boundaries without changing website data, API or scientific contracts.

Narrower active contracts under `system_docs/website_ui/` take precedence for their explicitly defined component or page scope.

For the authorised Hex Map narrow-screen Phase 1 implementation, [`hex-map-mobile-layout-contract.md`](hex-map-mobile-layout-contract.md) is the narrower active authority. Its fuller design source and implementation plan are retained under `plans/drafts/website_ui/` as non-authoritative planning material. Later Hex Map mobile phases remain deferred unless and until separately accepted into active authority.

## Required architecture

The public website MUST remain one application across desktop and mobile widths.

Desktop and mobile presentations MUST share:

- the same public URLs;
- the same API and cache-proxy routes;
- the same database-backed and R2-backed data products;
- the same observation, AQI and WHO meanings;
- the same page state and business rules where those rules are not presentation-specific.

A separate mobile website, separate mobile API, duplicated mobile business-logic tree or duplicated mobile chart implementation MUST NOT be introduced.

Responsive work is a presentation and interaction adaptation of the existing application.

## Mobile boundary

The shared mobile boundary is:

```text
viewport width < 768 CSS pixels
```

This matches the existing mobile drawer boundary in `/sidebar.js`.

Existing narrower component-specific breakpoints such as `720px` and `640px` MAY remain where they refine an individual component. New responsive work MUST NOT introduce another competing site-wide mobile boundary without an intentional contract update.

Viewport capability and available width, not user-agent device detection, MUST determine the responsive presentation.

## Desktop isolation

For viewport widths of `768px` and above:

- existing desktop and tablet presentation and behaviour MUST remain unchanged unless a narrower active contract intentionally changes them;
- mobile-only CSS MUST NOT apply;
- mobile-only JavaScript, where required by an active contract, MUST NOT initialise outside its intended responsive scope;
- existing API requests, chart loading, map state and navigation logic MUST NOT change merely to support narrow screens.

A shared file such as `/mobile.css` MAY provide narrow-screen presentation and SHOULD load after the page's existing styles.

Page-specific responsive presentation MAY live in the page's authoritative stylesheet where its active architecture contract assigns ownership there.

Mobile-only JavaScript SHOULD be avoided where CSS and existing semantic controls are sufficient. Where responsive JavaScript is genuinely required, it MUST reuse existing application state and functions rather than duplicate them.

## Shared navigation

`/sidebar.js` remains the shared navigation implementation.

Its mobile drawer behaviour MUST preserve:

- viewport widths below `768px` use the drawer state;
- the hamburger opens and closes the drawer;
- the overlay closes an open drawer;
- desktop hover and pin behaviour remains desktop-only;
- responsive work MUST NOT create a second navigation implementation.

The hamburger's approximately `44px × 44px` effective control remains the reference minimum interaction size for mobile controls.

Narrower shared-header behaviour is defined by [`mobile-header-contract.md`](mobile-header-contract.md).

## Mobile touch targets

On mobile widths, primary interactive controls MUST provide an effective touch target of at least approximately `44px × 44px` CSS pixels unless the control is part of a larger tappable parent that already meets that target.

The visible glyph MAY remain smaller. The effective button, label or hit area MUST provide the target.

This applies particularly to icon-only actions and close, pin, settings, select-all and clear-all controls.

Touch-target enlargement MUST NOT change a control's meaning, selected state, disabled state, accessible name or underlying action.

## Interaction equivalence

A primary user action MUST NOT require hover on a mobile-width presentation.

Hover styles MAY remain desktop enhancements, but any action needed to navigate, open or close a panel, select an option, refresh data, change a setting or enter/leave a page mode MUST remain available through tap/click semantics.

Existing semantic `<button>`, `<a>`, `<select>`, checkbox/label and keyboard-accessible controls SHOULD be reused rather than replaced by mobile-specific duplicates.

Responsive work MUST NOT re-enable a control that is intentionally commented out, disabled or outside the current product.

## Minimum mobile operability

The following remains the shared baseline. Narrower active component contracts may define richer presentation while preserving these operability requirements.

### Shared navigation

Mobile presentation MUST preserve:

- hamburger open/close;
- drawer-overlay close;
- navigation links to enabled public pages;
- existing home-link/logo behaviour.

### Homepage

Enabled homepage controls MUST remain reliably tappable, including:

- Refresh;
- the network-picker trigger;
- network select-all and clear-all actions;
- network selection rows/checkboxes;
- enabled WHO summary range controls.

Homepage mobile behaviour is refined by [`homepage-mobile-contract.md`](homepage-mobile-contract.md), with narrower component contracts for area readings and WHO presentation.

### Hex Map

Enabled page-level Hex Map controls MUST remain reachable and tappable, including where present:

- map settings open/close;
- region and network selectors;
- network select-all and clear-all actions;
- network-panel pin control;
- chart launch/back controls;
- sensor-panel close control;
- chart-selection controls;
- existing tab or mode controls.

Responsive Hex Map work MUST NOT change Hex Map data loading, sensor-selection rules, chart calculations, chart ownership or map-data semantics unless a separate active behavioural/data contract explicitly changes them.

Hex Map module and state ownership are defined by [`hex-map-modularisation-contract.md`](hex-map-modularisation-contract.md).

The current authorised map-first narrow-screen presentation is defined by [`hex-map-mobile-layout-contract.md`](hex-map-mobile-layout-contract.md).

### Sensor Map

Enabled Sensor Map controls MUST remain reachable and tappable, including:

- reading-scope selector;
- **Observed within** selector;
- Refresh;
- essential Leaflet map controls where their default target is too small for reliable touch.

`Observed within` is an observation-time filter governed by the active Latest Snapshot Sensor Map contract. Responsive work MUST NOT relabel it as `Updated within` or change its `last_value_at` semantics.

The control bar MAY wrap or stack at mobile width as needed to stay inside the viewport.

Responsive work MUST NOT change Sensor Map API requests, filtering meanings, polling/data-loading behaviour or map-marker semantics.

## Page-layout baseline

A page MUST NOT require access to a control positioned beyond the normal mobile viewport solely because a desktop fixed-width grid or minimum width remains active.

Responsive work MAY make narrow-screen layout changes needed to expose existing controls, including:

- changing a desktop multi-column grid to one column;
- allowing toolbar rows to wrap or stack;
- reducing narrow-screen page padding;
- making popovers/panels fit within viewport width;
- increasing button hit areas without increasing icon glyph size.

Unless a narrower active responsive contract explicitly extends a layout, these changes MUST remain scoped below `768px` and MUST NOT alter desktop layout.

## Hex Map narrow-screen authority

The current Hex Map map-first mobile work is no longer draft-only.

[`hex-map-mobile-layout-contract.md`](hex-map-mobile-layout-contract.md) actively authorises Phase 1 on TEST and defines the required narrow-screen hierarchy, search placement, removal of the large summary presentation above the map, increased map prominence, provisional bottom-oriented controls, ownership boundaries and desktop isolation.

That active contract deliberately stops at Phase 1. The fuller planning material under `plans/drafts/website_ui/` remains non-authoritative for later search-overlay behaviour, sensor bottom-sheet behaviour, final controls, compact summary, region labels, long press, draggable sheet mechanics and tablet-specific layouts unless those decisions are separately accepted into active authority.

All Hex Map responsive implementation MUST continue to preserve this contract's single-application rule, current module/state ownership, shared station-chart ownership, data/API/scientific meaning, accessibility, mobile touch targets and TEST/LIVE boundary.

## Station-chart boundary

Responsive website work does not create a separate station chart and does not change chart data or rendering ownership.

The active [`../station_charts/`](../station_charts/) contracts remain authoritative for:

- chart controllers;
- data clients;
- AQI-source behaviour;
- browser chart caches;
- D3/SVG rendering;
- chart diagnostics.

Hex Map and Sensors consume one shared station-chart implementation. Responsive work MAY resize or reflow the outer chart container and page controls where required, but deeper chart interaction changes belong in the station-chart area.

## Data and API invariants

Responsive work MUST NOT introduce:

- mobile-only API endpoints;
- mobile-only database queries;
- duplicated observation or AQI fetching solely because the viewport is narrow;
- browser-side AQI calculation;
- different scientific values between desktop and mobile;
- different network, pollutant or station eligibility rules between desktop and mobile.

For the same application state and data availability, responsive presentation MUST refer to the same underlying data as desktop presentation.

## Accessibility and state preservation

Responsive changes MUST preserve:

- existing accessible names and labels;
- `aria-expanded`, `aria-selected`, `aria-pressed` and disabled semantics where already used;
- keyboard focusability of semantic controls;
- visible focus handling;
- selected and disabled visual states;
- normal browser zoom behaviour.

Touch-target enlargement MUST NOT be implemented with invisible controls over unrelated content or overlapping click targets.

Overlays, popovers and bottom sheets introduced by an active narrower contract MUST have usable focus behaviour, meaningful accessible names and a clear accessible dismissal route where dismissal is part of the interaction.

## Explicit non-goals

This shared contract does not by itself:

- redesign the website visual identity;
- create separate mobile pages;
- redesign station charts;
- replace Leaflet or D3;
- change API/cache/data contracts;
- alter WHO, DAQI or European AQI calculations;
- refactor unrelated desktop code;
- modify LIVE repositories.

A narrower active page/component contract may refine presentation without changing these shared architecture and data boundaries.

## Implementation and validation rule

Responsive implementation SHOULD make the smallest changes that satisfy the applicable active contracts.

Where an existing semantic control already has a working handler, responsive work SHOULD alter only presentation or effective hit area rather than replace or rewire the handler unless the approved interaction genuinely requires a different presentation adapter.

If implementation analysis shows a control failure is caused by shared application logic rather than presentation, the task must stop on that item and report the conflict instead of broadening into an unapproved shared-logic refactor.

Before deployment, perform only structural viability checks required by the changed files and interfaces. Functional and visual validation occurs through real operation on TEST after deployment. Do not create a broad speculative pre-implementation test programme.
