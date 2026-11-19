#!/usr/bin/env bash
# Сборка epf/1CHarness.epf из исходников src/CHarness1C без DESIGNER (v8unpack).
# Макет «МостКлейка» вшивается в Template «Страница» — v8unpack иначе ломает двухмакетную сборку.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/1charness-v8unpack-$$"
EPF_IN="$ROOT/epf/1CHarness.epf"
EPF_OUT="$ROOT/epf/1CHarness.epf"

if ! command -v v8unpack >/dev/null; then
  echo "v8unpack not installed (pip install v8unpack)" >&2
  exit 1
fi

mkdir -p "$WORK"
v8unpack -E "$EPF_IN" "$WORK"

cp "$ROOT/src/CHarness1C/Forms/Form/Ext/Form/Module.bsl" "$WORK/Form/Form/Form.obj.bsl"
cp "$ROOT/src/CHarness1C/Templates/Страница/Ext/Template.txt" "$WORK/Template/Страница/Template.txt"

python3 << PY
import json
from pathlib import Path

work = Path("$WORK")
root_src = Path("$ROOT")

glue = (root_src / "src/CHarness1C/Templates/МостКлейка/Ext/Template.txt").read_text(
    encoding="utf-8"
)
page_path = work / "Template/Страница/Template.txt"
page = page_path.read_text(encoding="utf-8")
if "{{HARNESS_WORKSPACE_VARS}}" not in page:
    if "<head>" not in page:
        raise SystemExit("Страница: нет <head> для вставки клейки")
    page = page.replace("<head>", "<head>" + glue, 1)
    page_path.write_text(page, encoding="utf-8")

bsl_path = work / "Form/Form/Form.obj.bsl"
bsl = bsl_path.read_text(encoding="utf-8")
old = (
    '\tКлейка = Обработка.ПолучитьМакет("МостКлейка").ПолучитьТекст();\n'
    '\tКлейка = СтрЗаменить(Клейка, "{{HARNESS_WORKSPACE_VARS}}", ФрагментРабочей);\n'
    '\tТекст = СтрЗаменить(Текст, "<head>", "<head>" + Клейка);'
)
new = '\tТекст = СтрЗаменить(Текст, "{{HARNESS_WORKSPACE_VARS}}", ФрагментРабочей);'
if old not in bsl:
    raise SystemExit("Form.obj.bsl: ожидался блок МостКлейка для замены")
bsl_path.write_text(bsl.replace(old, new, 1), encoding="utf-8")

form = work / "Form/Form/Form.json"
data = json.loads(form.read_text(encoding="utf-8"))
form_body = data["form"][0][0][1]
for i, item in enumerate(form_body):
    if (
        isinstance(item, list)
        and item
        and item[0] in ("2", 2)
        and any("ПриОткрытии" in str(x) for x in item)
    ):
        if any("ПриЗакрытии" in str(x) for x in item):
            break
        close_uuid = "b1c2a3d4-5e6f-4789-a012-3456789abcde"
        item[0] = "3"
        item[5:5] = [close_uuid, '"ПриЗакрытии"']
        item.extend([close_uuid, "0", "1"])
        form_body[i] = item
        break
form.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
PY

v8unpack -B "$WORK" "$EPF_OUT"
rm -rf "$WORK"
echo "OK: $EPF_OUT ($(wc -c < "$EPF_OUT") bytes)"