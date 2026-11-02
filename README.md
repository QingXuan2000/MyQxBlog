# QxBlog

自己写的静态博客生成器。文章放在 `content/posts/` 的 Markdown 里，或者在 GitHub Discussions 发帖后同步过来，构建一次得到整套 HTML。关掉 JavaScript 也能把每一页读完，开着的时候多几样东西：搜索、主题切换、代码复制、目录跟随滚动。

线上站点是 https://blog.qxbit.me ，界面走大字号、细线、留白的路线，深浅两套配色。

## 特性

- **零运行时**：产物全是静态文件，扔到 GitHub Pages 或任何静态服务器上就能跑，不需要 Node，没有前端框架。
- **两种内容源**：本地 Markdown 直接读 `content/posts/`；GitHub Discussions 由工作流同步成同样格式的 Markdown。两者可以混用，同步不会覆盖你自己写的文章。
- **完整的 Markdown**：unified 管道，支持 GFM、Shiki 代码高亮、KaTeX 公式、表格、图片和视频。正文里的 HTML 先进 rehype-sanitize 清洗，再交给高亮和公式渲染器——作者能写 `<video>`，但写不出能执行的东西。
- **开箱即用的页面**：首页、文章列表、分类、标签、归档、关于、404，外加 `feed.xml`、`sitemap.xml`、`robots.txt` 和一份给前端搜索用的 `assets/search.json`。
- **渐进增强**：页面按无 JavaScript 的标准写，脚本只认模板里的 `data-*` 标记做增强，不读 DOM 猜页面状态。

## 快速开始

需要 Node.js 22 或以上（CI 用 24）。

```sh
npm ci
npm run dev
```

终端会打出地址，默认 http://127.0.0.1:5502/ 。开发服务器盯着 `src`、`config`、`content` 和 `public`，文件一改就重新构建，刷新浏览器即可。改端口或部署路径要重启服务。

常用命令：

```sh
npm run build          # 生成 dist/
npm run preview        # 本地预览 dist/
npm run format         # Prettier 格式化
npm run format:check   # 格式检查
```

Bun 也能用，`bun install` 之后 `bun run dev`。要在 CI 上复现同一份依赖，用提交进仓库的 npm 锁文件。

## 写文章

### 本地 Markdown

在 `content/posts/` 新建文件，比如 `1.md`：

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

文章地址由 id 决定，固定为 `/posts/<id>.html`。id 全局唯一，只允许字母、数字、下划线和连字符，也别用 `con`、`prn`、`nul`、`com1` 这类 Windows 保留名——构建会直接报错。

frontmatter 支持的字段：

| 字段 | 必填 | 说明 |
| --- | :---: | --- |
| `id` | | 地址里的那一段，不写就用文件名 |
| `title` | ✓ | 标题，空标题直接报错 |
| `date` | | 默认 1970-01-01，建议写带时区的 ISO 8601 |
| `updated` | | 默认等于 `date`，文章页底部显示最后更新时间 |
| `author` | | 默认取 `siteConfig.json` 的 `site.author` |
| `excerpt` | | 列表和 feed 里的摘要，不写就截正文前 180 字 |
| `description` | | `excerpt` 的别名 |
| `tags` | | 标签，数组或逗号分隔的字符串都行 |
| `labels` | | `tags` 的别名 |
| `tagSlugs` | | 自定义标签地址，数量要和标签数对上 |
| `labelSlugs` | | `tagSlugs` 的别名 |
| `category` | | 分类，一篇一个 |
| `categorySlug` | | 自定义分类地址，不写就从分类名生成 |
| `draft` | | 写 `true` 就不发布 |
| `discussionUrl` | | 原文链接，必须是 http(s) 地址 |

草稿想看效果，跑 `npm run dev -- --drafts`。站点没有文章时显示真实的空状态，不会拿示例内容凑数。

### GitHub Discussions

1. 仓库设置里打开 Discussions。
2. `config/buildConfig.json` 的 `author` 填允许发布的 **GitHub 登录名**，和站点上显示的署名是两回事。
3. 发 Discussion，标题和正文就是文章，分类变 category，标签变 tags。
4. 工作流同步到 `content/posts/`，构建后部署到 Pages。

发布规则：带 `no-article` 标签的不发，已采纳答案的不发，已关闭的不发，作者不是 `buildConfig.author` 的也不发。发出去的文章被删除、关闭或标记答案，下次同步会下架，恢复之后又能回来。同步靠游标翻页，不受前 100 篇的限制。

同步出来的文章带 `source: github-discussion`、仓库名和 Discussion 编号三个标记。同步只动带这些标记的文件，同 id 的本地原创文章不会被覆盖；远程读取失败或校验不过时，已有文件一个也不删。手动改同步文章的正文没有意义，下次同步按 Discussions 重写。

本地手动同步需要两个环境变量：`GH_TOKEN`（或 `GITHUB_TOKEN`）和 `GITHUB_REPOSITORY=owner/repo`：

```sh
npm run sync
npm run build
```

令牌要有读该仓库 Discussions 的权限。只写本地文章、不开同步的话不用管这些。

## 配置

### config/siteConfig.json

| 键 | 说明 |
| --- | --- |
| `site.name` | 导航栏、侧边栏和 og:site_name 上的站名 |
| `site.title` | 页面标题后缀，拼成 `文章标题 · 站名` |
| `site.author` | 作者名，文章默认署名和页脚兜底文案都用它 |
| `site.description` | 默认 meta description |
| `site.welcome` | 首页巨字标语，构建时自动转大写并合并多余空白 |
| `site.url` | 正式站点地址，构建时据此推导路径前缀 |
| `about.sections` | 关于页的段落，每项 `{ head, text }` |
| `about.friendLinks` | 友链，每项 `{ name, url }` |
| `footerContent` | 页脚，数组里每项一行 HTML |
| `sidebar.motto` | 侧边栏头像下面那句话 |
| `sidebar.links` | 导航，每项 `{ text, href }`，桌面导航和侧边栏共用这一份 |

配置里的 HTML 不全放行。`about` 和 `footerContent` 只认 `<br>`、`<strong>`、`<em>`、`<b>`、`<i>` 和 `<a>` 六种标记，链接只允许 http、https 和 mailto 协议，渲染时自动补 `target="_blank"` 和 `rel="noopener noreferrer"`。

侧边栏链接的 `text` 可以写成 SVG 图标加文字，渲染时图标会被剥掉只留文字，因为那条悬停下划线要贴着文字走。

### config/buildConfig.json

| 键 | 说明 |
| --- | --- |
| `author` | 允许同步的 GitHub 登录名 |
| `githubStartId` | Discussion 编号到文章 id 的偏移，id = 编号 + 该值 − 1 |
| `maxArticlesPerPage` | 每页文章数，取值 1 到 100 |
| `timezoneOffset` | 日期显示时区，默认 `+08:00` |
| `robots` | `robots.txt` 的规则，含 `userAgent`、`allow`、`disallow`、`additionalRules` |

### public/

`public/` 原样复制到输出根目录。头像 `img/Avatar.png`、logo、favicon、字体、自定义域名的 `CNAME` 都放这里。分享卡片用的图固定取 `img/Avatar.png`。

## 构建时发生了什么

`scripts/build.js` 只解析参数，活都在 `src/build/site.js`：读配置，扫 `content/posts/*.md`，逐篇规范化、渲染 Markdown、算目录和阅读时长，再拼出所有页面。

写盘走的是一套临时目录流程。产物先写进 `.qxblog-build-xxx`，写完把旧 `dist/` 挪开，新的整个换上去，成功后才删旧的——中途失败，旧产物还在。输出目录限定在 `dist/` 和 `.preview/` 下面，不许是符号链接，也不许和内容目录重叠，这些都在落盘前检查掉。

生成的路由有这些：`index.html`、`articles/`（含 `page/N/` 分页）、`categories/` 与 `tags/` 的总览页和每个分组的列表页、`archive/`、`about/`、`posts/<id>.html`、`404.html`。列表页第一页永远是 `index.html`，第二页才是 `page/2/`，地址不会分叉。

站点前缀从 `site.url` 的路径部分推出来。用 `https://username.github.io/QxBlog/` 就得到 `/QxBlog/` 前缀，自定义域名得到 `/`，也可以手动覆盖：

```sh
npm run build -- --base /QxBlog/
npm run preview -- --base /QxBlog/
```

命令行参数：

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--out` | `dist` | 输出目录，只接受 `dist` 或 `.preview` 下的路径 |
| `--content` | `content/posts` | 内容目录 |
| `--base` | 从 `site.url` 推导 | 路径前缀 |
| `--port` | `5502` | 本地服务端口 |
| `--host` | `127.0.0.1` | 本地服务监听地址 |
| `--drafts` | 关 | 是否带上草稿 |

## 部署

产物都在 `dist/`。GitHub 仓库 **Settings → Pages → Source** 选 **GitHub Actions**，工作流在 `main` 分支 push、Discussions 事件和手动运行时触发。Discussions 和手动运行会先同步内容，只把 `content/posts/` 提交回仓库，构建产物不回写源码仓库。默认分支不叫 `main` 的话记得改工作流。

换域名改 `config/siteConfig.json` 里的 `site.url`，canonical、sitemap、feed 和 og 标签都会跟着变。

## 自定义主题与模板

所有页面的 HTML 结构均已拆解为独立的 .html 模板文件，告别 JS 硬编码，方便自由定制主题与视觉结构：

`	ext
src/templates/
├── layouts/
│   └── layout.html          # 页面顶层骨架（DOCTYPE、head、body 容器）
├── pages/
│   ├── home.html            # 首页（Hero 区域、文章网格、分页）
│   ├── post.html            # 文章详情页（返回按钮、标题、元信息、正文、更新时间与相邻文章导航）
│   ├── listing.html         # 文章列表与分类/标签详情列表
│   ├── taxonomy-index.html  # 分类/标签汇总页
│   ├── archive.html         # 归档时间线
│   ├── about.html           # 关于页面
│   └── 404.html             # 404 页面
├── partials/
│   ├── head.html            # <head> 标签（Meta、SEO、字体预加载、KaTeX、样式等）
│   ├── header.html          # 顶部导航栏（Logo、桌面导航、主题/搜索/目录按钮）
│   ├── sidebar.html         # 侧边栏抽屉（头像、座右铭、导航链接）
│   ├── toc.html             # 文章目录侧边栏
│   ├── footer.html          # 页脚版权与链接
│   ├── search-dialog.html   # 全站搜索浮层
│   ├── curtain.html         # 首屏加载幕布与跑马灯
│   └── back-to-top.html     # 返回顶部按钮
└── components/
    ├── page-hero.html       # 页面顶部横幅组件
    ├── article-card.html    # 文章卡片行组件
    ├── pagination.html      # 分页条组件
    └── empty-state.html     # 空状态组件
`

### 模板语法

内置零依赖模板引擎，采用类似 EJS 的直观语法：

- <%= value %>：自动 HTML 转义输出（安全输出文字，如 <%= post.title %>）
- <%- value %>：原始 HTML 输出（渲染富文本或正文，如 <%- post.html %>）
- <% if (...) { %> ... <% } %>：条件分支与循环控制语句
- <%- include('partials/header.html') %>：包含与复用子模板

### 主题覆盖机制

除了直接编辑 src/templates/ 下的文件，你还可以在项目根目录下创建 	emplates/ 目录：
例如在根目录放置 	emplates/partials/footer.html，引擎将优先使用根目录下的模板，无需修改引擎源码即可实现主题覆盖与自定义。开发服务器（
pm run dev）会自动监听 src/ 与 	emplates/ 的变动并实时重载。

## 目录结构

```text
config/                 站点与构建配置
content/posts/          Markdown 文章
public/                 原样复制的静态资源
src/
  content/              解析、规范化、Markdown 渲染、GitHub 同步
  build/                配置、页面编排、feed 与索引生成
  templates/            布局、组件、各页面模板
  styles/               全站样式，单文件 default.css
  client/               主题、导航、搜索、文章增强与动效
scripts/                build / dev / preview / sync 入口
.github/workflows/      构建与部署
dist/                   构建产物（已忽略）
```

改界面通常落在 `src/templates/` 和 `src/styles/default.css`。客户端脚本只认模板里的 `data-*` 标记，内容处理和页面模板之间靠同一个 Post 对象对接，不靠读 DOM 反推状态。

## 字体

`public/fonts/` 里全是 woff2。中文字体是 MiSans 可变字体，已按 GB2312 全字符（7769 个）子集化，19.2 MB 压到 2.5 MB，子集之外的生僻字回落到系统字体。原始 TTF 在 git 历史里，需要重新子集时：

```sh
pyftsubset MiSansVariable.ttf --unicodes-file=glyphs.txt --flavor=woff2 \
  --layout-features='*' --name-IDs='*' --output-file=MiSansVariable.woff2
```

`glyphs.txt` 是逗号分隔的 `U+XXXX` 列表。动了字体，`src/styles/default.css` 顶部的 `@font-face` 要一起改。

## 设计取向

- 无 JavaScript 时一切内容照常可读，脚本挂掉或被拦截的最坏结果是少了动效。
- 转场、自绘光标、解码标题都在 `prefers-reduced-motion: reduce` 下自动关闭；自绘光标还要求设备有精确指针，触屏不启用。
- 全站样式收敛在 `default.css` 一个文件里，按分区注释组织，改主题变量在文件顶部一处完成。
- `.preview/` 和 `.qxblog-build-*` 是本地临时目录，不进生产输出，也都在 gitignore 里。

## 许可证

[GNU General Public License v3.0](LICENSE)。

## 致谢与归因

部分页面布局、排版与交互动画代码参考自：

- Antoine Wodniack — https://wodniack.dev
- CodePen 上的相关实现 — https://codepen.io/wodniack

具体涉及：波浪动画（2D Perlin noise 公式）、页面转场幕布、二进制跑马灯字符集与指针光标交互等视觉增强层代码。
