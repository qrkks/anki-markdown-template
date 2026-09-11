# Anki Markdown Template

<p align="right"><strong>English</strong> | <a href="README.zh-CN.md">简体中文</a></p>

Ready-to-use Anki card templates with Markdown, syntax highlighting, KaTeX math, Mermaid diagrams, dark mode, and code copying.

[Changelog](CHANGELOG.md)

## Install Markdown Basic

Download `anki-markdown-basic.apkg` from [GitHub Releases](https://github.com/qrkks/anki-markdown-template/releases), then choose **File → Import** in Anki. The package creates:

- The `Markdown Basic` note type
- The `Front` and `Back` fields
- The `Basic` card template
- A `Markdown Basic Demo` deck containing one removable example card
- Local media resources for Markdown, KaTeX, syntax highlighting, and Mermaid

The package does not modify Anki's built-in `Basic` note type.

On the back, every Markdown heading (`#` through `######`) in `Back` becomes an
item in a floating outline below fixed **正面** and **背面** entries. Wide desktop
windows show the outline beside the card; narrower windows and mobile devices
use a **目录** button and bottom drawer. Clicking an item jumps to that section.
Scrolling through untitled introductory Back content highlights **背面**, then
the active heading takes over. Cards without back headings do not show outline
controls. `Front` does not need to contain a heading.

### Manual installation

Open **Tools → Manage Note Types → Cards...** in Anki, then copy the three generated files:

1. Copy all of [`dist/basic/front.html`](dist/basic/front.html) into **Front Template**.
2. Copy all of [`dist/basic/back.html`](dist/basic/back.html) into **Back Template**.
3. Copy all of [`dist/basic/styling.css`](dist/basic/styling.css) into **Styling**.
4. Save the note type and verify it with a test card first.

`styling.css` contains CSS only. The build script embeds JavaScript in the front and back templates, so the template no longer depends on scripts running from Anki's Styling section.

### Mobile text size

At viewport widths of 600px or less, Markdown Basic uses **23px body text**. Desktop body text stays at 20px; tag sizes are unchanged. In Anki's **Cards… → Styling**, adjust `--mb-mobile-font-size: 23px;` near the top to change the narrow-screen body size independently. Headings and other relative text sizes scale with the body. This rule also applies to narrow desktop windows.

### Optional tag conventions

Markdown Basic keeps ordinary tags in their existing style. Opt into two visual groups by using these prefixes (matched case-insensitively):

- `todo::` with a name, such as `todo::缺少正面`: amber text and a pale amber background for notes that need attention. Remove the tag manually after completing the work; the template does not inspect or edit note fields.
- `source::` with a name, such as `source::AHK::text`: gray text and a gray background for provenance. Any tool name and nesting depth are supported.

On both card faces, tags appear in this order: **to do → content → source**. To-do and content tags share the first row; source tags start on a separate row below, with a small gap. Both rows stay centered and wrap naturally on narrow screens. Each group preserves the order supplied by Anki. Full tag names remain visible, so meaning does not depend on color. Light and dark modes use matching palettes.

Example: `todo::缺少正面` · `数学::微积分` · `source::AHK::text`.

This is an optional display convention, not an AHK-specific tag list. It does not rename existing tags or change Anki's Browser tag sidebar. Users without these prefixes see the same tag style as before.

### Custom fields

The public template marks Markdown regions with `data-markdown`. The renderer remains compatible with the legacy `id="front"` and `id="back"` containers. On a complex card, add `data-markdown` only to the fields that need Markdown. One script can process any number of regions on the same card face:

```html
<div class="Paraphrase" data-markdown>{{释义 1}}</div>
<div class="Paraphrase" data-markdown>{{释义 2}}</div>
<div class="Example" data-markdown>{{例句}}</div>
```

You can also render multiple fields as one continuous Markdown document:

```html
<div data-markdown>
  {{释义 1}}

  {{释义 2}}

  {{例句}}
</div>
```

For a custom template, place one `<script>` at the bottom of every card face that uses Markdown and paste the complete contents of [`src/template.js`](src/template.js) into it. Do not repeat the script inside each `data-markdown` region. Continue using [`dist/styling.css`](dist/styling.css) for the accompanying styles.

Unmarked HTML and conditional blocks are not rewritten by the Markdown renderer. Keep native interactive elements outside Markdown regions, and do not nest `data-markdown` containers.

## Install English vocabulary cards

Download `anki-english-vocabulary.apkg` from [GitHub Releases](https://github.com/qrkks/anki-markdown-template/releases), then choose **File → Import** in Anki. The package creates:

- The `单词` (Vocabulary) note type
- 11 fields ordered by content hierarchy
- The `RECITE`, `SPELLING`, and `DICTATION` card templates
- An `English Vocabulary Demo` deck containing one removable example note
- Local media resources for Markdown, KaTeX, syntax highlighting, and Mermaid

The field order is: `单词 → 音标 → 发音 → 词性 1 → 释义 1 → 词性 2 → 释义 2 → 例句 → 例句翻译 → 词组短语 → 拓展`.

See [`templates/english-vocabulary`](templates/english-vocabulary) for the template structure, manual installation, and development update instructions. If the repository's development installer already manages a `单词` note type with the same model ID, you do not need to import the APKG again. Continue using `pnpm run install:anki:dry-run` and `pnpm run install:anki` for safe updates.

## Templates

The repository contains two template families:

- [`templates/basic`](templates/basic): the public `Markdown Basic` front and back templates. They are generated in `dist/basic`, with compatibility copies such as `dist/front.html` retained at the root of `dist`.
- [`templates/english-vocabulary`](templates/english-vocabulary): the English vocabulary templates. See the directory documentation for their required fields and installation instructions.

Both templates share the Markdown renderer in `src/template.js`. Running `pnpm run build` generates both sets, so the script does not need to be copied manually between templates.

## Features

- Markdown headings, lists, links, tables, and emphasis
- Responsive floating outline generated from headings on the back of Markdown Basic cards
- Optional `todo::` / `source::` tag grouping with light and dark mode styles
- Fenced code blocks and inline code
- highlight.js syntax highlighting and click-to-copy
- KaTeX inline math with `$...$` and `\(...\)`, plus display math with `$$...$$` and `\[...\]`
- Mermaid diagrams
- Anki dark mode and responsive layouts
- DOMPurify HTML sanitization and Mermaid strict security mode

## Content rules

The renderer follows a **Markdown-first, limited-HTML, code-preserving** policy:

- Content inside fenced code blocks and inline code is excluded from HTML cleanup, so tags such as `<div>` and `<script>` are displayed as code text.
- Four-space or tab indentation does not create a code block. Use an explicit triple-backtick fence for code blocks.
- Plain `<div>`, `<div dir="auto">`, and `<br>` elements commonly produced by Anki's editor are converted to line breaks.
- Empty `<p>` elements produced by Anki become blank lines. A heading beginning with `#` inside an unstyled `<p>` is restored to Markdown, and `&nbsp;` after the heading marker becomes a regular space.
- `<div>` elements with attributes such as `class` or `style`, along with other HTML such as images, tables, and links, are preserved and sanitized by DOMPurify after rendering.
- Markdown parsing inside HTML containers is not additionally guaranteed. Do not wrap Markdown that requires stable rendering in complex HTML containers.

These rules avoid guessing at arbitrary rich-text conversions while ensuring that HTML examples are not interpreted as real page elements.

## Resource loading

The runtime first attempts to load these files from Anki's media directory, then falls back to pinned CDN versions:

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

`pnpm run install:anki` updates an installed `单词` note type whose model ID matches the managed release identity. It downloads missing or invalid resources from pinned URLs, verifies their SHA-256 hashes, writes them to Anki's media collection, and then updates the templates. The 20 WOFF2 fonts used by KaTeX are installed as well, allowing normal installations to work completely offline. If an optional resource fails both locally and from the CDN, only that feature is disabled; other content continues to render.

The installer reports obsolete managed resources but keeps them by default so other templates that still reference them are not affected. Once they are no longer needed, remove them explicitly:

```powershell
pnpm run install:anki:dry-run
pnpm run install:anki
pnpm run install:anki:prune
```

### Audit and sync local templates

After changing the shared renderer, you can audit or synchronize all three managed note types at once: `单词`, `Markdown Basic`, and `Obsidian-basic`.

```powershell
pnpm run audit:anki
pnpm run sync:anki:dry-run
pnpm run sync:anki
```

Both `audit:anki` and `sync:anki:dry-run` are read-only. Use the former for routine drift checks and the latter to preview a synchronization. `sync:anki` completes a full preflight before writing anything, then reads all targets back to confirm that they match the repository. Each note type that actually changes is backed up separately under `.anki-backups/`. Pinned media resources are checked and synchronized only once per run.

`KaTeX and Markdown Basic` and `KaTeX and Markdown Cloze` use legacy renderers with additional compatibility requirements and are intentionally excluded. These commands do not modify fields, note content, cards, decks, or scheduling data.

### Migrate local Obsidian-basic

This is a compatibility migration for an existing local template, not part of the public `Markdown Basic` installation flow. Existing `Obsidian-basic / Front / Back` cards can be upgraded separately to use the shared renderer. The command replaces the managed renderer on both card faces and removes the `#front * / #back *` global selector that overrides math fonts. It preserves the remaining card HTML, CSS, and custom scripts, and backs up the original template under `.anki-backups/`.

```powershell
pnpm run migrate:anki:obsidian-basic:dry-run
pnpm run migrate:anki:obsidian-basic
```

## Development

The shared rendering core and template sources are located in:

- `src/template.js`: rendering logic
- `templates/basic`: the `Markdown Basic` structure and plain CSS
- `templates/english-vocabulary`: the English vocabulary templates

The `front.html`, `back.html`, and `styling.css` files under `dist/` are generated. Do not edit them directly.

```powershell
pnpm run build
pnpm test
pnpm run check
```

`pnpm run check` regenerates the templates, checks JavaScript syntax, verifies bilingual documentation parity, and runs the regression suite.

### Build APKG files

After installing [uv](https://docs.astral.sh/uv/), run:

```powershell
pnpm run package:all
```

The command downloads and verifies 30 pinned resources, then creates `release/anki-markdown-basic.apkg`, `release/anki-english-vocabulary.apkg`, and `release/SHA256SUMS.txt`. Both packages are imported into isolated temporary collections using the pinned official Anki 25.09.4 Python library. The validation checks model, field, and template IDs; CSS; example notes; generated cards; and every media hash. It never accesses or modifies the user's Anki profile.

For normal maintainer releases, push an explicit `chore: release vX.Y.Z` commit on `main`. The Release workflow verifies the matching `package.json` version and bilingual release-notes file, runs the full checks, creates the tag if needed, builds the APKG files from that tag, and creates the GitHub Release. Manually pushing a matching `vX.Y.Z` tag remains supported as a compatibility path. See [`docs/releasing.md`](docs/releasing.md) for the complete process, retries, and rollback instructions.

### Update Markdown Basic locally

APKG files are intended for public releases and first-time installation. During development, use AnkiConnect to update only an installed `Markdown Basic / Basic` note type after changing its templates, CSS, or shared renderer:

```powershell
pnpm run install:anki:basic:dry-run
pnpm run install:anki:basic
```

This command requires a `Markdown Basic` note type with the managed model ID, normally installed from the APKG. It validates the identity, synchronizes pinned resources, backs up the original template, and updates only the `Basic` front, back, and CSS. It does not modify fields, notes, cards, decks, or scheduling data. The two APKG files on GitHub Releases remain the public distribution artifacts.

## License

This template is licensed under the [MIT License](LICENSE).
