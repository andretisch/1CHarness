#!/usr/bin/env python3
"""Локальный прокси OpenAI-compatible → Ollama Cloud (ключ только в env)."""

import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib import request as urlrequest
from urllib.error import HTTPError

UPSTREAM = "https://ollama.com"
BIND = ("127.0.0.1", int(os.environ.get("HARNESS_OLLAMA_PROXY_PORT", "8768")))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _proxy(self):
        key = os.environ.get("OLLAMA_API_KEY", "").strip()
        if not key:
            self.send_response(503)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"OLLAMA_API_KEY not set"}')
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        url = UPSTREAM + self.path
        req = urlrequest.Request(
            url,
            data=body,
            method=self.command,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": self.headers.get("Content-Type", "application/json"),
            },
        )
        try:
            with urlrequest.urlopen(req, timeout=300) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self._cors()
                ct = resp.headers.get("Content-Type", "application/json")
                self.send_header("Content-Type", ct)
                self.end_headers()
                self.wfile.write(data)
        except HTTPError as e:
            err = e.read()
            self.send_response(e.code)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(err)

    do_GET = _proxy
    do_POST = _proxy


def main():
    host, port = BIND
    print(f"Ollama proxy http://{host}:{port}/v1 → {UPSTREAM}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
