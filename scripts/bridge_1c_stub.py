#!/usr/bin/env python3
"""HTTP-заглушка платформы 1С: принимает tool.invoke, исполняет tools/python/stub_1c."""

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.python.stub_1c.executor import handle_bridge_message  # noqa: E402

BIND = ("127.0.0.1", int(__import__("os").environ.get("HARNESS_BRIDGE_PORT", "8769")))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_POST(self):
        if self.path.rstrip("/") not in ("/invoke", "/bridge", ""):
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
            out = handle_bridge_message(body)
            code = 200
        except Exception as e:
            out = {"type": "tool.result", "ok": False, "error": str(e)}
            code = 400
        data = json.dumps(out, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(data)


def main():
    host, port = BIND
    print(f"1C bridge stub http://{host}:{port}/invoke", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
