import { initTheme } from './theme.js';
import { initNavigation } from './navigation.js';
import { initSearch } from './search.js';
import { initArticle } from './article.js';

export function initClient(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return;
  initTheme(doc, win);
  initNavigation(doc, win);
  initSearch(doc, win);
  initArticle(doc, win);
}

if (globalThis.document) {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => initClient(), { once: true });
  else initClient();
}
