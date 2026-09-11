# Changelog

<p align="right"><strong>English</strong> | <a href="CHANGELOG.zh-CN.md">简体中文</a></p>

All notable changes to the published Anki templates are documented here.

## [Unreleased]

## [0.3.0] - 2026-09-11

### Added

- Added a responsive floating outline built from every heading in `Back`. Fixed **正面** and **背面** entries sit above the heading hierarchy, untitled introductory Back content activates **背面**, and later headings become active as they are reached. The outline switches from a desktop side panel to an accessible mobile drawer; `Front` remains free-form and does not require a heading.
- Independently adjustable 23px body text on viewports up to 600px via `--mb-mobile-font-size`, preserving desktop and tag sizes.
- Optional `todo::` (amber) and `source::` (gray) tag styles in Markdown Basic, with light/dark palettes and stable to-do/content/source grouping on both faces. Source tags occupy a separate centered row below to-do and content tags. Ordinary tags keep their existing style and full names stay visible.

### Fixed

- Preserved Markdown source and rendering behavior consistently across generated card templates and repeated renderer initialization.
- Prevented Markdown emphasis syntax inside math formulas from being interpreted as Markdown formatting.
- Prevented display-math placeholders inside highlighted code blocks from being restored as live math.
- Classified a standalone `todo` tag as a to-do tag while preserving the existing behavior for ordinary and source tags.

## [0.2.0] - 2026-09-01

### Added

- Published `anki-english-vocabulary.apkg` with the managed `单词` note type, 11 fields, and the `RECITE`, `SPELLING`, and `DICTATION` card templates.
- Added stable release identities for the vocabulary model, fields, templates, and demo deck.
- Added a unified audit and synchronization workflow for the managed `单词`, `Markdown Basic`, and `Obsidian-basic` note types.
- Published both APKG files with a shared `SHA256SUMS.txt` manifest.

### Changed

- Aligned the managed vocabulary field order with the card editor and display hierarchy.
- Restored Markdown headings entered through Anki's rich-text editor.

### Fixed

- Preserved Markdown content that follows inline display math.
- Strengthened installer preflight, backup, readback, and isolated APKG verification.

## [0.1.1] - 2026-08-30

### Changed

- Clarified that the public APKG creates the standalone `Markdown Basic` note type without modifying Anki's built-in `Basic` note type.

### Fixed

- Preserved original Markdown before asynchronous resources and MathJax could mutate the card DOM, preventing first-open math flicker and damaged rerenders.
- Added regression coverage for delayed resource loading and multiline display math.

## [0.1.0] - 2026-08-29

### Added

- First public `anki-markdown-basic.apkg` release with stable model, field, template, and demo-deck identities.
- Added Markdown, fenced and inline code, highlight.js, KaTeX, Mermaid, dark mode, code copying, and selective `data-markdown` rendering.
- Bundled and verified pinned local renderer resources for offline use, with CDN fallback for optional features.
- Added reproducible APKG packaging, checksums, isolated import verification, and GitHub Release automation.

### Fixed

- Preserved multiline display math and decoded serialized HTML entities safely.
- Improved blockquote, code, and quote rendering behavior.

[0.3.0]: https://github.com/qrkks/anki-markdown-template/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/qrkks/anki-markdown-template/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/qrkks/anki-markdown-template/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/qrkks/anki-markdown-template/releases/tag/v0.1.0
