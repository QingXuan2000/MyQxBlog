<div align="center">
    <img src="img/logo.svg" alt="QxBlog Logo" width="120" height="120">
    <h1>QxBlog</h1>
    <p>基于 GitHub Issues 驱动的静态个人博客</p>

![License](https://img.shields.io/github/license/QingXuan2000/QxBlog?style=for-the-badge)
![GitHub stars](https://img.shields.io/github/stars/QingXuan2000/QxBlog?style=for-the-badge)
![GitHub Workflow](https://img.shields.io/github/actions/workflow/status/QingXuan2000/QxBlog/qxblog-build.yml?style=for-the-badge)

</div>

在 GitHub Issues 中用 Markdown 写文章，GitHub Actions 自动构建并部署到 GitHub Pages。无需本地环境，无需数据库，无需服务器。

## 演示

![首页截图](img/home-page-img.png)

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | 原生 ES6 Modules，零框架依赖 |
| 样式 | 纯 CSS，亮/暗双主题 |
| 构建 | Bun + featherdown |
| 部署 | GitHub Actions + GitHub Pages |

## 功能

- **文章分页** — 省略号、页码、前进后退、GO 跳转
- **分类系统** — Issue Label 即分类，每个分类独立分页
- **全文搜索** — 标题 / 标签 / 正文匹配，下拉结果，键盘 ↑↓ 导航
- **文章目录** — H2/H3 层级缩进，侧边栏锚点跳转
- **主题切换** — 自动跟随系统，手动切换，内联 script 防闪烁
- **代码复制** — 代码块 hover 一键复制
- **侧边栏** — 头像、格言、导航链接，旋转光环动画
- **Hero 区** — 首页全屏 SVG 线稿动画（多面体 + 轨道环 + 卫星三角）
- **友情链接** — 构建时从配置自动同步
- **返回顶部** — 滚动超过 300px 淡入

## 目录结构

```
├── index.html                       # 首页（Hero + 文章列表）
├── 404.html                         # 404 页面（独立样式，跟随主题）
├── articles/
│   ├── index.html                   # 文章列表页
│   └── pages/{id}.html              # 文章详情（构建生成）
├── categories/
│   ├── index.html                   # 分类列表页
│   └── {label}/index.html           # 分类详情（构建生成）
├── about/index.html                 # 关于页
├── blogData/                        # 动态 JSON 数据
│   ├── articles.json                #   全量文章索引
│   ├── articles/{page}.json         #   文章分页
│   ├── categories.json              #   分类列表
│   └── categories/{label}/{p}.json  #   分类分页
├── js/                              # ES6 前端模块
│   ├── default.js                   #   入口，协调各模块
│   ├── config.js                    #   站点配置加载与 UI 渲染
│   ├── articles.js                  #   文章加载与分页组件
│   ├── categories.js                #   分类列表加载
│   ├── search.js                    #   全文搜索（流式读取）
│   ├── nav.js                       #   导航交互（主题 / 搜索 / 侧边栏）
│   └── toc.js                       #   文章目录侧边栏
├── css/
│   ├── default.css                  #   全局样式
│   └── font-awesome.min.css         #   图标库
├── fonts/                           # Inter + FontAwesome
├── img/                             # Logo / 头像 / 截图
├── favicon.svg                      # 站点图标
├── config/
│   ├── siteConfig.json              #   前端展示配置
│   └── buildConfig.json             #   构建行为配置
└── .github/
    ├── workflows/qxblog-build.yml   #   CI 工作流
    └── script/
        ├── qxBlogBuild.js           #     静态站点生成器
        ├── package.json             #     构建依赖
        └── bun.lock                 #     依赖锁文件
```

## 工作流程

### 发布 / 更新文章

在仓库 Issues 中创建或编辑 Issue（标题 + Markdown 正文 + Label），GitHub Actions 自动触发：

```
Issue 事件（opened / edited / reopened）
  → 校验 Issue 作者 = buildConfig.author
  → featherdown 渲染 Markdown → HTML
  → 写入 articles/pages/{id}.html
  → 更新 blogData/articles.json 全量索引
  → 重算分页 → blogData/articles/{page}.json
  → 重算分类 → blogData/categories/{label}/{p}.json + categories/{label}/index.html
  → 重写 articles/index.html、categories/index.html、index.html
  → git-auto-commit 提交推送
  → GitHub Pages 自动部署
```

### 删除文章

删除 Issue 触发相同流程，移除对应 `{id}.html`、从索引清除、重算分页和分类。

### 前端渲染

```
页面加载
  → 内联 script 读取 localStorage / 系统主题，设置 data-theme（防闪烁）
  → QxConfig 渲染导航栏、loader、侧边栏、footer
  → QxConfig 加载 siteConfig.json，填充 Hero / 关于 / 友情链接
  → QxNav 绑定主题切换、搜索展开、侧边栏开关
  → QxSearch 流式读取 articles.json，构建搜索索引
  → QxArticles 拉取分页 JSON，渲染文章卡片 + 分页控件
  → QxToc 为文章页构建目录侧边栏
  → loader 淡出移除
```

## 配置

### buildConfig.json — 构建行为

```json
{
    "author": "QingXuan2000",
    "timezoneOffset": "+08:00",
    "maxArticlesPerPage": 15,
    "searchBodyLength": 0,
    "friendLinks": []
}
```

| 字段 | 说明 |
|---|---|
| `author` | 只有此 GitHub 用户创建的 Issue 会被构建 |
| `timezoneOffset` | 文章时间偏移量 |
| `maxArticlesPerPage` | 每页文章数 |
| `searchBodyLength` | 索引正文长度，`0` 不索引正文，`-1` 索引全文 |
| `friendLinks` | 友情链接，构建时自动同步到 siteConfig.json |

### siteConfig.json — 前端展示

```json
{
    "site": {
        "name": "QxBlog",
        "title": "QxBlog",
        "author": "QingXuanJun",
        "siteCreatedAt": "2026-03-01T00:00:00Z"
    },
    "hero": {
        "tag": "<Blog />",
        "title": "「用代码，写世界。」",
        "subtitle": "Thoughts on code, design, and everything in between."
    },
    "about": {
        "sections": [
            { "head": "关于我", "text": "..." },
            { "head": "关于本站", "text": "..." }
        ],
        "friendLinks": []
    },
    "sidebar": {
        "motto": "用代码，写世界。",
        "links": [
            { "text": "<i class=\"fa fa-home\"></i> 首页", "href": "index.html" },
            { "text": "<i class=\"fa fa-file-text\"></i> 文章", "href": "articles/index.html" },
            { "text": "<i class=\"fa fa-folder\"></i> 分类", "href": "categories/index.html" },
            { "text": "<i class=\"fa fa-user\"></i> 关于", "href": "about/index.html" }
        ]
    }
}
```

控制 Hero 区文案、侧边栏导航、关于页段落、Footer 版权年份。`about.friendLinks` 由构建脚本从 `buildConfig.json` 同步，无需手动维护。

## 自定义

1. **Fork 本仓库**，启用 GitHub Actions 和 GitHub Pages（Source: Actions）
2. 修改 `config/siteConfig.json` — 站点名称、作者、Hero 文案、关于页
3. 修改 `config/buildConfig.json` — 将 `author` 改为你的 GitHub 用户名
4. 替换 `img/Avatar.png` 和 `img/logo.svg`
5. 在 Issues 中创建文章即可触发构建部署
