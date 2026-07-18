# Anki Markdown Template

一套可直接复制到 Anki 的卡片模板，支持 Markdown、代码高亮、KaTeX 数学公式、Mermaid 图表、暗色模式和代码复制。

## 安装

打开 Anki 的 **工具 → 管理笔记类型 → 卡片...**，然后复制三个生成文件：

1. 将 [`dist/front.html`](dist/front.html) 的全部内容复制到 **正面模板**。
2. 将 [`dist/back.html`](dist/back.html) 的全部内容复制到 **背面模板**。
3. 将 [`dist/styling.css`](dist/styling.css) 的全部内容复制到 **样式**。
4. 保存后先使用测试卡片确认显示效果。

`styling.css` 是纯 CSS；JavaScript 已由构建脚本嵌入正面和背面模板，不再依赖从 Anki Styling 区执行脚本。

### 自定义字段

默认模板会渲染 `id="front"` 和 `id="back"` 容器。复杂卡片可以只给需要 Markdown 的字段添加 `data-markdown`。一份脚本可以处理同一面上的任意多个区域：

```html
<div class="Paraphrase" data-markdown>{{释义 1}}</div>
<div class="Paraphrase" data-markdown>{{释义 2}}</div>
<div class="Example" data-markdown>{{例句}}</div>
```

也可以把多个字段作为一篇连续的 Markdown 一起渲染：

```html
<div data-markdown>
  {{释义 1}}

  {{释义 2}}

  {{例句}}
</div>
```

自定义模板需要在使用 Markdown 的每一面底部放置一次 `<script>`，其中粘贴 [`src/template.js`](src/template.js) 的全部内容；不要在每个 `data-markdown` 区域中重复脚本。配套样式仍使用 [`dist/styling.css`](dist/styling.css)。

没有标记的 HTML 和条件块不会被 Markdown 渲染器改写。需要保留原生交互行为的内容应放在 Markdown 区域之外，也不要嵌套 `data-markdown` 容器。

## 功能

- Markdown 标题、列表、链接、表格和强调
- fenced code block 与行内代码
- highlight.js 代码高亮和点击复制
- KaTeX 行内公式 `$...$` 与块级公式 `$$...$$`
- Mermaid 图表
- Anki 暗色模式和响应式布局
- DOMPurify HTML 清理与 Mermaid strict 安全模式

## 内容规则

本模板采用 **Markdown 优先、有限 HTML、代码原样保留** 的规则：

- fenced code block 和行内代码中的内容不会参与 HTML 清理，`<div>`、`<script>` 等标签会作为代码文字显示。
- Anki 编辑器常用的无属性 `<div>`、`<div dir="auto">` 和 `<br>` 会转换成换行。
- 带 `class`、`style` 等属性的 `<div>` 以及图片、表格、链接等其他 HTML 会保留，并在渲染后交给 DOMPurify 清理。
- HTML 容器内部是否继续解析 Markdown 不做额外保证；需要稳定展示的 Markdown 不应包在复杂 HTML 容器中。

这种规则避免猜测和反向转换任意富文本，同时保证 HTML 教学代码不会被当成真实页面元素。

## 资源加载

运行时会先尝试从 Anki 媒体目录加载以下文件，失败后再使用固定版本的 CDN：

- `_purify-3.4.12.min.js`
- `_highlight-11.11.1.js`
- `_highlight-github-11.11.1.css`
- `_highlight-github-dark-11.11.1.css`
- `_katex-0.16.22.css`
- `_katex-0.16.22.min.js`
- `_auto-render-0.16.22.js`
- `_mhchem-0.16.22.js`
- `_markdown-it-14.1.0.min.js`
- `_mermaid-10.9.0.min.js`

未安装本地资源时需要联网。单个可选资源加载失败只会关闭对应功能，不会阻止其他内容显示。

## 开发

源文件位于 `src/`：

- `src/front.html`、`src/back.html`：模板结构
- `src/styling.css`：纯 CSS
- `src/template.js`：渲染逻辑

`dist/` 中的 `front.html`、`back.html` 和 `styling.css` 是生成文件，请不要直接修改。

```powershell
pnpm run build
pnpm test
pnpm run check
```

`pnpm run check` 会重新生成模板、检查 JavaScript 语法并运行回归测试。

## 许可证

本模板采用 [MIT License](LICENSE)。
