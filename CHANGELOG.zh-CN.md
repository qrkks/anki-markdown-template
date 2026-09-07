# 更新日志

<p align="right"><a href="CHANGELOG.md">English</a> | <strong>简体中文</strong></p>

所有公开发布的 Anki 模板重要变更均记录于此。

## [Unreleased]

### 新增

- 宽度不超过 600px 时默认使用 22px 正文，可通过 `--mb-mobile-font-size` 独立调整；桌面及标签字号保持原样。
- Markdown Basic 支持可选的 `todo::`（琥珀色）和 `source::`（灰色）标签样式，配套浅色/深色模式；正反面稳定按待处理、内容、来源分组。来源标签单独居中显示在待处理和内容标签下方。普通标签保持原样，完整名称保持可见。

## [0.2.0] - 2026-09-01

### 新增

- 发布 `anki-english-vocabulary.apkg`，包含受管的 `单词` 笔记类型、11 个字段以及 `RECITE`、`SPELLING`、`DICTATION` 三套卡片模板。
- 为词汇模型、字段、模板和演示牌组加入稳定的发布标识。
- 加入统一审计和同步流程，管理 `单词`、`Markdown Basic` 和 `Obsidian-basic` 三个笔记类型。
- 同时发布两个 APKG 文件以及统一的 `SHA256SUMS.txt` 校验清单。

### 变更

- 统一受管词汇字段在卡片编辑器中的顺序与显示层级。
- 恢复由 Anki 富文本编辑器输入的 Markdown 标题。

### 修复

- 保留行内显示公式后方的 Markdown 内容。
- 加强安装器预检、备份、回读以及 APKG 隔离验证流程。

## [0.1.1] - 2026-08-30

### 变更

- 明确公开 APKG 会创建独立的 `Markdown Basic` 笔记类型，不会修改 Anki 内置的 `Basic` 笔记类型。

### 修复

- 在异步资源和 MathJax 改写卡片 DOM 前保存原始 Markdown，避免首次打开时的公式闪烁和二次渲染损坏。
- 增加延迟资源加载和多行显示公式的回归测试。

## [0.1.0] - 2026-08-29

### 新增

- 首次公开发布 `anki-markdown-basic.apkg`，提供稳定的模型、字段、模板和演示牌组标识。
- 加入 Markdown、围栏及行内代码、highlight.js、KaTeX、Mermaid、暗色模式、代码复制和选择性 `data-markdown` 渲染。
- 打包并校验固定版本的本地渲染资源以支持离线使用，可选功能保留 CDN 回退。
- 加入可复现 APKG 打包、校验和、隔离导入验证及 GitHub Release 自动化。

### 修复

- 正确保留多行显示公式并安全解码序列化的 HTML 实体。
- 改进块引用、代码和引号的渲染行为。

[0.2.0]: https://github.com/qrkks/anki-markdown-template/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/qrkks/anki-markdown-template/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/qrkks/anki-markdown-template/releases/tag/v0.1.0
