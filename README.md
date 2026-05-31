# QxBlog

QxBlog 是一个基于 GitHub Issues 的静态博客项目。

通过 Issue 发布文章后，构建脚本会自动更新数据并生成静态页面，适合部署到 GitHub Pages。

## 功能概览

- Issue 驱动发布文章
- 自动生成文章详情页与分类页
- 前端动态分页
- 全文搜索
- 明暗主题切换

## 项目结构

```text
QxBlog/
├─ index.html
├─ 404.html
├─ about/
│  └─ index.html
├─ articles/
│  ├─ index.html
│  └─ pages/{id}.html
├─ categories/
│  ├─ index.html
│  └─ {label}/index.html
├─ blogData/
│  ├─ articles.json
│  └─ categories.json
├─ config/
│  ├─ buildConfig.json
│  └─ siteConfig.json
├─ js/
├─ css/
├─ fonts/
├─ img/
└─ .github/
   ├─ workflows/qxblog-build.yml
   └─ script/qxBlogBuild.js
```

## 数据文件

### `blogData/articles.json`

保存全量文章索引（文章 id、标题、日期、标签、作者等）。

### `blogData/categories.json`

保存分类统计信息。

```json
[
  { "label": "前端", "count": 10 },
  { "label": "学习", "count": 6 }
]
```

## 配置说明

### `config/buildConfig.json`

构建行为配置。

```json
{
  "author": "QingXuan2000",
  "timezoneOffset": "+08:00",
  "maxArticlesPerPage": 20,
  "friendLinks": []
}
```

字段说明：

- `author`: 允许触发构建的 Issue 作者
- `timezoneOffset`: 文章发布时间时区偏移
- `maxArticlesPerPage`: 每页文章数量（必填，必须为正数）
- `friendLinks`: 友情链接，构建时同步到前端配置

### `config/siteConfig.json`

前端展示配置，包含站点信息、首页文案、关于页、侧边栏、Footer 等。

## 分页机制

分页由前端运行时完成：

1. 读取 `blogData/articles.json`
2. 分类页按标签过滤
3. 按 `maxArticlesPerPage` 切片
4. 渲染分页控件与文章列表

## 构建流程

当 Issue 发生 `opened` / `edited` / `reopened` / `deleted` 时：

1. 读取并校验作者
2. 更新 `blogData/articles.json`
3. 更新 `blogData/categories.json`
4. 生成或删除 `articles/pages/{id}.html`
5. 生成分类页 `categories/{label}/index.html`
6. 刷新首页、文章列表页、分类列表页

## 使用方式

1. 修改 `config/siteConfig.json`（站点内容）
2. 修改 `config/buildConfig.json`（作者、分页配置等）
3. 在 GitHub Issues 发布文章（标题 + Markdown + 标签）
4. 等待 GitHub Actions 自动构建部署

## 部署指南

QxBlog 推荐部署到 GitHub Pages，配合仓库内置工作流实现自动构建。

### 1) 准备仓库

1. 将项目推送到 GitHub 仓库（建议仓库名：`QxBlog`）
2. 确保仓库已包含 `.github/workflows/qxblog-build.yml`
3. 在 `config/buildConfig.json` 中设置正确的 `author`（你的 GitHub 用户名）

### 2) 配置站点信息

1. 编辑 `config/siteConfig.json`，填写站点标题、描述、导航、关于页内容等
2. 编辑 `config/buildConfig.json`，按需调整：
   - `timezoneOffset`：文章时间显示时区（中国大陆通常为 `+08:00`）
   - `maxArticlesPerPage`：文章列表每页条数
   - `friendLinks`：友情链接

### 3) 启用 GitHub Pages

1. 打开 GitHub 仓库设置：`Settings -> Pages`
2. `Build and deployment` 选择 `Deploy from a branch`
3. Branch 选择 `main`（或你的默认分支），目录选择 `/ (root)`
4. 保存后等待首次部署完成

### 4) 通过 Issue 发布文章

1. 在仓库 `Issues` 新建 Issue
2. `Title` 作为文章标题，`Body` 使用 Markdown 正文
3. 使用 `Labels` 标记分类（例如：`前端`、`学习`）
4. 提交后，Actions 会自动更新：
   - `blogData/articles.json`
   - `blogData/categories.json`
   - `articles/pages/{id}.html`
   - `categories/{label}/index.html`

### 5) 访问站点

- 默认地址：`https://<你的用户名>.github.io/<仓库名>/`
- 用户/组织主页仓库（如 `<用户名>.github.io`）可直接使用根域名访问

### 6) 可选：绑定自定义域名

1. 在 `Settings -> Pages` 的 `Custom domain` 中填写你的域名
2. 在 DNS 平台配置 `CNAME` 或 `A` 记录到 GitHub Pages
3. 等待证书签发完成后启用 HTTPS

## 默认主题：QxPaper

`QxPaper` 是 QxBlog 的默认主题，定位为“简洁阅读 + 轻量交互”。

- 视觉风格：干净留白、卡片式信息组织，突出文章内容本身
- 阅读体验：支持目录、代码块、数学公式（KaTeX）、文章分类浏览
- 交互能力：全文搜索、前端分页、明暗主题切换
- 响应式布局：桌面与移动端均可用

主题相关资源主要位于：

- `css/default.css`：全局样式与主题变量
- `js/default.js`：全局交互逻辑
- `js/nav.js` / `js/search.js` / `js/toc.js`：导航、搜索、目录功能

如果你想在 `QxPaper` 基础上做定制，建议优先修改 `config/siteConfig.json`（内容配置），再按需调整 CSS 与 JS（表现与交互）。

## 内容清空

重置站点文章与标签可执行：

- `blogData/articles.json` 设为 `{}`
- `blogData/categories.json` 设为 `[]`
- 清空 `articles/pages/`
- 清空 `categories/` 下分类目录（保留 `categories/index.html`）

## 编码建议

- 所有配置与文档统一使用 UTF-8 编码
- `README.md`、`buildConfig.json`、`siteConfig.json` 建议保持 UTF-8（无 BOM）
