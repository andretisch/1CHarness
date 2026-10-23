"""Эталон инструментов ТЗ 1СХарнесс для workspace (не HTTP)."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[3] / "workspace"
MAX_CHARS = 200_000
TEXT_EXT = {".txt", ".md", ".json", ".xml", ".csv", ".bsl", ".js", ".html", ".css", ".log"}
PLATFORM_TOOLS = {
    "run_query",
    "inspect_metadata",
    "read_object",
    "make_navlink",
    "sketch_query",
    "delegate_task",
    "report_describe",
    "report_run",
    "report_compose",
    "open_draft",
}
ALIASES = {"read_file": "fs_read", "write_file": "fs_write"}
WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]


def _resolve(rel: str) -> Path:
    rel = (rel or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise ValueError("Недопустимый путь")
    target = (WORKSPACE_ROOT / rel).resolve()
    root = WORKSPACE_ROOT.resolve()
    if not str(target).startswith(str(root)):
        raise ValueError("Путь вне workspace")
    return target


def _list_files() -> list[str]:
    root = WORKSPACE_ROOT.resolve()
    out = []
    if not root.is_dir():
        return out
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.name == ".keep":
            continue
        out.append(path.relative_to(root).as_posix())
    return sorted(out)


def _read(path: str) -> str:
    target = _resolve(path)
    if not target.is_file():
        raise FileNotFoundError(f"Файл не найден: {path}")
    return target.read_text(encoding="utf-8")[:MAX_CHARS]


def _write(path: str, content: str) -> None:
    target = _resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content if content is not None else "", encoding="utf-8")


def _glob_re(pattern: str) -> re.Pattern[str]:
    re_s = ""
    i = 0
    pattern = pattern.replace("\\", "/")
    while i < len(pattern):
        c = pattern[i]
        if c == "*":
            if i + 1 < len(pattern) and pattern[i + 1] == "*":
                re_s += ".*"
                i += 2
                if i < len(pattern) and pattern[i] == "/":
                    i += 1
                continue
            re_s += "[^/]*"
        elif c in ".+^${}()|[]\\":
            re_s += "\\" + c
        else:
            re_s += c
        i += 1
    return re.compile("^" + re_s + "$", re.I)


def _excerpt(text: str, query: str) -> str:
    at = text.lower().find(query.lower())
    if at < 0:
        return ""
    return " ".join(text[max(0, at - 40) : at + len(query) + 80].split())


def _calc(expression: str) -> dict:
    raw = (expression or "").strip()
    compact = re.sub(r"\s+", "", raw)
    if not compact or not re.fullmatch(r"[\d.eE+\-*/()%]+", compact):
        raise ValueError("Допустимы только числа и + - * / % скобки")
    value = eval(compact, {"__builtins__": {}}, {})  # noqa: S307 — алфавит уже ограничен
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError("Результат не число")
    return {"expression": raw, "value": value}


def _chart(args: dict) -> dict:
    raw = str(args.get("type") or "bar").strip().lower()
    kind = "bar"
    if any(token in raw for token in ("hbar", "horizontal", "гориз")):
        kind = "hbar"
    elif any(token in raw for token in ("line", "лин")):
        kind = "line"
    labels = [str(x) for x in (args.get("labels") or [])]
    series = args.get("data")
    if series is None:
        series = args.get("values") or []
    if not labels or len(labels) != len(series):
        raise ValueError("labels и data — массивы одной длины")
    numbers = [float(item) for item in series]
    return {
        "type": kind,
        "title": str(args.get("title") or ""),
        "labels": labels,
        "datasets": [{"label": str(args.get("title") or "Ряд"), "data": numbers}],
    }


def invoke_tool(name: str, arguments: dict | None) -> dict:
    arguments = arguments or {}
    tool = ALIASES.get(name, name)
    if tool == "read_agent_md":
        aid = str(arguments.get("agent_id") or "default").strip()
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", aid):
            raise ValueError("Недопустимый agent_id")
        path = f"agents/{aid}.md"
        return {"path": path, "agent_id": aid, "content": _read(path)}
    if tool in PLATFORM_TOOLS:
        err = ValueError("Инструмент выполняется только в сеансе 1С")
        if tool == "run_query":
            err.hints = ["Запрос с РАЗРЕШЕННЫЕ выполняется на платформе", "Ссылки в params: { type, uuid }"]  # type: ignore[attr-defined]
        raise err
    if tool == "session_now":
        now = datetime.now().astimezone()
        return {"iso": now.isoformat(), "weekday": WEEKDAYS[now.weekday()], "local": now.strftime("%d.%m.%Y %H:%M")}
    if tool == "calc":
        return _calc(str(arguments.get("expression") or ""))
    if tool == "draw_chart":
        return {"chart": _chart(arguments), "hint": "Превью графика добавляет интерфейс чата."}
    if tool == "find_in_chat":
        query = str(arguments.get("query") or "").strip()
        if not query:
            raise ValueError("Пустой query")
        hits = []
        sessions = WORKSPACE_ROOT / "sessions"
        if sessions.is_dir():
            for path in sorted(sessions.glob("*.json")):
                text = path.read_text(encoding="utf-8")
                if query.lower() in text.lower():
                    hits.append({"session_id": path.stem, "excerpt": _excerpt(text, query)})
        return {"query": query, "hits": hits[:20]}
    if tool == "find_skill":
        query = str(arguments.get("query") or "").strip()
        if not query:
            raise ValueError("Пустой query")
        hits = []
        for folder in ("skills", "agents"):
            base = WORKSPACE_ROOT / folder
            if not base.is_dir():
                continue
            for path in base.rglob("*.md"):
                text = path.read_text(encoding="utf-8")
                rel = path.relative_to(WORKSPACE_ROOT).as_posix()
                if query.lower() in (rel + "\n" + text).lower():
                    hits.append({"path": rel, "excerpt": _excerpt(text, query) or rel})
        return {"query": query, "hits": hits[:20]}
    if tool == "fs_list":
        directory = str(arguments.get("path") or "").strip().strip("/")
        if directory:
            _resolve(directory)
        entries: dict[str, dict] = {}
        prefix = f"{directory}/" if directory else ""
        for rel in _list_files():
            if directory and rel != directory and not rel.startswith(prefix):
                continue
            rest = rel[len(prefix) :] if prefix else rel
            if not rest:
                continue
            name = rest.split("/", 1)[0]
            child = f"{directory}/{name}" if directory else name
            is_dir = "/" in rest
            entries[name] = {"name": name, "type": "dir" if is_dir else "file", "path": child}
        return {"path": directory or ".", "entries": sorted(entries.values(), key=lambda e: e["name"])}
    if tool == "fs_read":
        path = str(arguments.get("path") or "")
        content = _read(path)
        offset = arguments.get("offset")
        limit = arguments.get("limit")
        if offset or limit:
            lines = content.split("\n")
            start = max(1, int(offset or 1))
            take = len(lines) if limit is None else max(0, int(limit))
            chunk = lines[start - 1 : start - 1 + take]
            return {"path": path, "content": "\n".join(chunk), "start": start, "lines": len(chunk), "total": len(lines)}
        return {"path": path, "content": content}
    if tool == "fs_write":
        path = str(arguments.get("path") or "")
        content = arguments.get("content") or ""
        _write(path, content)
        return {"path": path, "bytes": len(content), "ok": True}
    if tool == "fs_mkdir":
        path = str(arguments.get("path") or "").strip().strip("/")
        target = _resolve(path)
        target.mkdir(parents=True, exist_ok=True)
        return {"path": path, "ok": True}
    if tool == "fs_edit":
        path = str(arguments.get("path") or "")
        old = str(arguments.get("old_text") or "")
        new = str(arguments.get("new_text") or "")
        if not old:
            raise ValueError("Пустой old_text")
        content = _read(path)
        count = content.count(old)
        if count == 0:
            raise ValueError("Фрагмент не найден")
        if count > 1:
            raise ValueError("Фрагмент встречается больше одного раза")
        _write(path, content.replace(old, new, 1))
        return {"path": path, "ok": True}
    if tool == "fs_glob":
        pattern = str(arguments.get("pattern") or "").strip()
        if not pattern:
            raise ValueError("Пустой pattern")
        cre = _glob_re(pattern)
        paths = [p for p in _list_files() if cre.match(p) or cre.match(p.split("/")[-1])]
        return {"pattern": pattern, "paths": paths[:200]}
    if tool == "fs_search":
        query = str(arguments.get("query") or "")
        if not query:
            raise ValueError("Пустой query")
        root = str(arguments.get("path") or "").strip().strip("/")
        hits = []
        for rel in _list_files():
            if root and rel != root and not rel.startswith(root + "/"):
                continue
            if Path(rel).suffix.lower() not in TEXT_EXT:
                continue
            text = _read(rel)
            if query.lower() not in text.lower():
                continue
            hits.append({"path": rel, "excerpt": _excerpt(text, query)})
            if len(hits) >= 30:
                break
        return {"query": query, "hits": hits}
    raise ValueError(f"Неизвестный инструмент: {name}")


def handle_bridge_message(body: dict) -> dict:
    msg_type = body.get("type")
    req_id = body.get("id")
    if msg_type != "tool.invoke":
        raise ValueError(f"Неизвестный type: {msg_type}")
    try:
        result = invoke_tool(body.get("tool", ""), body.get("arguments"))
        return {"type": "tool.result", "id": req_id, "ok": True, "result": result}
    except Exception as e:
        payload = {"type": "tool.result", "id": req_id, "ok": False, "error": str(e)}
        hints = getattr(e, "hints", None)
        if hints:
            payload["hints"] = hints
        return payload


def main_cli() -> None:
    import sys

    raw = sys.stdin.read()
    body = json.loads(raw) if raw.strip() else {}
    print(json.dumps(handle_bridge_message(body), ensure_ascii=False))


if __name__ == "__main__":
    main_cli()
