# Maintenance-mode deployment restoration

The active website maintenance-mode deployment capability was retired on 12 September 2026 because the `index_v3` migration changed from an in-place R2 rewrite to a side-by-side v2/v3 migration. The website therefore no longer needs to enter maintenance mode for that migration.

The files in this directory are the complete known-working maintenance deployment implementation as it existed immediately before retirement:

- `workflows/pages.yml`
- `scripts/uk_aq_site_maintenance.mjs`
- `maintenance/index.html`

To restore the implementation in the TEST website repository, copy the archived files back to their active locations:

```bash
cp Archive/2026-09-12/maintenance-mode/workflows/pages.yml .github/workflows/pages.yml
cp Archive/2026-09-12/maintenance-mode/scripts/uk_aq_site_maintenance.mjs scripts/uk_aq_site_maintenance.mjs
mkdir -p maintenance
cp Archive/2026-09-12/maintenance-mode/maintenance/index.html maintenance/index.html
```

The maintenance build also depends at runtime on `images/UK-AQ-Maintenance-NoDate.png` and `images/favicon.ico`. Those active assets should exist; they are deliberately not duplicated into `Archive/`.

If a target hostname is protected by Cloudflare Access, the restored workflow's remote resolve and verify requests need a Service Auth mechanism or equivalent authenticated access.

After restoration, structurally validate the workflow and script, then exercise maintenance status, activation, verification and deactivation on TEST before promotion to any other environment.
