/** OpenAI-compatible tool definitions for 1С platform. */
export const HARNESS_OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Прочитать текстовый файл в рабочей области 1С (путь относительно workspace, например data/sample.txt).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Относительный путь к файлу' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Записать текст в файл рабочей области 1С (sessions/… для истории чата).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Относительный путь' },
          content: { type: 'string', description: 'Содержимое файла' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_agent_md',
      description: 'Прочитать markdown-инструкцию агента из agents/<agent_id>.md',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Идентификатор агента, по умолчанию default' },
        },
        required: [],
      },
    },
  },
];
