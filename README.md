# 1СХарнесс

Полноценная обвязка ИИ-агента на платформе 1С.

## UI (старт)

В корне лежит [`llama.html`](llama.html) — один HTML-файл чата, взятый из [openconstruct/llamahtml](https://github.com/openconstruct/llamahtml) как основа интерфейса. Открывается в браузере или в **поле HTML документа** (Chromium, 8.3). Дальше на него насаживаем мост к 1С и сценарии из ТЗ.

Сейчас UI рассчитан на **llama-server** (`/completion`, стриминг). Подключение к OpenAI/Ollama и бэкенду 1С — следующий шаг.
