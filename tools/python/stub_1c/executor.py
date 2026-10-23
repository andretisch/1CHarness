"""Эмуляция платформы 1С: инструменты read/write для workspace (эталон для моста)."""

from __future__ import annotations

import json
import re
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[3] / "workspace"

ALLOWED_TOOLS = frozenset({"read_file", "write_file", "read_agent_md"})


def _resolve_path(rel: str) -> Path:
    rel = (rel or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise ValueError("Недопустимый путь")
    target = (WORKSPACE_ROOT / rel).resolve()
    if not str(target).startswith(str(WORKSPACE_ROOT.resolve())):
        raise ValueError("Путь вне workspace")
    return target


def read_file(path: str) -> dict:
    target = _resolve_path(path)
    if not target.is_file():
        raise FileNotFoundError(f"Файл не найден: {path}")
    return {"path": path, "content": target.read_text(encoding="utf-8")}


def write_file(path: str, content: str) -> dict:
    target = _resolve_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content if content is not None else "", encoding="utf-8")
    return {"path": path, "bytes": len(content or ""), "ok": True}


def read_agent_md(agent_id: str = "default") -> dict:
    aid = (agent_id or "default").strip()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", aid):
        raise ValueError("Недопустимый agent_id")
    path = f"agents/{aid}.md"
    data = read_file(path)
    data["agent_id"] = aid
    return data


def invoke_tool(name: str, arguments: dict | None) -> dict:
    arguments = arguments or {}
    if name not in ALLOWED_TOOLS:
        raise ValueError(f"Неизвестный инструмент: {name}")
    if name == "read_file":
        return read_file(arguments.get("path", ""))
    if name == "write_file":
        return write_file(arguments.get("path", ""), arguments.get("content", ""))
    if name == "read_agent_md":
        return read_agent_md(arguments.get("agent_id", "default"))
    raise ValueError(f"Не реализовано: {name}")


def handle_bridge_message(body: dict) -> dict:
    """Формат моста UI ↔ 1С."""
    msg_type = body.get("type")
    req_id = body.get("id")
    if msg_type == "tool.invoke":
        try:
            result = invoke_tool(body.get("tool", ""), body.get("arguments"))
            return {"type": "tool.result", "id": req_id, "ok": True, "result": result}
        except Exception as e:
            return {"type": "tool.result", "id": req_id, "ok": False, "error": str(e)}
    raise ValueError(f"Неизвестный type: {msg_type}")


def main_cli() -> None:
    import sys

    raw = sys.stdin.read()
    body = json.loads(raw) if raw.strip() else {}
    out = handle_bridge_message(body)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main_cli()
