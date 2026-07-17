import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

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
  assert.match(back, /{{Back}}/);
  assert.match(back, /id=["']back["']/);
  assert.match(back, /<script>/);
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
    context.cleanHTML('<div class="callout"><strong>HTML</strong></div>'),
    '<div class="callout"><strong>HTML</strong></div>',
  );
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
