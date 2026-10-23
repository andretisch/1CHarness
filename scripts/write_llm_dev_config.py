#!/usr/bin/env python3
"""Пишет web/js/llm-dev-config.js из OLLAMA_API_KEY (только локальный dev, не в git)."""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "js" / "llm-dev-config.js"
KEY = os.environ.get("OLLAMA_API_KEY", "").strip()


def main():
    if KEY:
        content = f"window.__HARNESS_LLM_API_KEY = {json.dumps(KEY)};\n"
    else:
        content = "// OLLAMA_API_KEY not set in environment\n"
    OUT.write_text(content, encoding="utf-8")
    print(f"Wrote {OUT} ({'with key' if KEY else 'empty'})", flush=True)


if __name__ == "__main__":
    main()
