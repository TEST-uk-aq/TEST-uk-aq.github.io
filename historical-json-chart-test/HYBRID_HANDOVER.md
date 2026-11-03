# Isolated hybrid history reader

This implementation adds a third source to the existing protected comparison
page. It does not select the hybrid for ordinary Hex Map or Sensors charts.
The manual August 2026 PM10 series-43/station-1581 publication remains eligible
only for this pilot. No backend, data, security, publication or deployment
configuration changes are included.

## Provider boundary

`shared/station-chart/hybrid-history-client.js` composes the existing JSON and
calculated clients. It exposes `prepareLoad`, `cacheIdentity`,
`selectionExpiresAt`, `loadCurrent`, `loadOlder` and `prefetchAqi`. The shared
controller retains loading, cancellation, ordered settlement, chart caching and
rendering. There is no new transport or AQI calculation implementation.

The JSON reader has additive composition methods for inspecting a pinned month
selection, identifying its cache version and reading a bounded range. Its normal
JSON-only missing-month behavior is retained.

Only a non-redirected JSON **404 / `history_month_unavailable`** from the
configured authenticated manifest request permits
`calculated_fallback_missing_json`. Generic 404s, other statuses, network/auth
failures, stale/invalid manifests, object failures, integrity failures and
cancellation never choose another source. No HEAD or separate existence probe
is added.

## Range ownership and progression

The current request is clipped to the latest requested reporting month. JSON
owns that month or the calculated client supplies its normal stable head.
Independent section head bounds and continuation cursors are retained; earlier
months extend the same backward plan. Each older controller chunk is partitioned
again by reporting month before delegating to either client. Calculated older
requests retain the caller's stable-head boundary and cannot overlap it.

Original observations use `[S,E)` and AQI endpoints use `(S,E]`. Authenticated
terminal observation dependencies are compared against adjacent responses, and
only the displayed range's terminal dependency is retained outside original
observation ownership. Raw observation multiplicity is retained with stable
occurrence IDs. Inconsistent values, multiplicity, shared provenance fields or
AQI endpoints reject the affected join. Authenticated empty terminal inputs are
also checked against subsequently returned observations.

PM context is requested/calculated by the existing service. The hybrid never
calculates AQI or substitutes JSON observations into the calculated service.
Independent section and per-index completeness and source partial/gap reasons
remain available in results and downloadable diagnostics.

## Cache and Refresh

Selections are pinned to one per-load context. Positive and authoritative
negative selection lifetimes share the JSON reader's maximum five-minute
deadline, measured from the manifest request start. Only exact selector absence
is negatively cached. Refresh and publication checks recheck manifests;
publication/source changes produce a different controller cache identity.
Immutable objects reuse the existing shared bounded cache, keyed by physical
identity, month, source, pubID, algorithm and paired object digests. Calculated
selection identities include physical identity, month, generation and algorithm.

## Explicit limitations

- Closed reporting months only, with the existing JSON reader's maximum
  12-month range. Open/current-month stitching remains excluded.
- The existing calculated API does not return JSON edge-day/context hashes or
  all original observation status provenance. Mixed-source seams therefore carry
  `hybrid_boundary_authority_unavailable`; their observation boundary and AQI
  dependency interval remain explicitly incomplete. The PM AQI interval includes
  the preceding terminal endpoint and following 23-hour context dependency.
  Available values are retained without claiming source parity.
- Calculated generation is checked against authenticated history dependency tags
  when exposed by the service. Missing/unexposed tags produce
  `hybrid_calculated_generation_unverified`, not an inferred complete response.
  A contrary generation, algorithm or physical identity is rejected.
- Logical continuity is not joined to physical JSON publications: an enabled
  calculated continuity family is rejected pending compatible source authority.
- September is an explicit adjacent-month fixture, not a claim that it is
  unpublished. Its authenticated selector response decides the source.

## Validation and release handover

Local checks cover changed JavaScript parsing, local module/HTML references,
exact archives, and one deterministic provider-interface check with synthetic
responses (selection classification, stable-head cursor, independent partials,
month endpoint ownership, multiplicity, immutable object reuse, Refresh and
abort). These checks establish structure, not real TEST acceptance or CPU savings.

Exact pre-change copies of `historical-json-client.js`,
`station-chart-runtime.js`, `viewer.js` and `index.html` are preserved under
`Archive/2026-11-03/`, retaining their repository-relative paths.

Do not merge or deploy as part of this implementation. The existing Pages
workflow runs on pushes to `main`, so merging requires separate TEST deployment
authorization. Once authorized, use the existing Pages deployment process; no
new deployment command or configuration is required. Operational rollback is
selection of Normal calculated history on this page; ordinary chart defaults are
unchanged. Source rollback uses the original files or a separately authorized
revert and Pages deployment.

After authorized TEST deployment, collect real requests for admitted August JSON,
genuinely unpublished September fallback, the two-month seam, Refresh/new pubID,
auth/integrity failures without fallback, observation/DAQI/EAQI completeness and
partial/failed/uncovered intervals. Verify protected-host redirect/Access behavior
under the existing pilot release gates. Download browser diagnostics and collect
Cloudflare route-attributed CPU/exceededCpu evidence separately.

No authoritative contracts were edited. No contract amendment is required for
this explicitly incomplete isolated implementation. Complete mixed-source seam
certification or logical continuity requires a separately scoped Ops/API source
proof interface and corresponding contract decision; it is not included here.
