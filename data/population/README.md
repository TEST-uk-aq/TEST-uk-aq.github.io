# Interim TEST Hex Map population snapshot

Reviewed on 2026-09-30. These are version-controlled deployment assets, not a scheduled ingest.
The active system population contract remains authoritative; this file records snapshot provenance.

| Asset | Coverage | Reference year | Approximate uncompressed size |
| --- | --- | --- | --- |
| `pcon-latest.json` | 650/650 | 2024 | 55,738 bytes |
| `lad-latest.json` | 359/361 | 2025 | 30,865 bytes |

## Official sources and selections

All values are total resident population, all ages and both sexes. Mid-year reference dates are
30 June of the estimate year, never the download/publication year. No name joins, interpolation,
boundary conversion or local aggregation were performed. Source precision is retained: NRS LAD
totals are published rounded to tens; Scottish PCON values are copied directly from the NRS
workbook, and Nomis/NISRA selections use their unrounded totals.

| Nation / geography | Source / input filename | Selection |
| --- | --- | --- |
| England & Wales PCON | [ONS via Nomis PESTOA2021 / NM_2014_1](https://www.nomisweb.co.uk/datasets/pestoa2021), `pcon.csv` | TYPE172 = July 2024 constituencies; Total gender, All Ages, Value, normal observations; reference 2024. 543 England + 32 Wales. |
| England & Wales LAD | [ONS via Nomis NM_2002_1](https://www.nomisweb.co.uk/datasets/pestsyoala), `lad-current.csv` | Request exact current map codes; Total gender, All Ages, Value, normal observations; reference 2025. 294 England + 22 Wales. |
| Scotland PCON | [NRS Other geographies: mid-2011 to mid-2024 (2022 data zones)](https://www.nrscotland.gov.uk/publications/other-geographies-mid-2011-to-mid-2024-2022-data-zones/), `nrs-pcon.xlsx` | Published 1 September 2026. Workbook `special-area-population-tables-mid-2011-to-mid-2024.xlsx`, sheet `UKPC`; `Sex = Persons`, `Year = 2024`, `All ages`. Join on `UKPC (2024) Code`: exactly the current 57 Scottish `S140...` map codes. |
| Scotland LAD | [NRS mid-2025 population estimates](https://www.nrscotland.gov.uk/publications/mid-2025-population-estimates/), `nrs.xlsx` | Table 1, Council area, Persons, All ages, code in current map: 32 rows, reference 2025. |
| Northern Ireland PCON | [NISRA small-area estimates mid-2024](https://www.nisra.gov.uk/publications/2024-mid-year-population-estimates-small-geographical-areas-within-northern-ireland), `ni-pcon.xlsx` | Flat sheet; Parliamentary Constituencies (2024), Unrounded, latest year per code: 18 rows, reference 2024. Explicit vintage selection is essential: the workbook also contains 2008 constituencies with overlapping codes. |
| Northern Ireland LAD | [NISRA mid-2025 estimates](https://www.nisra.gov.uk/publications/2025-mid-year-population-estimates-northern-ireland-and-estimates-population-aged-85), `ni-lad.xlsx` | Flat sheet; Local Government Districts (LGD2014), Unrounded, latest year per exact current code: 11 rows, reference 2025. |

The September 2026 NRS workbook supplies official mid-2024 population totals for the current
2024 UK Parliamentary Constituencies. Its `UKPC` headers explicitly identify the 2024 geography;
Note 7 confirms 57 constituencies and a 2022 Data Zone basis. NRS constructs these estimates on
a best-fit basis; this importer copies the published totals without performing its own aggregation.
The 57 `UKPC (2024) Code` values match the current Hex Map exactly. Names are descriptive only;
no name join or separate Output Area lookup is required. The older 59-seat/2005-boundary source,
electoral register and Scottish Parliament (`SPC`) sheet are not used. All 650 PCON rows now have
`reference_date = "2024-06-30"`; September 2026 is the publication date, not the reference year.

The importer checks the exact `UKPC` title and dimension headers, allowed sex/year dimensions,
unique selected rows and equality with the expected 57-code map set before allowing output.

Official source data are Crown copyright, available under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

## Deliberate gaps

- LAD `E08000038` (Barnsley), `E08000039` (Sheffield): the available ONS/Nomis
  mid-2025 population product still uses 2023 LA boundaries. The exact new 2025 codes
  return no rows. Do not reuse `E08000016` / `E08000019` through the map's legacy aliases.
  [ONS release editions](https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/estimatesofthepopulationforenglandandwales).
- Every pre-2024 map constituency intentionally displays `Population: n/a`, including codes
  retained across vintages. The UK controller checks the actual geometry configuration.

## Reproduce this reviewed snapshot

Use Python with `openpyxl` installed. Download to a scratch directory outside the published tree.
These commands use read-only public HTTPS requests. No credentials or database access are needed.
They pin the reviewed reference periods; a future refresh requires checking current releases and
boundary compatibility again, not just changing a global year. The generator fails if the reviewed
coverage or source dimensions change. It validates both outputs before writing either.

```bash
mkdir -p /tmp/uk-aq-population-sources
curl --fail --location 'https://www.nomisweb.co.uk/api/v01/dataset/NM_2014_1.data.csv?geography=TYPE172&gender=0&c_age=200&date=2024&measures=20100' -o /tmp/uk-aq-population-sources/pcon.csv
curl --fail --location 'https://www.nisra.gov.uk/system/files/statistics/2025-12/MYE24_POP_TOTALS_NI_HSCT_PC_0.xlsx' -o /tmp/uk-aq-population-sources/ni-pcon.xlsx
curl --fail --location 'https://www.nisra.gov.uk/system/files/statistics/2026-09/MYE25-POP_TOTALS.xlsx' -o /tmp/uk-aq-population-sources/ni-lad.xlsx
curl --fail --location 'https://www.nrscotland.gov.uk/media/15rlr1vf/data-mid-year-population-estimates-mid-2025.xlsx' -o /tmp/uk-aq-population-sources/nrs.xlsx
curl --fail --location 'https://www.nrscotland.gov.uk/media/g4ym15ob/special-area-population-tables-mid-2011-to-mid-2024.xlsx' -o /tmp/uk-aq-population-sources/nrs-pcon.xlsx
python3 - <<'PYDOWNLOAD'
import json
import urllib.parse
import urllib.request
from pathlib import Path
geometry = json.loads(Path('data/LAD/uk_aq_la_hex_2025.geojson').read_text())
codes = sorted({f['properties']['la_code'] for f in geometry['features']
                if f['properties']['la_code'][0] in 'EWS'})
query = urllib.parse.urlencode(dict(geography=','.join(codes), gender=0,
                                   c_age=200, date=2025, measures=20100))
url = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_2002_1.data.csv?' + query
with urllib.request.urlopen(url, timeout=60) as response:
    Path('/tmp/uk-aq-population-sources/lad-current.csv').write_bytes(response.read())
PYDOWNLOAD
python3 scripts/uk_aq_build_population_snapshot.py /tmp/uk-aq-population-sources
```

Expected: PCON 650 rows / 0 missing; LAD 359 rows / 2 missing. The initial Nomis downloads
used `date=latest`, which returned 2024 and 2025 respectively; the commands above pin those
same periods. Nomis may subsequently revise values, so review diffs and source changes.
The generator prints input SHA-256 values. Initial downloaded bytes:

| Input | SHA-256 |
| --- | --- |
| `pcon.csv` | `b5aafda618b57494736952a72e58f663f466efab794727bae37a472ba2d1b3e3` |
| `lad-current.csv` | `d907eec91b1babf2d4601d37b1f134054224eba8c078dfa38e15ae92b45d18eb` |
| `ni-pcon.xlsx` | `ebe36e1af0e7d2a56b2bdd6474feb0c75c92901f1196e69f82996fbc6ac0740b` |
| `ni-lad.xlsx` | `e2716416280f935ab1bb41e6d4b2bfe175d2b3fc76faf157145ecd625f8a48d3` |
| `nrs.xlsx` | `d9cc42bcff7551801e2243ae1a788ae017b6787633f6dab0bf764caa18389d76` |
| `nrs-pcon.xlsx` | `cb07c193519ea3d695c6ecabbab86cb5b53a9151dd7c97a40eead2c517d1d3c3` |

## Runtime and TEST acceptance after deployment

The controllers each start one independent static fetch during initialization and retain a local
lookup. Historical UK geometry skips the PCON fetch entirely. No polling/Refresh path fetches or
resets population. Invalid payloads fail open to an empty lookup. Lookup admission requires a
positive integer, a unique canonical code and a real ISO date. Tooltips use each row's reference
year: `Population: 123,456 (2025)`; all other tooltip lines retain their existing formatting.
No coordinator, network, station-chart, AQ payload or Supabase population changes are involved.

After review and normal TEST Pages deployment (not performed by this task):

1. Confirm current England/Wales, Scotland and NI constituency tooltips show their 2024 values and a current
   England/Wales, Scotland or NI LAD shows its 2025 value, with thousands separators.
2. Confirm Barnsley and Sheffield LAD tooltips still show `Population: n/a`.
3. Load `/hex_map/?map_date=2023-01-01`; confirm historical constituencies show n/a and there
   is no PCON population fetch. Check a retained NI constituency code as well.
4. Use Refresh, allow normal polling, change networks/pollutants and switch C&R regions.
   Each static asset is requested at most once per page lifetime; values stay available.
5. Block either population URL before loading the page (also try an invalid JSON response).
   Geometry, AQ, networks, area selection, sensor lists and station charts must still work.
6. Confirm DevTools shows no `uk_aq_population` calls and AQ responses are unchanged.

Rollback: restore the two controllers from `Archive/2026-09-30/hex_map/` and remove the new
`data/population/` assets and generator, or redeploy the previous reviewed Pages artifact.
There is no schema/data rollback. Archives are reference only and must never be runtime fallbacks.
The existing system contracts already specify this implementation; no contract edits are needed.

## Pre-deployment structural checks completed

- Both changed controllers passed `node --input-type=module --check` (stdin).
- Generator passed Python AST parsing; its focused import completed successfully.
- Both JSON assets passed parsing, outer type/count, required field types, positive integers,
  actual calendar-date validation, unique codes and current-map membership checks.
- Scotland/Wales regional 2025 LAD geometry codes were also checked against the main geography.
- `git diff --check` passed; pre-change controller archives match the original repository files.
- The controller comment mentions `npm run validate:hexmap:2025`, but this checkout has no
  `package.json` or corresponding validator. That unavailable command was not run.
- No automated frontend suite or browser functional testing was added/run; real TEST acceptance
  remains post-deployment.

## Scottish PCON source correction checks

The focused correction checks passed: generator Python syntax/import and execution; JSON parsing;
650 unique PCON rows matching exactly all current Hex Map codes; all 57 current Scottish `S140...`
codes populated; every reference date `2024-06-30`; positive integer values; direct equality with
the NRS `UKPC` Persons/2024/All ages totals; and `git diff --check`. The existing 593 PCON rows,
LAD snapshot and both controller files are unchanged by this correction. No new test suite was added.

The pre-correction generator is preserved at
`Archive/2026-09-30/scripts/uk_aq_build_population_snapshot.py`. To roll back only this correction,
restore that generator and the prior reviewed PCON snapshot/provenance; retain the static-loading
controllers and LAD asset. No database or system-contract rollback is involved. After deployment,
spot-check Aberdeen North (`S14000060`): `Population: 114,328 (2024)`.
