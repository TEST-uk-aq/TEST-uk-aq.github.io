# One-day calculated fallback: TEST implementation and operation

## Scope and implementation plan

- [x] Review TEST system contracts, previous CPU context and both repositories.
- [x] Archive the three affected frontend originals before editing.
- [x] Bound hybrid calculated initial HTTP requests to at most 24 visible hours.
- [x] Use the existing controller `olderChunkMs` option at 24 hours for hybrid.
- [x] Run minimal local structural checks, review, then deliver a TEST PR.
- [ ] Separately authorised TEST deployment and real CPU/output acceptance.

The choice is browser request bounding, rather than global Worker environment
settings. Both existing head controls (`stableAqiHeadMaxHours` and
`observationChunkMaxHours`, normally 168 hours) also affect unrelated consumers;
changing them is unnecessary. A narrowed request start already bounds both
visible sections. No new API parameter, environment variable or Worker policy
is needed. This supersedes THREE_DAY_HANDOVER.md only for hybrid chunk sizing.

Ops reviewed at `34c6826860452ea58bdb599e4307ebab6e54388e`:
`workers/uk_aq_station_history/src/{index,policy,stable_head,calculated_history,r2_observations}.mjs`,
`lib/aqi/aqi_levels.mjs` and `logs4GH/README.md`. No Ops files change and no Ops PR
or Worker/proxy redeployment is needed. Stage 4 and AQI preparation stay intact.

## Changed files

- `shared/station-chart/hybrid-history-client.js`: after existing manifest
  selection, narrow only an unavailable month's current request to
  `max(request start, month start, end - 24 hours)`. This happens before calling
  the calculated client, rather than trimming a seven-day response afterward.
  Existing cursor synthesis compares the returned head start with the original
  browser request, so the earlier days remain scheduled.
- `historical-json-chart-test/viewer.js`: hybrid uses the existing controller
  option at one day and reports that effective size in diagnostics. The older
  chunk selector now applies only to normal calculated comparison mode.
- `historical-json-chart-test/index.html`: explain that distinction.
- `Archive/2026-11-05/`: exact pre-change copies of those three files; reference
  only, never imported or executed.

Normal calculated mode keeps its 3/7-day selector and Worker-configured head.
JSON-only keeps its previous presentation spans and monthly object selection.
Hybrid published months retain their selection/pubID/source authority; more
finely partitioned older presentation uses the existing immutable object cache
and shared in-flight reads, not extra publication requests by design.
The comparison page is the only active hybrid caller found in this checkout.
Any future caller must also set its existing controller `olderChunkMs` to a day.

## Structural findings and preserved contracts

The controller builds a work list until the requested start without a chunk-count
cap. For full August fallback: head `[31 August, 1 September]`, then 30 older
one-day items back to 1 August. Observation/AQI work with identical bounds is
coalesced. Shorter intervals remain shorter; month edges may split work.
Requests, retries, cache hits and separate parts can change actual HTTP counts.

Existing controller concurrency remains 3 primary observation requests, 2
additional observation requests and 2 AQI-only requests; the page transport
scheduler remains capped at 6. Failures are caught per item and settled in
order; successful other items still commit. Refresh retains the existing retry
and coverage rules. Abort signals and generation checks still prevent stale
commits. HTTP-successful valid incomplete responses retain partial/gap metadata;
blank AQI hours do not become transport failures. No new retry/cache architecture.

Worker `buildCalculatedHistory` independently reads preceding 23-hour PM context
for every request, including the narrowed head, with the existing terminal
endpoint read (`outputEndMs + 1`). A daily PM request therefore reads 47 hours
plus that terminal boundary, potentially three UTC timestamp partitions. NO2
requires no rolling context. Date-valid continuity selection and source
precedence stay server-owned. AQI owns `(start, end]`; hybrid observations retain
`[start, end)` ownership plus the final terminal dependency, preserving source
multiplicity and existing boundary checks/deduplication.

The shared per-invocation budget stays 16 physical pages and 5,000 accepted R2
rows, with at most 1,024 physical decoded rows per page. Physical reads remain
sequential and response bodies are consumed before advancing. The narrower
range does not increase per-invocation fan-out or the existing subrequest and
connection bounds (see Ops Worker README); repeated daily context increases
total requests/reads. Dense sources or unusual continuity may still exhaust a
budget and must retain incomplete/no-store behavior, never silently omit rows.
No limits, algorithms, precision, null/missing rules, threshold, source eligibility,
identity proofs or completeness checks change.

## Local evidence

- `node --check shared/station-chart/hybrid-history-client.js`
- `node --check historical-json-chart-test/viewer.js`
- `node --test tests/station-history-loader.test.mjs`: existing harness passes.
- Direct invocation of existing `buildMissingChunkWorkList` for both sections:
  30 contiguous daily older items after a daily August head, with exact first
  and last boundaries.
- Exact archive byte comparisons and `git diff --check`.

These checks establish structural viability only. No new test suite, deployed
Worker request, numerical parity claim or CPU acceptance is included.

## Exact TEST deployment procedure (operator only; not executed)

1. Review this PR. Save full seven-day baseline response bodies and a HAR for
   the same source snapshot before deployment: on the protected comparison page,
   choose Normal calculated history, Normal TEST, full August, 7-day older
   chunks, then Load / repeat. Retain each request URL, response headers/body,
   independent completeness and calculation statuses. Record actual deployed
   station-history scriptVersion. Browser diagnostic summaries alone cannot
   establish numerical equality.
2. Obtain separate merge/deployment authorisation. A merge/push to website
   `main` automatically triggers `.github/workflows/pages.yml` (Deploy GH Pages),
   so treat merging as deployment, not a code-only action. Do not merge here.
3. After that authorised merge, allow the existing Pages build/deploy to finish.
   If a manual redeploy is needed, use exactly:

   ```sh
   gh workflow run pages.yml --repo TEST-uk-aq/TEST-uk-aq.github.io --ref main -f refresh_blog_feed=false
   gh run list --repo TEST-uk-aq/TEST-uk-aq.github.io --workflow pages.yml --limit 3
   gh run watch RUN_ID --repo TEST-uk-aq/TEST-uk-aq.github.io --exit-status
   ```

   Substitute the run ID returned for that deployment. Do not dispatch Ops
   workflows or change Worker variables. The existing build hashes changed JS
   and rewrites asset imports; confirm current HTML and its hashed assets loaded.
4. Verify the existing HTTPS redirect/Access boundary, including the alternate
   GitHub Pages hostname, then open
   `https://test-uk-aq.ukaq.co.uk/historical-json-chart-test/` authenticated.

## Minimum real-operation checks

1. Select Hybrid JSON-first, full August (1 August 00:00 through 1 September
   00:00 UTC), AURN PM10 connector 1 / timeseries 43 / station 1581. First verify
   manifest diagnostics select `calculated_fallback_missing_json` for August
   following authenticated 404 + `history_month_unavailable`. If August is
   published, this exact fallback trial is blocked by existing selection; do
   not delete/unpublish data, intercept responses or broaden fallback to force
   it. Report the prerequisite and retain ordinary selected JSON behavior.
2. Run Load / repeat with browser network capture and full response bodies.
   Expect the `/api/aq/station-series` request to start 31 August and end
   1 September. Expect 30 adjacent `/api/aq/timeseries` daily visible ranges
   back to 1 August, absent cache/retry/part differences. Check the returned
   stable head and older output bounds, and each PM required context start
   exactly 23 hours before output start. Count fallback HTTP calls separately
   from manifest/object calls and retries. Require diagnostic `dropped_events=0`;
   use full bodies for range accounting because summary lists are bounded.
3. Union all visible ranges: exactly 31 days, no unrequested gaps/overlap.
   Check AQI endpoint identities once per hour (744 expected evaluated endpoints
   if source evaluation succeeds), and observation multiplicity/terminal
   ownership, without inventing missing observations. Preserve partial-source
   intervals/reasons distinctly from genuinely absent physical measurements and
   valid `missing_input`/`insufficient_samples` AQI. A complete load need not
   mean complete source data. Verify 12 August 14:00's full AQI row against the
   saved baseline, as well as all other timestamps/values/nulls/statuses/counts.
4. Compare full assembled one-day output with the seven-day baseline by physical
   identity, pollutant and endpoint, including numerical fields, statuses and
   missing reasons. Compare interval completeness by its union and reasons;
   per-response range/context/cursor metadata naturally differs by partition.
   Confirm the same canonical snapshot/generation; changed source data makes
   direct equivalence inconclusive. Verify Refresh retries failures/partial
   observations while retaining already retrieved valid chunks, and cancellation
   during loading cannot commit stale work. One controlled failed browser request
   can check retained successful chunks without changing server/data settings.
5. In Cloudflare TEST station-history Observability, capture all unprofiled
   invocations for each isolated run, using UTC request bounds/URL/request IDs
   from the HAR. Record executed full scriptVersion for every invocation,
   route/class, CPU time, outcome/errors (including exceededCpu), reported R2
   work and request count. Version selector/header claims alone are insufficient.
   Check the deployed script matches the baseline version since no Worker source
   change is needed. Distinguish station-history CPU from proxy and leaf-reader
   CPU; note any cache hits without a station-history invocation and unrelated
   traffic. Reconcile HTTP calls and invocations rather than assuming 31 of each.
6. Repeat fresh and warm loads. For head, older and combined populations report
   sample count, min, median, p95/p99 with sample-size qualification, maximum,
   count and percentage `>=10 ms` and `>10 ms`, errors and total wall time.
   Acceptance requires every observed invocation strictly below 10 ms, preferably
   6–8 ms. A small passing sample is not a universal guarantee. Record raw samples
   and cache states; do not infer CPU from browser elapsed time or flamegraphs.
7. Exercise a representative authoritative NO2 identity using the existing shared
   controller/client with the same one-day option (the thin pilot UI is fixed
   to PM10; obtain the real identity from TEST metadata rather than guessing).
   Exercise a known date-valid physical continuity transition on the normal
   calculated service with one-day requests, checking PM context across members.
   The existing hybrid explicitly rejects enabled continuity; retain and report
   that limitation rather than broadening this task. Also check a published
   JSON-only month and normal calculated 7-day mode retain current behavior.
8. If any daily request reaches/exceeds 10 ms, report its class, version, source,
   work counters and CPU distribution. Do not add automatic optimisation. Use
   measured dominant work to recommend the smallest next reduction; repeated
   context/page work is a possibility, not an established bottleneck.

## Reliability, rollback and documentation handover

More total reads/loading time is expected and accepted. Every PM request repeats
its own context. Selection expiry remains 300 seconds; a slow full load can
still encounter `history_selection_expired` and need existing Refresh/reload.
Hybrid unresolved generation/source-boundary authority remains incomplete.
Continuity support is unchanged. Actual CPU and full output parity are pending.

Rollback: separately authorise a revert of this PR and redeploy TEST Pages using
the existing process. Restore complete active files via Git, never execute
Archive paths. No data, Worker, environment or schema rollback is required.

Chat-mode system-doc handover: update the isolated comparison sections of
`station_charts/contract.md` and `aqi-levels/station-history-contract.md` to record
hybrid-only daily head/request bounding and the existing controller daily option,
with unchanged fallback eligibility, 23-hour context and source/algorithm rules.
This implementation introduces no API/schema/environment change. Link the PR,
local evidence and later real-operation measurements, explicitly distinguishing
code delivery, deployment and CPU/output acceptance. Authoritative docs were
read only during this task.
