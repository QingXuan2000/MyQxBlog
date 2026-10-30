# QxBlog

静态博客生成器。内容来自 GitHub Discussions 或本地 Markdown，构建时生成完整 HTML。关掉 JavaScript 仍可完整阅读；开启时有即时搜索、主题切换、阅读进度和代码复制。

界面走大字号、细线、留白路线，深浅两套主题，纯静态输出，无运行时依赖。

## 特性

- **零运行时**：纯静态文件，可直接托管在 GitHub Pages 或任意静态服务器。
- **两种内容源**：GitHub Discussions 自动同步，或在 `content/posts/` 写 Markdown。
- **完整 Markdown**：支持 GFM、代码高亮（Shiki）、数学公式（KaTeX）、表格与图片；正文中的危险 HTML 会被清理。
- **开箱即用页面**：首页、文章列表、分类、标签、归档、关于、404，外加 `feed.xml`、`sitemap.xml`、`robots.txt` 和全文搜索索引。
- **渐进增强**：无 JS 可完整浏览；有 JS 时提供搜索、主题切换、目录高亮、代码复制和阅读进度。

## 快速开始

需要 Node.js 22 或以上（CI 使用 Node.js 24）。

```sh
npm ci
npm run dev
```

终端会输出地址（默认 `http://127.0.0.1:5502/`）。开发服务器监听源码、配置和文章变化并自动重建；修改部署路径或服务配置后需重启服务器。

常用命令：

```sh
npm run build          # 生成 dist/
npm run preview        # 本地预览 dist/
npm run format         # Prettier 格式化
```

也支持 Bun（`bun install` / `bun run dev`）；需要可复现 CI 时请使用已提交的 npm 锁文件。

## 写文章

### 本地 Markdown

在 `content/posts/` 新建文件，例如 `1.md`：

```markdown
---
id: 1
title: 我的第一篇文章
date: '2026-10-15T09:00:00+08:00'
tags: [随笔, 技术]
category: 思考
draft: false
---

正文支持 GFM、代码高亮、数学公式、表格与图片。
```

- 文章链接固定为 `/posts/<id>.html`。`id` 必须唯一，不含斜杠或目录穿越字符。
- 日期推荐使用带时区的 ISO 8601。
- 可选字段：`updated`、`author`、`excerpt`、`tags`（或 `labels`）、`tagSlugs`、`category`、`categorySlug`、`discussionUrl`。
- `draft: true` 默认不发布；本地区看草稿：`npm run dev -- --drafts`。
- 没有文章时站点显示真实空状态，不填充示例内容。

### GitHub Discussions

1. 仓库开启 Discussions。
2. 在 `config/buildConfig.json` 的 `author` 填写允许发布的 **GitHub 登录名**（与站点展示名称独立）。
3. Discussion 的标题与正文成为文章，Category 成为分类，Labels 成为标签。
4. 工作流同步到 `content/posts/`，构建后部署到 Pages。

发布规则：带 `no-article` 标签、已回答、已关闭或非指定作者的 Discussion 不发布；删除、关闭或标记回答会下架对应文章，恢复后可重新发布。同步通过游标读取完整列表，不限前 100 篇。

同步文章带 `source: github-discussion`、仓库名和 Discussion 编号标记。同步只管理带这些标记的文件，**不会覆盖同 ID 的本地原创文章**；远程读取或校验失败时也不会删除已有内容。不要手动改同步文章正文——下次同步以 Discussions 为准。

本地手动同步需要环境变量 `GH_TOKEN`（或 `GITHUB_TOKEN`）和 `GITHUB_REPOSITORY=owner/repository`：

```sh
npm run sync
npm run build
```

令牌需有读取该仓库 Discussions 的权限。普通开发不需要令牌。

## 配置

- `config/siteConfig.json`：站点名称、作者、`site.url`、首页标语 `site.welcome`（渲染时自动转大写）、个人介绍、友链、页脚。
- `config/buildConfig.json`：发布作者、Discussion 编号偏移 `githubStartId`、每页文章数 `maxArticlesPerPage`、展示时区 `timezoneOffset`、robots 规则。
- `public/`：原样复制到输出根目录的文件，如头像、图标、自定义域名的 `CNAME`。

## 部署

`site.url` 必须是正式站点地址，构建器据此推导路径前缀。项目站点可用 `https://username.github.io/QxBlog/`，自动生成 `/QxBlog/` 前缀；也可显式覆盖：

```sh
npm run build -- --base /QxBlog/
npm run preview -- --base /QxBlog/
```

所有静态文件输出到 `dist/`。GitHub 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。工作流在 `main` 分支 push、Discussions 事件和手动运行时触发；Discussions/手动运行会先同步内容并只提交 `content/posts/`，构建产物不回写源码仓库。若默认分支不是 `main`，请修改工作流。

## 目录结构

```text
config/                 站点与构建配置
content/posts/          Markdown 内容
public/                 静态资源（字体、头像、图标）
src/
  content/              解析、规范化、渲染、GitHub 同步
  build/                配置、资产、索引、feed 与构建编排
  templates/            公共布局、组件与页面
  styles/               全站样式（单文件 default.css）
  client/               主题、导航、搜索与文章增强
scripts/                build / dev / preview / sync 入口
.github/workflows/      自动构建与部署
dist/                   生成结果（Git 忽略）
```

UI 改动通常落在 `src/templates/` 与 `src/styles/`；客户端脚本只增强模板里的 `data-*` 标记。内容处理与页面模板通过统一的 Post 数据结构连接，不以页面 DOM 反推业务状态。

## 预览草稿

`draft: true` 的文章默认不发布。想在本地区看它们：

```sh
npm run dev -- --drafts
```

也可单独构建一份带草稿的产物：

```sh
npm run build -- --drafts --out .preview/demo
npm run preview -- --out .preview/demo --port 5504
```

`.preview/` 只用于本地查看，不会进入正常 `npm run build` 的生产输出。

## 许可证

[GNU General Public License v3.0](LICENSE)。

## 致谢与归因

部分页面布局、排版与交互动画代码参考自：
- Antoine Wodniack — https://wodniack.dev
- CodePen 上的相关实现 — https://codepen.io/wodniack

具体涉及：波浪动画（2D Perlin noise 公式）、页面转场幕布、二进制跑马灯字符集与指针光标交互等视觉增强层代码。
