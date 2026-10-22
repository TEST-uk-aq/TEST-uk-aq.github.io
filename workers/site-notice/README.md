# Site notice operations (TEST setup, no resources provisioned by this PR)

The accepted contracts are `system_docs/website_ui/site-notice-contract.md` and
`system_docs/website_deployment/site-notice-publication-contract.md` in the
authoritative system-docs repository. These notes explain this implementation.

`site-notice.toml` is the sole editorial source. It ships disabled with blank
copy: set reviewed wording before enabling any notice. Plain text, paragraph
breaks and `[words](https://destination/path)` or `[words](/same-site/path)` are
supported. HTML displays literally; images, bracket escapes, nested brackets and
parentheses in link destinations are unsupported (percent-encode destination
parentheses). Malformed links and unsafe schemes fail validation. Each network
table uses its exact canonical `network_code`. Unknown/absent networks never
create rows. An enabled network inherits the main message even if the main pill
is disabled; an explicit override must be nonblank when enabled.

## One-off prerequisites, to perform only after authorisation

Use Node 24, Python 3.12+ and Wrangler 4. No dependency installation is needed for
TOML validation or publication. Configure each repository independently; never
reuse another environment's namespace, endpoint or credentials as a fallback.

Required repository **variables**:

| Variable | Meaning |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Explicit account containing this environment's namespace |
| `UK_AQ_SITE_NOTICE_KV_NAMESPACE_ID` | Dedicated namespace ID in that account |
| `UK_AQ_SITE_NOTICE_URL` | Complete public HTTPS GET endpoint, without credentials/query/fragment |

Required repository **secret**: `CLOUDFLARE_API_TOKEN`, with Workers KV Storage
Edit permission for the intended account. Use a separate operator deployment
token with Workers Scripts Edit (and route permission if using a custom route)
for one-off Worker deployment; the publisher itself needs no script deployment
permission. Never put either token into TOML, generated config or browser code.

Operator-only environment variables for generating Wrangler configuration:
`UK_AQ_SITE_NOTICE_WORKER_NAME` and `UK_AQ_SITE_NOTICE_ALLOWED_ORIGINS` (a
comma-separated list of exact authorised HTTPS website origins). The generator
also consumes the account, namespace and public endpoint variables above. There
are no committed environment identifiers or default resource targets.

From the website repository, with explicitly selected TEST values in your shell:

```sh
# Check authoring configuration without any credentials/network.
python3 scripts/site-notice/publish.py --check

# Create a dedicated namespace; select a reviewed name and record the returned ID.
npx wrangler@4 kv namespace create "$UK_AQ_SITE_NOTICE_KV_NAMESPACE_NAME"
# Set UK_AQ_SITE_NOTICE_KV_NAMESPACE_ID to that returned ID.

# Generate a local deployment configuration, then inspect its exact targets.
node scripts/site-notice/worker-config.mjs ../work/site-notice/wrangler.json
cat ../work/site-notice/wrangler.json
# Optional local bundling check; no deployment:
npx wrangler@4 deploy --dry-run --config ../work/site-notice/wrangler.json
# Only after separate deployment authorisation:
npx wrangler@4 deploy --config ../work/site-notice/wrangler.json
```

The generated config uses `workers_dev: true` and binds **only** `SITE_NOTICE_KV`.
Set `UK_AQ_SITE_NOTICE_URL` to the actual deployed HTTPS hostname and chosen path.
The Worker serves exactly that pathname. For a custom domain, separately configure
that exact hostname/route through the normal reviewed Cloudflare procedure; do not
invent a hostname or assume it exists. Regenerate config if the path changes.
The endpoint permits GET only, reflects only explicitly allowed origins, and
returns JSON errors with non-success statuses on missing/invalid/unavailable KV.
It has no public write route or browser write credential.

Set the three repository variables using the intended TEST repository selector
and the values above (`gh variable set NAME --repo "$TEST_WEBSITE_REPOSITORY"
--body "$VALUE"`). Set `CLOUDFLARE_API_TOKEN` using `gh secret set
CLOUDFLARE_API_TOKEN --repo "$TEST_WEBSITE_REPOSITORY"` and supply the token at
its prompt. The existing Blog, Media email and Supabase settings remain required.

After authorised merge/setup, dispatch `site-notice.yml` on `main` once to seed
the KV key `site_notice_current`. Review publication success, then authorise the
normal Pages deployment (the existing manual Blog refresh input is preserved).
Missing/invalid `UK_AQ_SITE_NOTICE_URL` fails the Pages build before upload.
The current affected CSPs already allow HTTPS `connect-src`; no CSP widening is
required. A notice-only commit publishes KV and skips Pages; mixed code/notice
commits run both workflows. Neither workflow deploys a Worker.

## Publication and freshness

The publisher parses the complete TOML, uses the same schema/link validator as
the Worker/browser, hashes canonical version-1 JSON and performs one atomic KV
PUT. Validate-only mode never reads credentials or writes KV. Publication is
serialised, checks out current `main`, and never silently retries against another
namespace. Invalid TOML/schema, missing credentials and rejected writes preserve
the last good value. A transport timeout can make the write acknowledgement
uncertain; inspect the public revision before retrying, rather than assuming a
globally immediate rollback.

KV is eventually consistent. KV read cache TTL is 60 seconds and HTTP freshness
is 30 seconds; there is no Cache API or stale-on-error layer. Browsers
fetch with `cache: no-store` immediately and about every 120 seconds, with a
10-second timeout, one in-flight owner, and a 130-second maximum retained age.
Visible-tab resumption checks expiry and refreshes. Allow KV propagation plus a
poll interval; do not promise an immediate global switch. Failed refreshes hide
both main and network notices, logging one diagnostic per distinct error without
editorial copy. Unchanged revisions leave DOM/focus untouched.

Authoring TOML, the publication workflow, publisher/injection/config-generation
directory and Worker directory are excluded from `.pages-site`. Existing unrelated public files and
all archives remain. New runtime modules/CSS use the existing content-derived
hashing, after public endpoint injection. Generated Wrangler files belong under
the workspace `work/` directory, outside the website source/artifact.

## Real TEST acceptance after authorised deployment

- Enable/disable the main notice; verify one amber pill below beta on all four
  pages, safe links/paragraphs, mobile wrapping, and no residual gap when disabled.
  Dismiss/expand beta and confirm its attribution, preference and focus survive.
- With the main notice disabled, independently enable AURN and another present
  canonical network; verify inherited/override messages and removal when disabled.
  Check both UK/C&R, selected/deselected and pollutant-unavailable rows.
- Hover then move into tooltip links; focus/Tab/Shift+Tab, tap/tap-again, outside
  interaction and Escape. Verify links work, tooltip stays within the viewport,
  and mobile, floating and pinned/docked layouts remain usable.
- Confirm warning interactions never toggle checkboxes, change counts, pin/close
  the panel or mask its count tooltip. Check row-wide selection and logo links,
  keep-one/select-all, scope changes and preserved panel/selection/focus on refresh.
- Publish a TOML-only edit; confirm only the notice workflow runs, revision changes
  and already-open pages update after propagation/polling. A mixed commit must
  still run Pages. Check manual Pages and Blog refresh behaviour normally.
- Try invalid TOML/link/blank enabled copy through check mode: it must fail before
  PUT. Confirm authenticated publication permissions and actual previous-value
  preservation through reviewed TEST operations. Exercise missing/invalid KV and
  endpoint failures: non-success JSON, stale UI removed, bounded console error,
  recovery after valid config, and no environment fallback.

## Rollback

- **Editorial/KV:** restore the previous reviewed complete TOML on `main` and let
  the publication workflow replace the one key; manual dispatch publishes current
  `main`. For an urgent fully disabled state, set every enabled item to false.
  Never rely on turning off only the main pill to disable network notices.
- **Website:** revert this feature's implementation commit through review and
  perform an authorised Pages deployment of that reviewed state. The exact
  pre-change files (including the current Pages workflow) are under
  `Archive/2026-10-22/`; restore whole files from that snapshot when appropriate.
  Restore the old workflow with the old page/controller files so the rollback
  does not retain the new endpoint requirement. Normal content hashes follow
  the restored bytes; no forced reload or cache-policy change is needed.
- **Worker:** after authorisation, use `npx wrangler@4 deployments list --config
  ../work/site-notice/wrangler.json`, select the recorded known-good version and
  run `npx wrangler@4 rollback VERSION_ID --config ../work/site-notice/wrangler.json`.
  On first deployment there is no earlier version; disable the editorial notices
  or roll back the website before an authorised removal of the new Worker/route.
  Keep namespace contents until rollback is accepted; do not delete KV as a
  website rollback step.

The authoritative contracts remain read-only in this implementation. After real
TEST acceptance, hand over the PR, deployment/namespace/endpoint setup, revision
and acceptance evidence to ChatGPT to update their future-implementation status.
