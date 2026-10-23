/** Схемы инструментов по ТЗ 1СХарнесс (OpenAI tools). */

function fn(name, description, properties, required) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties, required: required || [] },
    },
  };
}

const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });

export const HARNESS_OPENAI_TOOLS = [
  fn('fs_list', 'Список файлов и папок внутри workspace.', {
    path: str('Относительный каталог, по умолчанию корень'),
  }),
  fn('fs_read', 'Прочитать текстовый файл внутри workspace.', {
    path: str('Относительный путь'),
    offset: num('Строка с 1, необязательно'),
    limit: num('Сколько строк вернуть, необязательно'),
  }, ['path']),
  fn('fs_write', 'Записать текстовый файл внутри workspace (перезапись).', {
    path: str('Относительный путь'),
    content: str('Полное содержимое'),
  }, ['path', 'content']),
  fn('fs_edit', 'Заменить один фрагмент текста в файле workspace.', {
    path: str('Относительный путь'),
    old_text: str('Фрагмент, который нужно заменить (ровно одно вхождение)'),
    new_text: str('Новый фрагмент'),
  }, ['path', 'old_text', 'new_text']),
  fn('fs_search', 'Найти подстроку в текстовых файлах workspace.', {
    query: str('Что искать'),
    path: str('Каталог или файл, по умолчанию весь workspace'),
  }, ['query']),
  fn('fs_glob', 'Найти пути по маске (* и **).', {
    pattern: str('Маска, например skills/**/*.md'),
  }, ['pattern']),
  fn('fs_mkdir', 'Создать каталог внутри workspace.', {
    path: str('Относительный путь каталога'),
  }, ['path']),
  fn('session_now', 'Дата и время сеанса и день недели.', {}),
  fn('calc', 'Посчитать арифметическое выражение (числа, + - * / % скобки, запись 1e9).', {
    expression: str('Выражение'),
  }, ['expression']),
  fn('find_in_chat', 'Поиск по сохранённым диалогам, включая архив в localStorage.', {
    query: str('Подстрока'),
  }, ['query']),
  fn('find_skill', 'Найти playbook в skills/ и инструкции agents/.', {
    query: str('Слова запроса'),
  }, ['query']),
  fn('draw_chart', 'График bar, line или hbar. UI вставит превью в ответ.', {
    type: str('bar | line | hbar'),
    title: str('Подпись'),
    labels: { type: 'array', items: { type: 'string' } },
    data: { type: 'array', items: { type: 'number' }, description: 'Значения одного ряда' },
  }, ['type', 'labels', 'data']),
  fn('run_query', 'Язык запросов 1С. В браузере без сеанса ИБ недоступен.', {
    query: str('Текст запроса'),
    params: { type: 'object', description: 'Параметры; ссылки как {type, uuid}' },
    limit: num('Лимит строк'),
  }, ['query']),
  fn('inspect_metadata', 'Структура объекта метаданных. Только сеанс 1С.', {
    name: str('Имя объекта метаданных'),
  }, ['name']),
  fn('read_object', 'Карточка объекта по ссылке {type, uuid}. Только сеанс 1С.', {
    ref: { type: 'object', description: '{ type, uuid }' },
  }, ['ref']),
  fn('make_navlink', 'Навигационная ссылка объекта. Только сеанс 1С.', {
    ref: { type: 'object', description: '{ type, uuid }' },
  }, ['ref']),
  fn('sketch_query', 'Субагент метаданных: эскиз запроса. Только сеанс 1С.', {
    task: str('Что нужно выбрать'),
  }, ['task']),
  fn('delegate_task', 'Субагент данных: выборка до ~200 строк, data_ref родителю. Только сеанс 1С.', {
    task: str('Задача выборки'),
  }, ['task']),
  fn('report_describe', 'Описание варианта отчёта БСП по имени. Только сеанс 1С.', {
    name: str('Имя или фрагмент имени варианта'),
  }, ['name']),
  fn('report_run', 'Сформировать вариант отчёта: колонки, строки, период. Только сеанс 1С.', {
    name: str('Вариант отчёта'),
    period: str('Период, необязательно'),
  }, ['name']),
  fn('report_compose', 'Универсальный отчёт БСП и открытие формы. Только сеанс 1С.', {
    task: str('Что показать в отчёте'),
  }, ['task']),
  fn('open_draft', 'Открыть форму нового документа или элемента без записи. Только сеанс 1С.', {
    type: str('Тип метаданных, например Документ.Реализация'),
    fill: { type: 'object', description: 'Поля заполнения' },
  }, ['type']),
];
