import { parseDocument } from 'yaml';

export function parseFrontmatter(source) {
  const text = String(source).replace(/^\uFEFF/, '');
  const opening = text.match(/^---[^\S\r\n]*\r?\n/);
  if (!opening) return { data: {}, content: text };
  const rest = text.slice(opening[0].length);
  const closing = /^---[^\S\r\n]*(?:\r?\n|$)/m.exec(rest);
  if (!closing) throw new Error('frontmatter opening delimiter has no closing delimiter');
  const document = parseDocument(rest.slice(0, closing.index));
  if (document.errors.length)
    throw new Error(`invalid YAML frontmatter: ${document.errors[0].message}`);
  const data = document.toJS({ maxAliasCount: 100 }) ?? {};
  if (typeof data !== 'object' || Array.isArray(data))
    throw new Error('frontmatter must be an object');
  return { data, content: rest.slice(closing.index + closing[0].length) };
}

export function serializeFrontmatter(data, body) {
  // JSON 值本身即合法 YAML；逐值引用可防止标量注入。
  const header = Object.entries(data)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
  return `---\n${header}\n---\n\n${body}`;
}
