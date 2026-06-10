<div align="center">
  <img src="img/logo/dark.svg" alt="QxBlog Logo" width="120" height="120">
  <h1>QxBlog</h1>
  <p>基于 Issues 驱动的静态博客系统</p>
  <p>
    <img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License">
    <img src="https://img.shields.io/badge/build-GitHub%20Actions-green.svg" alt="Build">
    <img src="https://img.shields.io/badge/deploy-GitHub%20Pages-orange.svg" alt="Deploy">
    <img src="https://img.shields.io/badge/runtime-Bun-black.svg" alt="Bun">
  </p>
</div>

---

## 简介

QxBlog 是一个基于 **Issues 驱动**的静态博客系统。通过 GitHub Issues 管理文章，利用 GitHub Actions 自动构建并部署到 GitHub Pages。无需数据库，无需服务器，只需一个 GitHub 仓库即可拥有完整的博客站点。

> 「用代码，写世界。」

![首页预览](img/home-page-img.png)

## 功能特性

### 核心功能

- **Issues 驱动写作** — 通过 GitHub Issues 创建、编辑和管理文章，写作体验与 GitHub 原生一致
- **自动化构建部署** — 利用 GitHub Actions 实现文章的自动构建与部署，Issue 的创建、编辑、删除、关闭都会触发重新构建
- **响应式设计** — 适配桌面端和移动端设备，提供一致的阅读体验
- **深色/浅色主题** — 支持自动跟随系统主题或手动切换

### 文章功能

- **Markdown 支持** — 完整支持 GitHub Flavored Markdown（GFM）语法
- **代码高亮** — 基于 Shiki 的代码高亮，支持多种编程语言，带语言标签和一键复制功能
- **数学公式** — 支持 KaTeX 渲染数学公式，兼容行内公式和块级公式
- **文章分类** — 通过 GitHub Labels 实现文章分类，支持按分类浏览
- **文章搜索** — 支持按标题、标签、正文内容实时搜索
- **目录导航** — 文章页自动生成目录（TOC），便于快速跳转
- **分页浏览** — 文章列表支持分页，可配置每页显示数量

### SEO 与性能

- **SEO 优化** — 自动生成 Open Graph、Twitter Card、结构化数据（Schema.org）等元数据
- **懒加载** — 图片和视频默认启用懒加载
- **View Transition** — 支持页面切换动画
- **自定义加载动画** — 基于 SVG 的几何图形加载动画

## 技术栈

### 构建系统

| 类别 | 技术 |
|------|------|
| 运行时 | Bun / Node.js |
| 构建脚本 | 原生 JavaScript (ES Module) |
| CLI 工具 | Commander.js |

### 文章处理

| 类别 | 技术 |
|------|------|
| Markdown 解析 | Unified / Remark |
| Markdown 扩展 | remark-gfm (GFM 支持) |
| 数学公式 | remark-math + rehype-katex |
| 代码高亮 | rehype-pretty-code + Shiki |
| 元数据解析 | remark-frontmatter + vfile-matter |
| HTML 生成 | rehype-stringify |
| 标题链接 | rehype-slug + rehype-autolink-headings |

### 前端

| 类别 | 技术 |
|------|------|
| 样式 | 原生 CSS (CSS Variables 主题系统) |
| 字体 | Inter (西文) / MiSans (中文) / JetBrains Mono (代码) |
| 交互 | 原生 JavaScript (ES Module) |
| 图标 | 内联 SVG |

### 部署

| 类别 | 技术 |
|------|------|
| CI/CD | GitHub Actions |
| 托管 | GitHub Pages |

## 部署方式

### 前置要求

- GitHub 账号
- 开启仓库的 GitHub Pages 功能

### 快速开始

1. **Fork 本仓库** 到自己的 GitHub 账号下

2. **配置仓库设置**
   - 进入仓库 `Settings` → `Pages`
   - Source 选择 `GitHub Actions`

3. **开始写作**
   - 在仓库的 Issues 中新建一个 Issue
   - 添加标题和正文（支持 Markdown 语法）
   - 为 Issue 添加标签（Label）作为文章分类
   - 保存后，GitHub Actions 将自动构建并部署

4. **访问博客**
   - 构建完成后，访问 `https://<你的用户名>.github.io/<仓库名>`

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/<用户名>/QxBlog.git
cd QxBlog

# 安装依赖（进入构建脚本目录）
cd .github/script
bun install

# 从本地 Markdown 文件构建所有文章（前提是已有 blogData/markdown/*.md 文件）
bun qxBlogBuild.js local build all

# 或者启动本地服务器预览
# 使用任意静态服务器工具，例如：
# cd ../..
# python -m http.server 8000
# 或 npx serve .
```

### 构建脚本命令

```bash
# 从本地 Markdown 文件构建所有文章
bun qxBlogBuild.js local build all

# 从本地 Markdown 文件构建指定 ID 的文章
bun qxBlogBuild.js local build <id>

# CI 模式（从 GitHub Issues 构建，用于 GitHub Actions）
bun qxBlogBuild.js ci build

# 删除所有文章
bun qxBlogBuild.js local delete all

# 删除指定 ID 的文章
bun qxBlogBuild.js local delete <id>

# 查看帮助
bun qxBlogBuild.js --help
```

## 配置说明

### 站点配置 (`config/siteConfig.json`)

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `site.name` | string | 站点名称 |
| `site.title` | string | 页面标题后缀 |
| `site.author` | string | 作者名称 |
| `site.url` | string | 站点完整 URL |
| `site.description` | string | 站点描述（用于 SEO） |
| `site.keywords` | string | 站点关键词 |
| `site.siteCreatedAt` | string | 站点创建时间（ISO 8601） |
| `hero.tag` | string | 首页标签文字 |
| `hero.title` | string | 首页主标题 |
| `hero.subtitle` | string | 首页副标题 |
| `about.sections` | array | 关于页面内容区块 |
| `about.friendLinks` | array | 友链列表 |
| `footerContent` | array | 页脚内容 |
| `sidebar.motto` | string | 侧边栏座右铭 |
| `sidebar.links` | array | 侧边栏导航链接 |

### 构建配置 (`config/buildConfig.json`)

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `author` | string | 构建作者标识 |
| `timezoneOffset` | string | 时区偏移（如 `+08:00`） |
| `githubStartId` | number | GitHub Issue 起始编号偏移 |
| `maxArticlesPerPage` | number | 每页显示文章数量 |
| `robots` | object | robots.txt 配置 |

## 项目结构

```
QxBlog/
├── .github/
│   ├── script/              # 构建脚本
│   │   ├── package.json     # 构建依赖
│   │   └── qxBlogBuild.js   # 主构建脚本
│   └── workflows/
│       └── qxblog-build.yml # GitHub Actions 工作流
├── about/                   # 关于页面
├── articles/                # 文章列表页
├── blogData/                # 博客数据
│   ├── articles.json        # 文章索引
│   ├── tags.json            # 标签数据
│   └── markdown/            # Markdown 源文件
├── tags/                    # 标签页面
├── config/                  # 配置文件
│   ├── siteConfig.json      # 站点配置
│   └── buildConfig.json     # 构建配置
├── css/                     # 样式文件
│   ├── default.css          # 主样式
│   └── katex.min.css        # KaTeX 样式
├── fonts/                   # 字体文件
│   ├── Inter/               # Inter 可变字体
│   ├── JetBrainsMono/       # JetBrains Mono 字体
│   └── MiSans/              # MiSans 可变字体
├── img/                     # 图片资源
│   ├── logo.svg             # 站点 Logo
│   ├── Avatar.png           # 头像
│   └── home-page-img.png    # 首页预览图
├── js/                      # JavaScript 模块
│   ├── default.js           # 主入口（模块加载、代码复制、表格包装等）
│   ├── articles.js          # 文章列表与分页
│   ├── tags.js              # 标签管理
│   ├── config.js            # 配置加载与导航渲染
│   ├── nav.js               # 导航栏交互
│   ├── search.js            # 搜索功能
│   └── toc.js               # 目录生成
├── posts/                   # 生成的文章 HTML（构建时生成）
├── index.html               # 首页
├── 404.html                 # 404 页面
├── favicon.svg              # 站点图标
├── sitemap.xml              # 站点地图（构建时生成）
├── robots.txt               # 爬虫规则（构建时生成）
└── LICENSE                  # GPL-3.0 许可证
```

## 前端模块说明

| 模块 | 文件 | 功能 |
|------|------|------|
| QxConfig | `js/config.js` | 加载配置、渲染导航栏和侧边栏 |
| QxNav | `js/nav.js` | 移动端菜单、主题切换、当前页面高亮 |
| QxSearch | `js/search.js` | 实时搜索（标题/标签/正文），键盘导航 |
| QxArticles | `js/articles.js` | 文章列表渲染、分页逻辑、标签筛选 |
| QxTags | `js/tags.js` | 标签列表加载与渲染 |
| QxToc | `js/toc.js` | 文章目录生成、滚动高亮、点击跳转 |

## 写作指南

### Issue 格式

GitHub Issue 的标题即为文章标题，正文即为文章内容。支持所有 GitHub Flavored Markdown 语法：

- 标题、段落、列表
- 代码块（支持语法高亮）
- 表格
- 任务列表
- 数学公式（`$...$` 行内，`$$...$$` 块级）
- 图片与链接

### 使用 Labels 分类

为 Issue 添加 Labels 即可为文章设置分类。例如：
- `技术`
- `设计`
- `随笔`

### 关闭/删除 Issue

- **关闭 Issue**：文章将保留，但标记为关闭状态
- **删除 Issue**：文章将从博客中移除

## 许可证

本项目采用 [GNU General Public License v3.0](LICENSE) 开源许可证。

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/QingXuan2000">QingXuanJun</a></sub>
</div>
