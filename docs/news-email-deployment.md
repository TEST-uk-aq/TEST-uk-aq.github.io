# News by Email deployment configuration

Source markup is environment independent. The existing Pages staging injector
now requires these repository variables before content hashing:

| Variable | TEST | LIVE BETA | Public LIVE |
| --- | --- | --- | --- |
| `UK_AQ_SITE_ORIGIN` | TEST website HTTPS origin | LIVE BETA website HTTPS origin | Canonical public LIVE website HTTPS origin |
| `UK_AQ_MEDIA_EMAIL_PUBLIC_URL` | TEST email Worker origin | Same LIVE email Worker as public LIVE | LIVE email Worker origin |
| `UK_AQ_NEWS_EMAIL_INDEXABLE` | `false` for private acceptance | `false` before launch | `false` for unadvertised prelaunch; `true` only when indexing is intended |

`UK_AQ_TURNSTILE_SITE_KEY` remains the existing public browser site key, injected
from the existing Actions secret. Its server-side counterpart and allowed
hostnames must match the selected Worker environment. LIVE BETA and public LIVE
must both use the LIVE subscription backend; they must not fall back to TEST.
No new browser or server secret is introduced.

Site/API origins must be canonical HTTPS origins, optionally followed by one
slash; credentials, other paths, query, fragment, wildcard, unsafe normalised URL
forms and missing values fail the build. The indexing setting must be exactly
`true` or `false`; there is no implicit default. The injector updates only staged
`news/subscription-config.js` and `news-by-email/index.html`. It validates required
files and placeholder counts before writing. Canonical URL, Open Graph URL and
Open Graph/Twitter images use the site's configured origin. Indexing disabled
produces `noindex, nofollow`; enabled produces `index, follow`.

This setting controls crawler metadata, not access control or navigation.
TEST's existing News and Contact entry links remain unchanged. For public
prelaunch promotion, publish the subscription page and shared assets without
copying TEST entry-link markup into public News, Contact or navigation. LIVE BETA
can keep those existing entries. Preserve the respective CNAME and deployment
configuration. Do not create hostname-dependent logic or environment-specific
application files. Any further navigation visibility work must use deployment
configuration and preserve the shared form/controller code.

## Complete promotion scope

Promote this PR's `news-by-email/index.html`,
`scripts/uk_aq_inject_media_email_config.mjs`, `.github/workflows/pages.yml` and
this handover. A destination that has not received the current standalone page
also needs the matching unchanged `news/subscription.js`,
`news/subscription-config.js`, `news/subscription.css` and their current shared
page dependencies. These include `news/news.css`, `site-ui.css`, `bottom-nav.css`,
`mobile.css`, `sidebar.js` and its shared dependencies, favicon/share artwork,
`images/UK-AQ-NEWS-BY-EMAIL-1line.svg`,
`images/UK-AQ-NEWS-BY-EMAIL-2lines.svg`, and `images/UK-AQ-back-arrow.svg`.
The controller keeps old `/news/#confirm|manage|unsubscribe` links compatible;
retain its loading on `/news/` where legacy links may arrive, without copying the
News page's subscription entry markup into an unadvertised public launch.
No LIVE repository was inspected, so verify those dependencies in the later
authorised promotion review; existing TEST source alone does not prove LIVE parity.

Do not promote TEST Archive contents, generated `.pages-site` files, CNAME,
environment configuration or credentials. Apply the same source code to both
LIVE sites and select their origins/indexing/entry visibility through deployment
configuration. This PR makes no navigation or form redesign.

## Deployment and rollback

No deployment is authorised or performed by this change. Before any later merge,
set the required TEST variables: merging to main triggers Pages deployment.
After separately authorised TEST deployment, inspect all four metadata URLs,
robots content, unchanged form/navigation and real confirmation/manage/unsubscribe
fragments. Real subscription/SMTP/Queue validation requires explicit permission
to enable TEST delivery and exercise those services. The matching Media Worker
must accept the TEST origin and generate canonical TEST website links.

Restore a known-good Pages artifact and its matching configuration for rollback;
do not alter subscriber data. Retain both fragment routes because previously
issued links remain in mailboxes. Today's pre-existing Archive snapshots are
retained without overwriting; the PR's base commit records the immediate
pre-change source for exact rollback. Archive code is reference only.

Update authoritative `website_deployment/contract.md` with required site/indexing
injection before hashing and fail-closed configuration; update
`website_ui/news-email-subscription-ui-contract.md` with the standalone route,
unadvertised public prelaunch page and configurable indexing/entry visibility.
The Media contract needs the companion PR's origin/link changes. System docs
were read only, and browser/SMTP/Queue acceptance remains pending deployment.
