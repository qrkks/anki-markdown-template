# Anki Markdown Template

<p align="right"><a href="README.md">English</a> | <strong>简体中文</strong></p>

一套可直接复制到 Anki 的卡片模板，支持 Markdown、代码高亮、KaTeX 数学公式、Mermaid 图表、暗色模式和代码复制。

[更新日志](CHANGELOG.zh-CN.md)

## 安装 Markdown Basic

普通用户从 [GitHub Releases](https://github.com/qrkks/anki-markdown-template/releases)
下载 `anki-markdown-basic.apkg`，然后在 Anki 中选择 **文件 → 导入**。安装包会创建：

- 笔记类型 `Markdown Basic`
- 字段 `Front`、`Back`
- 卡片模板 `Basic`
- 含一张可删除示例卡片的牌组 `Markdown Basic Demo`
- Markdown、KaTeX、代码高亮和 Mermaid 所需的本地媒体资源

安装包不修改 Anki 内置 `Basic`。

背面会把 `Back` 中从 `#` 到 `######` 的全部 Markdown 标题生成为浮动大纲：宽屏
桌面端显示在卡片侧边，较窄窗口和移动端通过“目录”按钮打开底部抽屉。点击目录项可
跳至对应章节，滚动时会高亮当前章节；没有标题的背面不显示目录控件。`Front` 不需要
包含标题。

### 手动安装

打开 Anki 的 **工具 → 管理笔记类型 → 卡片...**，然后复制三个生成文件：

1. 将 [`dist/basic/front.html`](dist/basic/front.html) 的全部内容复制到 **正面模板**。
2. 将 [`dist/basic/back.html`](dist/basic/back.html) 的全部内容复制到 **背面模板**。
3. 将 [`dist/basic/styling.css`](dist/basic/styling.css) 的全部内容复制到 **样式**。
4. 保存后先使用测试卡片确认显示效果。

`styling.css` 是纯 CSS；JavaScript 已由构建脚本嵌入正面和背面模板，不再依赖从 Anki Styling 区执行脚本。

### 手机正文字号

视口宽度不超过 600px 时，Markdown Basic 使用 **23px 正文**；桌面正文仍为 20px，标签字号保持原样。在 Anki 的 **卡片… → 样式** 中，调整靠前的 `--mb-mobile-font-size: 23px;`，即可单独修改窄屏正文字号。标题等相对字号会随正文一起缩放。此规则也适用于较窄的桌面窗口。

### 可选的标签约定

Markdown Basic 中普通标签保持现有样式。使用以下前缀即可启用两类视觉区分（匹配时不区分大小写）：

- `todo::` 后接名称，例如 `todo::缺少正面`：用深琥珀色文字和淡琥珀色背景表示需要处理的笔记。完成后请手动移除标签；模板不会检查或修改笔记字段。
- `source::` 后接名称，例如 `source::AHK::text`：用灰色文字和灰色背景表示来源信息，支持任意工具名称及嵌套层级。

正反面均按 **待处理 → 内容 → 来源** 排列：待处理和内容标签共用第一行，来源标签另起一行放在下方，行间保留小间距。两行均居中，窄屏下自然换行；各组内部保留 Anki 提供的顺序。
完整标签名称保持可见，不仅依靠颜色传达含义；浅色和深色模式分别配色。

示例：`todo::缺少正面` · `数学::微积分` · `source::AHK::text`。

这是可选的显示约定，不包含 AHK 专用标签名单，也不会重命名已有标签或修改 Anki 浏览器的标签侧栏。未使用这些前缀的用户仍看到原有标签样式。

### 自定义字段

公开模板使用 `data-markdown` 标记需要渲染的区域；渲染器仍兼容旧模板的
`id="front"` 和 `id="back"` 容器。复杂卡片可以只给需要 Markdown 的字段添加
`data-markdown`。一份脚本可以处理同一面上的任意多个区域：

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

## 安装英语词汇卡片

普通用户从 [GitHub Releases](https://github.com/qrkks/anki-markdown-template/releases)
下载 `anki-english-vocabulary.apkg`，然后在 Anki 中选择 **文件 → 导入**。安装包会创建：

- 笔记类型 `单词`
- 11 个按内容层级排列的字段
- `RECITE`、`SPELLING`、`DICTATION` 三套卡片模板
- 含一条可删除示例笔记的 `English Vocabulary Demo` 牌组
- Markdown、KaTeX、代码高亮和 Mermaid 所需的本地媒体资源

字段顺序为：`单词 → 音标 → 发音 → 词性 1 → 释义 1 → 词性 2 → 释义 2 → 例句 → 例句翻译 → 词组短语 → 拓展`。
模板结构、手动安装和开发更新方法见
[`templates/english-vocabulary`](templates/english-vocabulary)。
已通过本仓库开发安装器管理同一模型 ID 的用户不需要重复导入 APKG，继续使用
`pnpm run install:anki:dry-run` 和 `pnpm run install:anki` 即可安全更新。

## 模板

仓库目前包含两套模板：

- [`templates/basic`](templates/basic)：公开的 `Markdown Basic` 正反面模板；生成到
  `dist/basic`，同时保留根目录 `dist/front.html` 等兼容路径。
- [`templates/english-vocabulary`](templates/english-vocabulary)：英语词汇模板；所需字段和安装方法见目录内说明。

两套模板共用 `src/template.js` 中的 Markdown 渲染核心。运行 `pnpm run build` 会同时生成它们，不需要在每套模板中手动复制脚本。

## 功能

- Markdown 标题、列表、链接、表格和强调
- 根据 Markdown Basic 背面标题生成的响应式浮动大纲
- 可选的 `todo::` / `source::` 标签分组，并适配浅色和深色模式
- fenced code block 与行内代码
- highlight.js 代码高亮和点击复制
- KaTeX 行内公式 `$...$`、`\(...\)` 与块级公式 `$$...$$`、`\[...\]`
- Mermaid 图表
- Anki 暗色模式和响应式布局
- DOMPurify HTML 清理与 Mermaid strict 安全模式

## 内容规则

本模板采用 **Markdown 优先、有限 HTML、代码原样保留** 的规则：

- fenced code block 和行内代码中的内容不会参与 HTML 清理，`<div>`、`<script>` 等标签会作为代码文字显示。
- 四个空格或制表符缩进不会生成代码块；需要代码块时请明确使用三个反引号围栏。
- Anki 编辑器常用的无属性 `<div>`、`<div dir="auto">` 和 `<br>` 会转换成换行。
- Anki 编辑器生成的空 `<p>` 会转换成空行；无样式 `<p>` 中以 `#` 开头的标题会展开为 Markdown，并把标题标记后的 `&nbsp;` 恢复成普通空格。
- 带 `class`、`style` 等属性的 `<div>` 以及图片、表格、链接等其他 HTML 会保留，并在渲染后交给 DOMPurify 清理。
- HTML 容器内部是否继续解析 Markdown 不做额外保证；需要稳定展示的 Markdown 不应包在复杂 HTML 容器中。

这种规则避免猜测和反向转换任意富文本，同时保证 HTML 教学代码不会被当成真实页面元素。

## 资源加载

运行时会先尝试从 Anki 媒体目录加载以下文件，失败后再使用固定版本的 CDN：

- `_purify-3.4.12.min.js`
- `_highlight-11.11.1.js`
- `_highlight-github-11.11.1.css`
- `_highlight-github-dark-11.11.1.css`
- `_katex-0.18.1.css`
- `_katex-0.18.1.min.js`
- `_auto-render-0.18.1.js`
- `_mhchem-0.18.1.js`
- `_markdown-it-14.3.0.min.js`
- `_mermaid-11.16.0.min.js`

`pnpm run install:anki` 用于更新已安装且模型 ID 匹配的 `单词` 笔记类型。它会先按固定 URL 下载缺失或校验不符的资源，通过 SHA-256
校验后写入 Anki 媒体库，再更新模板。KaTeX 使用的 20 个 WOFF2 字体也会一起安装，
因此正常安装后可以完全离线使用。单个可选资源在本地和 CDN 都加载失败时，只会关闭
对应功能，不会阻止其他内容显示。

安装器会报告旧版受管资源，但默认保留，避免影响仍引用旧文件的其他模板。确认不再需要
旧版本后，可显式清理：

```powershell
pnpm run install:anki:dry-run
pnpm run install:anki
pnpm run install:anki:prune
```

### 一键审计和同步本机模板

修改共享渲染器后，可以一次审计或同步当前受管的三个笔记类型：`单词`、
`Markdown Basic` 和 `Obsidian-basic`：

```powershell
pnpm run audit:anki
pnpm run sync:anki:dry-run
pnpm run sync:anki
```

`audit:anki` 和 `sync:anki:dry-run` 都只读检查 Anki；前者用于日常确认是否落后，后者用于
同步前预览。`sync:anki` 会先完整预检，只有三个目标全部通过后才开始更新；更新后还会回读
确认它们与当前仓库一致。每个实际发生变化的笔记类型仍会单独备份到 `.anki-backups/`。
固定版本媒体资源只检查和同步一次。

`KaTeX and Markdown Basic` 与 `KaTeX and Markdown Cloze` 使用具有额外兼容要求的旧渲染器，
明确不在一键同步范围内。上述命令也不会修改字段、笔记内容、卡片、牌组或学习记录。

### 迁移本地 Obsidian-basic

这是已有本地模板的兼容迁移工具，不属于公开的 `Markdown Basic` 安装流程。已有的
`Obsidian-basic / Front / Back` 卡片可以单独升级为同一套通用渲染器。该命令
替换正反面的受管渲染器脚本，并移除会覆盖数学字体的 `#front * / #back *` 全局选择器；
其余卡面 HTML 与 CSS 保持不变，原模板会备份到 `.anki-backups/`：

```powershell
pnpm run migrate:anki:obsidian-basic:dry-run
pnpm run migrate:anki:obsidian-basic
```

## 开发

共享渲染核心和模板源文件分别位于：

- `src/template.js`：渲染逻辑
- `templates/basic`：`Markdown Basic` 模板结构和纯 CSS
- `templates/english-vocabulary`：英语词汇模板

`dist/` 中的 `front.html`、`back.html` 和 `styling.css` 是生成文件，请不要直接修改。

```powershell
pnpm run build
pnpm test
pnpm run check
```

`pnpm run check` 会重新生成模板、检查 JavaScript 语法、核对双语文档一致性并运行回归测试。

### 构建 APKG

安装 [uv](https://docs.astral.sh/uv/) 后运行：

```powershell
pnpm run package:all
```

命令会下载并校验 30 个固定版本资源，生成
`release/anki-markdown-basic.apkg`、`release/anki-english-vocabulary.apkg` 和
`release/SHA256SUMS.txt`。两个安装包都会通过固定版本的 Anki 25.09.4 官方
Python 库导入到隔离的临时 collection，核对模型、字段、模板 ID、CSS、示例笔记、
生成卡片和全部媒体哈希。它不会访问或修改用户的 Anki profile。

常规维护者发布时，在 `main` 推送一条明确的 `chore: release vX.Y.Z` 提交。Release workflow 会校验对应的 `package.json` 版本和双语发布说明文件，运行完整检查，在需要时创建 tag，再从该 tag 构建 APKG 并创建 GitHub Release。手动推送匹配的 `vX.Y.Z` tag 仍作为兼容路径保留。完整流程、重试和回滚说明见 [`docs/releasing.md`](docs/releasing.md)。

### 本地更新 Markdown Basic

APKG 用于公开发布和首次安装。开发时修改模板、CSS 或共享渲染器后，可以通过
AnkiConnect 只更新本机已安装的 `Markdown Basic / Basic`：

```powershell
pnpm run install:anki:basic:dry-run
pnpm run install:anki:basic
```

该命令要求先通过 APKG 安装具有受管模型 ID 的 `Markdown Basic`。它会校验笔记类型、
同步固定版本资源、备份原模板，然后只更新 `Basic` 正反面和 CSS；不会修改字段、笔记、
卡片、牌组或学习记录。对外发布以 GitHub Release 中的两个 APKG 为安装文件。

## 许可证

本模板采用 [MIT License](LICENSE)。
