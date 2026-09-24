# Shared line-chart presentation contract

## Status

**Authoritative shared website presentation contract for UK AQ line charts.**

This contract defines cross-page visual conventions that should remain consistent wherever UK AQ presents comparable line-chart data.

It owns presentation only. It does not own observation values, aggregation, AQI calculation, source precedence, chart-controller state, API requests or page-specific chart semantics.

Page-specific and subsystem contracts MAY add narrower behaviour while preserving this shared baseline.

## Current consumers

The initial required consumers are:

- the shared station-chart renderer used by Hex Map and Sensors;
- the Wood Burning Summer/Winter BC/UV profile charts.

A page MUST NOT copy the shared station-chart implementation merely to adopt these visual conventions.

## Horizontal Y-grid lines

Line charts MUST provide subtle horizontal reference/grid lines aligned with the visible Y-axis tick values.

The grid lines MUST:

- span the plotted data area rather than the outer card/container;
- sit visually behind data lines and interactive overlays;
- use a restrained light neutral grey consistent with the current UK AQ UI;
- use a dotted or short-dash treatment rather than a heavy solid rule;
- be substantially less visually prominent than the plotted data lines;
- update with the Y-axis tick positions whenever the chart scale changes.

Line charts MUST NOT add vertical grid lines merely for symmetry. A narrower chart contract may authorise a specific vertical reference line where it has an explicit data meaning.

The X and Y axes themselves may retain their existing normal axis treatment. This rule concerns reference lines through the plotted area.

## Data-line priority

Reference/grid styling MUST never compete visually with the data series.

Normal data lines SHOULD remain solid unless a narrower contract explicitly gives line pattern a semantic meaning.

Do not introduce dotted/dashed data lines merely to distinguish ordinary peer series when colour and interaction provide sufficient distinction.

## Multi-series colour

Where one chart intentionally contains multiple peer data series, colour MAY be used as the primary visible series distinction.

The colour set MUST provide useful contrast between adjacent series and against the chart background and shared grid.

Colour assignment MUST be deterministic within the chart's semantic ordering. A rerender, resize or pagination event MUST NOT arbitrarily remap the same semantic series to a different colour.

A narrower contract MAY define a fixed ordered palette or mapping.

## Legend interaction baseline

Where a chart provides an interactive series legend, each legend item MUST be a real focusable/tappable control rather than hover-only text.

An interactive legend SHOULD support selection/focus that:

- makes the selected series easy to identify;
- preserves the selected series at full visual prominence;
- visually subdues the other peer series without making them disappear completely unless a narrower contract explicitly chooses filtering;
- works by click/tap and keyboard, with hover as an optional desktop enhancement;
- exposes selected state accessibly, for example with appropriate `aria-pressed` or equivalent semantics.

At mobile widths, a primary legend action MUST NOT require precise tapping of a thin plotted line.

Selected legend presentation SHOULD reuse an established UK AQ selected-control treatment where an appropriate one exists rather than inventing a new page-specific selected style.

## Tooltip/readability boundary

Tooltips and line highlighting MAY provide exact values and series identity, but the chart must remain interpretable without hover.

Grid lines are a reading aid only. They MUST NOT imply a threshold, guideline or health category unless a separate scientific/presentation contract explicitly assigns that meaning.

## Responsive and accessibility behaviour

Shared grid and data-line conventions apply at desktop, tablet and mobile widths.

Responsive changes MAY reduce tick density where required for legibility, but every visible horizontal grid line MUST continue to correspond to an actual visible Y-axis tick.

Colour MUST NOT be used to communicate a scientific warning/category meaning unless that meaning is separately contracted.

A page-specific multi-series chart may initially rely on colour to distinguish peer series where the accompanying interactive legend lets users isolate a series. Additional symbols or line patterns MAY be added later if real TEST use shows they are needed, but they are not required by this shared contract.

## Implementation ownership

For existing station charts, implementation remains in the sole shared station-chart renderer under `/shared/station-chart/`; Hex Map and Sensors MUST NOT add independent grid layers or chart renderers.

For other pages with genuinely different chart semantics, such as Wood Burning monthly diurnal profiles, a page-specific renderer/module MAY implement the same shared visual conventions without adopting unrelated station-chart controller/data architecture.

Shared colour/grid CSS tokens SHOULD be reused where practical so visually equivalent rules do not drift between pages.

## Structural validation before implementation

Before implementation, validate only that:

- the station-chart renderer has one suitable layer/order for horizontal Y-grid lines behind the plotted data;
- the grid can consume the renderer's existing Y-scale/tick positions without creating a second scale;
- Wood Burning can use the same presentation token/treatment while retaining its separate diurnal data semantics.

No broad speculative pre-deployment visual test suite should be created.

## TEST functional and visual acceptance

After deployment, acceptance on real TEST should confirm that:

- horizontal dotted/short-dash lines align exactly with visible Y-axis ticks;
- no unrequested vertical grid is added;
- grid lines remain visually subordinate to data lines;
- chart resize/range/Y-scale changes keep grid and ticks aligned;
- existing Hex Map and Sensors chart data/interaction semantics are unchanged;
- Wood Burning charts use the same shared grid treatment;
- interactive legends, where present, remain usable by mouse, keyboard and touch.
