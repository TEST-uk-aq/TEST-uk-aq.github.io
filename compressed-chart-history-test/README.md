# Isolated TEST chart-history viewer

The viewer accepts both existing request-time AQI publications and the paired
precomputed-AQI publication. Its diagnostics identify the selected mode,
publication and object digests, and report observation and AQI completeness
separately. Missing preceding PM context remains visible as partial AQI.

`index.html` is a manually selected AURN PM2.5 comparison page. It uses the existing shared controller, cache, normalizer, D3 renderer and chart diagnostics. The experimental client is limited to the complete v3 September and equivalent v2/v3 1 September publications; the normal source uses the existing TEST station-history endpoints. A source change destroys the old controller and cache, and the new cache contract includes source, generation and publication SHA-256.

The page uses the existing `uk-aq-cache-auth.js` session flow. The new prototype API is available only after the separately configured private Worker, derived TEST bucket, selected publications and cache-proxy service binding are deployed. Until then the page will show a request failure. The page itself has no normal site navigation link, carries `noindex`, and contains no unpublished network data.

Use `?cache_base=<TEST-cache-origin>/api/aq` if the TEST site does not proxy `/api/aq` on its own origin, as for the normal Sensors page. Select a mode, load, and download the bounded diagnostics JSON. Request IDs correlate with private Worker logs. The `complete` record concerns chart load; check `observation_range_complete` and controller incomplete/failure events separately. The v2 option is intentionally one day only. PM AQI will be marked partial where preceding observation context is absent from the selected JSON publication.

After authorised TEST deployment, compare the 24-hour and September modes with browser network measurements and Cloudflare Worker CPU/R2-operation telemetry. Confirm the normal route is actually using the TEST v3 authority during that run. This repository change does not deploy or validate browser rendering.
