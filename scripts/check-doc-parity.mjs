import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

const documentPairs = [
  {
    label: "README",
    english: {
      name: "English README",
      path: new URL("../README.md", import.meta.url),
      languageLink: '<a href="README.zh-CN.md">简体中文</a>',
    },
    chinese: {
      name: "Chinese README",
      path: new URL("../README.zh-CN.md", import.meta.url),
      languageLink: '<a href="README.md">English</a>',
    },
    requiredSharedText: [
      "https://github.com/qrkks/anki-markdown-template/releases",
      "anki-markdown-basic.apkg",
      "anki-english-vocabulary.apkg",
      "templates/basic",
      "templates/english-vocabulary",
      "src/template.js",
      "pnpm run install:anki:dry-run",
      "pnpm run install:anki",
      "pnpm run audit:anki",
      "pnpm run sync:anki:dry-run",
      "pnpm run sync:anki",
      "pnpm run check",
      "pnpm run package:all",
      "docs/releasing.md",
      "MIT License",
    ],
    compareCodeBlocks: true,
  },
  {
    label: "CHANGELOG",
    english: {
      name: "English changelog",
      path: new URL("../CHANGELOG.md", import.meta.url),
      languageLink: '<a href="CHANGELOG.zh-CN.md">简体中文</a>',
    },
    chinese: {
      name: "Chinese changelog",
      path: new URL("../CHANGELOG.zh-CN.md", import.meta.url),
      languageLink: '<a href="CHANGELOG.md">English</a>',
    },
    requiredSharedText: [
      `[${packageJson.version}]`,
      "[0.1.1]",
      "[0.1.0]",
      "anki-markdown-basic.apkg",
      "anki-english-vocabulary.apkg",
      "SHA256SUMS.txt",
    ],
    compareCodeBlocks: false,
  },
];

function countOccurrences(text, value) {
  return text.split(value).length - 1;
}

function headingLevels(text) {
  return [...text.matchAll(/^(#{2,3})\s+.+$/gm)].map((match) => match[1].length);
}

function versionHeadings(text) {
  return [...text.matchAll(/^## (\[[^\]]+\] - \d{4}-\d{2}-\d{2})$/gm)].map(
    (match) => match[1],
  );
}

function codeBlocks(text) {
  return [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```$/gm)].map((match) =>
    match[1].trimEnd(),
  );
}

for (const pair of documentPairs) {
  const [english, chinese] = await Promise.all(
    [pair.english, pair.chinese].map(async (document) => ({
      ...document,
      text: await readFile(document.path, "utf8"),
    })),
  );

  for (const document of [english, chinese]) {
    if (!document.text.includes(document.languageLink)) {
      throw new Error(`${document.name} is missing its language switch link`);
    }

    for (const required of pair.requiredSharedText) {
      if (!document.text.includes(required)) {
        throw new Error(`${document.name} is missing required text: ${required}`);
      }
    }
  }

  if (JSON.stringify(headingLevels(english.text)) !== JSON.stringify(headingLevels(chinese.text))) {
    throw new Error(`${pair.label} heading levels are out of sync`);
  }

  if (pair.label === "CHANGELOG" && JSON.stringify(versionHeadings(english.text)) !== JSON.stringify(versionHeadings(chinese.text))) {
    throw new Error("CHANGELOG version headings or dates are out of sync");
  }

  if (pair.compareCodeBlocks && JSON.stringify(codeBlocks(english.text)) !== JSON.stringify(codeBlocks(chinese.text))) {
    throw new Error(`${pair.label} command and markup examples are out of sync`);
  }

  for (const required of pair.requiredSharedText) {
    if (countOccurrences(english.text, required) !== countOccurrences(chinese.text, required)) {
      throw new Error(`${pair.label} occurrence count differs for: ${required}`);
    }
  }
}

const releaseNotesPath = new URL(
  `../docs/releases/v${packageJson.version}.md`,
  import.meta.url,
);
const releaseNotes = await readFile(releaseNotesPath, "utf8");
for (const required of [
  "## English",
  "## 简体中文",
  "anki-markdown-basic.apkg",
  "anki-english-vocabulary.apkg",
  "SHA256SUMS.txt",
  "CHANGELOG.md",
  "CHANGELOG.zh-CN.md",
]) {
  if (!releaseNotes.includes(required)) {
    throw new Error(`Current release notes are missing required text: ${required}`);
  }
}

console.log("Bilingual documentation parity check passed.");
