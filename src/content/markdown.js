/* Markdown 渲染管道。顺序在这里是有意义的，改之前先看下面这条。

   rehype-sanitize 必须跑在 KaTeX 和 Shiki 前面。它们生成的标记带着一大串 class 和
   内联样式，净化器会把不认识的属性全部剥掉，公式和高亮就废了。反过来先净化用户写的
   HTML，再让可信的渲染器产出结果，安全性一样，成品还能保住。

   顺带在管道里做了几件小事，媒体加懒加载、表格包裹外层容器、剥完属性后把锚点前缀接回、顺手收集目录
   和纯文本。都是过一遍树的事，分多次遍历不如一次做完。 */
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

function wrapTables() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (
        node.tagName === 'table' &&
        parent &&
        !(parent.tagName === 'div' && parent.properties?.className?.includes('qx-table-wrap'))
      ) {
        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['qx-table-wrap'] },
          children: [node],
        };
        parent.children.splice(index, 1, wrapper);
        return [visit.SKIP, index + 1];
      }
    });
  };
}

function remarkCjkEmphasis() {
  return (tree) => {
    visit(tree, (node) => {
      if (!Array.isArray(node.children) || node.type === 'code' || node.type === 'inlineCode')
        return;
      let hasTextWithStrong = false;
      for (const child of node.children) {
        if (child.type === 'text' && child.value.includes('**')) {
          hasTextWithStrong = true;
          break;
        }
      }
      if (!hasTextWithStrong) return;

      const newChildren = [];
      for (const child of node.children) {
        if (child.type === 'text' && child.value.includes('**')) {
          const parts = child.value.split(/(\*{2,3}[^\*\n]+?\*{2,3})/g);
          for (const part of parts) {
            if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
              newChildren.push({
                type: 'emphasis',
                children: [
                  {
                    type: 'strong',
                    children: [{ type: 'text', value: part.slice(3, -3) }],
                  },
                ],
              });
            } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
              newChildren.push({
                type: 'strong',
                children: [{ type: 'text', value: part.slice(2, -2) }],
              });
            } else if (part) {
              newChildren.push({ type: 'text', value: part });
            }
          }
        } else {
          newChildren.push(child);
        }
      }
      node.children = newChildren;
    });
  };
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

function normalizeTables(markdown) {
  const lines = markdown.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^\|\|(?=[^|])/.test(line)) {
      line = '|' + line.slice(2);
    }

    const isDelimiter = /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
    if (isDelimiter && result.length > 0) {
      const prevLine = result[result.length - 1];
      if (prevLine.includes('|')) {
        const parseRow = (str) => {
          let s = str.trim();
          let parts = s.split('|');
          if (s.startsWith('|')) parts.shift();
          if (s.endsWith('|')) parts.pop();
          return parts;
        };
        const headerCols = parseRow(prevLine).length;
        let delimCols = parseRow(line);
        if (delimCols.length !== headerCols && headerCols > 0) {
          if (delimCols.length > headerCols) {
            delimCols = delimCols.slice(0, headerCols);
          } else {
            while (delimCols.length < headerCols) {
              delimCols.push(' :--- ');
            }
          }
          line = '|' + delimCols.join('|') + '|';
        }
      }
    }
    result.push(line);
  }
  return result.join('\n');
}

// 先净化再跑可信渲染器，使生成的 KaTeX/Shiki 标记得以保留。
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkCjkEmphasis)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(enhanceMedia)
  .use(wrapTables)
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
  body = normalizeTables(body);
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
