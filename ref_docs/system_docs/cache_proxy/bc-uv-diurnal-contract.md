# BC/UV diurnal-profile cache-proxy contract

## Status

**Authoritative future implementation contract. Not current deployed runtime behaviour.**

This contract defines the public derived-data product used by the Wood Burning page for Black Carbon and UV daily-cycle profiles.

Canonical Black Carbon observation publication remains owned by the existing ingest and R2-history contracts. This contract does not create a third canonical observation stream.

## Public route

The cache proxy MUST expose:

```text
GET /api/aq/bc-uv/diurnal
```

The route is public read-only website data. The term `diurnal` means a repeated 24-hour profile by GMT hour ending; it does not imply multiple product refreshes during a day.

## Product properties

The initial derived product supports:

```text
bc
uv370
uvpm
```

| Product code | Meaning | Authority |
|---|---|---|
| `bc` | Black Carbon at 880 nm | canonical stored `bc` observations |
| `uv370` | UV particulate matter at 370 nm | canonical stored `uv370` observations |
| `uvpm` | UV component / UV-BC | derived from exact-timestamp `uv370 - bc` |

`uvpm` is a derived product value. The route MUST NOT require or invent a canonical stored `uvpm` timeseries or R2 observation row.

## Canonical source boundary

The product MUST derive from accepted canonical R2 observation history for the dedicated `ukair_bc` connector.

The browser MUST NOT download annual UK-AIR CSV files or large raw R2 histories to calculate these profiles. It MUST NOT derive `uvpm` locally.

A partial, gapped or otherwise untrustworthy canonical read MUST NOT be published as a complete replacement derived generation.

## UVPM derivation

For one Black Carbon station and one exact canonical endpoint `t`:

```text
uvpm(t) = uv370(t) - bc(t)
```

A derived hourly value exists only when both finite canonical inputs belong to the same station and have the same exact `observed_at_utc`.

If either input is missing, `uvpm` is missing for that timestamp. The implementation MUST NOT use nearest-time pairing, interpolation, forward/back filling, another station, or subtraction of separately aggregated monthly means.

`uvpm` MUST be derived from exact paired hourly values before month/hour aggregation.

Finite negative `uvpm` values MUST be retained and MUST NOT be clamped to zero. Finite zero is also valid.

### Derived verification status

Hourly derived provenance is:

```text
bc = R and uv370 = R  -> uvpm = R
otherwise, when both finite inputs exist -> uvpm = P
```

This derived status is product provenance only and MUST NOT mutate the source observations.

## GMT hour-ending semantics

The product uses the UK-AIR source convention `GMT hour ending` with 24 slots from `01:00` through `24:00`. BST MUST NOT be applied.

Canonical endpoint hours `01:00` through `23:00` map directly to the same hour-ending number. A canonical `00:00` endpoint maps to hour ending `24:00` for the preceding source calendar day.

Month grouping MUST therefore follow the represented GMT hour-ending interval, not naive `date(observed_at_utc)` grouping at midnight. An equivalent deterministic implementation may derive source calendar identity from an instant immediately before the endpoint.

## Monthly aggregation

For each eligible station, property, calendar month and GMT hour-ending slot, the builder MUST calculate a mean from finite accepted values in that exact group.

For `bc` and `uv370`, each property uses its own canonical observations. For `uvpm`, only exact-timestamp paired derived values contribute.

Each aggregate point MUST expose at least:

```text
month
hour_ending
mean_ugm3
observation_count
ratified_count
provisional_count
source_validation_status
```

For a non-empty point, `source_validation_status` is `R` only when all contributors are ratified; otherwise it is `P`. For an empty point the mean/status are null and all counts are zero.

Missing values MUST NOT be imputed.

## Summer/Winter support

The route MUST provide the aggregates required by the Wood Burning presentation:

```text
Summer = April through September
Winter = October through March
```

The response MUST identify the exact calendar months represented. A currently incomplete month or half-year may be returned, but the actual latest canonical source day and point-level counts MUST remain visible so incompleteness is not hidden.

The selected month set MUST be deterministic and MUST NOT silently mix non-adjacent months merely to fill six lines.

## Station population

The product SHOULD contain the eligible current public Black Carbon sensor population needed by the Wood Burning page so the browser can paginate six sensors at a time without a raw-history request per sensor.

Each sensor entry MUST include stable canonical identifiers, display name, `network_code = black_carbon`, latitude and longitude, plus the stored source-property timeseries IDs where relevant. A `uvpm` timeseries ID MUST NOT be invented.

## Response semantics

The response MUST include at least:

```text
contract_version
generated_at
source_through_day
network_code
properties
summer/winter month identities
sensors
per-property monthly hour-ending profile points
```

The exact JSON nesting may be refined during implementation if an existing shared public field name should be reused, but the semantics above are authoritative.

## Refresh and publication cadence

The derived product is intended to refresh **once per day**, after canonical Black Carbon observation reconciliation has made the relevant source state available.

A normal successful build MUST derive from canonical history rather than independently fetching the mutable UK-AIR source, validate the complete response, and publish the new generation atomically.

If canonical history is unchanged, a byte-identical/no-op result is allowed. Historical corrections and P-to-R changes within the selected profile period MUST be able to alter a later daily generation.

`source_through_day` MUST reflect canonical source coverage, not merely the calendar day on which the builder ran.

## Caching and failure

The public route SHOULD use a daily-derived-data cache policy rather than realtime observation caching.

A failed refresh MUST NOT replace a previously validated body with partial or malformed output.

The builder MUST fail closed for publication when canonical source coverage is contradictory/incomplete, station/property identity cannot be resolved, exact pairing is ambiguous, an aggregate is non-finite, or the selected month set cannot be represented deterministically.

The route MUST NOT manufacture sample values.

## Ownership boundaries

Canonical stored observations remain owned by the Black Carbon source and R2 history contracts. Black Carbon metadata identity remains owned by the Black Carbon identity contract. Wood Burning chart presentation remains owned by the Wood Burning page contract.

This contract owns only the derived BC/UV profile and its public cache-proxy boundary.

## Structural validation before implementation

Before implementation, validate only that:

- accepted canonical `bc` and `uv370` history can be read server-side for the required profile period;
- the two properties can be joined by canonical station identity and exact `observed_at_utc`;
- GMT `24:00` can be assigned to the preceding source calendar day/month without ambiguity;
- negative `uvpm` can pass through the derived schema/JSON unchanged;
- the cache proxy can serve one validated product without exposing privileged raw-history access;
- the response size for the current sensor population and required months is suitable for one browser fetch.

No broad speculative pre-deployment functional test suite should be created.

## TEST functional acceptance

After deployment, real TEST operation SHOULD confirm that the route serves `bc`, `uv370` and `uvpm`; `uvpm` is calculated before aggregation from exact timestamp pairs; missing inputs do not create derived values; negative values are retained; midnight endpoints populate source hour-ending `24:00`; aggregate counts/provenance match contributors; historical corrections/ratification can change a later daily generation; and one response can supply the six-sensor website page without browser-side raw-history aggregation.
