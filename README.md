# 1СХарнесс

Полноценная обвязка ИИ-агента на платформе 1С.

## UI (старт)

В корне лежит [`index.html`](index.html) — один HTML-файл чата на базе [openconstruct/llamahtml](https://github.com/openconstruct/llamahtml). Оформление (цвета, подложка чата) — как у [крабобот](https://github.com/andretisch/krabobot/tree/main/krabobot/web/static); **строка ввода** — компактная капсула как раньше. Зависимости (Bootstrap, marked, highlight.js) в [`vendor/`](vendor/); шрифт Nunito подгружается с Google Fonts (в 1С без сети останется system-ui). Открывается в браузере или в **поле HTML документа** (Chromium, 8.3).

Интерфейс на русском; адрес сервера и модели — в **Настройках**; чаты сохраняются автоматически, у каждого пункта меню **⋯** (переименовать, архивировать, удалить).

**Агент в браузере:** подключение к LLM — [`workspace/config.json`](workspace/config.json) (XHR через [`web/js/llm-xhr.js`](web/js/llm-xhr.js), read/write через мост 1С). Сессии — `workspace/sessions/*.json`, агенты — `workspace/agents/*.md`. Dev: [`stub-1c-platform.js`](web/js/stub-1c-platform.js). Статика: `python3 scripts/harness_dev.py`. После правок: `bash scripts/verify_harness.sh` (см. [AGENTS.md](AGENTS.md)).

## Внешняя обработка

Файл [`epf/1CHarness.epf`](epf/1CHarness.epf) — обработка с формой и **полем HTML** (`index.html?backend=1c&demo=1`).

**Исходники в git:** иерархический XML в [`src/1CHarness/`](src/1CHarness/) (корень [`CHarness1C.xml`](src/1CHarness/CHarness1C.xml)). Отдельные файлы [`src/epf/*.bsl`](src/epf/) — черновики для v0.2 (HTML + мост); их нужно переносить в `Ext/*.bsl` внутри дерева XML.

Сборка и выгрузка — **Конфигуратор в пакетном режиме** (`1cv8t` / `1cv8` + файловая ИБ). Перед запуском закройте сеансы 1С с этой ИБ или с открытой обработкой (иначе блокировка конфигурирования).

```bash
chmod +x scripts/epf-build.sh scripts/epf-dump.sh
./scripts/epf-build.sh          # XML → epf/1CHarness.epf
./scripts/epf-dump.sh           # epf/1CHarness.epf → src/1CHarness/
```

Параметры платформы и ИБ: [`.v8-project.json`](.v8-project.json). Тестовая ИБ: `/workspace/bases/harness-empty` (не в git).

Мост UI → 1С: скрытый `#harness-1c-bridge` + `window.harnessDeliverResponse()`; опрос раз в секунду в модуле формы.

Запуск (учебная платформа, один сеанс ИБ):

```bash
DISPLAY=:1 /opt/1cv8t/x86_64/8.3.27.2342/1cv8t /Execute"/path/to/1CHarness/epf/1CHarness.epf"
```

Тестовая файловая ИБ для разработки: `/workspace/bases/harness-empty` (не в git).

### Просмотр в браузере (демо без LLM)

```bash
cd /path/to/1CHarness
python3 -m http.server 8765
```

Откройте [http://127.0.0.1:8765/index.html?demo=1](http://127.0.0.1:8765/index.html?demo=1) — три примерных диалога (markdown, таблицы, BSL; в «Обороты по счёту 51» — столбцы, линия, круг, кольцо). Оформление — **Настройки → Интерфейс**. Пересоздать демо: `?demo=reset`.
