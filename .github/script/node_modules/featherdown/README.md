# featherdown

**featherdown** is a publishing-focused Markdown engine for apps, blogs, docs, and product surfaces that want **sanitized HTML**, **publishing metadata**, **diagnostics**, **code and math support**, and **asset hints**—without hand-wiring a full [unified](https://github.com/unifiedjs/unified) pipeline.

It is **not** a static site generator and does not ship client runtimes for charts, copy-to-clipboard behavior, or Mermaid in the browser. It produces HTML contracts and metadata your app can integrate.

The default npm entry is **browser-safe**. Optional **Node-only** Mermaid (inline SVG) lives behind `featherdown/node`.

## Install

```bash
npm install featherdown
```

Node.js **18+** is required.

### JSR / Deno

You can import the library from JSR (see [@karuifeather/featherdown](https://jsr.io/@karuifeather/featherdown)). **npm** publishes **CSS subpath exports** (`featherdown/styles.css`, `featherdown/styles/base.css`, and the other `featherdown/styles/*` entries in `package.json`). **Deno/JSR** (`deno.json` exports) does **not** mirror those CSS paths today—**CSS parity for JSR is deferred**; treat stylesheet wiring as environment-specific. **CSS packaging and `@import` resolution for JSR/Deno consumers are not treated as equivalent to npm bundler workflows.** Prefer npm (or a bundler) when you want the documented CSS entry points without extra setup.

## Quick start

```ts
import { Featherdown } from "featherdown";
import "featherdown/styles.css";

const featherdown = new Featherdown();

const result = await featherdown.parse("# Hello");

console.log(result.html);
```

The default entry is browser-safe and does **not** include Mermaid rendering.

## Rendering Markdown

Use the **`Featherdown`** class as the primary API. Constructor options set defaults; each call to **`parse(markdown, parseOptions?)`** can override them (with a shallow merge and one-level merge for nested groups like `code` and `publishing`).

```ts
const featherdown = new Featherdown({
  frontmatter: "auto",
  math: true,
  code: true,
  diagnostics: "warn",
});

const result = await featherdown.parse(markdown);
```

### Image manifest example

```ts
const featherdown = new Featherdown({
  kind: "post",
  slug: "hello-world",
  manifest: {
    map: {
      "post/hello-world/images/logo.png": { url: "https://cdn.example.com/logo.png" },
    },
  },
});

const result = await featherdown.parse(markdown);
```

## Result object

`Featherdown.parse()` resolves to a **`FeatherdownResult`**. Commonly used fields:

| Field | Meaning |
| --- | --- |
| **`html`** | Sanitized HTML string. |
| **`body`** | Markdown body after front matter is stripped when front matter parsing is enabled and a valid block exists; otherwise the full input string. |
| **`frontmatter`** | Parsed YAML object, or `{}` when absent or when front matter parsing is disabled. |
| **`metadata`** | Normalized subset of common publishing fields (`title`, `description`, `tags`, etc.) derived from front matter. |
| **`toc`** | Compact heading list for navigation (`depth`, `text`, `id`). |
| **`headings`** | Richer heading metadata in document order (includes `hasCustomId`). |
| **`excerpt`** | First meaningful plain-text excerpt from rendered flow content, or `null` when disabled or unavailable. |
| **`wordCount`** / **`estimatedReadingMinutes`** | Derived from the rendered document text (subject to `publishing` options). |
| **`stats`** | Mirrors `wordCount` and reading time for convenience. |
| **`diagnostics`** | Non-fatal warnings (for example invalid chart JSON or manifest misses). |
| **`assets`** | Hints such as **`assets.styles`** (selective package CSS paths) and **`assets.features`** (`math`, `code`, `charts`, `mermaid`). |

`assets.styles` lists **selective** style paths (for example `featherdown/styles/base.css`), not the all-in `featherdown/styles.css` aggregate.

## Styles

Official styles target the **`featherdown-content`** wrapper class and related HTML contracts.

### All-in (recommended starting point)

These entry points are intended for **npm / bundler** workflows where the toolchain resolves package paths and nested `@import`s.

```ts
import "featherdown/styles.css";
```

This aggregates base, KaTeX, code, and highlight layers. It is the simplest path when you want the full default look.

### Selective imports

For smaller CSS payloads, import only what you need:

```ts
import "featherdown/styles/base.css";
import "featherdown/styles/katex.css"; // when math is enabled
import "featherdown/styles/code.css"; // when code blocks / shell chrome are used
import "featherdown/styles/highlight.css"; // only when syntax highlighting is enabled
```

- **`base.css`** — Prose/layout and structural contracts for rendered content.
- **`katex.css`** — Bundler-oriented entry that pulls in KaTeX’s distribution CSS for math output.
- **`code.css`** — Featherdown code-block shell / chrome (titles, line layout hooks, etc.).
- **`highlight.css`** — Default highlight.js theme CSS; **include this only when syntax highlighting is enabled** (`code` with default highlighting, or equivalent).

Do **not** assume raw `<link href="node_modules/.../featherdown/styles.css">` without a bundler will resolve nested `@import`s the same way a bundler does.

### Custom themes

You can start from Featherdown's baseline styles and override them:

```ts
import "featherdown/styles/base.css";
import "./markdown-theme.css";
import "./code-theme.css";
```

Or skip `base.css` and fully own the rendered Markdown styles in your app.

When code highlighting is enabled, rendered code uses highlight.js-style `hljs` token classes, so custom code themes can target classes such as `.hljs-keyword`, `.hljs-string`, and `.hljs-comment`.

### Asset hints

```ts
const result = await featherdown.parse(markdown);
console.log(result.assets.styles);
```

Use this in SSR or static generators to decide which stylesheets to emit alongside HTML.

## Options

These options are wired end-to-end today:

```ts
const featherdown = new Featherdown({
  frontmatter: "auto",
  math: true,
  code: true,
  sanitize: true,
  diagnostics: true,
  charts: true,
  headings: true,
  publishing: true,
});
```

Object forms for nested groups:

```ts
const featherdown = new Featherdown({
  code: {
    enabled: true,
    highlighting: true,
  },
  publishing: {
    excerpt: true,
    wordCount: true,
    readingTime: true,
  },
});
```

- **`math`** — Toggle KaTeX HTML output for `$…$` / `$$…$$`.
- **`code`** — Toggle code pipeline features; **`highlighting`** controls whether highlight.js classes and **`highlight.css`** are relevant.
- **`frontmatter`** — `false`, `true`, or `"auto"`; controls whether leading YAML front matter is parsed and stripped from `body`.
- **`sanitize`** — When enabled, output passes through `rehype-sanitize` with the package schema.
- **`diagnostics`** — Controls whether warnings appear on the result and whether strict mode fails the parse.
  - **`false`** — `result.diagnostics` is always `[]` (issues may still be detected internally).
  - **`true`** or **`"warn"`** — Non-fatal diagnostics are returned on `result.diagnostics`; the parse does not throw.
  - **`"strict"`** — Same collection as warn; if any diagnostic exists after rendering, the parse throws **`FeatherdownDiagnosticsError`** with **`error.diagnostics`** and optional **`error.result`** (full `FeatherdownResult`, including `html`). Use `instanceof FeatherdownDiagnosticsError` in callers that need to branch.

```ts
import { Featherdown, FeatherdownDiagnosticsError } from "featherdown";

const featherdown = new Featherdown({
  diagnostics: "warn",
});

const strict = new Featherdown({
  diagnostics: "strict",
});

try {
  await strict.parse(markdown);
} catch (e) {
  if (e instanceof FeatherdownDiagnosticsError) {
    console.error(e.diagnostics);
  }
}
```
- **`charts`** — When enabled, valid `chart-*` fences become mount placeholders; invalid JSON surfaces diagnostics when diagnostics are enabled.
- **`headings`** — Controls **`result.headings`** and **`result.toc`** (metadata extracted after render). Heading markup in **`html`** is unchanged; this option gates the arrays on the result.
  - **`false`** — **`result.headings`** and **`result.toc`** are both empty arrays.
  - **`true`** — Default heading metadata: both arrays are populated when rendered headings have ids.
  - **Object** — Shape matches **`FeatherdownHeadingOptions`**: optional **`toc`**. When **`toc`** is **`false`**, **`result.toc`** is empty while **`result.headings`** can still be filled. Optional **`slugs`** and **`anchors`** are part of the public type and merge like other nested options; they do not toggle the Markdown processor in this release.
- **`publishing`** — Gates excerpt, word count, and reading-time fields on the result.

**`kind`**, **`slug`**, and **`manifest`** (local `map` and optional `remote`) drive manifest-based image URL rewriting—the same shape supported historically on render helpers.

Avoid treating every nested field on `FeatherdownOptions` as a global behavioral switch unless documented below (for example line numbers and copy UI remain **per-fence** in Markdown).

## Front matter

Publishing-style front matter is **opt in**. The default constructor does **not** strip YAML; pass **`frontmatter: "auto"`** (or `true`) when you want leading `---` YAML parsed and removed from the body string.

```ts
const featherdown = new Featherdown({
  frontmatter: "auto",
});

const result = await featherdown.parse(`---
title: Hello World
tags:
  - docs
---

# Hello`);
```

Then:

- `result.frontmatter.title`, `result.metadata.title`
- `result.body` — Markdown after the front matter block
- `result.html` — Rendered from `body` only

**Lenient behavior:** invalid or non-mapping YAML does not throw; the raw document is treated as body content with empty `frontmatter` / `metadata` where applicable.

**Strict legacy utility:** `parseMarkdownFile()` still throws on invalid YAML and returns **`frontMatter`** / **`content`**. Use it only when you need that contract; otherwise prefer `Featherdown` with `frontmatter: "auto"`.

## Code blocks

- **Fenced code** renders as sanitized `<pre><code>` with highlight.js classes when highlighting is on.
- **Titles:** ` ```ts title="example.ts" ` — emits `code-block` / `code-block-title` markup.
- **Line highlights:** ` ```ts {2,4-5} ` — `code-line` / `code-line-highlighted` wrappers.
- **Line numbers:** ` ```ts showLineNumbers ` — `code-line-numbered` and per-line number spans (per fence).
- **Copy UI hooks:** `showCopyButton` / `copyButton` on the fence emit button markup and `data-*` attributes for your app to wire up. **The package does not ship clipboard JavaScript.**

Styling for these contracts comes from **`code.css`** and **`highlight.css`** (when highlighting is enabled).

## Math

Enable math on the instance or per parse:

```ts
const featherdown = new Featherdown({
  math: true,
});
```

Ensure KaTeX styles are loaded (all-in `featherdown/styles.css`, or `featherdown/styles/katex.css`). The public option name is **`math`**; KaTeX is used internally for HTML output.

## Charts, callouts, and publishing features

### Chart placeholders

Valid `chart-*` fenced JSON becomes a **`chart-mount`** placeholder with `data-chart` and `data-chart-data`. The package does **not** bundle a chart runtime—your app hydrates or renders charts.

### Callouts (admonitions)

`:::note`, `:::warning`, `:::tip`, etc. (with optional `:::type[Title]`) render to **`callout`** / **`callout-<type>`** structures. Body markdown is processed normally.

### Images

Optional **`manifest`** + **`kind`** + **`slug`** rewrite relative `![alt](./path)` sources using deterministic keys. No CDN fetching is built in.

### TOC, excerpt, counts

`toc`, `headings`, `excerpt`, `wordCount`, and `estimatedReadingMinutes` come from the **same** render pass as `html`, gated by **`headings`** and **`publishing`** options.

## Node usage

Import **`Featherdown` from `featherdown/node`** for filesystem helpers and optional Mermaid.

```ts
import { Featherdown } from "featherdown/node";

const featherdown = new Featherdown({
  frontmatter: "auto",
});

const result = await featherdown.parseFile("./posts/hello.md");
```

- **`parseFile(path)`** reads UTF-8 and returns the same **`FeatherdownResult`** as **`parse(markdown)`** for the same file contents and options.

## Mermaid (Node only)

Inline SVG Mermaid is available **only** through the Node entry, with **`mermaid: { render: "svg" }`**. There is **no** placeholder-only mode documented today.

```ts
import { Featherdown } from "featherdown/node";

const featherdown = new Featherdown({
  mermaid: {
    render: "svg",
  },
});

const result = await featherdown.parse(markdown);
```

- Uses **`rehype-mermaid`** and may require the **optional Playwright / Chromium** peer setup (`playwright` + `npx playwright install chromium`). Failures can be **environment-sensitive** in CI.
- Valid diagrams become inline **SVG** in `html`; **`result.assets.features.mermaid`** is **`true`** when this path is active.
- The Node Mermaid pipeline uses a **final SVG-aware sanitize** step and does **not** match every rehype plugin order detail of the default browser pipeline—expect rare edge differences for exotic inputs.

The default **`featherdown`** entry remains Mermaid-free for bundle safety.

## Advanced and compatibility APIs

### `featherdown/advanced`

The advanced subpath is for **existing low-level unified integrations**. Most applications should use **`Featherdown`**. The subpath exists for **existing unified pipelines** and low-level compatibility:

```ts
import {
  createMarkdownProcessor,
  rehypeChartBlocks,
  rehypeCdnImages,
} from "featherdown/advanced";
```

The same symbols remain re-exported from the **root** package for backward compatibility; prefer **`Featherdown`** for normal Markdown rendering.

### Legacy function exports

Older helpers (`renderMarkdownToHtml`, `renderMarkdown`, `renderMarkdownDocument`, `parseMarkdownFile`, `createMarkdownProcessor`, …) remain exported and marked **`@deprecated`**. They take **`RenderMarkdownOptions`**, not the full **`FeatherdownOptions`** surface (for example **`math`**, **`code`**, **`charts`**, **`frontmatter`**, and **`diagnostics: "strict"`** are **`Featherdown`** features). Prefer **`new Featherdown().parse()`** for new code.

## Migration from legacy helpers

Legacy helpers remain available for compatibility, but new code should use **`Featherdown`**.

For default rendering behavior (what the legacy helpers covered under **`RenderMarkdownOptions`**), the closest migration is:

```ts
// Before
const html = await renderMarkdownToHtml(markdown);

// After
const { html } = await new Featherdown().parse(markdown);
```

> **Migration note:** The legacy helpers are kept for compatibility and use the older **`RenderMarkdownOptions`** surface. They are not a full alias for **`FeatherdownOptions`**. For feature gates such as **`math`**, **`code`**, **`charts`**, **`frontmatter`**, and **`diagnostics: "strict"`**, use the **`Featherdown`** class.

| Legacy | Prefer |
| --- | --- |
| `renderMarkdownToHtml(md, opts)` | `(await new Featherdown().parse(md)).html` — legacy **`opts`** only apply the older options shape; pass **`FeatherdownOptions`** on **`Featherdown`** when you need feature gates |
| `renderMarkdown(md, opts)` | `await new Featherdown().parse(md)` — use **`r.html`** and **`r.diagnostics`**; same **`RenderMarkdownOptions`** limitation as above |
| `renderMarkdownDocument(md, opts)` | `await new Featherdown().parse(md)` for the default document pipeline when **`opts`** are legacy **`RenderMarkdownOptions`**. The **`Featherdown`** result adds **`body`**, **`frontmatter`**, **`assets`**, and related fields—configure **`Featherdown`** directly if you need **`FeatherdownOptions`** (not understood by the helper) |
| `parseMarkdownFile(md)` | `new Featherdown({ frontmatter: "auto" }).parse(md)` returns **`frontmatter`**, **`metadata`**, **`body`**, and **`html`** in one result. Keep **`parseMarkdownFile`** only when you need its strict **`{ frontMatter, content }`** contract |
| `renderMarkdownToHtmlWithMermaid(md, opts)` (Node) | `new Featherdown({ mermaid: { render: "svg" } }).parse(md)` then read **`html`** from **`featherdown/node`** — add **`kind`**, **`manifest`**, and other options in the same object as needed; **do not spread** an options object that might already define **`mermaid`** (merge carefully or use a dedicated instance). Legacy **`opts`** remain **`RenderMarkdownOptions`**-shaped |
| `createMarkdownProcessor(opts)` | **`Featherdown`** for normal use; **`featherdown/advanced`** only for custom unified graphs |

**Strict diagnostics:** **`diagnostics: "strict"`** exists only on **`Featherdown`**; legacy render helpers do not use it.

## Styling reference (HTML contracts)

Rendered output uses stable classes including:

- **Article surface:** wrap content in **`featherdown-content`** (see shipped CSS).
- **Callouts:** `callout`, `callout-<type>`, `callout-title`
- **Code:** `code-block`, `code-block-title`, `code-line`, `code-line-highlighted`, `code-line-numbered`, `code-line-number`, `code-block-copyable`, `code-block-copy-button`
- **Charts:** `chart-mount`
- **Images:** `markdown-inline-img`

## Security and trust

- Input is sanitized (`rehype-sanitize`); scripts are stripped in the default pipeline.
- Prefer the **default** entry for untrusted user content.
- The **Node Mermaid** path is better suited to **trusted** publishing inputs.

## Runtime boundaries

| Entry | Role |
| --- | --- |
| **`featherdown`** | Browser-safe; no Mermaid / Playwright in the default bundle. |
| **`featherdown/node`** | Node **`Featherdown`**, optional Mermaid SVG, **`parseFile`**. |
| **`featherdown/advanced`** | Processor + rehype plugins for unified integrations. |

Mermaid is **npm subpath–oriented**; JSR usage focuses on the default library surface.

### Client-side Mermaid previews

The default `featherdown` entry does not render Mermaid in the browser. If your app needs live Mermaid previews, parse Markdown first, then hydrate `code.language-mermaid` blocks with the `mermaid` package in your own app code. This keeps Mermaid out of Featherdown's browser bundle. Use `featherdown/node` when you want build-time SVG output.

```ts
import mermaid from "mermaid";

const result = await featherdown.parse(markdown);
mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
```

## Public API (summary)

**Primary**

- **`Featherdown`**, **`FeatherdownOptions`**, **`FeatherdownParseOptions`**, **`FeatherdownResult`**, and related types from **`featherdown`**.

**Node**

- **`Featherdown`** from **`featherdown/node`** with optional **`NodeFeatherdownOptions`** / Mermaid config.

**Styles (package exports)**

- `featherdown/styles.css`, `featherdown/styles/base.css`, `featherdown/styles/katex.css`, `featherdown/styles/code.css`, `featherdown/styles/highlight.css`

**Compatibility**

- Legacy render helpers and **`parseMarkdownFile`** on the default entry; **`renderMarkdownToHtmlWithMermaid`** on **`featherdown/node`**; **`featherdown/advanced`** for processor/plugins.

## Scripts

| Script | Description |
| --- | --- |
| `npm run build` | Build ESM artifacts in `dist/` |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm run test:exports` | Build + export smoke checks |

## Site

A demo site lives in **`site/`**.

```bash
npm run site:install
npm run site:dev
```

Build:

```bash
npm run site:build
```

GitHub Pages base path:

```bash
SITE_BASE_PATH=/featherdown/ npm run site:build
```

## Maintainers

CI and publishing: [RELEASING.md](./RELEASING.md).

## License

MIT. See [LICENSE](./LICENSE).
