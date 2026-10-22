# 1СХарнесс

Полноценная обвязка ИИ-агента на платформе 1С.

## UI (старт)

В корне лежит [`index.html`](index.html) — один HTML-файл чата на базе [openconstruct/llamahtml](https://github.com/openconstruct/llamahtml). Зависимости (Bootstrap, marked, highlight.js) лежат в [`vendor/`](vendor/) и подключаются локально, без CDN. Открывается в браузере или в **поле HTML документа** (Chromium, 8.3); пути `vendor/…` должны быть доступны относительно каталога с `index.html`.

Сейчас UI рассчитан на **llama-server** (`/completion`, стриминг). Подключение к OpenAI/Ollama и бэкенду 1С — следующий шаг.
