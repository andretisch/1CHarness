#!/usr/bin/env python3
"""Статика + same-origin /dev-llm/* (обход CORS в браузере, ключ только на сервере dev)."""

import os
import subprocess
import sys
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
WEB_PORT = int(os.environ.get("HARNESS_WEB_PORT", "8765"))
OLLAMA_UPSTREAM = os.environ.get("HARNESS_LLM_UPSTREAM", "https://ollama.com").rstrip("/")
API_KEY = os.environ.get("OLLAMA_API_KEY", "").strip()


class HarnessDevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path.startswith("/dev-llm/"):
            self._proxy_llm()
            return
        self.send_error(405)

    def _proxy_llm(self):
        upstream_path = self.path[len("/dev-llm") :]
        if not upstream_path.startswith("/"):
            upstream_path = "/" + upstream_path
        url = OLLAMA_UPSTREAM + upstream_path
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b""
        headers = {
            "Content-Type": self.headers.get("Content-Type", "application/json"),
            "Accept": "application/json",
        }
        if API_KEY:
            headers["Authorization"] = f"Bearer {API_KEY}"
        req = Request(url, data=body, headers=headers, method="POST")
        try:
            with urlopen(req, timeout=300) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except HTTPError as e:
            err = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(err)
        except URLError as e:
            msg = json.dumps({"error": str(e.reason)}).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(msg)

    def log_message(self, fmt, *args):
        if args and isinstance(args[0], str) and args[0].startswith("GET /vendor"):
            return
        super().log_message(fmt, *args)


def main():
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "write_llm_dev_config.py")],
        cwd=str(ROOT),
        check=False,
    )
    print(
        f"Harness dev: http://127.0.0.1:{WEB_PORT}/index.html | LLM same-origin: /dev-llm/v1",
        flush=True,
    )
    server = ThreadingHTTPServer(("127.0.0.1", WEB_PORT), HarnessDevHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
