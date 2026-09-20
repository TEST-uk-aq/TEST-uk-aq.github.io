# Hex Map responsive toolbar contract

**Status: ACTIVE TEST IMPLEMENTATION CONTRACT - STABLE >=768PX TOOLBAR GEOMETRY**

## Authority and scope

This is the narrow presentation authority for the main Hex Map toolbar at viewport widths `>=768px`, in both map mode and chart mode.

It owns:

- stable ordering and row placement of the existing main toolbar controls;
- the relationship between the left control groups and the existing right-side Live/Refresh and Networks controls;
- responsive row changes at tablet/intermediate widths;
- behaviour while the selected-area sensor list is visible, including Compact sensor-list presentation;
- the rule that resizing MUST NOT repeatedly reorder or visibly jump the controls;
- View/Region responsive presentation geometry plus atomic Pollutant and Window group geometry;
- vertical alignment of toolbar groups within a row;
- presentation-only dividers between adjacent left-side control groups;
- the boundary between CSS/container-driven responsive presentation and JavaScript relocation.

It works alongside:

- [`contract.md`](contract.md) for the shared `<768px` site boundary and shared accessibility/responsive rules;
- [`hex-map-compact-sensor-list-contract.md`](hex-map-compact-sensor-list-contract.md) for the selected-area sensor list itself when its available inline width is below `860px` at viewport widths `>=768px`;
- [`hex-map-chart-presentation-contract.md`](hex-map-chart-presentation-contract.md) for selected-sensor chips and chart-panel vertical flow;
- [`hex-map-network-panel-contract.md`](hex-map-network-panel-contract.md) for Networks-panel open/pinned responsive behaviour and Search safe-area interaction;
- [`hex-map-mobile-layout-contract.md`](hex-map-mobile-layout-contract.md) and [`hex-map-mobile-controls-contract.md`](hex-map-mobile-controls-contract.md) below `768px`;
- [`hex-map-modularisation-contract.md`](hex-map-modularisation-contract.md) for module/state ownership.

Where older contracts describe tablet/desktop toolbar distribution in a way that conflicts with this contract, this contract is the narrower authority for the main toolbar.

This contract does not change map/chart data, pollutant/window meaning, sensor selection, Network selection, API behaviour, URL/history semantics or station-chart rendering.

## Runtime finding that prompted this revision

Real TEST operation on 16 September 2026 showed visible control-row jumping while continuously resizing the browser in all four checked browsers: Chrome, Firefox, Edge and Opera.

The problem was especially obvious when the selected-area sensor list was visible. It occurred in both chart mode and map mode. The same resize movement was substantially less problematic when the selected-area sensor list was not present.

Inspection of the runtime showed that `hex-map-toolbar-controller.js` used a measurement-driven `scheduleTabletSearchPlacement()` path which could repeatedly restore, measure, redistribute and reparent toolbar controls from resize and ResizeObserver activity. That per-resize DOM redistribution is not an accepted presentation model for the main toolbar.

Subsequent TEST visual review on 17 September 2026 established additional presentation requirements:

- keeping Pollutant and Window internally atomic must not force the complete toolbar off the right edge;
- at `920px` and above, a pinned/expanded sidebar may reduce the toolbar's available inline width, but the toolbar responds only to its actual measured width; from `768px` through `919px`, the Hex Map-specific shared-navigation rule prevents a pinned sidebar and keeps hover expansion overlay-only, so sidebar reveal must not reduce toolbar width; the toolbar itself remains unaware of sidebar state;
- the fit reservation for Live/Refresh must be large enough for the wider normal `Loading...` status state so pressing Refresh does not create a new row transition merely because the status pill grew;
- when the wide map row no longer fits, complete groups move through deterministic intermediate row states instead of dropping earlier than necessary;
- at narrower map widths, Window may share row 2 with Pollutant before Pollutant itself can move up beside View;
- at narrower chart widths, Window and Chart range may share row 2 when they fit even though Window cannot yet join Pollutant on row 1;
- Search follows the last populated map-control row rather than assuming one fixed Compact row count;
- toolbar groups are vertically centred within their row rather than top-aligned in grid cells;
- the light-grey group dividers used by the accepted wide presentation remain part of the toolbar visual language, but only between groups that actually share the same row.

## Core stability invariant

At a fixed responsive state and component width, the main toolbar control order and row assignment MUST be deterministic.

Continuous resizing MUST NOT produce rapid back-and-forth movement, transient reordering or visible oscillation between candidate rows.

In particular, controls MUST NOT temporarily appear in orders such as:

```text
Window -> Chart range -> Pollutant
```

when the authoritative logical order is:

```text
Pollutant -> Window -> Chart range
```

Sensor-list visibility MUST NOT itself reorder the main toolbar.

The Compact sensor-list ResizeObserver MAY detect a genuine presentation-boundary transition, but it MUST NOT drive repeated per-frame DOM reparenting of the main toolbar controls.

The toolbar MUST remain wholly inside its usable inline area. Preserving an atomic control group is not permission to let the right-hand side overflow, clip or disappear off-screen. If the current row cannot contain the complete authorised groups plus the reserved right-side controls, the toolbar MUST enter its next deterministic row state.

Keep each control group on the **highest authorised row where the complete required row geometry fits**. Move a group down only when keeping it on that row would cause overlap, clipping, or violation of the required spacing. Do not move a group down early merely to create extra visual breathing room or unused space on the row above.

The fit calculation MUST reserve the width required by the wider normal status state, currently `Loading...`, together with Refresh. A layout that fits only while the shorter `Live` state is rendered is not a valid fit. The status state changing between `Live` and `Loading...` MUST NOT by itself force an otherwise avoidable toolbar row transition.

Selecting the final authorised Narrow map state MUST also constrain its CSS presentation to the authorised three-row geometry. Generic flex wrapping MUST NOT silently create a fourth row after the layout selector has chosen the Narrow state.

## Ownership principle

The existing authoritative controls and handlers MUST be reused. Do not duplicate Pollutant, Window, Chart range, View/Region, Search, Live/Refresh or Networks state merely to create a different layout.

For `>=768px`, prefer deterministic CSS Grid/Flexbox and component/container queries for row placement.

JavaScript MAY:

- move an existing control when entering or leaving a genuinely different presentation regime;
- select an explicit presentation state at a real boundary;
- relocate sensor-list-specific selection/sort controls into the Compact sensor-list toolbar.

JavaScript MUST NOT continuously solve the main toolbar layout by repeatedly measuring and reparenting control groups while the viewport is being dragged.

## Left and right alignment regions at >=768px

The main toolbar has two visual alignment regions:

- a **left-side control region** containing the View/Region context, Pollutant, Window, Chart range where applicable, and Search;
- a **right-side control region** containing Live/Refresh and, in map mode, Networks.

All left-side toolbar groups MUST be anchored to one shared left origin for their row.

All right-side toolbar groups MUST be anchored to one shared right edge, where **shared right edge means the inner right edge of the toolbar/card content box after its normal right padding/inset**.

The normal resting border/background box of Live/Refresh and Networks MUST remain wholly inside that padded content box. It MUST NOT touch, overlap or extend beyond the card border.

Do not use negative right margins, transforms, grid overflow, stretched tracks or equivalent presentation tricks that visually place the right-side controls over the card border.

Every complete control group occupying the same visual row, on either the left or right side, MUST be vertically centred within that shared row track.

Controls MUST NOT be horizontally centred, floated, or positioned within unused space between the two regions merely because that space is available.

An authorised compact presentation changes only the internal presentation of that control. It MUST NOT create a third horizontal placement lane.

Live/Refresh remains right-aligned on row 1. Networks remains right-aligned on its currently authorised row and uses the same inner padded right edge.

## View and Region relationship at >=768px

At viewport widths `>=768px`, View and Region are functionally related, but **Region remains its own responsive control**.

In Countries & Regions mode the preferred presentation is:

```text
VIEW  [United Kingdom] [Countries & Regions]  [Region selector]
```

Pollutant is a separate control group.

The governing rule is:

> Keep Region on the same row as View for as long as that row can genuinely fit. Use compact Region before relocating Region. If even compact Region cannot fit with View and the row-1 right-side reservation, Region may move to the next authorised row independently.

Therefore:

- normal Region beside View is preferred;
- if that row becomes too wide, compact Region is tried first;
- failure of `normal View + compact Region + Live/Refresh` is the trigger to try compact View, not yet to relocate Region;
- if `compact View + compact Region + Loading.../Refresh` still does not fit, Region MAY move down as its own grid/control item;
- Region moving down does NOT mean Region and Pollutant become one responsive group;
- Pollutant MUST NOT carry Region with it merely because Pollutant changes row;
- Region and Pollutant MUST remain independently measured and independently placeable;
- the same authoritative Region control/state is reused in every presentation;
- no duplicate Region control, handler, menu state, URL/history path or business logic may be introduced.

### Region and View compaction priority

For row 1 while Region is beside View:

```text
1. try normal View + normal Region
2. if that row does not fit, try normal View + compact Region
3. if that still does not fit, try compact View and retry Region on row 1
4. only then move Region to its next authorised row
```

Compact View is a presentation-only fallback of the same authoritative View control. It MAY reduce horizontal padding and/or use a modestly smaller text treatment, but it MUST retain both existing View choices, their labels, selected state, accessible names and handlers. It MUST NOT create a duplicate View control or reduce the control below an appropriate usable touch/click target. Compact View SHOULD preserve the existing outer height so entering the fallback does not increase row height.

For any row after Region has relocated:

```text
1. try normal Region
2. if that row does not fit, try compact Region
3. only then relocate another right-side reservation or use the next authorised fallback
```

After Region moves to a different row, retry normal Region there before keeping it compact. Compact Region is therefore demand-driven and row-specific, not sticky.

A compact Region selector may reduce width and may show a long value such as `Yorkshire & Humber` on two lines. Shorter values such as `London` should remain one line where they fit.

**Compact Region MUST keep the same outer control height as normal Region.** Compaction changes width and internal text treatment only. A two-line value must fit inside that fixed outer height by using appropriate internal line-height/padding. Switching between normal and compact Region MUST NOT increase toolbar row height by itself.

At narrower widths, Region is explicitly allowed to share row 2 visually with Pollutant and Window:

```text
row 1: View                                           Live | Refresh
row 2: Region | Pollutant | Window
```

That shared row is a placement result only. Region, Pollutant and Window remain three independent responsive controls.

United Kingdom mode uses the same View control with no visible Region selector and no Region width reservation.

## Atomic Pollutant and Window groups at >=768px

At viewport widths `>=768px`, **Pollutant** and **Window** remain separate atomic toolbar groups.

Normal geometry:

```text
POLLUTANT  [PM2.5] [PM10] [NO₂]
WINDOW     [<] [6 Hours] [>]
```

The Pollutant label/buttons remain one inline group.

The Window label and previous/current/next control remain one toolbar-line group. The normal selected value is one line, for example `6 Hours`.

An authorised compact Window presentation MAY render the selected value on two centred visual lines inside the existing value box, for example:

```text
[<] [  6  ] [>]
    [Hours]
```

or:

```text
[<] [ No  ] [>]
    [Limit]
```

This is a real visual line break inside the value box. Escape notation MUST NOT be exposed as visible text.

In particular, the rendered UI MUST NEVER visibly contain literal markers such as:

```text
\A
/A
\\A
\n
```

If CSS generated content or JavaScript formatting uses an escape internally, the browser must render the intended line break rather than the escape characters themselves.

The semantic/accessibility value remains the ordinary phrase such as `6 Hours` or `No Limit`.

The compact Window presentation is authorised only after the applicable row-layout fallbacks defined below have been tried. Region compaction has priority for preserving the View/Region context on row 1. In the narrow row-2 sequence, moving Networks to Search's row occurs before compacting Window.

No pollutant/window control may be hidden, reordered or separated from its label merely to manufacture space.

## Toolbar row vertical alignment

All main toolbar groups sharing a visual row at `>=768px` MUST be vertically centred within that row. This applies to both left-side and right-side groups and is independent of their horizontal alignment.

This applies to the complete group boxes/cells, including:

- View / Region context;
- Pollutant;
- Window;
- Chart range where present;
- Live / Refresh;
- Networks.

Pollutant and Window MUST NOT be top-aligned merely because their labels or controls have a different intrinsic height from neighbouring groups.

The accepted visual relationship is the existing LIVE-style centred row: labels, buttons and selectors sit around the same vertical centre line. CSS grid/flex cells should therefore use centred cross-axis alignment rather than `start` alignment unless a narrower component contract explicitly requires otherwise.

Internal control baselines may differ naturally, but the complete group container itself MUST be centred in the row. Buttons, selectors and labels inside that group MUST retain their normal internal alignment; do not use per-control top margins or offsets to fake row alignment.

## Light-grey dividers between adjacent groups

The existing light-grey vertical separators remain authorised at `>=768px` only between adjacent left-side groups on the same visual row.

The View/Region context is one left-side responsive context. No divider is inserted between View and its Region selector.

Examples:

```text
wide map row 1:
  View/Region context | Pollutant | Window
                      ^           ^

compact map row 1:
  View/Region context | Pollutant
                      ^

intermediate/narrow map row 1:
  View/Region context
  no divider

intermediate/narrow map row 2:
  Pollutant | Window
            ^

wide chart row 1:
  Pollutant | Window | Chart range
            ^        ^
```

No divider follows the final left-side group before unused space or a right-side control. A divider from a wider state MUST disappear when its neighbouring group moves to another row.

## Relationship to the Compact sensor list

At viewport widths `>=768px`, the selected-area sensor list becomes Compact when its available inline width is below `860px`.

When that list is visible or changes between Full and Compact presentation:

- the main toolbar's logical order remains unchanged;
- the main toolbar MUST NOT visibly reshuffle merely because `sensor-table-wrap` resized;
- Compact sensor-list selection/sort controls may be relocated as authorised by the Compact sensor-list contract;
- that relocation MUST remain separate from main-toolbar row distribution;
- the selected-area sensor list appearing/disappearing MUST NOT trigger a repeated toolbar geometry feedback loop.

Crossing the actual Full/Compact sensor-list boundary may cause one deliberate presentation-state update. That is different from repeatedly recalculating and moving controls on every intermediate resize frame.

## Chart-mode >=768px order and rows

Chart mode has the authoritative left-side order:

```text
Pollutant
Window
Chart range
```

The order MUST remain the same at all `>=768px` widths.

Pollutant and Window each remain one-line atomic groups as defined above. A responsive row transition may move one of those groups as a whole, but MUST NOT stack `POLLUTANT` or `WINDOW` above its own controls.

The accepted deterministic row states are:

```text
WIDE CHART TOOLBAR
row 1 left:  Pollutant | Window | Chart range
row 1 right: Live | Refresh

COMPACT CHART TOOLBAR
row 1 left:  Pollutant | Window
row 1 right: Live | Refresh
row 2 left:  Chart range

NARROW CHART TOOLBAR >=768PX
row 1 left:  Pollutant
row 1 right: Live | Refresh
row 2 left:  Window | Chart range
```

Networks is a **map-mode-only presentation control**. Chart mode MUST NOT show the Networks selector or panel at any `>=768px` width and MUST NOT reserve a Networks grid area, row, placeholder or blank lane. Entering chart mode MUST preserve the authoritative Network selection; returning to map mode restores the same selector/state.

The selected-sensor chip band follows the last actually populated chart-control row. If all chart controls fit on row 1, the chips MAY move upward to begin below row 1. If Window or Chart range occupies row 2, the chips remain below row 2. Chart mode MUST NOT create a third control row merely because Window cannot yet join Pollutant on row 1 when Window and Chart range together fit row 2.

The separators shown above are presentation dividers only and follow the row-relative divider rules in this contract.

Transitions between Narrow, Compact and Wide chart states MUST be deterministic and width-driven, not selected-sensor-count-driven and not sensor-list-content-driven.

One or more fixed component/container thresholds MAY be selected from targeted measurement of the current real controls and the right-side Live/Refresh reservation. Each chosen threshold MUST include a small tolerance so the layout does not chatter at fractional-pixel equality. Once selected, implement the thresholds as stable presentation states rather than re-solving placement on every resize event.

Do not derive a breakpoint directly from an observed browser viewport width such as a screenshot width. The threshold must protect the required **toolbar container geometry**, including complete groups, row-relative dividers, gaps and the right-side controls actually present in chart mode.

The Chart range control MUST NOT jump ahead of Pollutant or Window.

## Map-mode >=768px order and rows

Map mode has four named structural states above the mobile boundary:

```text
Wide
Compact
Intermediate
Narrow
```

Region normal/compact presentation and Region row placement are fit variants within those structural states, not separate top-level states.

### Wide

Preferred very-wide desktop presentation:

```text
row 1 left:
  View + Region | Pollutant | Window
row 1 right:
  Live | Refresh

row 2 left:
  Search
row 2 right:
  Networks
```

Try Wide with normal Region, then Wide with compact Region before leaving Wide.

### Compact

When Wide no longer fits:

```text
row 1 left:
  View + Region | Pollutant
row 1 right:
  Live | Refresh

row 2 left:
  Window
row 2 right:
  Networks

row 3 left:
  Search
```

On entering Compact, retry normal Region first. If needed, compact Region before leaving Compact.

### Intermediate

When Compact no longer fits:

```text
row 1 left:
  View + Region
row 1 right:
  Live | Refresh

row 2 left:
  Pollutant | Window
row 2 right:
  Networks

row 3 left:
  Search
```

Again, try normal Region then compact Region on row 1.

If `normal View + compact Region + Loading.../Refresh` no longer fits, try compact View with Region still on row 1 first. Only if the compact-View retry still cannot fit may Region relocate independently to row 2. This does NOT itself force Networks to move:

```text
row 1 left:
  View
row 1 right:
  Live | Refresh

row 2 left:
  Region | Pollutant | Window
row 2 right:
  Networks

row 3 left:
  Search
```

When Region first arrives on row 2, retry normal Region there. If the complete row does not fit, try compact Region there before relocating Networks.

### Narrow

Narrow is the final three-row fit regime. Region placement and Networks placement are solved independently.

If row 1 can still contain View + Region + Live/Refresh, keep Region with View.

If it cannot after compact Region and the authorised compact-View retry, place Region on row 2.

Networks remains on row 2 for as long as the complete current row-2 geometry fits. If it does not fit after any required Region compaction, move Networks to row 3:

```text
row 1:
  View                                             Live | Refresh

row 2:
  Region | Pollutant | Window

row 3:
  Search                                           Networks
```

or, when Region can still remain with View:

```text
row 1:
  View + Region                                    Live | Refresh

row 2:
  Pollutant | Window

row 3:
  Search                                           Networks
```

After Networks moves, retry normal Region on row 2 if Region is there and the newly freed row width permits it. Otherwise use compact Region.

Only after Networks relocation and required Region compaction have been exhausted may Window compact.

If the complete authorised Narrow candidate then fits on rows 1 and 2 but the shared Search/Networks row is still the limiting row, Search MAY enter its authorised compact presentation. Compact Search is a width-only presentation of the same authoritative Search control. It is available only in Narrow after Networks has moved to row 3, and only when the normal Search minimum would otherwise make the complete three-row candidate invalid.

The normal Search minimum remains `340px`. Compact Search has an authorised minimum inline width of `272px`. It MUST retain the same Search field, input semantics, placeholder/label behaviour, result data, keyboard behaviour and handlers. It MUST NOT create a duplicate Search implementation or reduce the required `12px` Search-to-Networks gap.

The narrowest authorised Countries & Regions fallback is therefore:

```text
row 1:
  compact View                                     Live | Refresh

row 2:
  compact Region | Pollutant | compact Window

row 3:
  compact Search                                   Networks
```

The controls shown together on row 2 remain independent controls. They are not an atomic Region/Pollutant/Window group.

### Fit priority

The complete priority is:

```text
row 1:
  normal View + normal Region
  -> normal View + compact Region
  -> compact View + retry Region
  -> if still impossible, Region may relocate down independently

row 2 when Region is present:
  normal Region
  -> compact Region
  -> if Networks prevents fit, move Networks to row 3
  -> retry normal Region after Networks moves
  -> compact Region again if needed
  -> compact Window only if still needed

row 2 when Region remains on row 1:
  Pollutant | Window + Networks
  -> move Networks to row 3 if needed
  -> compact Window only if still needed

row 3 after Networks has moved:
  normal Search + Networks
  -> compact Search only if that shared row is still the limiting geometry
```

Compact Search MUST NOT be selected merely because the viewport or sidebar is at a particular width. It is demand-driven by the actual measured Narrow candidate geometry. If compact Search allows Region to remain on row 1, Region MUST NOT be moved down merely to avoid using compact Search because Region is required to stay on the highest authorised row where the complete candidate fits.

All fit decisions above MUST use the reserved `Loading...` + Refresh width rather than the shorter instantaneous `Live` width.

Pollutant remains normal and atomic throughout unless another contract explicitly authorises changing it.

The previous four-, five- and six-row map fallbacks remain unauthorised at `>=768px`.

This three-row maximum applies to **every rendered map state and every transition between states**, not only the final settled layout. Once the final Narrow candidate is selected, the implementation MUST keep Region/Pollutant/Window on their authorised row 2 using the preceding compact fallbacks as necessary; ordinary flex wrapping is not an authorised extra fallback. A narrowing toolbar MUST NOT temporarily pass through a four-row state such as:

```text
row 1: View / Live | Refresh
row 2: Region | Pollutant
row 3: Window
row 4: Search | Networks
```

If normal Window no longer fits the authorised row-2 geometry after the preceding Region/Networks fallbacks, the next candidate is compact Window **on the same row 2**. Window MUST NOT be moved to its own extra map-control row merely as an intermediate width state.

### Vertical alignment

- Live/Refresh is vertically centred against whatever complete left-side content genuinely occupies row 1;
- if Region is beside View, its height contributes to row 1;
- if Region relocates, row 1 height is determined by View rather than Region;
- Pollutant, Window and Region are vertically centred within row 2 when they share that row;
- Networks is vertically centred against row-2 content while it remains on row 2;
- after Networks moves to row 3, it is vertically centred against Search;
- compact Region has the same outer height as normal Region and MUST NOT make its row taller merely because its text uses two lines;
- compact Window may make row 2 taller.

### Targeted structural viability checks

Before implementation, measure the transition/fallback candidates rather than requiring Region to stay with View at 768px:

1. `View + normal Region + Live/Refresh`;
2. `View + compact Region + Live/Refresh` as the Region-relocation threshold;
3. Wide and Compact row-1 candidates with normal and compact Region;
4. Intermediate `Pollutant | Window + Networks`;
5. relocated-Region row 2 with normal Region and with compact Region, first with Networks and then without it;
6. narrow row 2 `Pollutant | Window`;
7. narrow row 2 with compact Window;
8. minimum-width fallback `compact Region | Pollutant | compact Window` when Region has relocated;
9. shared `Search + Networks` row after Networks relocation.

The minimum-width stop conditions are the final authorised fallbacks:

```text
row 1: compact View + Live/Refresh
row 2: compact Region | Pollutant | compact Window   (when Region has relocated)
row 3: compact Search + Networks
```

The compact Search minimum is `272px`; the normal Search minimum remains `340px`.

If those final fallbacks cannot fit at an actually supported measured `>=768px` toolbar width, stop and report the measured deficit. Failure of `normal View + compact Region + Loading.../Refresh` alone is NOT a stop condition; compact View must be tried next. Failure of the compact-View candidate is the signal that Region may relocate.

## Historical measured narrow geometry and retained compact Search

Targeted geometry review on 20 September 2026 established that the previously authorised final Search/Networks row could not fit when a `768px` Hex Map viewport was allowed to keep the shared sidebar expanded and consume `212px` of layout width.

That sidebar-induced state is no longer an authorised Hex Map presentation from `768px` through `919px`: the sidebar must now remain Mini for layout purposes and any hover expansion overlays the page. The measurement below is retained as the evidence that authorised compact toolbar fallbacks must remain capable of handling genuinely constrained toolbar containers caused by other geometry, rather than as a required sidebar state.

The historical measured/calculated geometry was:

```text
viewport                                      768px
expanded sidebar body offset                -212px
remaining body content                       556px
main horizontal padding                     - 56px
map-card border + horizontal padding        - 38px
map-controls content                         462px
toolbar inline padding                      - 16px
controller availableWidth                    446px
```

The normal final row required:

```text
Search minimum                               340px
Search-to-Networks gap                        12px
Networks pill                              146.45px
required                                   498.45px
deficit                                     52.45px
```

The limiting row was therefore row 3, not row 1 or row 2. Adding another map row or allowing ordinary flex wrapping remains prohibited.

The authorised resolution is a Narrow-only compact Search minimum of `272px`:

```text
compact Search                               272px
Search-to-Networks gap                        12px
Networks pill                              146.45px
required                                   430.45px
available                                    446px
measured headroom                            15.55px
```

This value remains an authorised component minimum derived from measured constrained-toolbar geometry. It MUST NOT be implemented as a sidebar-specific rule or a new toolbar viewport breakpoint. The separate `920px` Hex Map sidebar rule governs navigation occupancy only and MUST NOT directly select compact Search or another toolbar candidate.

## Search placement

Search follows the authorised structural state.

In Wide it may share row 2 with Networks:

```text
row 2 left:  Search
row 2 right: Networks
```

In Compact and Intermediate, Search normally occupies row 3 while Networks remains on row 2.

In Narrow, Networks moves to row 3 only when the complete current row-2 geometry no longer fits after any authorised Region compaction:

```text
row 3 left:  Search
row 3 right: Networks
```

Region relocation by itself does NOT require Networks relocation. If Region moves to row 2 and that complete row still fits with Networks, Search remains alone on row 3.

When Search shares a row with Networks, Search is left-aligned to the shared left control origin and uses only the space remaining before the Networks reservation.

Its right edge MUST stop before Networks with the normal deliberate gap. Search MUST NOT pass underneath Networks or force Networks beyond the inner padded right edge.

Normal Search keeps its `340px` minimum. In Narrow only, after Networks has moved to row 3, Search MAY use the compact `272px` minimum when the normal Search width is the limiting geometry for an otherwise valid three-row candidate. This compaction changes only the Search control's width allocation. It MUST NOT change Search semantics, text size, result behaviour or the required `12px` gap to Networks.

Compacting or relocating Region, compacting Window, or compacting Search MUST NOT create row 4.

Search interaction and Networks-panel safe-width behaviour remain governed by the existing Search and Networks-panel contracts.

## Right-side controls

Live/Refresh retain their existing state and controls in both map mode and chart mode.

Networks retains its authoritative selection state but is presented only in map mode. Entering chart mode MUST suppress the Networks trigger/panel and any layout reservation for it without clearing Network selection.

Live/Refresh remains row 1 right.

The toolbar fit reservation for this right-side pair MUST use the width required by the wider normal status state, currently `Loading...`, even while `Live` is displayed. The rendered pill may still contract visually to `Live`; only the fit reservation remains large enough to guarantee that entering `Loading...` does not unexpectedly force another toolbar layout.

Networks remains on its higher authorised row for as long as the **complete current row geometry** fits:

- Wide: row 2;
- Compact: row 2;
- Intermediate: row 2;
- Narrow: row 2 if it still fits, otherwise row 3.

If Region has relocated to row 2, Region is part of that row's fit calculation but remains an independent control. Try the authorised Region width treatment before deciding Networks must move.

Once Networks moves to row 3, Search shares that row on the left.

Both controls align to the same **inner padded right edge** of the toolbar/card content box.

Their normal resting border/background boxes MUST remain fully inside the card. They MUST NOT overlap the card's right border.

Networks uses its normal/natural content width. Moving it to row 3 is preferred over compacting Window merely to preserve Networks on row 2.

A candidate state is invalid if a right-side control overlaps the card border, clips, overflows, or forces another required control underneath it.

## Hex Map constrained-width sidebar behaviour

The toolbar remains width-driven, but the surrounding Hex Map navigation has an explicit presentation rule to avoid manufacturing an unnecessarily narrow toolbar merely because the sidebar is pinned.

For `body.hex-map-page`:

```text
<768px       existing mobile drawer behaviour
768-919px    Mini sidebar reserves 64px; hover-expanded sidebar overlays the page
>=920px      existing normal tablet/desktop sidebar pin and layout-width behaviour
```

From `768px` through `919px`:

- the sidebar MUST settle to Mini and reserve only `64px` of page width;
- permanent/pinned expansion MUST be unavailable;
- if pinning was on when this range is entered, pinning MUST be turned off and that off state persisted;
- the hamburger MUST remain visually off and MUST NOT toggle or pin the sidebar;
- the disabled hamburger MUST NOT use its normal hover lift or shadow affordance;
- hover over the sidebar/navigation hover region MUST still be able to reveal the full `212px` sidebar so icon meanings remain discoverable;
- the additional expanded width MUST overlay the Hex Map instead of changing body padding or narrowing the page;
- hover expansion therefore MUST NOT trigger a toolbar-width reduction or toolbar candidate transition;
- leaving the hover region MUST collapse the sidebar back to Mini;
- this presentation MUST NOT use the mobile `DRAWER` state or mobile overlay/backdrop semantics.

Other pages are outside this exception and retain their existing shared-sidebar behaviour.

## Responsive thresholds

The shared `768px` mobile boundary remains fixed.

The Hex Map has one separate navigation-occupancy boundary at `920px`: from `768px` through `919px`, the shared sidebar rests at its `64px` Mini width, cannot be pinned, and may expand only as an overlay on hover; at `920px` and above, normal tablet/desktop pinning and layout-width behaviour applies. This is not a toolbar-state breakpoint and does not change the `768px` mobile boundary.

Selection among `>=768px` map/chart toolbar presentation states remains geometry-driven under the dynamic-fit amendment. Observed screenshot widths and old fixed values such as `830px` or `910px` are diagnostic only and are not authoritative toolbar-state boundaries.

The selector responds to the toolbar's actual available inline width. It MUST NOT special-case sidebar state, the `920px` navigation boundary, browser resizing, DevTools, a window split or another surrounding layout change. At `920px` and above a pinned sidebar may still reduce the measured width; from `768px` through `919px`, hover expansion is overlay-only and therefore must not change the toolbar's measured available width.

Fit calculations include the complete normal or authorised compact controls, same-row dividers/gaps and the right-side reservations present in that candidate state.

A candidate state does not fit if it requires clipping, overlap, unauthorised group splitting or pushing a right-side control outside the usable toolbar area.

The minimum-width checks for the final authorised row-1, row-2 and row-3 fallbacks are targeted structural viability checks, not new hard-coded breakpoints. `normal View + compact Region + Loading.../Refresh` is a transition measurement that determines when compact View must be tried, not a minimum-width stop condition. Compact Search's `272px` minimum is a component presentation constraint, not a viewport breakpoint.

## Below 768px

This contract does not redesign Narrow/mobile controls.

Below `768px`, continue to follow the mobile layout/control contracts. Existing mobile control relocation may use the current dedicated mobile mounts because that is a distinct presentation regime, not a continuously solved tablet/desktop row allocator.

## Implementation direction

Implementation ownership is split deliberately:

```text
/sidebar.js                         Hex Map-only 768-919px sidebar Mini/hover-overlay rule
/hex_map/hex-map.css                toolbar presentation
/hex_map/hex-map-toolbar-controller.js  toolbar geometry/state selection
```

The sidebar rule MUST stay in the existing shared navigation implementation and MUST NOT be reimplemented inside Hex Map toolbar code. The preferred toolbar implementation remains primarily CSS/container-driven at `>=768px`.

The current toolbar controller should retain only genuine presentation-regime relocation and authoritative DOM ownership. Do not reintroduce the removed greedy resize-time distributor.

For the atomic Pollutant/Window rule, keep their existing label and controls in stable one-line group containers.

For map row packing, prefer explicit CSS/grid structural states for Wide, Compact, Intermediate and Narrow. Try normal Region, then compact Region, then compact View with Region retried on row 1. If Region can still no longer remain with View, relocate Region independently to row 2. Networks then remains on row 2 while the complete current row fits; Networks relocation precedes Window compaction. The final Narrow CSS state must prevent generic flex wrapping from manufacturing a fourth control row. Do not treat Region and Pollutant as one responsive group merely because they share row 2.

Fit-state measurement should reserve the width of the wider normal status presentation, currently `Loading...` + Refresh, rather than measuring only the status text currently visible.

For the final Narrow Search row, retain the normal `340px` Search minimum until the normal Search/Networks row is the limiting geometry. Only then may the same Search control use its authorised compact `272px` minimum. Do not key this presentation to sidebar state or a viewport breakpoint.

For chart row packing, prefer explicit Narrow, Compact and Wide states. At Narrow chart widths, Window and Chart range share row 2 when their combined geometry fits; do not reserve a third row merely because Window cannot yet fit on row 1.

For vertical alignment, centre the actual row/group grid or flex items rather than patching individual control margins.

For dividers, prefer state-aware CSS borders/pseudo-elements that reflect which groups share a row. Do not add permanent separators that remain after a group moves to another line.

Do not remove JavaScript relocation that is genuinely required for:

- entering/leaving Narrow mobile presentation;
- active UK/Countries & Regions ownership;
- moving the existing compact sensor-list selection/sort controls;
- state/handler ownership unrelated to layout solving.

Keep the change narrow to presentation ownership.

## Invariants

This work MUST NOT deliberately change:

```text
Pollutant meaning or selection state
Window meaning or selection state
Chart-range meaning or selection state
View / Region semantics
Search behaviour/data semantics
Live / Refresh behaviour
Network-selection state or persistence
sensor-selection semantics
selected-sensor order or maximum
AQI-source semantics
station-chart data/loading/rendering
API requests
URL/history semantics
UK/Countries & Regions data behaviour
Networks panel open/pinned semantics owned by the Networks-panel contract
```

## Validation rule

Before implementation, perform only targeted structural checks needed to establish:

- which current DOM nodes are authoritative;
- whether Region can remain independently placeable from Pollutant while reusing one authoritative state/control;
- whether normal and compact Region geometries can be measured on row 1 and, after relocation, on row 2;
- whether compact Region has the same rendered outer height as normal Region in both placements;
- whether compact Region is tried before compact View, and compact View is tried before Region leaves View's row;
- whether compact View preserves the same authoritative View choices/state and an appropriate usable control height;
- whether failure of `compact View + compact Region + Loading.../Refresh` triggers Region relocation rather than a stop;
- whether the fit reservation uses the wider `Loading...` status state even while `Live` is displayed;
- whether Region is retried at normal width after relocation or after Networks moves;
- whether Pollutant and Window retain separate stable group containers;
- whether Networks remains row 2 until the complete current row genuinely fails;
- whether Networks relocation from row 2 to row 3 occurs before Window compaction;
- whether map-mode state selection can move directly between authorised three-row variants without ever rendering a transient fourth row;
- whether normal and compact Window geometry can be measured deterministically;
- whether compact Window renders a real line break with no visible `\A`, `/A`, `\\A` or `\n` marker;
- whether Search and Networks can share their authorised row without overlap;
- whether normal Search remains at its `340px` minimum until the Narrow Search/Networks row is genuinely limiting;
- whether compact Search uses the same authoritative Search control at a `272px` minimum without changing Search semantics or the required `12px` gap;
- whether Live/Refresh and Networks align to the inner padded right edge and remain wholly inside the card border;
- whether state selection can occur without a measurement/layout feedback loop.

The targeted minimum-width viability checks are:

```text
compact View + Live/Refresh
compact Region | Pollutant | compact Window   when Region has relocated
compact Search + Networks shared row
right-side controls inside padded card edge
```

`View + compact Region + Live/Refresh` is an intermediate measurement only. Compact View MUST be tried next, using the wider `Loading...` + Refresh reservation. Failure of that compact-View candidate is the signal that Region may leave View's row; it is NOT a reason to stop.

If one of the final minimum-width fallback rows fails, report the measured deficit before changing the contract or adding rows.

Do not create a speculative browser/screenshot test suite before implementation.

After deployment to TEST, perform real visual/functional acceptance by continuously resizing.

Acceptance MUST cover:

```text
Hex Map sidebar:
  <768px: existing mobile drawer unchanged
  768-919px: Mini sidebar remains visible and reserves only 64px
  768-919px: any prior pinned/always-on state is turned off and persisted off
  768-919px: hamburger remains off/non-interactive with no hover lift or shadow
  768-919px: sidebar can still expand on hover to reveal labels
  768-919px: hover expansion overlays the page and does not change Hex Map/page/toolbar width
  768-919px: leaving the hover region collapses back to Mini
  >=920px: existing normal pin/unpin and layout-width behaviour resumes
  other pages: existing sidebar behaviour unchanged
map mode >=768px:
  Wide:
    row 1 View + Region | Pollutant | Window / Live+Refresh
    row 2 Search / Networks

  Compact:
    Region stays with View while normal or compact Region fits
    Window moves independently

  Intermediate:
    prefer row 1 View + Region / Live+Refresh
    row 2 Pollutant | Window / Networks
    row 3 Search

  Narrow:
    if compact Region no longer fits beside View, Region moves independently to row 2
    Region may visually share row 2 with Pollutant and Window without becoming their group
    Networks stays row 2 only while the complete current row fits
    Networks moves to Search row when required
    Window compacts only after Networks relocation and Region width options are exhausted
    Search compacts to its authorised 272px minimum only when Networks is on row 3 and normal Search is the limiting geometry

  compact Region is tried before compact View, and compact View is tried before Region leaves View's row
  compact View preserves both View choices/state and does not create a duplicate control
  layout fit reserves Loading... + Refresh width even while Live is displayed
  compact Region keeps the same outer height as normal Region
  Region is retried at normal width after relocation or newly freed space
  Region and Pollutant remain independently measured/placed
  normal Window transitions directly to compact Window within the same three-row geometry when required
  no transient 3-row -> 4-row -> 3-row map sequence
  compact Window shows real line breaks with no visible escape notation
  Live/Refresh and Networks remain inside the padded card edge
  no fourth/fifth/sixth map-toolbar row
  no clipping, overflow, floating controls or resize chatter

chart mode >=768px:
  existing chart Wide / Compact / Narrow / Wrapped / Stacked rules remain intact
  no Networks presentation or reservation
```

No data/state semantics are changed by this presentation contract.
