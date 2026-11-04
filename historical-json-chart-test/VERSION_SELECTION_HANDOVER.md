# TEST Worker version selection

The page adds Normal TEST (default), Stage 3 and Stage 4 choices. Explicit
selection is available only for calculated history. JSON and hybrid disable and
reset it to Normal TEST, leaving their source and Refresh behaviour unchanged.

Stage selection requires the existing allowed-Origin/session policy plus a
dedicated TEST cache-proxy operator token. Enter it in the password field; it is
kept only in page memory and never included in downloaded diagnostics or storage.
No API hostname, Worker name, version UUID or credential is supplied by this
website build. The shared auth helper still owns the cache-proxy API base.

Load / repeat makes a fresh controller/cache. Changing source, range, chunk size,
version or token destroys/aborts the old run. Refresh retains same-version chart
coverage as before, so use Load / repeat for fresh CPU comparisons. The captured
selection reaches the head and all older/concurrent calculated requests.
Obsolete transport results and diagnostics cannot enter a different run.

Downloads use schema 3, recording requested label and configured UUIDs reported
by the proxy, UTC run/request timestamps, ranges, chunk size, head/older class,
HTTP status, browser settlement and existing completeness/source fetch counts.
Configured/requested UUIDs are not proof of executed version. The page always
labels execution unverified and `comparison_valid=false`; acceptance requires
Cloudflare invocation analytics **scriptVersion** for every measured request.
Browser elapsed time is not Worker CPU time.

The required backend, configuration catalogue, complete later deployment order,
two-version 100% Stage 4 / 0% Stage 3 procedure, automatic-deployment risk,
telemetry/real-TEST acceptance, rollback and read-only system-documentation
handover are in the
[Ops operational handover](https://github.com/TEST-uk-aq/uk-aq-ops/blob/codex/station-history-version-selector/docs/station-history-version-comparison-handover.md).
The reported [0% Service Binding override issue](https://github.com/cloudflare/workers-sdk/issues/15536)
is unresolved by this code: stop if actual routing cannot be proved; never
silently alter traffic percentages or fall back to normal routing.

Changed active files are `index.html`, `viewer.js`, `viewer.css` in this directory
and `shared/station-chart/station-chart-diagnostics.js`. Exact pre-change copies
are under `Archive/2026-11-04/` with their relative paths preserved. No active
page references an archive. The shared controller, clients, cache implementation,
renderer, public charts and asset-hashing workflow are unchanged.

Local syntax/whitespace checks and the existing station-history loader harness
passed. A focused scratch adapter check also passed head/older/concurrent
selection, normal/JSON/hybrid omission, late-response rejection, timestamp
recording and credential exclusion. Real TEST visual/operational acceptance and
actual version/CPU/numerical verification remain separately authorised work.
No merge, deployment, baseline regeneration or Cloudflare resource change was made.
