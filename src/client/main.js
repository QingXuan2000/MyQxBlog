/* 客户端增强的总入口。页面本身在没有脚本时也能读完，这里启动的一切都是加分项。

   每个模块自己检查依赖和降级条件，拿不到就安静退出，不抛错。一个模块失效不该连带
   别的模块一起停，比如浏览器没有 IntersectionObserver，入场揭示不播，搜索还得能用。

   顺序有一点讲究。主题、导航、搜索先接上，它们是功能；动效模块放在后面，
   首屏视觉稍晚一点没有代价。 */
import { initTheme } from './theme.js';
import { initNavigation } from './navigation.js';
import { initSearch } from './search.js';
import { initArticle } from './article.js';
import { initWaves, initSeparators } from './waves.js';
import { initFooterHeight } from './footer.js';
import { initReveal } from './reveal.js';
import { initRoll } from './roll.js';
import { initCursor } from './cursor.js';
import { initTransition } from './transition.js';

export function initClient(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return;
  initTheme(doc, win);
  initNavigation(doc, win);
  initSearch(doc, win);
  initArticle(doc, win);
  initWaves(doc, win);
  initSeparators(doc);
  initFooterHeight(doc, win);
  initReveal(doc, win);
  initRoll(doc, win);
  initCursor(doc, win);
  initTransition(doc, win);
}

if (globalThis.document) {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => initClient(), { once: true });
  else initClient();
}
