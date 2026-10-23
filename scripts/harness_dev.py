#!/usr/bin/env python3
"""Статика + Ollama proxy + мост 1С (stub) для разработки в браузере."""

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_PORT = int(os.environ.get("HARNESS_WEB_PORT", "8765"))


def main():
    procs = []
    try:
        procs.append(
            subprocess.Popen(
                [sys.executable, str(ROOT / "scripts" / "ollama_proxy.py")],
                cwd=str(ROOT),
            )
        )
        procs.append(
            subprocess.Popen(
                [sys.executable, str(ROOT / "scripts" / "bridge_1c_stub.py")],
                cwd=str(ROOT),
            )
        )
        time.sleep(0.3)
        procs.append(
            subprocess.Popen(
                [sys.executable, "-m", "http.server", str(WEB_PORT), "--bind", "127.0.0.1"],
                cwd=str(ROOT),
            )
        )
        print(
            f"Harness dev: http://127.0.0.1:{WEB_PORT}/index.html | "
            f"Ollama proxy :8768 | bridge stub :8769",
            flush=True,
        )
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for p in procs:
            p.terminate()


if __name__ == "__main__":
    main()
