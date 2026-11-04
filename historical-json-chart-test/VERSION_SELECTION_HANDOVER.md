# TEST Worker version selection

The page adds Normal TEST (default), Stage 3 and Stage 4 choices. Explicit
selection is available only for calculated history. JSON and hybrid disable and
reset it to Normal TEST, leaving their source and Refresh behaviour unchanged.

Stage selection requires the existing allowed-Origin/session policy plus a
dedicated TEST cache-proxy operator token. Enter it in the password field; it is
kept only in page memory and never included in downloaded diagnostics or storage.
No Worker name, version UUID or operator credential is supplied by the website
build. Normal routing keeps the shared auth helper's existing API-base behaviour.
Selected requests use the trusted deployment policy described below.

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
and `shared/station-chart/station-chart-diagnostics.js`. The trusted-origin
correction also changes `shared/auth/uk-aq-cache-auth.js`,
`scripts/uk_aq_inject_project_ref.mjs` and `.github/workflows/pages.yml`.
Exact pre-change copies are under `Archive/2026-11-04/` with their relative paths
preserved (the Pages workflow is under `workflows/pages.yml`). The existing
index/viewer archives were reused unchanged. No active
page references an archive. The shared controller, clients, cache implementation,
renderer, public charts and asset-hashing mechanism are unchanged.

Local syntax/whitespace checks and the existing station-history loader harness
passed. A focused scratch adapter check also passed head/older/concurrent
selection, normal/JSON/hybrid omission, late-response rejection, timestamp
recording and credential exclusion. Real TEST visual/operational acceptance and
actual version/CPU/numerical verification remain separately authorised work.
No merge, deployment, baseline regeneration or Cloudflare resource change was made.

## Trusted API origin correction

The original PR compared selected requests against `ukAqSharedAuth.cacheBaseUrl`,
which is itself overridable by a `cache_base` query parameter. That allowed an
attacker-controlled link to choose the operator credential's destination. The
same helper also accepts a `cache_session_url` override. Matching an effective
query-controlled base did not establish trust.

The existing environment-injection owner,
`scripts/uk_aq_inject_project_ref.mjs`, now populates the comparison HTML's
`uk-aq-version-comparison-api-base` meta field. It reuses the repository's
deployment **CNAME** hostname authority, already used by the staged page metadata
finaliser, and the established same-origin `/api/aq` route. Only the existing
repository variable **`UK_AQ_ENV_NAME=TEST`** enables this value. The Pages workflow
passes that existing variable to the injector; missing/non-TEST values leave the
policy empty. CNAME must be one valid hostname, without credentials, URL syntax,
path, query or port. The generated policy is HTTPS and is written before staging
and content hashing. No hostname or full endpoint is committed in application
source, and no new GitHub variable or secret name is introduced.

The shared auth helper captures this deployment policy from HTML, independently
of query parameters. Its new opt-in `fetchVersionComparisonApi` method validates
the policy, effective API base, effective session endpoint, GET method and exact
`/api/aq/station-series` or `/api/aq/timeseries` destination **before** calling
existing authentication or dispatch. Either malicious override is rejected
before any fetch. Missing/invalid policy and mismatched/unrelated destinations
also fail closed. The policy is not taken from the caller, page URL or an
arbitrary API URL. A cached helper without the new method fails closed too.

Selected requests use the existing authentication/retry implementation with a
fixed validated URL and forced `redirect: error`, including every retry. Session
initialisation constructs its own headers and never receives the operator token.
The selected wrapper emits fixed transport/configuration errors without URLs or
credentials. Trusted policy values are never added to chart diagnostics. Normal,
JSON and hybrid requests retain the original helper and send no operator token.
No controller, cancellation, cache-isolation, chunk, algorithm, logical-label or
diagnostic-schema change is part of this correction.

Deployment prerequisite: the website repository must supply its existing
`UK_AQ_ENV_NAME` variable as `TEST`, and its existing CNAME must identify the TEST
website origin already serving the cache-proxy `/api/aq` routes. Raw source/local
pages without injection deliberately cannot send selected credentials. A later
approved Pages build injects the policy and hashes changed assets normally.
There is no Ops dependency beyond the existing PR #183; that PR and Cloudflare
resources are unchanged. System documentation remains read-only; document this
narrow trusted-policy/authentication amendment separately.

All 24 focused local trusted-origin scenarios passed, covering malicious API/session overrides, missing/invalid
policy, allowed calculated routes, unrelated routes, normal routing, forced
redirect rejection, authentication retries, fixed error messages and absence of
operator credentials/trusted policy from diagnostics. Seven injection cases passed,
covering TEST/non-TEST gating, invalid CNAME and deterministic output. The adapter
check uses the real shared auth helper, and the existing loader harness also passes.
Real TEST acceptance
still requires a separately approved deployment.
