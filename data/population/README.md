# Interim TEST Hex Map population snapshot

Reviewed on 2026-09-30. These are version-controlled deployment assets, not a scheduled ingest.
The active system population contract remains authoritative; this file records snapshot provenance.

| Asset | Coverage | Reference year | Approximate uncompressed size |
| --- | --- | --- | --- |
| `pcon-latest.json` | 593/650 | 2024 | 50,873 bytes |
| `lad-latest.json` | 359/361 | 2025 | 30,865 bytes |

## Official sources and selections

All values are total resident population, all ages and both sexes. Mid-year reference dates are
30 June of the estimate year, never the download/publication year. No name joins, interpolation,
boundary conversion or aggregation were performed. Source precision is retained (NRS totals are
published rounded to tens; Nomis and NISRA selections use their unrounded totals).

| Nation / geography | Source / input filename | Selection |
| --- | --- | --- |
| England & Wales PCON | [ONS via Nomis PESTOA2021 / NM_2014_1](https://www.nomisweb.co.uk/datasets/pestoa2021), `pcon.csv` | TYPE172 = July 2024 constituencies; Total gender, All Ages, Value, normal observations; reference 2024. 543 England + 32 Wales. |
| England & Wales LAD | [ONS via Nomis NM_2002_1](https://www.nomisweb.co.uk/datasets/pestsyoala), `lad-current.csv` | Request exact current map codes; Total gender, All Ages, Value, normal observations; reference 2025. 294 England + 22 Wales. |
| Scotland LAD | [NRS mid-2025 population estimates](https://www.nrscotland.gov.uk/publications/mid-2025-population-estimates/), `nrs.xlsx` | Table 1, Council area, Persons, All ages, code in current map: 32 rows, reference 2025. |
| Northern Ireland PCON | [NISRA small-area estimates mid-2024](https://www.nisra.gov.uk/publications/2024-mid-year-population-estimates-small-geographical-areas-within-northern-ireland), `ni-pcon.xlsx` | Flat sheet; Parliamentary Constituencies (2024), Unrounded, latest year per code: 18 rows, reference 2024. Explicit vintage selection is essential: the workbook also contains 2008 constituencies with overlapping codes. |
| Northern Ireland LAD | [NISRA mid-2025 estimates](https://www.nisra.gov.uk/publications/2025-mid-year-population-estimates-northern-ireland-and-estimates-population-aged-85), `ni-lad.xlsx` | Flat sheet; Local Government Districts (LGD2014), Unrounded, latest year per exact current code: 11 rows, reference 2025. |

Official source data are Crown copyright, available under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

## Deliberate gaps

- LAD `E08000038` (Barnsley), `E08000039` (Sheffield): the available ONS/Nomis
  mid-2025 population product still uses 2023 LA boundaries. The exact new 2025 codes
  return no rows. Do not reuse `E08000016` / `E08000019` through the map's legacy aliases.
  [ONS release editions](https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/estimatesofthepopulationforenglandandwales).
- All 57 Scottish current constituencies: the [NRS UK constituency population source](https://www.nrscotland.gov.uk/publications/uk-parliamentary-constituency-population-estimates/)
  describes 59 constituencies on 2005 election boundaries. No validated direct current-2024
  constituency source was identified. Do not substitute electors, Scottish Parliament seats,
  or construct best-fit estimates from smaller areas. The omitted current codes are listed below.
- Every pre-2024 map constituency intentionally displays `Population: n/a`, including codes
  retained across vintages. The UK controller checks the actual geometry configuration.

| Omitted PCON code | Name |
| --- | --- |
| S14000021 | East Renfrewshire |
| S14000027 | Na h-Eileanan an Iar |
| S14000045 | Midlothian |
| S14000048 | North Ayrshire and Arran |
| S14000051 | Orkney and Shetland |
| S14000060 | Aberdeen North |
| S14000061 | Aberdeen South |
| S14000062 | Aberdeenshire North and Moray East |
| S14000063 | Airdrie and Shotts |
| S14000064 | Alloa and Grangemouth |
| S14000065 | Angus and Perthshire Glens |
| S14000066 | Arbroath and Broughty Ferry |
| S14000067 | Argyll, Bute and South Lochaber |
| S14000068 | Bathgate and Linlithgow |
| S14000069 | Caithness, Sutherland and Easter Ross |
| S14000070 | Coatbridge and Bellshill |
| S14000071 | Cowdenbeath and Kirkcaldy |
| S14000072 | Cumbernauld and Kirkintilloch |
| S14000073 | Dumfries and Galloway |
| S14000074 | Dumfriesshire, Clydesdale and Tweeddale |
| S14000075 | Dundee Central |
| S14000076 | Dunfermline and Dollar |
| S14000077 | East Kilbride and Strathaven |
| S14000078 | Edinburgh East and Musselburgh |
| S14000079 | Edinburgh North and Leith |
| S14000080 | Edinburgh South |
| S14000081 | Edinburgh South West |
| S14000082 | Edinburgh West |
| S14000083 | Falkirk |
| S14000084 | Glasgow East |
| S14000085 | Glasgow North |
| S14000086 | Glasgow North East |
| S14000087 | Glasgow South |
| S14000088 | Glasgow South West |
| S14000089 | Glasgow West |
| S14000090 | Glenrothes and Mid Fife |
| S14000091 | Gordon and Buchan |
| S14000092 | Hamilton and Clyde Valley |
| S14000093 | Inverclyde and Renfrewshire West |
| S14000094 | Inverness, Skye and West Ross-shire |
| S14000095 | Livingston |
| S14000096 | Lothian East |
| S14000097 | Mid Dunbartonshire |
| S14000098 | Moray West, Nairn and Strathspey |
| S14000099 | Motherwell, Wishaw and Carluke |
| S14000100 | North East Fife |
| S14000101 | Paisley and Renfrewshire North |
| S14000102 | Paisley and Renfrewshire South |
| S14000103 | Perth and Kinross-shire |
| S14000104 | Rutherglen |
| S14000105 | Stirling and Strathallan |
| S14000106 | West Dunbartonshire |
| S14000107 | Ayr, Carrick and Cumnock |
| S14000108 | Berwickshire, Roxburgh and Selkirk |
| S14000109 | Central Ayrshire |
| S14000110 | Kilmarnock and Loudoun |
| S14000111 | West Aberdeenshire and Kincardine |

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

Expected: PCON 593 rows / 57 missing; LAD 359 rows / 2 missing. The initial Nomis downloads
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

## Runtime and TEST acceptance after deployment

The controllers each start one independent static fetch during initialization and retain a local
lookup. Historical UK geometry skips the PCON fetch entirely. No polling/Refresh path fetches or
resets population. Invalid payloads fail open to an empty lookup. Lookup admission requires a
positive integer, a unique canonical code and a real ISO date. Tooltips use each row's reference
year: `Population: 123,456 (2025)`; all other tooltip lines retain their existing formatting.
No coordinator, network, station-chart, AQ payload or Supabase population changes are involved.

After review and normal TEST Pages deployment (not performed by this task):

1. Confirm a current England/Wales or NI constituency tooltip shows its 2024 value and a current
   England/Wales, Scotland or NI LAD shows its 2025 value, with thousands separators.
2. Confirm a Scottish current constituency, Barnsley and Sheffield show `Population: n/a`.
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
