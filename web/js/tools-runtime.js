/** Исполнение инструментов ТЗ. Файлы — только через переданный fs (корень workspace). */

export const PLATFORM_TOOLS = new Set([
  'run_query',
  'inspect_metadata',
  'read_object',
  'make_navlink',
  'sketch_query',
  'delegate_task',
  'report_describe',
  'report_run',
  'report_compose',
  'open_draft',
]);

const ALIASES = {
  read_file: 'fs_read',
  write_file: 'fs_write',
};

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MAX_CHARS = 200000;
const TEXT_EXT = /\.(txt|md|json|xml|csv|bsl|js|html|css|log)$/i;

export function normalizeRel(rel) {
  const p = String(rel || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!p || p.split('/').includes('..')) throw new Error('Недопустимый путь');
  return p;
}

function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (pattern[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`, 'i');
}

function sliceLines(content, offset, limit) {
  const lines = String(content).split('\n');
  const start = Math.max(1, Number(offset) || 1);
  const take = limit == null ? lines.length : Math.max(0, Number(limit));
  const slice = lines.slice(start - 1, start - 1 + take);
  return { content: slice.join('\n'), start, lines: slice.length, total: lines.length };
}

function safeCalc(expression) {
  const raw = String(expression || '').trim();
  const compact = raw.replace(/\s+/g, '');
  if (!compact || !/^[\d.eE+\-*/()%]+$/.test(compact)) {
    throw new Error('Допустимы только числа и + - * / % скобки');
  }
  const value = Function(`"use strict"; return (${compact})`)();
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Результат не число');
  return { expression: raw, value };
}

function chartSpec(args) {
  const type = String(args.type || '').trim();
  if (!['bar', 'line', 'hbar'].includes(type)) throw new Error('type: bar, line или hbar');
  const labels = Array.isArray(args.labels) ? args.labels.map(String) : [];
  const data = Array.isArray(args.data) ? args.data.map(Number) : [];
  if (!labels.length || labels.length !== data.length || data.some((n) => !Number.isFinite(n))) {
    throw new Error('labels и data — массивы одной длины из чисел');
  }
  return {
    type,
    title: String(args.title || ''),
    labels,
    datasets: [{ label: String(args.title || 'Ряд'), data }],
  };
}

function excerpt(text, query) {
  const src = String(text || '');
  const at = src.toLowerCase().indexOf(String(query).toLowerCase());
  if (at < 0) return '';
  const from = Math.max(0, at - 40);
  return src.slice(from, at + query.length + 80).replace(/\s+/g, ' ');
}

/**
 * @param {string} name
 * @param {object} args
 * @param {{read: Function, write: Function, list: Function, searchChats: Function, readSkills: Function}} fs
 */
export async function executeHarnessTool(name, args, fs) {
  args = args || {};
  const tool = ALIASES[name] || name;
  if (tool === 'read_agent_md') {
    const id = String(args.agent_id || 'default').trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Недопустимый agent_id');
    const content = await fs.read(`agents/${id}.md`);
    return { path: `agents/${id}.md`, agent_id: id, content };
  }
  if (PLATFORM_TOOLS.has(tool)) {
    const error = new Error('Инструмент выполняется только в сеансе 1С');
    error.hints = tool === 'run_query'
      ? ['Запрос с РАЗРЕШЕННЫЕ выполняется на платформе', 'Ссылки в params: { type, uuid }']
      : undefined;
    throw error;
  }
  if (tool === 'session_now') {
    const now = new Date();
    return {
      iso: now.toISOString(),
      weekday: WEEKDAYS[now.getDay()],
      local: now.toLocaleString('ru-RU'),
    };
  }
  if (tool === 'calc') return safeCalc(args.expression);
  if (tool === 'draw_chart') {
    const chart = chartSpec(args);
    return { chart, hint: 'Превью графика добавляет интерфейс чата.' };
  }
  if (tool === 'find_in_chat') {
    const query = String(args.query || '').trim();
    if (!query) throw new Error('Пустой query');
    const hits = await fs.searchChats(query);
    return { query, hits: hits.slice(0, 20) };
  }
  if (tool === 'find_skill') {
    const query = String(args.query || '').trim().toLowerCase();
    if (!query) throw new Error('Пустой query');
    const docs = await fs.readSkills();
    const hits = docs
      .filter((d) => `${d.path}\n${d.content}`.toLowerCase().includes(query))
      .map((d) => ({ path: d.path, excerpt: excerpt(d.content, query) || d.path }));
    return { query: args.query, hits: hits.slice(0, 20) };
  }
  if (tool === 'fs_list') {
    const dir = args.path ? normalizeRel(args.path).replace(/\/$/, '') : '';
    const paths = await fs.list();
    const entries = new Map();
    for (const rel of paths) {
      if (dir && rel !== dir && !rel.startsWith(`${dir}/`)) continue;
      const rest = dir ? rel.slice(dir.length + 1) : rel;
      if (!rest) continue;
      const name = rest.split('/')[0];
      if (name === '.keep') continue;
      const child = dir ? `${dir}/${name}` : name;
      const isDir = rest.includes('/') || paths.some((p) => p.startsWith(`${child}/`));
      entries.set(name, { name, type: isDir ? 'dir' : 'file', path: child });
    }
    return { path: dir || '.', entries: [...entries.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  }
  if (tool === 'fs_read') {
    const path = normalizeRel(args.path);
    let content = await fs.read(path);
    if (content.length > MAX_CHARS) content = content.slice(0, MAX_CHARS);
    if (args.offset || args.limit) {
      const sliced = sliceLines(content, args.offset, args.limit);
      return { path, ...sliced };
    }
    return { path, content };
  }
  if (tool === 'fs_write') {
    const path = normalizeRel(args.path);
    const content = args.content ?? '';
    await fs.write(path, content);
    return { path, bytes: String(content).length, ok: true };
  }
  if (tool === 'fs_mkdir') {
    const path = normalizeRel(args.path).replace(/\/$/, '');
    await fs.write(`${path}/.keep`, '');
    return { path, ok: true };
  }
  if (tool === 'fs_edit') {
    const path = normalizeRel(args.path);
    const oldText = String(args.old_text ?? '');
    const fresh = String(args.new_text ?? '');
    if (!oldText) throw new Error('Пустой old_text');
    const content = await fs.read(path);
    const count = content.split(oldText).length - 1;
    if (count === 0) throw new Error('Фрагмент не найден');
    if (count > 1) throw new Error('Фрагмент встречается больше одного раза');
    const next = content.replace(oldText, fresh);
    await fs.write(path, next);
    return { path, ok: true };
  }
  if (tool === 'fs_glob') {
    const pattern = String(args.pattern || '').trim();
    if (!pattern) throw new Error('Пустой pattern');
    const re = globToRegExp(pattern.replace(/\\/g, '/'));
    const paths = (await fs.list()).filter((p) => re.test(p) || re.test(p.split('/').pop()));
    return { pattern, paths: paths.slice(0, 200) };
  }
  if (tool === 'fs_search') {
    const query = String(args.query || '');
    if (!query) throw new Error('Пустой query');
    const root = args.path ? normalizeRel(args.path) : '';
    const paths = await fs.list();
    const hits = [];
    for (const path of paths) {
      if (root && path !== root && !path.startsWith(`${root}/`)) continue;
      if (!TEXT_EXT.test(path)) continue;
      let content = '';
      try {
        content = await fs.read(path);
      } catch {
        continue;
      }
      if (!content.toLowerCase().includes(query.toLowerCase())) continue;
      hits.push({ path, excerpt: excerpt(content, query) });
      if (hits.length >= 30) break;
    }
    return { query, hits };
  }
  throw new Error(`Неизвестный инструмент: ${name}`);
}

export function toolErrorPayload(error) {
  return {
    message: error?.message || String(error),
    hints: error?.hints,
  };
}
