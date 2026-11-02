/**
 * Giscus 评论区客户端初始化与主题同步模块。
 */

const themeUrlCache = new Map();
let lastSentThemeUrl = null;

async function resolveTheme(theme, target) {
  const isDark = theme === 'dark';
  const defaultFallback = isDark ? 'transparent_dark' : 'light';
  const configuredTheme = isDark
    ? target?.dataset?.themeDark
    : target?.dataset?.themeLight;

  if (!configuredTheme) {
    return defaultFallback;
  }

  // 如果原本配置的就是 giscus 内置主题关键字，直接返回
  if (!configuredTheme.startsWith('http') && !configuredTheme.endsWith('.css')) {
    return configuredTheme;
  }

  // 已探测并缓存过，立即返回无需发起网络请求（实现 0 延迟实时响应）
  if (themeUrlCache.has(configuredTheme)) {
    return themeUrlCache.get(configuredTheme);
  }

  // 首次尝试探测配置的自定义直角极客风 CSS 文件
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(configuredTheme, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      themeUrlCache.set(configuredTheme, configuredTheme);
      return configuredTheme;
    }
  } catch (_) {
    // 探测失败
  }

  // 没有拉取到的话回退默认主题并缓存
  themeUrlCache.set(configuredTheme, defaultFallback);
  return defaultFallback;
}

export async function updateGiscusTheme(theme, doc = globalThis.document, force = false) {
  const iframe = doc.querySelector('iframe.giscus-frame') || doc.querySelector('.giscus iframe');
  if (!iframe?.contentWindow) return;

  const target = doc.querySelector('[data-giscus-target]');
  if (!target) return;

  const themeUrl = await resolveTheme(theme, target);

  // 避免向 iframe 重复投递相同主题造成不必要的闪烁
  if (!force && lastSentThemeUrl === themeUrl) return;
  lastSentThemeUrl = themeUrl;

  iframe.contentWindow.postMessage(
    {
      giscus: {
        setConfig: {
          theme: themeUrl,
        },
      },
    },
    'https://giscus.app',
  );
}

export async function initComment(doc = globalThis.document, win = globalThis.window) {
  const container = doc.querySelector('.qx-comments');
  if (!container) return;

  const target = container.querySelector('[data-giscus-target]');
  if (!target) return;

  const repo = target.dataset.repo;
  const repoId = target.dataset.repoId;
  const category = target.dataset.category;
  const categoryId = target.dataset.categoryId;
  const mapping = target.dataset.mapping || 'number';
  const term = target.dataset.term;
  const reactionsEnabled = target.dataset.reactionsEnabled || '1';
  const emitMetadata = target.dataset.emitMetadata || '0';
  const inputPosition = target.dataset.inputPosition || 'top';
  const lang = target.dataset.lang || 'zh-CN';
  const loading = target.dataset.loading || 'lazy';

  // 必须配置了有效的 repoId 和 categoryId 才挂载 giscus 脚本
  if (!repo || !repoId || !categoryId) return;

  const currentTheme = doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const initialTheme = await resolveTheme(currentTheme, target);

  // 提前并发预探测深色和浅色主题，确保后续主题切换 0 延迟即时生效
  resolveTheme('dark', target);
  resolveTheme('light', target);

  lastSentThemeUrl = initialTheme;

  const script = doc.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.setAttribute('data-repo', repo);
  script.setAttribute('data-repo-id', repoId);
  script.setAttribute('data-category', category);
  script.setAttribute('data-category-id', categoryId);
  script.setAttribute('data-mapping', mapping);
  if (term) script.setAttribute('data-term', term);
  script.setAttribute('data-reactions-enabled', reactionsEnabled);
  script.setAttribute('data-emit-metadata', emitMetadata);
  script.setAttribute('data-input-position', inputPosition);
  script.setAttribute('data-theme', initialTheme);
  script.setAttribute('data-lang', lang);
  script.setAttribute('data-loading', loading);
  script.setAttribute('crossorigin', 'anonymous');
  script.async = true;

  target.appendChild(script);

  // 监听 iframe 节点挂载，确保第一时间将当前全局主题推入
  const observer = typeof win.MutationObserver === 'function'
    ? new win.MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && (node.matches?.('iframe') || node.querySelector?.('iframe'))) {
              const theme = doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
              updateGiscusTheme(theme, doc);
              return;
            }
          }
        }
      })
    : null;
  observer?.observe(target, { childList: true, subtree: true });

  // 监听 giscus 载入与握手消息，确保 iframe 就绪时同步最新全局主题
  let hasHandshaked = false;
  const handleMessage = async (event) => {
    if (event.origin !== 'https://giscus.app') return;
    if (!event.data?.giscus) return;

    if (!hasHandshaked) {
      hasHandshaked = true;
      const theme = doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      await updateGiscusTheme(theme, doc, true);
    }
  };
  win.addEventListener('message', handleMessage);
}
