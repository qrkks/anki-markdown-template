import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import {
  MODEL_NAME,
  MODEL_ID,
  REQUIRED_FIELDS,
  TEMPLATE_NAME,
  TEMPLATE_NAMES,
  getVocabularyFieldOrderChanges,
  installAnki,
  sha256,
  syncResources,
  transformResource,
  validateExistingModel,
} from "../scripts/install-anki.mjs";
import {
  BASIC_MODEL_ID,
  BASIC_MODEL_NAME,
  BASIC_REQUIRED_FIELDS,
  BASIC_TEMPLATE_NAME,
  installMarkdownBasic,
  normalizeAnkiText,
  validateBasicModel,
} from "../scripts/install-basic-anki.mjs";
import {RESOURCE_MANIFEST} from "../scripts/resource-manifest.mjs";
import {
  OBSIDIAN_MODEL_NAME,
  OBSIDIAN_REQUIRED_FIELDS,
  OBSIDIAN_TEMPLATE_NAME,
  migrateObsidianBasic,
  relaxGlobalFontSelector,
  replaceManagedRuntime,
} from "../scripts/migrate-obsidian-basic.mjs";
import {
  describeSyncResult,
  EXCLUDED_LEGACY_MODELS,
  syncManagedAnki,
} from "../scripts/sync-anki.mjs";

function extractFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notEqual(end, -1, `${nextName} should follow ${name}`);
  return source.slice(start, end);
}

test("Markdown Basic is clean, scoped, and built to both public paths", async () => {
  const [styling, front, back, publicStyling, publicFront, publicBack] =
    await Promise.all([
      readFile("dist/styling.css", "utf8"),
      readFile("dist/front.html", "utf8"),
      readFile("dist/back.html", "utf8"),
      readFile("dist/basic/styling.css", "utf8"),
      readFile("dist/basic/front.html", "utf8"),
      readFile("dist/basic/back.html", "utf8"),
    ]);

  assert.equal(styling, publicStyling);
  assert.equal(front, publicFront);
  assert.equal(back, publicBack);
  assert.doesNotMatch(styling, /<\/?(?:style|script)>/i);
  assert.doesNotMatch(styling, /Microsoft YaHei|微软雅黑/);
  assert.doesNotMatch(styling, /#front\s+\*|#back\s+\*/);
  assert.match(styling, /\.markdown-basic-content/);
  assert.doesNotMatch(styling, /\.markdown-basic-content pre \*/);
  assert.match(styling, /--mb-tag-background:\s*#7c3aed/);
  assert.match(styling, /--mb-code-label-background:\s*#10b981/);
  assert.match(styling, /\.markdown-basic-tag::before\s*{[^}]*content:\s*"#"/s);
  assert.match(
    styling,
    /\.markdown-basic-content \.code-lang-label:focus-visible/,
  );
  assert.match(styling, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styling, /markdown-basic-copy-pulse/);
  assert.match(front, /{{Front}}/);
  assert.match(front, /anki-markdown-template:basic/);
  assert.match(front, /data-markdown/);
  assert.match(front, /{{#Tags}}[\s\S]*{{Tags}}[\s\S]*{{\/Tags}}/);
  assert.match(front, /function enhanceBasicTags\(\)/);
  assert.match(front, /pill\.className = "markdown-basic-tag"/);
  assert.match(front, /langLabel\.setAttribute\("role", "button"\)/);
  assert.match(front, /langLabel\.addEventListener\("keydown"/);
  assert.match(
    front,
    /if \(lang === "mermaid"\) \{[\s\S]*?return `<div class="mermaid">/,
  );
  assert.doesNotMatch(front, /id=["']front["']/);
  assert.match(front, /<script>/);
  assert.match(back, /{{FrontSide}}/);
  assert.match(back, /id=["']answer["']/);
  assert.match(back, /{{Back}}/);
  assert.match(back, /data-markdown/);
  assert.doesNotMatch(back, /id=["']back["']/);
  assert.match(back, /<script>/);
});

test("release identities are stable and unambiguous", async () => {
  const [
    configText,
    vocabularyConfigText,
    packageText,
    builder,
    vocabularyBuilder,
    workflow,
  ] = await Promise.all([
    readFile("config/basic-release.json", "utf8"),
    readFile("config/vocabulary-release.json", "utf8"),
    readFile("package.json", "utf8"),
    readFile("scripts/build-basic-apkg.py", "utf8"),
    readFile("scripts/build-vocabulary-apkg.py", "utf8"),
    readFile(".github/workflows/release.yml", "utf8"),
  ]);
  const config = JSON.parse(configText);
  const vocabularyConfig = JSON.parse(vocabularyConfigText);
  const packageJson = JSON.parse(packageText);
  const releaseNotes = await readFile(
    `docs/releases/v${packageJson.version}.md`,
    "utf8",
  );
  assert.equal(config.noteTypeName, "Markdown Basic");
  assert.equal(config.cardTemplateName, "Basic");
  assert.equal(config.deckName, "Markdown Basic Demo");
  assert.equal(config.artifactName, "anki-markdown-basic.apkg");
  assert.equal(packageJson.version, "0.2.0");
  assert.match(packageJson.scripts["package:basic"], /package-basic\.mjs/);
  assert.match(
    packageJson.scripts["package:vocabulary"],
    /package-vocabulary\.mjs/,
  );
  assert.match(packageJson.scripts["package:all"], /write-release-checksums\.mjs/);
  assert.match(
    packageJson.scripts["install:anki:basic"],
    /install-basic-anki\.mjs/,
  );
  const ids = [
    config.modelId,
    config.deckId,
    config.templateId,
    ...Object.values(config.fieldIds),
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => Number.isSafeInteger(id) && id > 0));
  assert.equal(vocabularyConfig.noteTypeName, MODEL_NAME);
  assert.equal(vocabularyConfig.modelId, MODEL_ID);
  assert.equal(vocabularyConfig.deckName, "English Vocabulary Demo");
  assert.equal(
    vocabularyConfig.artifactName,
    "anki-english-vocabulary.apkg",
  );
  assert.deepEqual(Object.keys(vocabularyConfig.fieldIds), REQUIRED_FIELDS);
  assert.deepEqual(Object.keys(vocabularyConfig.templateIds), TEMPLATE_NAMES);
  const vocabularyIds = [
    vocabularyConfig.modelId,
    vocabularyConfig.deckId,
    ...Object.values(vocabularyConfig.fieldIds),
    ...Object.values(vocabularyConfig.templateIds),
  ];
  assert.equal(new Set(vocabularyIds).size, vocabularyIds.length);
  assert.ok(
    vocabularyIds.every((id) => Number.isSafeInteger(id) && id > 0),
  );
  assert.match(builder, /anki==25\.09\.4/);
  assert.match(builder, /genanki==0\.13\.1/);
  assert.match(builder, /Collection\(/);
  assert.match(builder, /import_anki_package/);
  assert.match(builder, /normalize_archive\(output, timestamp\)/);
  assert.match(vocabularyBuilder, /anki==25\.09\.4/);
  assert.match(vocabularyBuilder, /genanki==0\.13\.1/);
  assert.match(vocabularyBuilder, /Collection\(/);
  assert.match(vocabularyBuilder, /import_anki_package/);
  assert.match(vocabularyBuilder, /card_ords != \[0, 1, 2\]/);
  assert.match(vocabularyBuilder, /normalize_archive\(output, timestamp\)/);
  assert.match(workflow, /Verify release metadata/);
  assert.match(workflow, /docs\/releases\/\$\{GITHUB_REF_NAME\}\.md/);
  assert.match(workflow, /SOURCE_DATE_EPOCH/);
  assert.match(workflow, /pnpm run package:all/);
  assert.match(workflow, /anki-markdown-basic\.apkg/);
  assert.match(workflow, /anki-english-vocabulary\.apkg/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /--notes-file/);
  assert.doesNotMatch(workflow, /--generate-notes/);
  assert.match(releaseNotes, /^## English$/m);
  assert.match(releaseNotes, /^## 简体中文$/m);
});

test("English vocabulary preset is built with its required fields", async () => {
  const [styling, front, back] = await Promise.all([
    readFile("dist/english-vocabulary/styling.css", "utf8"),
    readFile("dist/english-vocabulary/recite/front.html", "utf8"),
    readFile("dist/english-vocabulary/recite/back.html", "utf8"),
  ]);

  assert.doesNotMatch(styling, /<\/?(?:style|script)>/i);
  assert.match(front, /{{单词}}/);
  assert.match(front, /{{音标}}/);
  assert.match(front, /{{发音}}/);
  assert.match(back, /{{FrontSide}}/);
  assert.doesNotMatch(back, /id=["']answer["']/);
  for (const field of [
    "词性 1",
    "释义 1",
    "词性 2",
    "释义 2",
    "例句",
    "例句翻译",
    "词组短语",
    "拓展",
  ]) {
    assert.match(back, new RegExp(`{{${field}}}`));
  }
  assert.equal(front.match(/<script>/g)?.length ?? 0, 0);
  assert.equal(back.match(/<script>/g)?.length, 1);
});

test("example and example translation render independently", async () => {
  for (const name of ["recite", "spelling", "dictation"]) {
    const back = await readFile(
      `dist/english-vocabulary/${name}/back.html`,
      "utf8",
    );
    const templateMarkup = back.split("<script>", 1)[0];
    const exampleStart = templateMarkup.indexOf("{{#例句}}");
    const exampleEnd = templateMarkup.indexOf("{{/例句}}");
    const translationStart = templateMarkup.indexOf("{{#例句翻译}}");
    const translationEnd = templateMarkup.indexOf("{{/例句翻译}}");

    assert.ok(exampleStart >= 0, `${name}: missing example condition`);
    assert.ok(exampleEnd > exampleStart, `${name}: invalid example condition`);
    assert.ok(
      translationStart > exampleEnd,
      `${name}: translation must not depend on example`,
    );
    assert.ok(
      translationEnd > translationStart,
      `${name}: invalid translation condition`,
    );
  }
});

test("SPELLING and DICTATION use the shared card layout", async () => {
  for (const name of ["spelling", "dictation"]) {
    const [front, back] = await Promise.all([
      readFile(`dist/english-vocabulary/${name}/front.html`, "utf8"),
      readFile(`dist/english-vocabulary/${name}/back.html`, "utf8"),
    ]);
    assert.match(front, /class=["'][^"']*\bfront-content\b/);
    assert.match(front, /class=["'][^"']*\bcat\b/);
    assert.doesNotMatch(back, /id=["']answer["']/);
    assert.doesNotMatch(front, /<script>/);
    assert.equal(back.match(/<script>/g)?.length, 1);
    const templateMarkup = back.split("<script>", 1)[0];
    assert.equal(templateMarkup.match(/data-markdown/g)?.length, 4);
    assert.match(templateMarkup, /data-markdown class=["']md["']/);
    assert.doesNotMatch(templateMarkup, /{{hint:词组短语}}/);
  }

  const dictationBack = await readFile(
    "dist/english-vocabulary/dictation/back.html",
    "utf8",
  );
  assert.match(dictationBack, /class=["']sense-section sense-one["']/);

  const spellingFront = await readFile(
    "dist/english-vocabulary/spelling/front.html",
    "utf8",
  );
  assert.match(
    spellingFront,
    /class=["']sense-section sense-two sense-section-separated["']/,
  );
});

test("English vocabulary CSS scopes separators and supports night mode", async () => {
  const styling = await readFile(
    "templates/english-vocabulary/styling.css",
    "utf8",
  );

  assert.match(styling, /\.card\.nightMode\s*{/);
  assert.match(styling, /\.md hr\s*{/);
  assert.doesNotMatch(styling, /\.Paraphrase hr\s*{/);
  assert.match(
    styling,
    /\.sense-section-separated\s*{[^}]*border-top:\s*2px solid var\(--blue\);/s,
  );
  assert.match(styling, /\.spelling-content \.sense-section-separated\s*{/);
  assert.match(styling, /\.dictation-content \.sense-section-separated\s*{/);
  assert.match(styling, /\.section-rule\s*{[^}]*height:\s*3px;/s);
  assert.doesNotMatch(styling, /^hr\s*{/m);
  assert.doesNotMatch(styling, /^h\s*{/m);
  assert.doesNotMatch(styling, /^u\s*{/m);
  assert.match(styling, /var\(--content-width\)/);
  assert.doesNotMatch(styling, /--back-(?:width|max-width)/);
  assert.match(styling, /--font-chinese:/);
  assert.match(styling, /--font-latin:/);
  assert.match(styling, /"Microsoft YaHei"/);
  assert.doesNotMatch(styling, /KaiTi|STKaiti|Kaiti SC/);
  assert.doesNotMatch(styling, /@font-face|_(?:kt|times)\.ttf/);
  assert.match(styling, /h\.POSS/);
  assert.match(styling, /hr\.POSS/);
  assert.match(
    styling,
    /\.md pre\s*{[^}]*position:\s*relative;[^}]*background:\s*var\(--code-background\);[^}]*border:\s*1px solid var\(--code-border\);/s,
  );
  assert.match(
    styling,
    /\.md pre code\s*{[^}]*display:\s*block;[^}]*background:\s*transparent !important;/s,
  );
  assert.match(
    styling,
    /\.md \.code-lang-label\s*{[^}]*position:\s*absolute;[^}]*min-width:\s*44px;[^}]*background:\s*var\(--code-label-background\);/s,
  );
  assert.match(styling, /--code-background:\s*#0d1117;/);
  assert.match(
    styling,
    /\.md blockquote,[\s\S]*?\.En blockquote,[\s\S]*?\.Zh blockquote\s*{[^}]*background:\s*var\(--blockquote-background\);[^}]*border-left:\s*4px solid var\(--blockquote-border\);/s,
  );
  assert.match(styling, /--blockquote-background:\s*rgba\(39, 134, 187, 0\.14\);/);
});

test("Anki installer refuses legacy field names without mutating them", () => {
  const legacyNames = new Map([
    ["词性 1", "词性1"],
    ["释义 1", "释义1"],
    ["词性 2", "词性2"],
    ["释义 2", "释义2"],
  ]);
  const legacyFields = REQUIRED_FIELDS.map(
    (field) => legacyNames.get(field) || field,
  );
  assert.throws(
    () => validateExistingModel(MODEL_ID, legacyFields, {[TEMPLATE_NAME]: {}}),
    /检测到旧字段名/,
  );
});

test("Anki installer refuses a different same-name model", () => {
  const templates = Object.fromEntries(TEMPLATE_NAMES.map((name) => [name, {}]));
  assert.throws(
    () => validateExistingModel(MODEL_ID + 1, REQUIRED_FIELDS, templates),
    /与受管模板 ID .* 不同/,
  );
});

test("English vocabulary fields keep the managed editing order", () => {
  assert.deepEqual(REQUIRED_FIELDS.slice(0, 3), ["单词", "音标", "发音"]);
  assert.deepEqual(REQUIRED_FIELDS.slice(-2), ["词组短语", "拓展"]);
  assert.deepEqual(
    getVocabularyFieldOrderChanges([
      "单词",
      "音标",
      "词性 1",
      "释义 1",
      "词性 2",
      "释义 2",
      "发音",
      "例句",
      "例句翻译",
      "拓展",
      "词组短语",
    ]),
    [
      {fieldName: "发音", index: 2, description: "发音移至音标后"},
      {
        fieldName: "词组短语",
        index: REQUIRED_FIELDS.length - 2,
        description: "词组短语移至拓展前",
      },
    ],
  );
  assert.deepEqual(getVocabularyFieldOrderChanges(REQUIRED_FIELDS), []);
});

test("Anki installer updates all managed templates and shared styling", async () => {
  const actions = [];
  let currentFields = [
    "单词",
    "音标",
    "词性 1",
    "释义 1",
    "词性 2",
    "释义 2",
    "发音",
    "例句",
    "例句翻译",
    "拓展",
    "词组短语",
  ];
  const currentTemplates = {
    [TEMPLATE_NAME]: {Front: "old front", Back: "old back"},
    SPELLING: {Front: "keep", Back: "keep"},
    DICTATION: {Front: "keep", Back: "keep"},
    UNMANAGED: {Front: "keep", Back: "keep"},
  };
  const request = async (action, params) => {
    actions.push({action, params});
    if (action === "version") return 6;
    if (action === "modelNamesAndIds") return {[MODEL_NAME]: MODEL_ID};
    if (action === "modelFieldNames") return currentFields;
    if (action === "modelTemplates") return currentTemplates;
    if (action === "modelStyling") return {css: "old css"};
    if (action === "modelFieldReposition") {
      const oldIndex = currentFields.indexOf(params.fieldName);
      currentFields.splice(oldIndex, 1);
      currentFields.splice(params.index, 0, params.fieldName);
    }
    return null;
  };

  await installAnki({
    request,
    resourceManifest: [],
    managedResourcePatterns: [],
    saveBackup: async () => "mock-backup.json",
    log() {},
  });

  const templateUpdate = actions.find(
    ({action}) => action === "updateModelTemplates",
  );
  assert.deepEqual(Object.keys(templateUpdate.params.model.templates), TEMPLATE_NAMES);
  assert.equal(templateUpdate.params.model.templates.UNMANAGED, undefined);
  assert.ok(actions.some(({action}) => action === "updateModelStyling"));
  assert.deepEqual(
    actions
      .filter(({action}) => action === "modelFieldReposition")
      .map(({params}) => params),
    [
      {modelName: MODEL_NAME, fieldName: "发音", index: 2},
      {
        modelName: MODEL_NAME,
        fieldName: "词组短语",
        index: REQUIRED_FIELDS.length - 2,
      },
    ],
  );
  assert.deepEqual(currentFields.slice(0, 3), ["单词", "音标", "发音"]);
  assert.deepEqual(currentFields.slice(-2), ["词组短语", "拓展"]);
});

test("Markdown Basic updater validates identity and updates only Basic", async () => {
  assert.equal(normalizeAnkiText("line one\r\nline two"), "line one\nline two");
  assert.throws(
    () =>
      validateBasicModel(
        {[BASIC_MODEL_NAME]: BASIC_MODEL_ID + 1},
        BASIC_REQUIRED_FIELDS,
        {[BASIC_TEMPLATE_NAME]: {}},
      ),
    /为避免覆盖同名模板/,
  );

  const actions = [];
  const templates = {
    [BASIC_TEMPLATE_NAME]: {Front: "old front", Back: "old back"},
    Custom: {Front: "keep", Back: "keep"},
  };
  const request = async (action, params) => {
    actions.push({action, params});
    if (action === "version") return 6;
    if (action === "modelNamesAndIds") {
      return {[BASIC_MODEL_NAME]: BASIC_MODEL_ID};
    }
    if (action === "modelFieldNames") {
      return [...BASIC_REQUIRED_FIELDS, "Custom Field"];
    }
    if (action === "modelTemplates") return templates;
    if (action === "modelStyling") return {css: "old css"};
    return null;
  };

  await installMarkdownBasic({
    request,
    resourceManifest: [],
    managedResourcePatterns: [],
    saveBackup: async (backup) => {
      assert.equal(backup.modelId, BASIC_MODEL_ID);
      assert.deepEqual(backup.templates, templates);
      return "mock-basic-backup.json";
    },
    log() {},
  });

  const templateUpdate = actions.find(
    ({action}) => action === "updateModelTemplates",
  );
  assert.deepEqual(Object.keys(templateUpdate.params.model.templates), [
    BASIC_TEMPLATE_NAME,
  ]);
  assert.equal(templateUpdate.params.model.templates.Custom, undefined);
  assert.ok(actions.some(({action}) => action === "updateModelStyling"));
});

test("Obsidian migration replaces only the managed runtime and preserves card markup", async () => {
  const previous = [
    '<div id="front">{{Front}}</div>',
    '<script>window.customBehavior = true;</script>',
    '<script>const RESOURCE_PROMISE_KEY = "ankiMarkdownResourcePromise";</script>',
  ].join("\n");
  const next = replaceManagedRuntime(previous, "window.currentRuntime = true;");

  assert.match(next, /<div id="front">{{Front}}<\/div>/);
  assert.match(next, /window\.customBehavior = true/);
  assert.match(next, /window\.currentRuntime = true/);
  assert.doesNotMatch(next, /const RESOURCE_PROMISE_KEY/);
  assert.throws(
    () => replaceManagedRuntime("<div>No runtime</div>", "replacement"),
    /实际找到 0 个/,
  );
});

test("Obsidian migration only relaxes its known global font selector", async () => {
  const actions = [];
  const previousStyling = [
    "/* custom */",
    "  #front,",
    "  #back,",
    "  #front *,",
    "  #back * {",
    "    font-family: sans-serif;",
    "  }",
    "  .custom { color: rebeccapurple; }",
  ].join("\n");
  const templates = {
    [OBSIDIAN_TEMPLATE_NAME]: {
      Front:
        '<div id="front">{{Front}}</div><script>const RESOURCE_PROMISE_KEY = "ankiMarkdownResourcePromise";</script>',
      Back:
        '<div id="back">{{Back}}</div><script>const RESOURCE_PROMISE_KEY = "ankiMarkdownResourcePromise";</script>',
    },
  };
  const request = async (action, params) => {
    actions.push({action, params});
    if (action === "version") return 6;
    if (action === "modelNames") return [OBSIDIAN_MODEL_NAME];
    if (action === "modelFieldNames") return OBSIDIAN_REQUIRED_FIELDS;
    if (action === "modelTemplates") return templates;
    if (action === "modelStyling") return {css: previousStyling};
    return null;
  };

  await migrateObsidianBasic({
    request,
    resourceManifest: [],
    managedResourcePatterns: [],
    saveBackup: async (backup) => {
      assert.equal(backup.css, previousStyling);
      return "mock-generic-backup.json";
    },
    log() {},
  });

  const update = actions.find(({action}) => action === "updateModelTemplates");
  assert.deepEqual(Object.keys(update.params.model.templates), [
    OBSIDIAN_TEMPLATE_NAME,
  ]);
  assert.match(
    update.params.model.templates[OBSIDIAN_TEMPLATE_NAME].Front,
    /_katex-0\.18\.1\.min\.js/,
  );
  const stylingUpdate = actions.find(
    ({action}) => action === "updateModelStyling",
  );
  assert.equal(
    stylingUpdate.params.model.css,
    [
      "/* custom */",
      "  #front,",
      "  #back {",
      "    font-family: sans-serif;",
      "  }",
      "  .custom { color: rebeccapurple; }",
    ].join("\n"),
  );
  assert.equal(
    relaxGlobalFontSelector("unrelated css"),
    "unrelated css",
  );
});

test("resource manifest is pinned and KaTeX CSS uses flat Anki font paths", () => {
  assert.equal(new Set(RESOURCE_MANIFEST.map(({filename}) => filename)).size, 30);
  for (const resource of RESOURCE_MANIFEST) {
    assert.match(resource.filename, /^_/);
    assert.match(resource.url, /^https:\/\//);
    assert.match(resource.sha256, /^[a-f0-9]{64}$/);
  }

  const resource = {
    transform: "katex-css",
  };
  const source = Buffer.from(
    '@font-face{src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2"),url(fonts/KaTeX_Main-Regular.woff) format("woff"),url(fonts/KaTeX_Main-Regular.ttf) format("truetype")}',
  );
  const transformed = transformResource(resource, source).toString("utf8");
  assert.match(
    transformed,
    /url\(_katex-0\.18\.1-font-KaTeX_Main-Regular\.woff2\)/,
  );
  assert.doesNotMatch(transformed, /url\(fonts\//);
  assert.doesNotMatch(transformed, /\.woff\)|\.ttf\)/);
});

test("resource sync verifies hashes, installs missing files, and prunes only explicitly", async () => {
  const currentData = Buffer.from("current");
  const newData = Buffer.from("new");
  const manifest = [
    {
      filename: "_test-current.js",
      url: "https://example.test/current.js",
      sha256: sha256(currentData),
    },
    {
      filename: "_test-new.js",
      url: "https://example.test/new.js",
      sha256: sha256(newData),
    },
  ];
  const media = new Map([["_test-current.js", currentData]]);
  media.set("_test-old.js", Buffer.from("old"));
  const actions = [];
  const request = async (action, params) => {
    actions.push({action, params});
    if (action === "retrieveMediaFile") {
      return media.get(params.filename)?.toString("base64") || false;
    }
    if (action === "getMediaFilesNames") return [...media.keys()];
    if (action === "storeMediaFile") {
      media.set(params.filename, Buffer.from(params.data, "base64"));
      return params.filename;
    }
    if (action === "deleteMediaFile") {
      media.delete(params.filename);
      return params.filename;
    }
    return null;
  };

  const first = await syncResources({
    request,
    resourceManifest: manifest,
    managedResourcePatterns: ["_test-*"],
    downloadResource: async ({filename}) => {
      assert.equal(filename, "_test-new.js");
      return newData;
    },
    log() {},
  });
  assert.deepEqual(first.updated, ["_test-new.js"]);
  assert.deepEqual(first.oldFiles, ["_test-old.js"]);
  assert.equal(media.has("_test-old.js"), true);

  const second = await syncResources({
    request,
    pruneResources: true,
    resourceManifest: manifest,
    managedResourcePatterns: ["_test-*"],
    log() {},
  });
  assert.deepEqual(second.updated, []);
  assert.deepEqual(second.deleted, ["_test-old.js"]);
  assert.equal(media.has("_test-old.js"), false);
  assert.ok(actions.some(({action}) => action === "deleteMediaFile"));
});

test("resource sync rejects downloaded content with the wrong hash", async () => {
  const actions = [];
  const request = async (action) => {
    actions.push(action);
    if (action === "retrieveMediaFile") return false;
    if (action === "getMediaFilesNames") return [];
    return null;
  };

  await assert.rejects(
    syncResources({
      request,
      resourceManifest: [
        {
          filename: "_test.js",
          url: "https://example.test/test.js",
          sha256: sha256(Buffer.from("expected")),
        },
      ],
      managedResourcePatterns: [],
      downloadResource: async () => Buffer.from("tampered"),
      log() {},
    }),
    /SHA-256 校验失败/,
  );
  assert.equal(actions.includes("storeMediaFile"), false);
});

test("resource sync can be skipped by the unified installer", async () => {
  const result = await syncResources({
    request() {
      throw new Error("resource request should not run");
    },
    resourceManifest: [],
    managedResourcePatterns: [],
    log() {
      throw new Error("resource log should not run");
    },
  });

  assert.deepEqual(result, {
    current: [],
    missing: [],
    mismatched: [],
    oldFiles: [],
    updated: [],
    deleted: [],
  });
});

test("managed Anki sync preflights all targets before writing and verifies", async () => {
  const calls = [];
  const attempts = new Map();
  const targets = ["单词", "Markdown Basic", "Obsidian-basic"].map((name) => ({
    name,
    async install({dryRun, resourceManifest}) {
      const attempt = (attempts.get(name) || 0) + 1;
      attempts.set(name, attempt);
      calls.push({name, dryRun, checksResources: resourceManifest === undefined});
      return {
        action: dryRun && attempt === 1 ? "update" : dryRun ? "none" : "update",
        resources: {missing: [], mismatched: [], updated: []},
      };
    },
  }));

  const result = await syncManagedAnki({targets, log() {}});

  assert.equal(result.mode, "sync");
  assert.deepEqual(
    calls.map(({name, dryRun}) => `${name}:${dryRun}`),
    [
      "单词:true",
      "Markdown Basic:true",
      "Obsidian-basic:true",
      "单词:false",
      "Markdown Basic:false",
      "Obsidian-basic:false",
      "单词:true",
      "Markdown Basic:true",
      "Obsidian-basic:true",
    ],
  );
  assert.deepEqual(
    calls.map(({checksResources}) => checksResources),
    [true, false, false, false, false, false, false, false, false],
  );
});

test("managed Anki dry-run never writes and reports excluded legacy models", async () => {
  const calls = [];
  const targets = ["单词", "Markdown Basic", "Obsidian-basic"].map((name) => ({
    name,
    async install({dryRun}) {
      calls.push({name, dryRun});
      assert.equal(dryRun, true);
      return {
        action: "none",
        resources: {missing: [], mismatched: [], updated: []},
      };
    },
  }));

  const result = await syncManagedAnki({dryRun: true, targets, log() {}});

  assert.equal(result.mode, "dry-run");
  assert.equal(calls.length, 3);
  assert.deepEqual(EXCLUDED_LEGACY_MODELS, [
    "KaTeX and Markdown Basic",
    "KaTeX and Markdown Cloze",
  ]);
  assert.equal(
    describeSyncResult("单词", {
      action: "update",
      resources: {missing: ["resource"], mismatched: []},
    }),
    "单词：将更新，1 个资源需要同步",
  );
});

test("managed Anki sync aborts before writes when preflight fails", async () => {
  let writes = 0;
  const targets = [
    {
      name: "单词",
      async install({dryRun}) {
        if (!dryRun) writes += 1;
        return {
          action: "none",
          resources: {missing: [], mismatched: [], updated: []},
        };
      },
    },
    {
      name: "Markdown Basic",
      async install() {
        throw new Error("invalid managed model");
      },
    },
  ];

  await assert.rejects(
    syncManagedAnki({targets, log() {}}),
    /invalid managed model/,
  );
  assert.equal(writes, 0);
});

test("cleanHTML preserves indentation and non-blockquote HTML entities", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({
    window: {},
    debug() {},
    console: {log() {}, warn() {}, error() {}},
  });
  vm.runInContext(
    `${extractFunction(source, "cleanHTML", "escapeHtml")}; this.cleanHTML = cleanHTML;`,
    context,
  );

  assert.equal(context.cleanHTML("- parent\n  - child"), "- parent\n  - child");
  assert.equal(
    context.cleanHTML("&lt;b&gt;literal&lt;/b&gt;"),
    "&lt;b&gt;literal&lt;/b&gt;",
  );
  assert.equal(context.cleanHTML("&gt; **quote**"), "> **quote**");
  assert.equal(
    context.cleanHTML("&gt;拉丁语：e- + legere\n&gt;legere：to pick, gather"),
    ">拉丁语：e- + legere\n>legere：to pick, gather",
  );
  assert.equal(
    context.cleanHTML("  &gt; &gt; nested quote"),
    "> > nested quote",
  );
  assert.equal(
    context.cleanHTML("comparison: a &gt; b"),
    "comparison: a &gt; b",
  );
  assert.equal(
    context.cleanHTML("```text\n&gt; code stays encoded\n```"),
    "```text\n&gt; code stays encoded\n```",
  );
});

test("runtime decodes arrows consistently before safe code rendering", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({});
  vm.runInContext(
    `${extractFunction(source, "decodeHtmlEntities", "safeSetHTML")}; this.decodeHtmlEntities = decodeHtmlEntities;`,
    context,
  );

  assert.equal(context.decodeHtmlEntities("A --&gt; B"), "A --> B");
  assert.equal(context.decodeHtmlEntities("x &lt; y &amp;&amp; y &gt; z"), "x < y && y > z");
  assert.equal(context.decodeHtmlEntities("a&#x27; = a&#39;"), "a' = a'");
  assert.match(
    source,
    /return `<div class="mermaid">\$\{escapeHtml\(\s*decodeHtmlEntities\(token\.content\)/,
  );
  assert.match(source, /decodedStr\s*=\s*decodeHtmlEntities\(str\)/);
  assert.match(
    source,
    /decodedContent\s*=\s*decodeHtmlEntities\(token\.content\)/,
  );
  assert.match(
    source,
    /forEach\(async \(diagram, index\) => \{\s*const graphDefinition = diagram\.textContent;\s*try \{/,
  );
});

test("cleanHTML removes only indentation shared by the whole field", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({
    window: {},
    debug() {},
    console: {log() {}, warn() {}, error() {}},
  });
  vm.runInContext(
    `${extractFunction(source, "cleanHTML", "escapeHtml")}; this.cleanHTML = cleanHTML;`,
    context,
  );

  assert.equal(
    context.cleanHTML("    ordinary text\n    keep later indentation"),
    "ordinary text\nkeep later indentation",
  );
  assert.equal(
    context.cleanHTML("  \n\t\n    ordinary text"),
    "ordinary text",
  );
  assert.equal(
    context.cleanHTML("    - parent\n      - child"),
    "- parent\n  - child",
  );
  assert.equal(
    context.cleanHTML("first line\n    intentional later indentation"),
    "first line\n    intentional later indentation",
  );
});

test("cleanHTML treats fenced and inline code as opaque text", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({
    window: {},
    debug() {},
    console: {log() {}, warn() {}, error() {}},
  });
  vm.runInContext(
    `${extractFunction(source, "cleanHTML", "escapeHtml")}; this.cleanHTML = cleanHTML;`,
    context,
  );

  const fenced = "```html\n<div>hello</div>\n<script>alert(1)</script>\n```";
  assert.equal(context.cleanHTML(fenced), fenced);
  assert.equal(
    context.cleanHTML("Use `<span>hello</span>` here"),
    "Use `<span>hello</span>` here",
  );
});

test("cleanHTML normalizes only Anki layout wrappers", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({
    window: {},
    debug() {},
    console: {log() {}, warn() {}, error() {}},
  });
  vm.runInContext(
    `${extractFunction(source, "cleanHTML", "escapeHtml")}; this.cleanHTML = cleanHTML;`,
    context,
  );

  assert.equal(context.cleanHTML("<div>first</div><div>second</div>"), "first\n\nsecond");
  assert.equal(
    context.cleanHTML(
      "<div><br></div><div><div># innocence</div><div>## origin</div></div>",
    ),
    "# innocence\n\n## origin",
  );
  assert.equal(
    context.cleanHTML('<div class="callout"><strong>HTML</strong></div>'),
    '<div class="callout"><strong>HTML</strong></div>',
  );
  assert.equal(
    context.cleanHTML(
      '<div class="callout"><div dir="auto">inside</div></div>',
    ),
    '<div class="callout">\ninside\n</div>',
  );
});

test("cleanHTML restores headings typed in Anki rich-text paragraphs", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({
    window: {},
    debug() {},
    console: {log() {}, warn() {}, error() {}},
  });
  vm.runInContext(
    `${extractFunction(source, "cleanHTML", "escapeHtml")}; this.cleanHTML = cleanHTML;`,
    context,
  );

  assert.equal(
    context.cleanHTML(
      "<p><br></p><p>#&nbsp;orthogonal 按词源来说 直角的？</p><p><br></p><div>对，词源上基本就是“直角的”。</div>",
    ),
    "# orthogonal 按词源来说 直角的？\n\n对，词源上基本就是“直角的”。",
  );
  assert.equal(
    context.cleanHTML('<p dir="auto">##&#160;词源</p>'),
    "## 词源",
  );
  assert.equal(
    context.cleanHTML('<p class="lead">#&nbsp;intentional rich HTML</p>'),
    '<p class="lead">#&nbsp;intentional rich HTML</p>',
  );
});

test("runtime preserves and enables backslash math delimiters", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({});
  vm.runInContext(
    `${extractFunction(source, "protectMathDelimiters", "restoreMathDelimiters")}
     ${extractFunction(source, "restoreMathDelimiters", "escapeHtml")}
     this.protectMathDelimiters = protectMathDelimiters;
     this.restoreMathDelimiters = restoreMathDelimiters;`,
    context,
  );

  const input = String.raw`Inline \(x + 1\), display \[y = 2\].`;
  const protectedText = context.protectMathDelimiters(input);
  assert.doesNotMatch(protectedText, /\\[()[\]]/);
  assert.equal(context.restoreMathDelimiters(protectedText), input);
  const codeInput = "Code `\\(z\\)` and fenced code:\n```tex\n\\[z\\]\n```";
  assert.equal(
    context.restoreMathDelimiters(context.protectMathDelimiters(codeInput)),
    codeInput,
  );

  assert.match(source, /left:\s*"\\\\\(",\s*right:\s*"\\\\\)"/);
  assert.match(source, /left:\s*"\\\\\[",\s*right:\s*"\\\\\]"/);
  assert.match(source, /protectDisplayMathBlocks\([\s\S]*cleanHTML\(original\)/);
  assert.match(source, /protectMathDelimiters\(protectedDisplayMath\.text\)/);
  assert.match(source, /restoreMathDelimiters\(md\.render\(text\)\)/);
});

test("code copy reports the real Anki-compatible clipboard result", async () => {
  const source = await readFile("src/template.js", "utf8");
  const execStart = source.indexOf("function copyWithExecCommand(");
  const copyStart = source.indexOf("async function copyToClipboard(");
  const copyEnd = source.indexOf("function addLanguageLabel(", copyStart);
  assert.notEqual(execStart, -1);
  assert.notEqual(copyStart, -1);
  assert.notEqual(copyEnd, -1);
  const execFunction = source.slice(execStart, copyStart);
  const copyFunction = source.slice(copyStart, copyEnd);
  const timers = [];
  const classes = new Set();
  const textArea = {
    value: "",
    readOnly: false,
    style: {},
    focus() {},
    select() {},
    setSelectionRange() {},
  };
  let execResult = true;
  const context = vm.createContext({
    console: {warn() {}},
    debug() {},
    navigator: {},
    document: {
      createElement() {
        return textArea;
      },
      execCommand(command) {
        assert.equal(command, "copy");
        return execResult;
      },
      body: {
        appendChild() {},
        removeChild() {},
      },
    },
    setTimeout(callback) {
      timers.push(callback);
    },
  });
  vm.runInContext(
    `${extractFunction(source, "showCopyFeedback", "copyWithExecCommand")}
     ${execFunction}
     ${copyFunction}
     this.copyToClipboard = copyToClipboard;`,
    context,
  );

  const button = {
    textContent: "python",
    style: {minWidth: ""},
    getBoundingClientRect() {
      return {width: 52.25};
    },
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
    },
  };

  assert.equal(await context.copyToClipboard("print('ok')", button), true);
  assert.equal(textArea.value, "print('ok')");
  assert.equal(button.textContent, "已复制");
  assert.equal(button.style.minWidth, "53px");
  assert.ok(classes.has("copied"));
  timers.shift()();
  assert.equal(button.textContent, "python");
  assert.equal(button.style.minWidth, "");
  assert.equal(classes.size, 0);

  execResult = false;
  assert.equal(await context.copyToClipboard("nope", button), false);
  assert.equal(button.textContent, "复制失败");
  assert.ok(classes.has("copy-failed"));
});

test("runtime preserves multiline display math across Markdown rendering", async () => {
  const source = await readFile("src/template.js", "utf8");
  const context = vm.createContext({
    escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    },
  });
  vm.runInContext(
    `${extractFunction(source, "protectDisplayMathBlocks", "restoreDisplayMathBlocks")}
     ${extractFunction(source, "restoreDisplayMathBlocks", "protectMathDelimiters")}
     ${extractFunction(source, "decodeHtmlEntities", "safeSetHTML")}
     this.protectDisplayMathBlocks = protectDisplayMathBlocks;
     this.restoreDisplayMathBlocks = restoreDisplayMathBlocks;
     this.decodeHtmlEntities = decodeHtmlEntities;`,
    context,
  );

  const input = String.raw`Before
$$
A^\dagger = F^\mathsf{T}(F F^\mathsf{T})^{-1}
$$
Middle
\[
p=
\begin{bmatrix}
1\\
1
\end{bmatrix}
\]
After`;
  const protectedMath = context.protectDisplayMathBlocks(input);
  assert.equal(protectedMath.blocks.length, 2);
  assert.doesNotMatch(protectedMath.text, /A\^\\dagger/);
  assert.doesNotMatch(protectedMath.text, /\\begin\{bmatrix\}/);

  const markdownHtml = `<p>${protectedMath.text}</p>`;
  const restored = context.restoreDisplayMathBlocks(
    markdownHtml,
    protectedMath.blocks,
  );
  assert.equal(
    restored,
    String.raw`<p>Before
$$
A^\dagger = F^\mathsf{T}(F F^\mathsf{T})^{-1}
$$
Middle
\[
p=
\begin{bmatrix}
1\\
1
\end{bmatrix}
\]
After</p>`,
  );
  assert.doesNotMatch(restored, /<br>/);
  assert.match(restored, /1\\\\\n1/);

  const singleLineDollars = String.raw`Before
$$A=CF$$
**Markdown after the first formula**
## Heading between formulas
$$T=\sum_i u_i \circ v_i$$
After`;
  const protectedSingleLineDollars =
    context.protectDisplayMathBlocks(singleLineDollars);
  assert.equal(protectedSingleLineDollars.blocks.length, 0);
  assert.equal(protectedSingleLineDollars.text, singleLineDollars);

  const embeddedInput = String.raw`同时，\[
p = Pb = \dfrac{aa^T}{a^Ta}b
\]，
然后继续。`;
  const embedded = context.protectDisplayMathBlocks(embeddedInput);
  assert.equal(embedded.blocks.length, 1);
  assert.equal(
    embedded.text,
    "同时，@@ANKI_MD_DISPLAY_MATH_BLOCK_0@@，\n然后继续。",
  );
  assert.equal(
    context.restoreDisplayMathBlocks(`<p>${embedded.text}</p>`, embedded.blocks),
    String.raw`<p>同时，\[
p = Pb = \dfrac{aa^T}{a^Ta}b
\]，
然后继续。</p>`,
  );

  const unsafe = context.protectDisplayMathBlocks("$$\nx < y & y > 0\n$$");
  assert.equal(
    context.restoreDisplayMathBlocks(unsafe.text, unsafe.blocks),
    "$$\nx &lt; y &amp; y &gt; 0\n$$",
  );

  const serialized = context.protectDisplayMathBlocks(
    "$$\n\\begin{bmatrix}\n1&amp;1\\\\\n1&amp;1\n\\end{bmatrix}\na&#x27; &lt; b\n$$",
  );
  const restoredSerialized = context.restoreDisplayMathBlocks(
    serialized.text,
    serialized.blocks,
  );
  assert.equal(
    restoredSerialized,
    "$$\n\\begin{bmatrix}\n1&amp;1\\\\\n1&amp;1\n\\end{bmatrix}\na' &lt; b\n$$",
  );
  assert.doesNotMatch(restoredSerialized, /&amp;amp;|&amp;#x27;/);
  assert.match(context.decodeHtmlEntities(restoredSerialized), /1&1/);
  assert.match(
    source,
    /restoreDisplayMathBlocks\([\s\S]*protectedDisplayMath\.blocks/,
  );
});

test("runtime requires fenced blocks instead of indentation for code", async () => {
  const source = await readFile("src/template.js", "utf8");
  assert.match(source, /md\.block\.ruler\.disable\(\["code"\]\)/);
  assert.match(source, /md\.renderer\.rules\.fence\s*=/);
  assert.match(source, /md\.renderer\.rules\.code_inline\s*=/);
});

test("runtime uses explicit resource checks and secure Mermaid defaults", async () => {
  const source = await readFile("src/template.js", "utf8");
  assert.doesNotMatch(source, /cdn\.includes\(/);
  assert.doesNotMatch(source, /Promise\.all\(\[\s*\.\.\.RESOURCES\.scripts/);
  assert.match(source, /securityLevel:\s*"strict"/);
  assert.match(source, /html:\s*typeof window\.DOMPurify/);
  assert.match(source, /isLoaded:\s*\(\) => typeof window\.renderMathInElement/);
  assert.match(source, /_highlight-\$\{highlightTheme\}-11\.11\.1\.css/);
  assert.doesNotMatch(source, /"\\\\ce":\s*"\\\\ce"/);
  assert.doesNotMatch(source, /highlightedCode\s*=\s*decodedStr/);
  assert.match(source, /highlightedCode\s*=\s*escapeHtml\(decodedStr\)/);
});

test("runtime supports legacy card containers and selective Markdown regions", async () => {
  const source = await readFile("src/template.js", "utf8");
  const front = {};
  const selective = {};
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return id === "front" ? front : null;
      },
      querySelectorAll(selector) {
        assert.equal(selector, "[data-markdown]");
        return [front, selective];
      },
    },
    Set,
  });

  vm.runInContext(
    `${extractFunction(source, "getMarkdownElements", "renderAll")}; this.getMarkdownElements = getMarkdownElements;`,
    context,
  );

  const elements = context.getMarkdownElements();
  assert.equal(elements.length, 2);
  assert.equal(elements[0], front);
  assert.equal(elements[1], selective);
});

test("runtime snapshots Markdown before asynchronous resource loading", async () => {
  const source = await readFile("src/template.js", "utf8");
  const captureFunction = extractFunction(
    source,
    "captureMarkdownSources",
    "renderAll",
  );
  const element = {innerHTML: String.raw`\[x=1\]`};
  const context = vm.createContext({element});

  vm.runInContext(
    `const originalMarkdownSources = new WeakMap();
     function getMarkdownElements() { return [element]; }
     ${captureFunction}
     this.captureMarkdownSources = captureMarkdownSources;
     this.getCapturedSource = (value) => originalMarkdownSources.get(value);`,
    context,
  );

  context.captureMarkdownSources();
  element.innerHTML = "<mjx-container>already typeset</mjx-container>";
  context.captureMarkdownSources();
  assert.equal(context.getCapturedSource(element), String.raw`\[x=1\]`);

  assert.match(
    source,
    /const original\s*=\s*originalMarkdownSources\.get\(el\)\s*\?\?\s*el\.innerHTML/,
  );
  assert.match(
    source,
    /async function init\(\)[\s\S]*?captureMarkdownSources\(\);[\s\S]*?await window\[RESOURCE_PROMISE_KEY\]/,
  );
  assert.match(
    source,
    /captureMarkdownSources\(\);\s*\n\s*if \(document\.readyState === "loading"\)/,
  );
});
