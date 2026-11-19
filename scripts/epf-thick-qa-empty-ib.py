#!/usr/bin/env python3
"""Thick client ENTERPRISE QA: empty IB, EPF execute, security dialogs, log check."""
from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from pathlib import Path

import mss
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STORE_MEDIA = Path(
    os.environ.get(
        "HARNESS_QA_MEDIA",
        "/cursor/stores/bc-211c42db-74d1-418c-a765-2a4f71623b47/media",
    )
)
V8 = Path("/opt/1cv8t/x86_64/8.3.27.2342/1cv8t")
BASE = ROOT / "bases/empty-ib"
EPF = ROOT / "epf/1CHarness.epf"
LOG = Path.home() / ".config/1CHarness/1c-harness-form.log"
TAG = os.environ.get("HARNESS_QA_TAG", "app-catalog-fix")


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=False, text=True, capture_output=True, **kwargs)


def xdo(*args: str) -> str:
    p = run(["xdotool"] + list(args))
    return (p.stdout or "").strip()


def shot_desktop(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with mss.MSS() as sct:
        img = sct.grab(sct.monitors[0])
        Image.frombytes("RGB", img.size, img.rgb).save(path)


def find_warning_window() -> str | None:
    wid = xdo("search", "--name", "Предупреждение безопасности")
    if wid:
        return wid.splitlines()[0]
    wid = xdo("search", "--name", "Предупреждение")
    if wid:
        for w in wid.splitlines():
            name = xdo("getwindowname", w)
            if "безопасност" in name.lower() or "предупрежд" in name.lower():
                return w
    return None


def click_yes_on_warning(wid: str) -> None:
    xdo("windowactivate", "--sync", wid)
    # Default focus is often «Нет» — move to «Да» and confirm.
    run(["xdotool", "key", "--window", wid, "Left", "Return"])
    time.sleep(0.35)
    # Fallback: Alt+Д (mnemonic on «Да» in ru UI)
    run(["xdotool", "key", "--window", wid, "alt+d"])


def dismiss_warnings(max_rounds: int = 12) -> int:
    dismissed = 0
    for _ in range(max_rounds):
        time.sleep(1.0)
        wid = find_warning_window()
        if not wid:
            break
        click_yes_on_warning(wid)
        dismissed += 1
        time.sleep(0.8)
    return dismissed


def main() -> int:
    if not V8.exists() or not EPF.exists() or not BASE.exists():
        print("missing 1C, EPF or IB", file=sys.stderr)
        return 2

    os.environ.setdefault("DISPLAY", ":99")
    STORE_MEDIA.mkdir(parents=True, exist_ok=True)

    run(["pkill", "-f", "1cv8t"])
    time.sleep(1)

    env = {**os.environ, "LANG": "C.UTF-8"}
    subprocess.Popen(
        [
            str(V8),
            "ENTERPRISE",
            f"/F{BASE}",
            f"/Execute{EPF}",
            "/Lru",
            "/WA-",
            "/DisableStartupDialogs",
        ],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    time.sleep(6)
    shot_desktop(STORE_MEDIA / f"epf-qa-{TAG}-01-start.png")
    n_warn = dismiss_warnings(10)
    time.sleep(3)
    shot_desktop(STORE_MEDIA / f"epf-qa-{TAG}-02-after-warnings.png")
    time.sleep(15)
    shot_desktop(STORE_MEDIA / f"epf-qa-{TAG}-03-ui-wait15s.png")
    dismiss_warnings(4)
    time.sleep(5)
    shot_desktop(STORE_MEDIA / f"epf-qa-{TAG}-04-final.png")

    log_tail = ""
    field_path = ""
    has_title = False
    has_init = False
    has_document = False
    if LOG.exists():
        log_tail = LOG.read_text(encoding="utf-8", errors="replace")[-4000:]
        has_title = "title=" in log_tail
        has_init = "мост init" in log_tail
        has_document = "документ:" in log_tail
        m = re.search(r"поле=(file://[^\s|]+)", log_tail)
        if m:
            field_path = m.group(1)

    print(f"warnings_dismissed={n_warn}")
    print(f"field={field_path}")
    print(f"log_title={has_title}")
    print(f"log_mост_init={has_init}")
    print(f"log_document={has_document}")
    if log_tail:
        print("--- log tail ---")
        print("\n".join(log_tail.strip().splitlines()[-25:]))

    ok = has_title or has_init
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())