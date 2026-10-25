# Canonical physical-site chart selection — implementation handover

Scope: TEST website only, based on `main` at `6fce23bfd8394d462c93b43b291ba1d219e31522`.
No deployment or functional acceptance is included. Authoritative system documentation is unchanged.

## Findings and ownership

| Responsibility | Current implementation |
| --- | --- |
| Canonical membership | Core `station_matches` / `stations.match_id`; never inferred by the browser |
| Public canonical metadata | Ops `workers/uk_aq_latest_snapshot_cloud_run/run_job.ts` projects `match_id`, `uk_air_ref`, `canonical_station_label`, `site_networks` onto source Latest Snapshot rows |
| Hex source eligibility | `hex-map-network-controller.js` plus UK/C&R controllers filter scalar source networks before grouping |
| Hex current-source choice | `shared/domain/canonical-current-rows.js`: newest timestamp, AURN on ties, then existing ascending source identity |
| Hex chart launch | UK/C&R `buildChartModeEntriesForSelectedArea()` retains the chosen representative as `entry.row`, including canonical metadata and actual source IDs |
| Page integration | `hex-map-station-chart-adapter.js` mounts the shared controller, forwards page readiness/range/selection and presents chips/table selection |
| Pollutant transition | `pollutant-context-controller.js` reconciles selection and supplies the existing guarded atomic `replacePollutantContext()` handoff |
| Observations, AQI, cancellation, range and cache | Unchanged shared station-chart controller, clients and cache |
| Rendering | Unchanged shared renderer, used by both Hex Map and Sensors |
| Sensors list and source choice | `sensors-page.js`, using the existing `/stations-chart` response and explicit series dropdown |

The confirmed Hex defect was station-ID intersection in `reconcileSelection()`. When another pollutant at the same physical site used a different source station, it was removed as unsupported. The old same-pollutant map reconciliation could also select the first unrelated visible station after a representative changed.

Sensors separately retained a timeseries ID and otherwise selected the first globally sorted option. Pollutant replacement could therefore jump to another site. Its entry construction also discarded canonical metadata.

These are selection-layer defects. The distinct source station IDs are valid.

## Implemented identity boundary

`station-chart-domain.js` now supplies shared pure `logicalSiteKey()` and `resolveSiteEntries()` helpers:

```text
matched:   match:<match_id>
unmatched: source:<connector_id>:<station_id>
```

Only authoritative non-null `match_id` groups source stations. Labels, UK-AIR text, coordinates and `site_networks` do not establish a relationship. Missing canonical metadata conservatively retains source identity.

Hex passes its ordered previous selected entries to the pollutant owner. The owner resolves each selected site against authoritative target-pollutant entries and maps primary/AQI roles to the replacement source station. It preserves selection order. The same resolver handles refreshed/network-filtered representatives. An unsupported selection drops out; no unrelated first-row substitution occurs.

The shared history controller still receives ordinary target entries with actual connector, station, timeseries and pollutant identities. `match_id` never substitutes for any history request or cache identity. Continuity, source/verification status, observation precedence, AQI calculations and rendering are unchanged. Old-pollutant entries are selection references only, never target history fallback data.

## Network safety and multiple candidates

Hex still supplies one representative per site/pollutant from the current eligible, selected scalar networks. This patch consumes that established order and choice; it does not search excluded rows or treat `site_networks` membership as source eligibility. With multiple networks selected, the target pollutant's current representative can be a different selected network, exactly under the existing current-reading rule.

Sensors has no network picker or accepted cross-network replacement policy. Its resolver requires the selected scalar network to remain the same. If scalar network identity is absent, it permits only the exact connector/station fallback. Within that eligible set, it retains the existing sorted option order, and preserves an existing selected series when it remains available. The dropdown keys now qualify timeseries IDs by connector. Explicit user selection of another series remains supported.

No history coverage competition, averaging, merging, deduplication, cross-connector splice or new source-ranking policy is activated. The separate future Hex history-source contract remains future work.

## Sensors metadata boundary

The current Ingest `uk_aq_stations_chart` mapping does not expose the four canonical fields. Hex already receives them; Sensors does not. New page-owned `sensor-site-metadata.js` reuses the established `/latest-snapshot?pollutant=<pollutant>&window=all` public projection, joining only exact `(connector_id, station_id, timeseries_id, pollutant)` identities.

For a Sensors list load, it makes at most three additional requests, one for each represented supported pollutant whose rows lack `match_id`. It skips these requests when the existing source response supplies canonical metadata. This is the genuine missing data boundary requiring additional requests; there is no new endpoint, private Supabase browser query, database change or backend PR.

Enrichment copies only the four canonical fields. Source IDs, scalar networks and observation values remain from the original list response. Existing cache/auth configuration and HTTP caching apply; no additional persistent cache or environment fallback is introduced. Source-list `304` responses still refresh chart history and re-read canonical metadata. Search/refresh generations abort superseded page-data/metadata reads and prevent stale list commits. ETags are retained only with accepted source bodies.

Missing metadata never invents a site relationship. Transport/shape failure retains safe source-level entries and displays a retry message. Pollutants outside PM2.5/PM10/NO₂, or source rows absent from these public projections, retain source-level switching unless the list response itself supplies canonical metadata. A missing pollutant gives the existing empty chart/selection state; Sensors retains its site anchor so a supported pollutant can be selected again.

The existing Sensors endpoint still calls `uk_aq_public.uk_aq_latest_rpc`, while canonical schema verification treats that RPC as retired. Source inspection alone does not establish whether the deployed endpoint currently works. Its availability is an existing Sensors operational prerequisite; this patch neither restores the retired RPC nor changes that backend. The normal Hex fix is independent of it.

## Files

Active code:

- `shared/station-chart/station-chart-domain.js`
- `shared/station-chart/pollutant-context-controller.js`
- `hex_map/hex-map-station-chart-adapter.js`
- `sensors/sensors-page.js`
- `sensors/sensor-site-metadata.js` (new)

Exact pre-change copies of the four existing code files are under `Archive/2026-10-25/` with the same relative paths. Existing archives were preserved. This handover is the only documentation addition in this implementation repository.

## Structural validation

- Node 24 syntax parsing passed for all five active code files.
- Existing `tests/pollutant-context-controller.test.mjs` passed.
- Existing `tests/hex-map-station-history-loader.test.mjs` passed.
- A bounded pure identity/interface check passed for the supplied Bristol mappings, ordered primary/AQI remapping, empty selection, connector-qualified unmatched fallback and Sensors network restriction. This is not real-data functional acceptance.
- The new metadata module and shared domain import successfully in Node. A full browser-entry import in bare Node stops at the existing D3/ChartCore dependency guard; both HTML shells still load those classic dependencies before their module bootstrap. No browser mount is claimed.
- The production content-hash helper passed on a disposable staging copy: 103 active assets, 18 HTML files, 137 rewritten HTML references. It resolves the local module graph including the new metadata module and propagates changed dependency hashes to the page entry points. No tracked asset URLs were rewritten.
- All four archives were compared byte for byte against the base commit.
- `git diff --check` passed. No schema migration or data operation is required or was run.

## Real TEST acceptance after separately authorised deployment

Use the real deployed TEST pages and their configured same-environment cache API. Capture source identities from actual requests/responses and inspect chart output; offline harnesses cannot establish acceptance.

| Site | Logical identity | PM2.5 station / timeseries | PM10 station / timeseries | NO₂ station / timeseries |
| --- | --- | --- | --- | --- |
| Bristol St Paul's | `match_id=66`, `UKA00494` | `441 / 324` | `440 / 107` | `434 / 662` |
| Bristol Temple Way | `match_id=138`, `UKA00631` | `448 / 218` | `7353 / 14` | `445 / 612` |

These user-confirmed TEST identities are acceptance references, not application constants. Confirm the deployed projection still supplies their current authoritative relationships.

1. On the UK Hex Map select the area and launch each Bristol site's PM2.5 chart. Switch PM2.5 → PM10 → NO₂ → PM2.5 without leaving chart mode. Repeat in Countries & Regions. The selected physical site, selection order and chart duration must remain correct; the actual source identities must change as shown above.
2. Confirm real observation values, timestamps, units, pollutant labels, tooltips and DAQI/EAQI output against the authoritative source responses. Check actual connector/network, requested timeseries and returned physical/continuity identities. No request/cache key may substitute `match_id` for a timeseries or station ID. Preserve returned provenance and verification status.
3. Select two sites, make the second the AQI source, then change pollutants. Symbols/order and the AQI source must follow their sites. Same-pollutant add/remove and AQI-only source switches must retain existing behaviour; an AQI-only switch must not fetch observations.
4. For a real matched multi-network site, select each member network individually, then both. Only selected live-map-eligible scalar source rows may supply charts. With both selected, the existing current representative rule remains in force, without coverage-based competition or history splicing. Change network selection while a chart is open and inspect the actual replacement source.
5. On Sensors, use the existing Bristol search to select each site and switch pollutants. Verify the same site and source network remain selected, the correct source series is requested, and the explicit series dropdown still works. Inspect the at-most-three same-environment metadata requests and their exact-source joins. Check Refresh after a source-list `304` and a new station search.
6. Check a genuinely unmatched source station, including unresolved pollutant-specific rows if present. Same connector/station remains selectable where supported; distinct unmatched stations remain separate even with similar names/coordinates. Do not repair Warrington through browser inference.
7. Select a site without a target pollutant. Confirm the target empty/unavailable state, removal of old lines/AQI and no unrelated site/network substitution. On Sensors, selecting an available pollutant again should restore the retained site anchor. Hex retains its established unsupported-selection removal semantics.
8. Exercise rapid PM2.5 → PM10 → NO₂ changes with slow/in-flight history reads, a metadata failure, and an empty response. Only the latest chart context may commit. No stale line may be relabelled as the target pollutant; no automatic retry loop should occur.
9. Check 12h/24h/7d/31d/90d ranges, Refresh and repeated pollutant visits. Preserve duration, Hex hour-aligned endpoint policy, actual-source/pollutant cache separation, freshness and cancellation. Confirm single-source sites retain normal chart appearance, first-open animation and incremental selection behaviour; pollutant replacement must not replay initial animation.

No new configuration, schema, resolver run, Worker deployment or JSONgen publication is required for this patch. Existing canonical Latest Snapshot projection, history services and (for Sensors) its list endpoint must be available. Use the existing website review/release workflow only under separate merge/deployment authority; a `main` push already triggers Pages. No workflow was invoked here.

## JSONgen PR #79 follow-up

Website PR #79 was inspected read-only at `0f71e4a1b3367bff44a589f32fa5420162afbfa4`. Its isolated viewer's `populate()` and `selectedSample()` group/select by `connector_id:station_id`. Its catalog does not currently provide canonical grouping to those selectors. It therefore needs a separate UI adaptation to keep a physical site selected across pollutant-specific source stations.

That follow-up can reuse the shared identity helpers once authoritative canonical metadata reaches the viewer, while passing the selected sample's original physical source IDs to the existing chart context. JSONgen export, publication, observation/AQI calculation and physical retrieval must remain independent of `match_id`; do not require it in publication/cache identities. Existing callers supplying explicit target station IDs without previous selected entries remain compatible. Neither PR #79's branch nor Ops PR #136 was modified; neither is a prerequisite for this normal-chart fix.

## ChatGPT Chat-mode documentation handover

Please amend the authoritative `station_charts/pollutant-switch-contract.md` and `pollutant-context-handoff-contract.md` after review to distinguish logical physical-site retention from actual selected source station IDs. Document the optional previous `selectedEntries` input, canonical reconciliation, primary/AQI role remapping and unchanged atomic guarded controller handoff. Station identifiers in requests remain physical source identifiers.

Clarify the current Hex chart boundary in `website_ui/hex-map-canonical-site-contract.md`: each target pollutant still uses its current selected-network representative, but logical selection now follows `match_id` across different representative station IDs. Preserve the future status of `hex-map-canonical-history-source-contract.md`; this implementation does not activate it.

Document Sensors' existing projection gap, bounded public Latest Snapshot enrichment, same-source-network restriction, supported pollutant/coverage limits and conservative unavailable handling. Record the existing legacy Sensors list-endpoint prerequisite separately from this frontend change. No changes to canonical station matching, the Latest Snapshot public schema, history/AQI/cache contracts, environment configuration or JSONgen publisher contracts are required.

Functional acceptance remains pending the real TEST procedure above. Roll back by reverting the website implementation commit through the normal release process; there is no database or data rollback. Archives are reference only and must never become runtime fallbacks.
