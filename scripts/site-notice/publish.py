#!/usr/bin/env python3
"""Parse TOML, validate through the shared schema, then make at most one KV PUT."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tomllib
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def required(name, pattern=None):
    import re
    value = os.environ.get(name, "").strip()
    if not value or (pattern and not re.fullmatch(pattern, value)):
        raise ValueError(f"Missing or invalid {name}")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate only; no network or credentials")
    parser.add_argument("--output", type=Path, help="Save the deterministic compiled document")
    args = parser.parse_args()
    source_path = ROOT / "site-notice.toml"
    if source_path.stat().st_size > 262144:
        raise ValueError("Notice source too large")
    with source_path.open("rb") as source_file:
        source = tomllib.load(source_file)
    result = subprocess.run(
        ["node", str(ROOT / "scripts/site-notice/compile.mjs")],
        input=json.dumps(source, ensure_ascii=True), text=True, capture_output=True, check=False,
    )
    if result.returncode:
        # Validation occurs before reading credentials or constructing any write.
        raise ValueError("Notice schema validation failed: " + result.stderr.strip())
    compiled = json.loads(result.stdout)
    if args.output:
        args.output.write_text(result.stdout, encoding="utf-8")
    if args.check:
        print(f"Notice configuration valid; revision {compiled['revision']}")
        return
    account = required("CLOUDFLARE_ACCOUNT_ID", r"[a-fA-F0-9]{32}")
    namespace = required("UK_AQ_SITE_NOTICE_KV_NAMESPACE_ID", r"[a-fA-F0-9]{32}")
    token = required("CLOUDFLARE_API_TOKEN")
    # Explicit environment-scoped account/namespace only, one atomic value write.
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/storage/kv/namespaces/{namespace}/values/site_notice_current"
    request = urllib.request.Request(
        url, data=result.stdout.strip().encode("utf-8"), method="PUT",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_json = json.load(response)
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Cloudflare KV publication failed; no retry or alternate namespace attempted") from None
    if response_json.get("success") is not True:
        raise RuntimeError("Cloudflare KV did not acknowledge publication")
    print(f"Published notice revision {compiled['revision']}; KV propagation is eventually consistent")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
