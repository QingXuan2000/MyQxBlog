/** 此处文本不转义：由模板按各自 HTML 上下文转义。 */
export function textValue(value, field, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error(`${field} must be text`);
  return String(value).trim();
}

export function safeSegment(value, field = 'id') {
  const segment = textValue(value, field);
  if (
    !segment ||
    !/^[\p{L}\p{N}_-]+$/u.test(segment) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(segment)
  ) {
    throw new Error(`${field} must be a safe path segment`);
  }
  return segment;
}

export function slugify(value) {
  return (
    String(value)
      .normalize('NFKC')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

function isoDate(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(textValue(value, field));
  const original = String(value);
  const calendar = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(original);
  const calendarDate = calendar
    ? new Date(`${calendar[1]}-${calendar[2]}-${calendar[3]}T00:00:00.000Z`)
    : null;
  const invalidCalendar =
    calendar &&
    (Number.isNaN(calendarDate.getTime()) ||
      calendarDate.toISOString().slice(0, 10) !== `${calendar[1]}-${calendar[2]}-${calendar[3]}`);
  if (Number.isNaN(date.getTime()) || invalidCalendar) {
    throw new Error(`${field} must be a valid date`);
  }
  return date.toISOString();
}

function textList(value, field) {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string')
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  if (!Array.isArray(value)) throw new Error(`${field} must be a list or comma-separated text`);
  return value.map((item) => textValue(item, field)).filter(Boolean);
}

export function normalizePost(data, body, fallbackId, config = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('frontmatter must be an object');
  if (typeof body !== 'string') throw new Error('body must be text');
  const id = safeSegment(data.id ?? fallbackId);
  const title = textValue(data.title, 'title');
  if (!title) throw new Error('title is required');
  if (data.draft !== undefined && typeof data.draft !== 'boolean')
    throw new Error('draft must be a boolean');
  const labels = textList(data.labels ?? data.tags, 'labels');
  const explicitSlugs = textList(data.labelSlugs ?? data.tagSlugs, 'labelSlugs');
  if (explicitSlugs.length && explicitSlugs.length !== labels.length)
    throw new Error('labelSlugs must match labels');
  const labelSlugs = labels.map((label, index) =>
    safeSegment(explicitSlugs[index] ?? slugify(label), 'labelSlug'),
  );
  const category = textValue(
    data.category,
    'category',
    textValue(data.categorySlug, 'categorySlug'),
  );
  const categorySlug = category
    ? safeSegment(data.categorySlug ?? slugify(category), 'categorySlug')
    : '';
  const date = isoDate(data.date ?? data.createdAt, 'date', '1970-01-01T00:00:00.000Z');
  const updated = isoDate(data.updated ?? data.updatedAt, 'updated', date);
  const post = {
    id,
    title,
    author: textValue(data.author, 'author', config.site?.author || config.author || 'Anonymous'),
    date,
    updated,
    labels,
    labelSlugs,
    category,
    categorySlug,
    body,
    excerpt: textValue(data.excerpt ?? data.description, 'excerpt'),
    draft: data.draft ?? false,
  };
  if (data.discussionUrl !== undefined) {
    const url = new URL(textValue(data.discussionUrl, 'discussionUrl'));
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new Error('discussionUrl must be an HTTP URL');
    post.discussionUrl = url.href;
  }
  return post;
}
