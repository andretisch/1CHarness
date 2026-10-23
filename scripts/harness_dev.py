#!/usr/bin/env python3
"""Статика для UI (LLM — прямой XHR из браузера)."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_PORT = int(os.environ.get("HARNESS_WEB_PORT", "8765"))


def main():
    print(f"Harness dev: http://127.0.0.1:{WEB_PORT}/index.html", flush=True)
    subprocess.run(
        [sys.executable, "-m", "http.server", str(WEB_PORT), "--bind", "127.0.0.1"],
        cwd=str(ROOT),
        check=False,
    )


if __name__ == "__main__":
    main()
