# Three-day older-history comparison

Implementation handover for the protected TEST page only. Structural checks do
not establish real TEST acceptance or CPU savings. No merge or deployment is
included, and LIVE, TEST Ops, Worker policy, publication and data are unchanged.

## Controls and cache ownership

`Calculated older chunks` defaults to 3 days (72 hours); 7 days is the baseline.
The adapter passes the selected duration explicitly to the existing controller
`olderChunkMs` option for calculated and hybrid sources. It never changes the
shared default or sends a head-size override to the API. The seven-day option is
explicit for every comparison range, rather than depending on its window label.

Changing Source, UTC interval or chunk size destroys the controller, aborts its
work and disables Refresh until Load. Load / repeat creates a fresh controller
and its own calculated coverage records; the cache contract also includes the
selected span. Refresh retains the same controller and normal cache/retry
semantics. Downloaded configuration belongs to the recorded run, even if the
controls have subsequently changed. Late transport events from an old run are
discarded. Source, Range, Load / repeat, Refresh and diagnostics download remain.

September is labelled `30d`, and August–September `61d`; all UTC bounds are
unchanged. `chart-core.js` adds only those two symbol-interval aliases to retain
the old monthly/two-month marker density. Existing ordinary-chart intervals and
Hex Map/Sensors adapters are unchanged.

## Hybrid and JSON

The hybrid's existing month partitioning still chooses each source from the
authenticated selector. Calculated fallback older intervals are at most the
selected 72/168 hours and may be shorter at a month or requested-range boundary.
The initial calculated stable head remains governed by the Worker (normally
seven days). Existing stable-head/cursor ownership, ordered settlement,
cancellation and non-overlapping visible interval ownership are unchanged.

Hybrid work items may divide cached JSON presentation more finely. The unchanged
JSON reader shares in-flight product reads by abort signal and immutable
publication identity, then reuses the shared pubID/digest-keyed object cache.
There is no extra monthly object fetch caused by this partition alone. JSON-only
keeps its previous controller presentation spans (6 hours for the day fixture,
3 days for a single-month fixture, 7 days for two months), independently of the
experimental selection. Its control is disabled and diagnostics report
`older_chunk_ms: null`. Monthly publication selection, Refresh/pubID checks,
fail-closed errors and fallback eligibility are unchanged for both providers.

## PM context and correctness

Read-only review of TEST Ops `buildCalculatedHistory` confirms it computes
`requiredStartMs = outputStartMs - 23 hours` for every independent AQI-enabled
PM request. Older routing also independently selects `contextHours = 23`.
Neither implementation is changed. No request receives rolling state or hidden
observations from another browser request. Repeated context reads are expected.

Server-side `aqilevels_hourly_v3`, precision, 24-hour PM rolling calculation,
UTC hour-ending AQI ownership, canonical R2 precedence, physical identity,
continuity, observation multiplicity, natural gaps, independent completeness
and the hybrid's explicitly incomplete source seams remain with existing owners.

## Diagnostics

Schema 2 downloads identify the run, source, exact range, selected and effective
chunk spans, start time and Refresh status. The shared measured-fetch helper,
used by this page, records request IDs, initial stable head versus older-history
requests, UTC bounds, HTTP status, cache headers, header/body/parse and settlement
elapsed timings, HTTP/network/body failures, and response metadata without row
arrays or authentication values. Calculated response metadata includes the R2
observation fetch count where reported, actual output/context/head boundaries,
independent observations/AQI completeness and partial/gap reasons. Hybrid source,
publication and seam diagnostics are retained. The controller's existing
observation-coverage summary additionally exposes bounded UTC uncovered/partial
intervals alongside its counts; this does not change planning or settlement.

First-visible-line, cache/render timings and full settlement remain available.
Events are bounded at 2,000 and downloads expose `dropped_events`; interval lists
are bounded at 16, with total interval counts retained. Browser times are elapsed
wall time. Cloudflare telemetry alone determines Worker CPU.

## Files and archives

Active changes: `historical-json-chart-test/index.html`, `viewer.js`,
`shared/station-chart/station-chart-diagnostics.js`,
`shared/station-chart/station-chart-controller.js` (coverage diagnostics only),
and `chart-core.js` (marker aliases only), plus this handover.

New exact pre-change archives under `Archive/2026-11-03/` preserve
`chart-core.js`, `shared/station-chart/station-chart-diagnostics.js` and
`shared/station-chart/station-chart-controller.js`. Existing same-day
`historical-json-chart-test/{index.html,viewer.js}` archives are reused unchanged
as required by AGENTS.md; they are the day's earlier snapshots, before the
hybrid addition. The PR parent preserves the exact immediate pre-task adapter.
No active asset references archives. Roll back by a separately authorised revert
of this PR and the usual Pages process; do not activate archive paths.

## Structural validation

- JavaScript syntax for changed scripts and shared runtime import/interface
  resolution (browser globals stubbed, no renderer execution).
- HTML parsing, unique IDs, control bindings and local asset resolution.
- Focused adapter configuration check: explicit 72/168-hour options, controller
  destruction, unchanged exact UTC day counts and JSON-only partitioning.
- Focused measured-fetch check: unchanged returned payload, request mode/status,
  independent completeness/context/R2 metadata, received and failure timings,
  and exclusion of row/auth values. Marker interval aliases retain old cadence.
- Exact new archive byte comparisons and `git diff --check`.

These are local structural checks only, not a new automated frontend suite.

## Required real TEST validation after separate deployment authorisation

The existing `Deploy GH Pages` workflow runs on pushes to `main`; do not merge
or dispatch it as part of this PR. When separately authorised, use that existing
Pages process without new Worker or workflow configuration. Retain the pilot's
Access/alternative-host release checks.

For AURN PM10 physical timeseries 43, compare 3-day and 7-day runs on September
calculated, August–September calculated, and August–September hybrid. Save each
download, distinguishing Load / repeat from Refresh and cache states. Check
chunk/head/cursor boundaries, independent observation/AQI completeness, natural
and unresolved gaps, failed/uncovered intervals, source seams, no duplicate
boundary observations/AQI endpoints, Refresh and cancellation. Confirm hybrid
partitioning adds no monthly object requests for the same pinned publication.

Compare total requests, total reported R2 reads, first-visible-line and full
settlement, not just individual-invocation work. Independently inspect station-
history Cloudflare CPU p50/p95/p99/maximum, requests/share over 10 ms and CPU-limit
failures, distinguishing initial head from older history and upstream Workers.
Aim for reliable uncached headroom below 10 ms, preferably 5–7 ms typical, without
a material overall regression. This implementation claims no measured savings.

## Future work and documentation handover

Three-day older requests alone cannot bring the unchanged approximately seven-
day initial head under 10 ms CPU. A separate TEST Ops review must measure its
hotspots and consider bounded preparation/serialisation or head-policy changes,
with independent PM context and all source evidence retained.

Context reuse is structurally possible inside an explicitly authenticated,
sequential, source-pinned batch with one starting 23-hour read and carried
authoritative observations. It is not supplied by today's independent requests.
A future API contract must authenticate physical/continuity membership,
algorithm and source/version/snapshot identity (including canonical precedence
and any eligible ingest seam), context bytes and completeness/gap evidence.
It must define immutable/versioned cache identity and invalidation, batch bounds,
endpoint/multiplicity ownership, expiry, cancellation, out-of-order scheduling,
retry/resume and standalone-request behavior. Failed/expired/unproven context
must require an independent authoritative read, never a browser claim of success.
A large single invocation could itself exceed the CPU budget; measure that
design separately. No such API, context-sharing or source-proof work is included.

Authoritative system_docs are unchanged. Their 3 November experiment authority
covers this implementation; ChatGPT may update its future/not-implemented status
after PR review, and record operational acceptance only after real deployment
evidence. No further behavioral contract amendment is required for this PR.
