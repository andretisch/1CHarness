# Проверка инструментов

26 октября 2026, 15:05–15:11 мск. Каждый инструмент вызван в своём диалоге. Диалоги не удалялись: они в списке слева и в `workspace/sessions`.

Самопроверка при открытии: `params=85/2/ромашка/2`, `сеанс=2980/график/поиск/отчёт`, отчётов 1.

| Инструмент | Диалог | Что вернул |
| --- | --- | --- |
| `fs_list` | fs_list — корень workspace | data, manifest.json, agents, config.json, skills, sessions |
| `fs_read` | fs_read — skills/query.md | заголовок «Запрос к срезу УНФ» |
| `fs_write` | fs_write — data/tool-fs-write.txt | `data/tool-fs-write.txt`, 24 байта |
| `fs_search` | fs_search — ВидЦен в skills | `skills/query.md`, фрагмент с `ВидЦен = "Розничная"` |
| `session_now` | session_now — дата сеанса | 2026-10-26T12:10:22, понедельник |
| `calc` | calc — сумма накладной | `20*85+4*320` = 2980 |
| `find_in_chat` | find_in_chat — фраза Ты тут | сессия `1793012310942` |
| `find_skill` | find_skill — ВидЦен | `skills/query.md`, `agents/default.md` |
| `draw_chart` | draw_chart — продажи бар | столбцы Кабель 1700 и Розетка 1280 |
| `run_query` | run_query — розничные цены | монтаж 500, розетка 320, кабель 85, параметр `ВидЦен` |
| `inspect_metadata` | inspect_metadata — Номенклатура | реквизиты Артикул, ЕдиницаИзмерения |
| `read_object` | read_object — кабель | Кабель ВВГнг 3х2,5, артикул CBL-325 |
| `make_navlink` | make_navlink — кабель | `e1cib/data/Справочник.Номенклатура?ref=...` |
| `sketch_query` | sketch_query — обороты продаж | запрос к `Продажи.Обороты`, без выдуманных строк |
| `delegate_task` | delegate_task — обороты продаж | 2 строки, 1280 и 1700, файл `data/delegate-...json` |
| `report_describe` | report_describe — Продажи | `ПродажиТоваров`, синоним «Продажи» |
| `report_run` | report_run — Продажи | розетка 4 / 1280, кабель 20 / 1700, total 2980 |
| `report_compose` | report_compose — продажи | те же две строки, total 2980 |
| `open_draft` | open_draft — расходная накладная | форма создания, контрагент ООО Ромашка, документ не записан |

В ответе `report_run` модель назвала количество кабеля штуками. В регистре это 20, единица у номенклатуры — метр. В подсказку агента добавлено: не подставлять «шт», если инструмент единицу не вернул.

## fs_list

![fs_list](images/tools/fs_list.jpg)

## fs_read

![fs_read](images/tools/fs_read.jpg)

## fs_write

![fs_write](images/tools/fs_write.jpg)

## fs_search

![fs_search](images/tools/fs_search.jpg)

## session_now

![session_now](images/tools/session_now.jpg)

## calc

![calc](images/tools/calc.jpg)

## find_in_chat

![find_in_chat](images/tools/find_in_chat.jpg)

## find_skill

![find_skill](images/tools/find_skill.jpg)

## draw_chart

![draw_chart](images/tools/draw_chart.jpg)

## run_query

![run_query](images/tools/run_query.jpg)

## inspect_metadata

![inspect_metadata](images/tools/inspect_metadata.jpg)

## read_object

![read_object](images/tools/read_object.jpg)

## make_navlink

![make_navlink](images/tools/make_navlink.jpg)

## sketch_query

![sketch_query](images/tools/sketch_query.jpg)

## delegate_task

![delegate_task](images/tools/delegate_task.jpg)

## report_describe

![report_describe](images/tools/report_describe.jpg)

## report_run

![report_run](images/tools/report_run.jpg)

## report_compose

![report_compose](images/tools/report_compose.jpg)

## open_draft

![open_draft](images/tools/open_draft.jpg)
