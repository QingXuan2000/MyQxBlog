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

## 内容清空

重置站点文章与标签可执行：

- `blogData/articles.json` 设为 `{}`
- `blogData/categories.json` 设为 `[]`
- 清空 `articles/pages/`
- 清空 `categories/` 下分类目录（保留 `categories/index.html`）

## 编码建议

- 所有配置与文档统一使用 UTF-8 编码
- `README.md`、`buildConfig.json`、`siteConfig.json` 建议保持 UTF-8（无 BOM）
