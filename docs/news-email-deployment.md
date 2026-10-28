# News by Email deployment and promotion

Source application files remain environment independent. The existing Media
email staging injector derives the website's HTTPS origin from the staged
`CNAME`, and still injects the existing public API and Turnstile settings before
content hashing. No new repository variable is required.

## Existing deployment inputs

| Input | TEST | LIVE BETA | Public LIVE |
| --- | --- | --- | --- |
| Staged `CNAME` | TEST website hostname | Beta website hostname | Public website hostname |
| `UK_AQ_MEDIA_EMAIL_PUBLIC_URL` repository variable | TEST email Worker origin | Same LIVE email Worker as public LIVE | LIVE email Worker origin |
| `UK_AQ_TURNSTILE_SITE_KEY` existing Actions secret/public browser value | TEST site key | Site key allowed for beta hostname | Site key allowed for public hostname |

CNAME must be a real file containing exactly one valid hostname (surrounding
whitespace is ignored). Missing, empty, multiple-hostname, URL, path, wildcard,
port, malformed DNS labels and non-canonical URL host spellings fail the build.
The injector constructs `https://<hostname>` without changing CNAME and uses it
for all four metadata destinations: canonical page, Open Graph page, Open Graph
image and Twitter image. It changes only staged `news/subscription-config.js`
and `news-by-email/index.html`, validating required files and placeholders before
writing. No TEST, beta or public origin is a fallback. Existing API-origin
validation and staging-file safety checks remain.

No robots directive is required on the ordinary subscription page; normal
indexing applies, including public prelaunch indexing. LIVE BETA remains
protected by its existing Cloudflare Access configuration. The unchanged
browser controller still inserts/sets `noindex, nofollow` for private
confirmation, Manage and Unsubscribe flows and removes the token fragment from
browser history. Tokens are not inserted into metadata or server-side URLs.

## Rollout and navigation boundaries

TEST's form, News entry button, Contact link, News sidebar/footer behaviour,
legacy-fragment handling and Turnstile interface are unchanged.

LIVE BETA will use the one LIVE email Worker and subscriber database, retain
visible News by Email entry links and use its own CNAME. The planned v0.7
promotion includes `contact.html`, `VERSION`, `sidebar.js` and the four already
agreed chart/Hex Map improvements. Those are approved release-scope decisions,
not additional changes in this task. The existing promotion script's intentional
removal of unready sidebar entries is acceptable and is not changed here.

Public LIVE initially needs the subscription page and necessary shared
dependencies without the new News/Contact entry links. It must be accessible to
canonical email links and can be indexed normally. Public entry/navigation
links follow in the approved release. Do not create environment-specific
application implementations. CNAME, existing deployment settings and the
approved promotion transformation may differ; source controller/application
code remains shared.

## Complete-file promotion dependencies

Promote these complete changed files:

- `news-by-email/index.html`
- `scripts/uk_aq_inject_media_email_config.mjs`
- `.github/workflows/pages.yml`
- This handover.

A destination without the current standalone page also needs the matching
unchanged `news/subscription-config.js`, `news/subscription.js`,
`news/subscription.css`, `news/news.css`, `site-ui.css`, `bottom-nav.css`,
`mobile.css`, `sidebar.js` and its shared dependencies. Retain controller
loading on `news/index.html` for legacy email fragments, without introducing
the public News subscription-entry markup ahead of its release.

Required page assets include `images/favicon.ico`,
`images/UK-AQ-social-share.png`, `images/UK-AQ-NEWS-BY-EMAIL-1line.svg`,
`images/UK-AQ-NEWS-BY-EMAIL-2lines.svg` and `images/UK-AQ-back-arrow.svg`.
Beta entry-link promotion additionally includes the matching `news/index.html`,
`contact.html`, `VERSION`, `sidebar.js` and entry artwork
`images/uk-aq-contact-white.png`, plus the agreed chart/Hex Map release files.
Preserve the existing release manifest/promotion script for those improvements;
this task does not change them. The canonical chart selection handover at
`plans/2026-10-25_canonical_chart_selection_handover.md` lists that change's
complete files and shared dependencies where applicable.

The existing Pages workflow's other generators/injectors/hash helpers remain
dependencies of promoting that complete workflow. No LIVE repository was read,
so later authorised promotion must compare its current baseline to the TEST
dependency set. Do not copy TEST CNAME, credentials, Archive contents or generated
`.pages-site` artifacts into LIVE source.

## Structural checks, deployment and rollback

Local checks cover script/workflow parsing, CNAME-derived metadata, invalid or
missing CNAME/API settings, unchanged page body and private-flow controller.
Real browser, Turnstile, subscription, Queue and SMTP acceptance remains pending
a separately authorised TEST deployment. No functional/browser suite is added.

Before any later authorised merge/deployment, verify the staged TEST CNAME,
existing email API origin/site key, Worker canonical website and hostname list
all refer to TEST. A syntactically valid wrong CNAME or API origin cannot be
identified as the wrong environment by generic source code; manual release
review is necessary. Merging to main triggers Pages, so a review-ready PR is
not approval to merge.

After deployment approval, verify all four metadata URLs and normal indexing,
then separately authorise real private-flow/subscription validation. Deploy the
matching Media Worker with sending disabled; activation and real delivery need
their own explicit TEST authorisation. Neither website has a separate subscriber
database, and beta subscriptions must not require registration again at public
launch.

Rollback restores matching known-good Pages artifacts, Worker/optional sender
and environment configuration without altering subscriber records or issued
token semantics. Keep direct and legacy fragment routes. Today's exact
pre-change snapshots are reference only; older archives remain unchanged.

## Authoritative system-doc handover

Update `website_deployment/contract.md` with CNAME-derived site metadata and the
existing API/site-key injection before hashing, validation failure behaviour and
unchanged CNAME/environment ownership. Update
`website_ui/news-email-subscription-ui-contract.md` with the standalone/direct
route, normally indexable public prelaunch page, private-flow noindex behaviour,
beta/public entry-link staging and unchanged form/navigation behaviour.
Media's handover covers shared hostname authority, canonical links and manual
environment review. Authoritative system docs were read only.
