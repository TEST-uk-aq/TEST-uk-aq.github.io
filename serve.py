#!/usr/bin/env python3
"""UK AQ local development server.

Run from this checkout with ``python3 serve.py``. Static files are served from
the directory containing this script; selected API routes are proxied for local
development only.
"""

import functools
import http.server
import json
import os
import urllib.error
import urllib.request
from urllib.parse import unquote, urlsplit


SITE_ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = 8080

AQ_API_PREFIX = "/api/aq"
AQ_API_TARGET = "https://test-uk-aq.ukaq.co.uk"
MEDIA_API_ROUTE = "/api/media/articles"
MEDIA_API_TARGET = "https://uk-aq-media-public.uk-aq-media.workers.dev"
UPSTREAM_TIMEOUT_SECONDS = 45

_HOP_BY_HOP_HEADERS = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "host",
    }
)


def _load_env_file(path):
    values = {}
    try:
        with open(path, encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                if key:
                    values[key] = value
    except FileNotFoundError:
        pass
    return values


_ENV = _load_env_file(os.path.join(SITE_ROOT, ".env"))
_ENV.update(os.environ)

CF_CLIENT_ID = _ENV.get("CLOUDFLARE_ACCESS_CLIENT_ID", "")
CF_CLIENT_SECRET = _ENV.get("CLOUDFLARE_ACCESS_CLIENT_SECRET", "")
AQ_CACHE_BYPASS_SECRET = _ENV.get("UK_AQ_CACHE_BYPASS_SECRET", "")
TURNSTILE_SITE_KEY = _ENV.get("UK_AQ_TURNSTILE_SITE_KEY", "")
TURNSTILE_PLACEHOLDER = "__UK_AQ_TURNSTILE_SITE_KEY__"


class UkAqLocalHandler(http.server.SimpleHTTPRequestHandler):
    """Serve this UK AQ checkout and its local-only proxy routes."""

    def _request_path(self):
        return unquote(urlsplit(self.path).path)

    def _is_aq_api_route(self):
        path = self._request_path()
        return path == AQ_API_PREFIX or path.startswith(AQ_API_PREFIX + "/")

    def _is_media_api_route(self):
        return self._request_path() == MEDIA_API_ROUTE

    def _upstream_path(self, replacement_path=None):
        parsed = urlsplit(self.path)
        path = replacement_path if replacement_path is not None else unquote(parsed.path)
        return path + ("?" + parsed.query if parsed.query else "")

    def _aq_proxy_headers(self):
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in _HOP_BY_HOP_HEADERS
        }
        if CF_CLIENT_ID and CF_CLIENT_SECRET:
            headers["CF-Access-Client-Id"] = CF_CLIENT_ID
            headers["CF-Access-Client-Secret"] = CF_CLIENT_SECRET
        if AQ_CACHE_BYPASS_SECRET:
            headers["X-CIC-Local-Dev-Token"] = AQ_CACHE_BYPASS_SECRET
        return headers

    def _relay_upstream(self, response):
        status = getattr(response, "status", None) or response.code
        self.send_response(status)
        for key, value in response.headers.items():
            lower_key = key.lower()
            if lower_key not in _HOP_BY_HOP_HEADERS and lower_key != "cache-control":
                self.send_header(key, value)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if self.command == "HEAD" or status in (204, 304):
            return
        try:
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_json_error(self, status, code):
        payload = json.dumps({"error": code}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def _proxy_request(self, upstream_base, upstream_path, headers):
        body = None
        content_length = self.headers.get("Content-Length")
        if content_length:
            try:
                body_length = int(content_length)
            except ValueError:
                self._send_json_error(400, "invalid_content_length")
                return
            if body_length < 0:
                self._send_json_error(400, "invalid_content_length")
                return
            body = self.rfile.read(body_length)

        request = urllib.request.Request(
            upstream_base.rstrip("/") + upstream_path,
            data=body,
            headers=headers,
            method=self.command,
        )
        try:
            with urllib.request.urlopen(request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
                self._relay_upstream(response)
        except urllib.error.HTTPError as error:
            with error:
                self._relay_upstream(error)
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            print(
                "  [proxy] "
                f"{self.command} {self._request_path()} -> unavailable "
                f"({type(error).__name__})"
            )
            self._send_json_error(502, "upstream_unavailable")

    def _proxy_aq_api(self):
        self._proxy_request(AQ_API_TARGET, self._upstream_path(), self._aq_proxy_headers())

    def _proxy_media_articles(self):
        # The public Media endpoint needs no credential. Do not forward browser
        # Authorization, cookies, environment values or other request headers.
        headers = {"Accept": "application/json", "User-Agent": "UK-AQ-LocalDev/1.0"}
        self._proxy_request(
            MEDIA_API_TARGET,
            self._upstream_path("/articles"),
            headers,
        )

    def _maybe_serve_html_with_local_config(self):
        target = self.translate_path(self.path)
        if os.path.isdir(target):
            target = os.path.join(target, "index.html")
        if not target.lower().endswith(".html") or not os.path.isfile(target):
            return False

        try:
            with open(target, "rb") as source_file:
                source = source_file.read()
            html = source.decode("utf-8")
        except (OSError, UnicodeDecodeError):
            return False

        if not TURNSTILE_SITE_KEY or TURNSTILE_PLACEHOLDER not in html:
            return False

        rendered = html.replace(TURNSTILE_PLACEHOLDER, TURNSTILE_SITE_KEY).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(rendered)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(rendered)
        return True

    def do_GET(self):
        if self._is_media_api_route():
            self._proxy_media_articles()
            return
        if self._is_aq_api_route():
            self._proxy_aq_api()
            return
        if self._maybe_serve_html_with_local_config():
            return
        super().do_GET()

    def do_HEAD(self):
        if self._is_media_api_route() or self._is_aq_api_route():
            self._send_json_error(405, "method_not_allowed")
            return
        if self._maybe_serve_html_with_local_config():
            return
        super().do_HEAD()

    def do_POST(self):
        if self._is_media_api_route():
            self._send_json_error(405, "method_not_allowed")
            return
        if self._is_aq_api_route():
            self._proxy_aq_api()
            return
        self._send_json_error(405, "method_not_allowed")

    def do_OPTIONS(self):
        if self._is_media_api_route():
            self._send_json_error(405, "method_not_allowed")
            return
        if self._is_aq_api_route():
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        self._send_json_error(405, "method_not_allowed")

    def log_message(self, format_string, *args):
        print(f"  {self.address_string()}  {format_string % args}")


class LocalThreadingServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    handler = functools.partial(UkAqLocalHandler, directory=SITE_ROOT)
    with LocalThreadingServer((HOST, PORT), handler) as server:
        print(f"\nUK AQ local server -> http://ukaq.localhost:{PORT}/")
        print(f"  Site root            -> {SITE_ROOT}")
        print(f"  /api/aq/...          -> {AQ_API_TARGET}/api/aq/...")
        print(f"  {MEDIA_API_ROUTE} -> {MEDIA_API_TARGET}/articles")
        print("  Listening on 127.0.0.1 only. Ctrl+C to stop.\n")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
