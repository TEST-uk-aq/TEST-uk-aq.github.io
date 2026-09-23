# Shared site-footer attribution contract

Status: authoritative for current UK AQ shared footer attribution behaviour and the authorised next Black Carbon attribution phase. The grouped `black_carbon` pill is future runtime until implemented and accepted on TEST.

## Scope

This contract governs:

- the shared website footer rendered by `/sidebar.js`;
- which existing network attribution blocks and network-specific marks/pills remain visible;
- grouped provider attribution boxes whose network pills are independently public-display gated;
- the use of `network_code` as the attribution mapping key;
- use of the public network catalogue to reflect `public_display_enabled` state;
- fail-open behaviour when catalogue filtering cannot be completed;
- the boundary between database-backed visibility and bespoke licence/attribution wording.

It does not define whether a network is public, the `/api/aq/networks` security/cache contract, network ingestion, station eligibility or the legal wording required by a data provider beyond the currently implemented attribution definitions.

Public-network eligibility and browser-facing catalogue delivery are owned by [`../cache_proxy/public-network-catalog-contract.md`](../cache_proxy/public-network-catalog-contract.md).

## Shared footer ownership

`/sidebar.js` remains the shared owner of the site footer and its attribution definitions.

The footer MUST remain shared site chrome rather than being duplicated independently into individual pages.

Current attribution presentation/styles are implemented primarily by:

```text
/sidebar.js
/site-footer.css
```

## Attribution definitions

Network-specific attribution content remains explicit website content.

The footer MUST NOT construct licence wording, provider links or logos automatically from arbitrary database fields.

Each supported attribution definition MUST instead be explicitly associated with its canonical `network_code`.

The shared footer has or is authorised to have explicit attribution definitions for:

```text
gov_uk_aurn
black_carbon
breathelondon
openaq
sensorcommunity
```

`gov_uk_aurn` and `black_carbon` belong to one grouped Defra/UK-AIR attribution box. They share the common Crown copyright / Open Government Licence wording, but each network MUST retain its own independently catalogue-gated pill:

```text
gov_uk_aurn  -> GOV.UK AURN
black_carbon -> Black Carbon
```

The grouped presentation MUST NOT conflate the two canonical network identities. The AURN pill may be visible without the Black Carbon pill, and the Black Carbon pill may be visible without the AURN pill.

These definitions record available attribution content only. Their presence in `/sidebar.js` MUST NOT make a network publicly visible when the public network catalogue excludes it.

A new public network that needs footer attribution requires an intentional attribution definition with the correct provider/licence wording. The UI MUST NOT fabricate an attribution block merely because a previously unknown `network_code` appears in the catalogue.

## Visibility source of truth

The footer MUST determine which existing attribution definitions are applicable from the public network catalogue exposed at:

```text
GET /api/aq/networks
```

The footer MUST NOT query the `networks` table directly.

The catalogue's public eligibility is ultimately controlled by canonical `uk_aq_core.networks.public_display_enabled` through the public database/API contract.

For footer matching, `network_code` is the stable identity. Numeric `network_id` MUST NOT be used as the primary mapping key between catalogue rows and attribution definitions.

## Render and filter behaviour

The footer MAY render its explicit attribution definitions before the public catalogue result is available.

After a valid contract-v2 public network catalogue is available, the footer MUST:

1. collect the returned public `network_code` values;
2. compare them with the explicit network attribution definitions already rendered;
3. hide/remove a network-specific mark, pill or standalone attribution section when its `network_code` is absent from the public catalogue;
4. retain a network-specific mark, pill or standalone attribution section when its `network_code` is present;
5. for a grouped provider box, retain the box and its shared provider/licence copy while at least one of its defined child network codes remains applicable;
6. hide/remove a grouped provider box when none of its defined child network codes remains applicable;
7. avoid creating a new attribution definition for an unknown public `network_code`;
8. hide the attribution-source container if no defined attribution boxes/sections remain visible.

For the grouped Defra/UK-AIR attribution box specifically:

- `GOV.UK AURN` MUST follow `gov_uk_aurn` catalogue presence;
- `Black Carbon` MUST follow `black_carbon` catalogue presence;
- the common Defra/UK-AIR Crown copyright / OGL copy MUST appear only once in the grouped box;
- the common copy remains while either pill is applicable;
- the complete grouped box disappears only when neither pill is applicable after valid catalogue filtering.

This means the footer follows the same public-network switch used by the rest of the website while preserving manually controlled provider/licence content and allowing related networks to share one attribution box without sharing visibility state.

## Catalogue reuse

The footer SHOULD avoid unnecessary duplicate catalogue work where the page has already obtained the same public network catalogue.

It MAY reuse the shared `window.UkAqPublicNetworkCatalogSnapshot` when available.

Where the shared network-catalogue client is already loaded and will publish the current catalogue, the footer MAY consume that shared result/event instead of issuing its own request.

A lightweight/static page that does not load the protected cache-auth/network-catalogue stack MAY fetch `/api/aq/networks` directly with browser credentials omitted.

A static page MUST NOT initialise Turnstile or create a protected data session solely to decide which shared footer attributions are applicable.

The cache-proxy contract is authoritative for why this metadata route may be read without that session.

## Fail-open attribution behaviour

Filtering is fail-open for attribution visibility, including every pill inside a grouped provider box.

If the footer cannot establish a valid public network catalogue because of conditions such as:

- request failure;
- non-success HTTP status;
- malformed payload;
- unexpected contract version;
- missing/empty `network_code` in a returned row;

then the footer MUST retain the explicit attribution definitions rather than removing them based on uncertain data.

This fail-open rule is deliberate. A temporary metadata/API problem MUST NOT cause source/licence attribution that may still be legally or operationally relevant to disappear from the website.

Fail-open attribution does not make the associated network's data public. It affects footer presentation only.

## Unknown public networks

If a valid public catalogue contains a `network_code` for which the footer has no explicit attribution definition:

- the footer MUST NOT invent wording or licence terms;
- existing defined/public attribution sections continue normally;
- the missing definition SHOULD remain diagnostically visible in browser logging so it can be reviewed deliberately.

Adding the new attribution text is a website-content decision and may require provider/licence review before implementation.

## Layout behaviour

The shared footer layout MUST remain usable when filtering changes either the number of attribution boxes or the number of pills inside a grouped provider box.

The Defra/UK-AIR box MUST lay out one or both surviving pills cleanly without reserving an empty slot for a filtered network.

Presentation MUST adapt to the actual surviving source count rather than preserving empty positions for removed networks.

Filtering MUST NOT require separate mobile and desktop attribution logic. The same surviving attribution set applies across responsive widths.

## Data/API boundary

This contract controls presentation only.

It MUST NOT independently redefine:

- the meaning of `public_display_enabled`;
- which network rows `/api/aq/networks` returns;
- cache-proxy origin/authentication behaviour;
- network eligibility for maps, charts, stations or observations.

Those rules remain with their owning data/API contracts.

## Implementation ownership

Current implementation is primarily in:

```text
TEST-uk-aq/TEST-uk-aq.github.io/sidebar.js
TEST-uk-aq/TEST-uk-aq.github.io/site-footer.css
TEST-uk-aq/TEST-uk-aq.github.io/shared/data/network-catalog.js
```

`shared/data/network-catalog.js` may publish/reuse the catalogue snapshot for pages that already use that shared client, while `/sidebar.js` remains the attribution-definition and footer-filter owner.

## Validation rule

Before implementation/deployment, only structural viability needs to be established: every explicit attribution mark has the intended `network_code`, grouped-provider child pills can be filtered independently, the public catalogue interface is compatible, and fail-open handling cannot remove attribution on an invalid result.

Functional and visual acceptance occurs through real TEST operation after deployment. A useful operational check is to change or inspect a known network's public visibility and confirm the corresponding footer attribution follows the public catalogue on both a normal data page and a lightweight/static page without introducing a Turnstile/session flow solely for the footer.
