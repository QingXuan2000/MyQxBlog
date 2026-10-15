import { test, expect } from '@playwright/test';

test('pages have working prefixed navigation and readable content without JavaScript', async ({
  browser,
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('保持专注');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '文章', exact: true })
    .click();
  await expect(page).toHaveURL(/\/QxBlog\/articles\/index.html$/);
  await page.getByRole('link', { name: '在复杂的世界里，保持简单', exact: true }).first().click();
  await expect(page.locator('[data-post-body]')).toContainText('简单不是忽略复杂');
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(errors).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto('http://127.0.0.1:5503/QxBlog/posts/101.html');
  await expect(plain.getByRole('heading', { level: 1 })).toContainText('保持简单');
  await expect(plain.locator('[data-post-body]')).toContainText('从一张白纸开始');
  await context.close();
});

test('search opens from keyboard, matches body and navigates to selected article', async ({
  page,
}) => {
  await page.goto('./');
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-search-dialog]')).toBeVisible();
  await page.locator('[data-search-input]').fill('语法高亮');
  await expect(page.locator('[data-search-results] a')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/QxBlog\/posts\/101.html$/);
  await page.locator('[data-search-open]').click();
  await page.locator('[data-search-input]').fill('完全不存在的搜索词');
  await expect(page.locator('[data-search-status]')).toContainText(/没有|未找到|0/);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-search-dialog]')).not.toBeVisible();
  await expect(page.locator('[data-search-open]')).toBeFocused();
});

test('theme persists across routes, code copy works and heading IDs stay stable', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('posts/101.html');
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await page.locator('[data-theme-toggle]').click();
  const nextTheme = initialTheme === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme);
  await page.getByRole('button', { name: '复制代码', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '代码已复制', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('keepThinking');
  const tocLink = page.locator('[data-toc] a').last();
  const href = await tocLink.getAttribute('href');
  await tocLink.click();
  await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  const id = decodeURIComponent(href.slice(1));
  expect(await page.evaluate((target) => !!document.getElementById(target), id)).toBe(true);
});

test('mobile navigation works and main pages have no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    './',
    'articles/index.html',
    'categories/index.html',
    'tags/index.html',
    'archive/index.html',
    'about/index.html',
    'posts/101.html',
    '404.html',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      route,
    ).toBe(true);
  }
  await page.goto('./');
  await page.locator('[data-menu-toggle]').click();
  await expect(page.locator('[data-menu-toggle]')).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '文章', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-menu-toggle]')).toBeFocused();
  await page.keyboard.press('Enter');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '关于', exact: true })
    .click();
  await expect(page).toHaveURL(/\/QxBlog\/about\/index.html$/);
});

test('all generated local navigation links resolve including Unicode taxonomy and feed', async ({
  page,
  request,
}) => {
  await page.goto('./');
  const links = await page
    .locator('a[href]')
    .evaluateAll((anchors) => [
      ...new Set(
        anchors
          .map((anchor) => anchor.href)
          .filter((href) => href.startsWith(location.origin) && !href.includes('#')),
      ),
    ]);
  for (const url of links) expect((await request.get(url)).status(), url).toBe(200);
  await page.goto('tags/index.html');
  await page.getByRole('link', { name: /设计/ }).first().click();
  await expect(page.locator('h1')).toHaveText('设计');
  await expect(page.locator('.post-list')).toContainText('让网页回到阅读本身');
});
