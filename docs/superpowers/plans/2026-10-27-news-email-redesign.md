# News by Email redesign implementation plan

**Goal:** Implement the user's agreed landscape subscription design in TEST and correct verification state handling.

**Architecture:** Reuse the existing static page, subscription controller, shared sidebar and Pages injection/hash pipeline. Keep the API payloads, double opt-in, UK delivery choices, management and unsubscribe boundaries.

**Tech stack:** HTML, CSS Grid, browser JavaScript, Node.js Pages helpers.

**Spec:** The current task's agreed redesign and the read-only `system_docs/website_ui/news-email-subscription-ui-contract.md` and `system_docs/media/media-news-email-contract.md` contracts.

## Constraints

- TEST only; branch, commit, push and PR to main; no merge or deployment.
- Preserve exact pre-change implementation in `Archive/2026-10-27/` once per file.
- No new speculative frontend suites. Local validation is structural; real functional and visual acceptance belongs on deployed TEST.
- Use existing deployment variables/secrets; identical application code for TEST/LIVE.

## Investigation and design

The existing Turnstile loader writes `Loading subscription verification…` into the general result status. Success only assigns a token and enables Submit, leaving that message forever. Email confirmation is already a separate secure-fragment API flow. Separate widget status from subscription/confirmation status; reserve the original loading message for an actual confirmation request, with a bounded request and explicit final result.

Use a 1,200px page shell and a component-width-driven Grid: preferences on the left, consent/verification/actions on the right, stacking when either column cannot fit. Keep the hidden internal heading for named secure-link result views only. Subscribe is approximately 160px; outlined Cancel links to `/news/`.

Use supported Turnstile `interaction-only` appearance, hide the widget container on success, invalidate tokens before re-verification and prevent callback races from enabling a pending submission. Reset only for a visible form after an unsuccessful request. Keep widget status/errors separate so refresh cannot erase the final subscription or API error message.

## Tasks

- [x] Inspect scoped contracts, markup/controller/style ownership, configuration and Pages pipeline; confirm structural viability with existing JS syntax checks.
- [x] Create a TEST feature branch and preserve pre-change files.
- [x] Update `news-by-email/index.html` and `news/subscription.css` for the responsive columns, scoped width, action row and separate verification status/retry.
- [x] Update `news/subscription.js` for widget lifecycle, bounded requests, confirmation outcomes and existing manage/unsubscribe flows.
- [x] Update `news/subscription-config.js`, `scripts/uk_aq_inject_media_email_config.mjs` and `.github/workflows/pages.yml` to reuse `UK_AQ_TURNSTILE_SITE_KEY` in staged injection before hashing.
- [x] Run Node syntax, HTML structure/CSS delimiter checks, staged configuration/hash integrity and diff checks. Review the final diff and exact archives.
- [ ] Commit, publish the feature branch, and open/attach a PR with cause, resolution and deployed TEST acceptance steps.

## Review focus and deployed TEST acceptance

Check Immediate/Daily and UK time; desktop/tablet/mobile layout and keyboard focus; neutral check-email/Junk confirmation; widget automatic completion, interaction, script failure, token expiry, retry and server rejection; callbacks during submission; valid, invalid, used, expired and unavailable confirmation links; legacy `/news/#…` redirects; secure Manage save and Unsubscribe; same-tab News state after Cancel.

No backend, authentication, rate-limit, consent-version, email transport or data-semantic changes are intended. No system-doc edits are authorised. Hand over the new layout and separate verification-status behaviour for documentation maintenance.

## Local verification evidence

- Node 24 syntax checks passed for the controller, public configuration and configuration injector.
- HTML nesting, unique IDs, labels/ARIA/controller references, local asset existence and CSS delimiter checks passed.
- Pages workflow YAML parses and supplies the existing public site-key secret to staged injection before asset hashing.
- A disposable staged configuration rejected a missing site key without changing bytes, then injected a sample public origin/key successfully.
- The existing full content-hash helper processed 103 active assets across 18 HTML files; all subscription-page local asset URLs matched the SHA-256 prefix of their staged bytes.
- Every archive remained byte-identical through hashing; all six new snapshots match the exact baseline. Tracked configuration retains placeholders.
- Independent read-only review found no actionable issues. Real Turnstile, viewport, API and email acceptance remains deferred to deployed TEST.
