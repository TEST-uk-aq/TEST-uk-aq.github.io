# Public network catalogue cache-proxy contract

Status: authoritative for the current public network metadata route used by the UK AQ website.

## Scope

This contract governs:

- the public browser-facing `/api/aq/networks` route;
- the route's read-only/session-free security boundary;
- public-network eligibility exposed through that route;
- stable network identity used by website consumers;
- the response contract required by shared website network-catalogue consumers;
- preservation of authentication rules for unrelated cache-proxy routes.

It does not define station eligibility, observation eligibility, connector behaviour, network attribution wording, footer layout or network administration procedures.

Website footer presentation based on this catalogue is owned by [`../website_ui/site-footer-attribution-contract.md`](../website_ui/site-footer-attribution-contract.md).

## Public route

The cache proxy MUST expose the public metadata route:

```text
GET /api/aq/networks
```

This route is intentionally public read-only metadata. A normal browser request to this route MUST NOT require:

- a `uk_aq_edge_session` cookie;
- Turnstile completion;
- a session-start request solely to obtain the network catalogue.

Making this route public MUST NOT broaden or weaken the authentication requirements of any other cache-proxy route. Other routes retain the behaviour defined by their own active contracts and implementation boundaries.

## Origin boundary

The public network catalogue remains inside the cache proxy's existing website-origin boundary.

Before treating `/api/aq/networks` as session-free, the Worker MUST establish an allowed request origin using the existing cache-proxy origin validation rules.

A request from an origin that is not allowed MUST NOT receive the catalogue merely because this route is public metadata.

Same-origin browser requests where the browser legitimately omits the `Origin` header MAY use the Worker's existing same-origin request evidence/recovery path. The public-route exception MUST NOT become a general origin-validation bypass.

## Source and public eligibility

The route MUST resolve to the existing public network catalogue data product (`uk_aq_public_networks` / the corresponding `uk_aq_public.networks` contract).

A network is eligible for this public catalogue only when its canonical `uk_aq_core.networks.public_display_enabled` value is `true`.

The public database boundary itself MUST enforce that eligibility. Browser code MUST NOT be the only layer preventing `public_display_enabled = false` networks from appearing in the public catalogue.

A change to `public_display_enabled` is therefore the authoritative switch for whether that network is returned by `/api/aq/networks`, subject to normal metadata-cache propagation.

## Network identity

`network_code` is the stable semantic identity for website/public-network behaviour.

Website consumers MUST use `network_code` when associating a returned public network with a known UI definition, attribution block or other network-specific presentation.

A numeric `network_id` MAY remain present for database/public API purposes, but it MUST NOT replace `network_code` as the website's stable mapping key.

Current canonical codes relevant to the shared footer include:

```text
gov_uk_aurn
black_carbon
breathelondon
openaq
sensorcommunity
```

This list records existing identities only. It does not make a network public independently of `public_display_enabled`.

## Response contract

The browser-facing network catalogue MUST retain contract version `2` while the current shared website consumers depend on that shape.

A successful response MUST provide:

- `contract_version = 2`;
- a `data` array;
- a non-empty `network_code` for every returned network row.

The underlying public network row MAY expose the existing public metadata fields such as:

- `network_id`;
- `network_code`;
- `network_label`;
- `network_type`;
- `public_display_enabled`;
- `default_priority`.

The route MUST NOT expose a disabled network simply to preserve a previously returned row or hard-coded website option.

Changing the response contract version, removing `network_code`, or changing public-network eligibility requires an intentional contract update before website consumers are changed.

## Caching and propagation

`/api/aq/networks` uses the cache proxy's metadata cache profile.

The route MAY therefore be served through normal metadata caching rather than querying the upstream database on every page load. A `public_display_enabled` change is expected to propagate according to that cache behaviour rather than requiring every browser request to bypass cache.

Caching MUST NOT manufacture or retain a network that is absent from the successfully refreshed public upstream catalogue beyond the normal cache/stale behaviour already owned by the cache proxy.

## Browser-consumer boundary

The route exists so lightweight/static website pages can read public network visibility without initialising the protected data-session/Turnstile path merely to render shared site chrome.

A website consumer MAY therefore fetch `/api/aq/networks` without credentials for this metadata purpose.

Pages that already have a valid shared public-network catalogue snapshot MAY reuse that snapshot instead of making a duplicate network-catalogue request.

Website presentation code MAY also keep a minimal validated same-tab/session cache derived from a successful contract-v2 catalogue so later full-page navigations can reconstruct presentation state without another blocking request.

Such a browser cache is a consumer optimisation only. It MUST NOT redefine public eligibility, persist failure/fail-open state as validated catalogue data, or become the authoritative source of network visibility.

A manual reload MAY choose to refresh the route so recent `public_display_enabled` changes can be picked up promptly despite the same-tab/session presentation cache.

This contract does not require every page to load the shared network-catalogue JavaScript client. It requires only that all consumers use the same public catalogue semantics.

## Failure boundary

Failure of the public network catalogue MUST remain local to consumers of this metadata. It MUST NOT cause the cache proxy to grant broader access to protected routes or silently switch the browser to direct private-database access.

Consumer-specific fallback presentation is owned by the relevant website UI contract.

## Implementation ownership

Current implementation is primarily in:

```text
TEST-uk-aq/uk-aq-ops/workers/uk_aq_cache_proxy/src/index.ts
TEST-uk-aq/uk-aq-schema/schemas/ingest_db/uk_aq_network_public_contract_phase1.sql
TEST-uk-aq/uk-aq-schema/schemas/ingest_db/uk_aq_rpc.sql
```

The public database view/RPC remains responsible for public-network filtering; the Worker remains responsible for the browser-facing route, origin boundary, cache behaviour and route-specific session exemption.

## Validation rule

Before implementation/deployment, only structural viability needs to be established: route identity, public-view filtering, response version/identity fields and confinement of the session exemption to the intended metadata route.

Functional acceptance occurs after deployment through real TEST operation. A representative static page should be able to obtain the network catalogue without starting a Turnstile/session flow, while protected data routes continue to retain their existing access boundary.
