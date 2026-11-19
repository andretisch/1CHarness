#!/usr/bin/env python3
"""Post-fix EPF click QA: screenshots after each interaction."""
from __future__ import annotations

import os
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
BASE = ROOT / "bases/unf-karkas"
EPF = ROOT / "epf/1CHarness.epf"
DISPLAY = os.environ.get("DISPLAY", ":1")


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    env = {**os.environ, "DISPLAY": DISPLAY, "LANG": "C.UTF-8"}
    return subprocess.run(cmd, env=env, check=False, text=True, capture_output=True, **kwargs)


def xdo(*args: str) -> str:
    p = run(["xdotool", *args])
    return (p.stdout or "").strip()


def find_harness_window() -> str | None:
    for pattern in ("1СХарнесс", "1С:Предприятие", "1cv8t"):
        wid = xdo("search", "--name", pattern)
        if wid:
            return wid.splitlines()[0]
    wid = xdo("search", "--class", "v8c")
    return wid.splitlines()[0] if wid else None


def shot_window(wid: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    geo = xdo("getwindowgeometry", "--shell", wid)
    vals: dict[str, int] = {}
    for line in geo.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            vals[k] = int(v)
    x, y, w, h = vals.get("X", 0), vals.get("Y", 0), vals.get("WIDTH", 0), vals.get("HEIGHT", 0)
    with mss.mss() as sct:
        img = sct.grab({"left": x, "top": y, "width": w, "height": h})
        Image.frombytes("RGB", img.size, img.rgb).save(path)


def click_rel(wid: str, rx: float, ry: float) -> None:
    geo = xdo("getwindowgeometry", wid)
    # WIDTHxHEIGHT
    size = geo.split()[-1].split("x")
    w, h = int(size[0]), int(size[1])
    xdo("mousemove", "--window", wid, str(int(w * rx)), str(int(h * ry)))
    run(["xdotool", "click", "1"])


def type_text(wid: str, text: str) -> None:
    xdo("windowactivate", "--sync", wid)
    run(["xdotool", "type", "--clearmodifiers", "--window", wid, text])


def main() -> int:
    if not V8.exists():
        print("1C platform missing", file=sys.stderr)
        return 2
    STORE_MEDIA.mkdir(parents=True, exist_ok=True)

    run(["pkill", "-f", str(EPF)])
    time.sleep(1)
    subprocess.Popen(
        [
            str(V8),
            "ENTERPRISE",
            f"/F{BASE}",
            '/N"Администратор"',
            f"/Execute{EPF}",
            "/Lru",
            "/WA-",
            "/DisableStartupDialogs",
            "/DisableStartupMessages",
        ],
        env={**os.environ, "DISPLAY": DISPLAY, "LANG": "C.UTF-8"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    wid = None
    for _ in range(60):
        time.sleep(1)
        wid = find_harness_window()
        if wid:
            break
    if not wid:
        print("Harness window not found", file=sys.stderr)
        return 1

    xdo("windowactivate", "--sync", wid)
    time.sleep(3)
    shot_window(wid, STORE_MEDIA / "epf-qa-motw-00-launch.png")

    # Onboarding: workspace path + По умолчанию + Далее (if visible)
    click_rel(wid, 0.55, 0.62)
    time.sleep(0.5)
    type_text(wid, "/agent/repos/1CHarness/workspace")
    time.sleep(0.5)
    shot_window(wid, STORE_MEDIA / "epf-qa-motw-01-onboarding-path.png")
    click_rel(wid, 0.38, 0.72)  # По умолчанию
    time.sleep(1)
    click_rel(wid, 0.62, 0.72)  # Далее
    time.sleep(2)
    shot_window(wid, STORE_MEDIA / "epf-qa-motw-02-after-onboarding.png")

    results: list[tuple[str, str, float, float]] = [
        ("new-chat", "epf-qa-motw-03-new-dialog.png", 0.12, 0.22),
        ("chat-input", "epf-qa-motw-04-chat-input.png", 0.52, 0.88),
        ("send", "epf-qa-motw-05-send.png", 0.93, 0.88),
        ("settings", "epf-qa-motw-06-settings.png", 0.04, 0.04),
        ("attach", "epf-qa-motw-07-attach.png", 0.86, 0.88),
    ]

    for name, fname, rx, ry in results:
        if name == "chat-input":
            click_rel(wid, rx, ry)
            time.sleep(0.3)
            type_text(wid, "motw-qa ping")
        elif name == "settings":
            click_rel(wid, 0.04, 0.04)
            time.sleep(0.5)
        else:
            click_rel(wid, rx, ry)
        time.sleep(1.2)
        shot_window(wid, STORE_MEDIA / fname)

    print("QA screenshots written to", STORE_MEDIA)
    return 0


if __name__ == "__main__":
    sys.exit(main())