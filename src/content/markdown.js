/* Markdown 渲染管道。顺序在这里是有意义的，改之前先看下面这条。

   rehype-sanitize 必须跑在 KaTeX 和 Shiki 前面。它们生成的标记带着一大串 class 和
   内联样式，净化器会把不认识的属性全部剥掉，公式和高亮就废了。反过来先净化用户写的
   HTML，再让可信的渲染器产出结果，安全性一样，成品还能保住。

   顺带在管道里做了三件小事，媒体加懒加载、剥完属性后把锚点前缀接回、顺手收集目录
   和纯文本。都是过一遍树的事，分三次遍历不如一次做完。 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';

const schema = {
  ...defaultSchema,
  // 正文要能放视频，默认白名单里没有这两个标签，也不放行 poster。
  tagNames: [...defaultSchema.tagNames, 'video', 'source'],
  protocols: { ...defaultSchema.protocols, poster: ['http', 'https'] },
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes.code || []),
      ['className', /^language-./, 'math-inline', 'math-display'],
    ],
    video: ['src', 'poster', 'controls', 'muted', 'loop', 'playsInline', 'width', 'height'],
    source: ['src', 'type'],
  },
};

function enhanceMedia() {
  return (tree) =>
    visit(tree, 'element', (node) => {
      if (node.tagName === 'img')
        Object.assign(node.properties, { loading: 'lazy', decoding: 'async' });
      if (node.tagName === 'video')
        Object.assign(node.properties, { controls: true, preload: 'metadata' });
    });
}

function reconnectSanitizedFragments() {
  return (tree) => {
    const ids = new Set();
    visit(tree, 'element', (node) => {
      if (node.properties.id) ids.add(node.properties.id);
    });
    const target = (id) =>
      !ids.has(id) && ids.has(`${schema.clobberPrefix}${id}`) ? `${schema.clobberPrefix}${id}` : id;
    visit(tree, 'element', (node) => {
      const href = node.properties.href;
      if (typeof href === 'string' && href.startsWith('#'))
        node.properties.href = `#${target(href.slice(1))}`;
      for (const name of ['ariaDescribedBy', 'ariaLabelledBy']) {
        const value = node.properties[name];
        if (Array.isArray(value)) node.properties[name] = value.map(target);
        else if (typeof value === 'string')
          node.properties[name] = value.split(/\s+/).map(target).join(' ');
      }
    });
  };
}

function collectContent() {
  return (tree, file) => {
    file.data.text = toText(tree).replace(/\s+/g, ' ').trim();
    file.data.toc = [];
    visit(tree, 'element', (node) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        file.data.toc.push({
          id: node.properties.id,
          text: toText(node).trim(),
          depth: Number(node.tagName[1]),
        });
      }
    });
  };
}

function codeCopyButtons() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (
        node.tagName === 'figure' &&
        Object.hasOwn(node.properties, 'data-rehype-pretty-code-figure')
      ) {
        const pre = node.children.find((c) => c.tagName === 'pre');
        const hasTitle = node.children.some((c) => c.tagName === 'figcaption');
        const lang = pre?.properties?.['data-language'] || pre?.properties?.dataLanguage;
        if (lang && !hasTitle) {
          node.children.unshift({
            type: 'element',
            tagName: 'figcaption',
            properties: { 'data-rehype-pretty-code-title': '' },
            children: [{ type: 'text', value: String(lang) }],
          });
        }
        node.children.push({
          type: 'element',
          tagName: 'button',
          properties: {
            type: 'button',
            className: ['code-copy'],
            ariaLabel: '复制代码',
            title: '复制代码',
          },
          children: [{ type: 'text', value: '复制代码' }],
        });
      }
    });
  };
}

// 先净化再跑可信渲染器，使生成的 KaTeX/Shiki 标记得以保留。
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(enhanceMedia)
  .use(reconnectSanitizedFragments)
  .use(rehypeSlug)
  .use(collectContent)
  // 与 ebd99b0 一致：wrap 整段标题文本，#/##/### 前缀交给 CSS 的 hN::before
  .use(rehypeAutolinkHeadings, {
    behavior: 'wrap',
    properties: { className: ['qx-heading-anchor'] },
  })
  .use(rehypeKatex, { strict: 'ignore', trust: false })
  .use(rehypePrettyCode, {
    theme: { light: 'github-light', dark: 'github-dark' },
    keepBackground: false,
    defaultLang: 'plaintext',
  })
  .use(codeCopyButtons)
  .use(rehypeStringify);

export async function renderMarkdown(body) {
  if (typeof body !== 'string') throw new TypeError('Markdown body must be text');
  const result = await processor.process(body);
  const text = result.data.text;
  const chineseCharacters = (
    text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []
  ).length;
  const words = text
    .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return {
    html: String(result),
    text,
    toc: result.data.toc,
    readingMinutes: Math.max(1, Math.ceil(chineseCharacters / 350 + words / 220)),
  };
}
