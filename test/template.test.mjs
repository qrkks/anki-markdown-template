import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import {
  MODEL_NAME,
  REQUIRED_FIELDS,
  TEMPLATE_NAME,
  TEMPLATE_NAMES,
  installAnki,
  sha256,
  syncResources,
  transformResource,
  validateExistingModel,
} from "../scripts/install-anki.mjs";
import {RESOURCE_MANIFEST} from "../scripts/resource-manifest.mjs";

function extractFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notEqual(end, -1, `${nextName} should follow ${name}`);
  return source.slice(start, end);
}

test("generated artifacts use pure CSS and executable card templates", async () => {
  const [styling, front, back] = await Promise.all([
    readFile("dist/styling.css", "utf8"),
    readFile("dist/front.html", "utf8"),
    readFile("dist/back.html", "utf8"),
  ]);

  assert.doesNotMatch(styling, /<\/?(?:style|script)>/i);
  assert.match(front, /{{Front}}/);
  assert.match(front, /id=["']front["']/);
  assert.match(front, /<script>/);
  assert.match(back, /{{FrontSide}}/);
  assert.match(back, /id=["']answer["']/);
  assert.match(back, /{{Back}}/);
  assert.match(back, /id=["']back["']/);
  assert.match(back, /<script>/);
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

test("SPELLING and DICTATION use the shared card layout", async () => {
  for (const name of ["spelling", "dictation"]) {
    const [front, back] = await Promise.all([
      readFile(`dist/english-vocabulary/${name}/front.html`, "utf8"),
      readFile(`dist/english-vocabulary/${name}/back.html`, "utf8"),
    ]);
    assert.match(front, /class=["'][^"']*\bfront-content\b/);
    assert.match(front, /class=["'][^"']*\bcat\b/);
    assert.match(back, /id=["']answer["']/);
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
    () => validateExistingModel(legacyFields, {[TEMPLATE_NAME]: {}}),
    /检测到旧字段名/,
  );
});

test("Anki installer updates all managed templates and shared styling", async () => {
  const actions = [];
  const currentTemplates = {
    [TEMPLATE_NAME]: {Front: "old front", Back: "old back"},
    SPELLING: {Front: "keep", Back: "keep"},
    DICTATION: {Front: "keep", Back: "keep"},
    UNMANAGED: {Front: "keep", Back: "keep"},
  };
  const request = async (action, params) => {
    actions.push({action, params});
    if (action === "version") return 6;
    if (action === "modelNames") return [MODEL_NAME];
    if (action === "modelFieldNames") return REQUIRED_FIELDS;
    if (action === "modelTemplates") return currentTemplates;
    if (action === "modelStyling") return {css: "old css"};
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

test("cleanHTML preserves Markdown indentation and literal HTML entities", async () => {
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
  assert.match(
    source,
    /escapeHtml\(decodeHtmlEntities\(str\)\)/,
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
  assert.match(source, /protectMathDelimiters\(cleanHTML\(original\)\)/);
  assert.match(source, /restoreMathDelimiters\(md\.render\(text\)\)/);
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
