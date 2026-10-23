# 1СХарнесс

Полноценная обвязка ИИ-агента на платформе 1С.

## UI (старт)

В корне лежит [`index.html`](index.html) — один HTML-файл чата на базе [openconstruct/llamahtml](https://github.com/openconstruct/llamahtml). Зависимости (Bootstrap, marked, highlight.js) лежат в [`vendor/`](vendor/) и подключаются локально, без CDN. Открывается в браузере или в **поле HTML документа** (Chromium, 8.3); пути `vendor/…` должны быть доступны относительно каталога с `index.html`.

Интерфейс на русском; адрес сервера и модели — в **Настройках**; чаты сохраняются автоматически, у каждого пункта меню **⋯** (переименовать, архивировать, удалить).

Сейчас UI рассчитан на **llama-server** (`/completion`, стриминг). Подключение к OpenAI/Ollama и бэкенду 1С — следующий шаг.

## Внешняя обработка

Файл [`epf/1CHarness.epf`](epf/1CHarness.epf) — обработка с формой и **полем HTML** (`index.html?backend=1c&demo=1`).

Исходники BSL (копировать в модули обработки в Конфигураторе): [`src/epf/`](src/epf/).

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

Откройте [http://127.0.0.1:8765/index.html?demo=1](http://127.0.0.1:8765/index.html?demo=1) — подставятся три примерных диалога (markdown, таблицы, BSL). Переключение темы — кнопка 🌙 в боковой панели. Чтобы пересоздать демо-чаты: `?demo=reset`.
