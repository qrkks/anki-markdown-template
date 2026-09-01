# Changelog

<p align="right"><strong>English</strong> | <a href="CHANGELOG.zh-CN.md">简体中文</a></p>

All notable changes to the published Anki templates are documented here.

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

[0.2.0]: https://github.com/qrkks/anki-markdown-template/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/qrkks/anki-markdown-template/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/qrkks/anki-markdown-template/releases/tag/v0.1.0
