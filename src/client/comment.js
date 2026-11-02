/**
 * Giscus 评论区客户端初始化与主题同步模块。
 */

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

  // 尝试拉取配置的自定义直角极客风 CSS 文件
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(configuredTheme, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
    });
    clearTimeout(timer);
    if (res.ok) {
      // 成功拉取到极客风主题，直接使用
      return configuredTheme;
    }
  } catch (_) {
    // 探测失败
  }

  // 没有拉取到的话再回退默认主题
  return defaultFallback;
}

export async function updateGiscusTheme(theme, doc = globalThis.document) {
  const iframe = doc.querySelector('iframe.giscus-frame');
  if (!iframe?.contentWindow) return;

  const target = doc.querySelector('[data-giscus-target]');
  const themeUrl = await resolveTheme(theme, target);

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

  const handleMessage = async (event) => {
    if (event.origin !== 'https://giscus.app') return;
    if (event.data?.giscus?.resizeHeight) {
      const theme = doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      await updateGiscusTheme(theme, doc);
    }
  };
  win.addEventListener('message', handleMessage);
}
