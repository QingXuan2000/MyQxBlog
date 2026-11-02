import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as helpers from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultTemplatesRoot = __dirname;
const templateCache = new Map();

/**
 * Compile template string to a render function
 */
export function compile(src, { filename = 'template' } = {}) {
  let cursor = 0;
  const regex = /<%(?:(=|-)|_)?([\s\S]*?)%>|$/g;
  let match;
  let body = 'let __out = [];\n';

  while ((match = regex.exec(src))) {
    const text = src.slice(cursor, match.index);
    if (text) {
      body += '__out.push(' + JSON.stringify(text) + ');\n';
    }
    cursor = regex.lastIndex;
    if (!match[0]) break;

    const modifier = match[1];
    const content = match[2].trim();

    if (modifier === '=') {
      body += '__out.push(__helpers.escapeHtml((' + content + ') ?? ""));\n';
    } else if (modifier === '-') {
      body += '__out.push(((' + content + ') ?? ""));\n';
    } else {
      body += content + '\n';
    }
  }
  body += 'return __out.join("");';

  let fn;
  try {
    fn = new Function('__data', '__helpers', 'with (__helpers) { with (__data) { ' + body + ' } }');
  } catch (err) {
    throw new Error(`Failed to compile ${filename}: ${err.message}\nGenerated code:\n${body}`);
  }

  return (data = {}, runtimeHelpers = {}) => {
    try {
      return fn(data, runtimeHelpers);
    } catch (err) {
      throw new Error(`Error rendering ${filename}: ${err.message}`);
    }
  };
}

/**
 * Resolve template file path:
 * 1. Check custom templates directory in root (e.g. process.cwd()/templates/...)
 * 2. Fallback to src/templates/...
 */
export function resolveTemplatePath(relPath, customRoot = null) {
  const norm = relPath.replace(/^[/\\]+/, '');
  const candidates = [];
  if (customRoot) {
    candidates.push(path.resolve(customRoot, norm));
  }
  candidates.push(path.resolve(process.cwd(), 'templates', norm));
  candidates.push(path.resolve(defaultTemplatesRoot, norm));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Template not found: ${relPath} (checked: ${candidates.join(', ')})`);
}

/**
 * Render a template file with data and helpers
 */
export function renderFile(relPath, data = {}, options = {}) {
  const filePath = resolveTemplatePath(relPath, options.templatesRoot);
  let compiled = templateCache.get(filePath);

  if (!compiled) {
    const content = fs.readFileSync(filePath, 'utf-8');
    compiled = compile(content, { filename: relPath });
    templateCache.set(filePath, compiled);
  }

  const runtimeHelpers = {
    ...helpers,
    e: helpers.escapeHtml,
    ...options.helpers,
    include: (includePath, childData = {}) => {
      const mergedData = { ...data, ...childData };
      return renderFile(includePath, mergedData, options);
    },
  };

  return compiled(data, runtimeHelpers);
}

/**
 * Clear the template cache (e.g. on rebuild in dev mode)
 */
export function clearTemplateCache() {
  templateCache.clear();
}
