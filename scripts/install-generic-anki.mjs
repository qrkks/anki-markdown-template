import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {ankiRequest, syncResources} from "./install-anki.mjs";
import {
  MANAGED_RESOURCE_PATTERNS,
  RESOURCE_MANIFEST,
} from "./resource-manifest.mjs";

export const GENERIC_MODEL_NAME = "Obsidian-basic";
export const GENERIC_TEMPLATE_NAME = "Front / Back";
export const GENERIC_REQUIRED_FIELDS = ["Front", "Back"];

export function relaxGlobalFontSelector(styling) {
  if (typeof styling !== "string") return "";
  return styling.replace(
    /^([ \t]*)#front,(\r?\n)\1#back,\2\1#front \*,\2\1#back \* \{/m,
    (_, indent, newline) => `${indent}#front,${newline}${indent}#back {`,
  );
}

export function replaceManagedRuntime(template, runtime) {
  const scripts = [...template.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)];
  const managed = scripts.filter(({0: source}) =>
    source.includes("ankiMarkdownResourcePromise"),
  );
  if (managed.length !== 1) {
    throw new Error(
      `预期找到 1 个通用渲染器脚本，实际找到 ${managed.length} 个；未修改模板。`,
    );
  }

  const [{0: previous, index}] = managed;
  const replacement = `<script>\n${runtime.trim()}\n</script>`;
  return `${template.slice(0, index)}${replacement}${template.slice(index + previous.length)}`;
}

async function loadRuntime() {
  return readFile("src/template.js", "utf8");
}

async function defaultSaveBackup(data) {
  const directory = ".anki-backups";
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const file = path.join(directory, `${GENERIC_MODEL_NAME}-${timestamp}.json`);
  await mkdir(directory, {recursive: true});
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return file;
}

export async function installGenericAnki({
  request = ankiRequest,
  dryRun = false,
  resourceManifest = RESOURCE_MANIFEST,
  managedResourcePatterns = MANAGED_RESOURCE_PATTERNS,
  downloadResource,
  saveBackup = defaultSaveBackup,
  log = console.log,
} = {}) {
  const version = await request("version");
  if (version < 6) throw new Error(`需要 AnkiConnect API 6，当前为 ${version}。`);

  const modelNames = await request("modelNames");
  if (!modelNames.includes(GENERIC_MODEL_NAME)) {
    throw new Error(`找不到笔记类型“${GENERIC_MODEL_NAME}”。`);
  }

  const [fields, templates, styling, runtime] = await Promise.all([
    request("modelFieldNames", {modelName: GENERIC_MODEL_NAME}),
    request("modelTemplates", {modelName: GENERIC_MODEL_NAME}),
    request("modelStyling", {modelName: GENERIC_MODEL_NAME}),
    loadRuntime(),
  ]);
  const missingFields = GENERIC_REQUIRED_FIELDS.filter(
    (field) => !fields.includes(field),
  );
  if (missingFields.length) {
    throw new Error(
      `笔记类型“${GENERIC_MODEL_NAME}”缺少字段：${missingFields.join("、")}。`,
    );
  }
  const current = templates[GENERIC_TEMPLATE_NAME];
  if (!current) {
    throw new Error(
      `笔记类型“${GENERIC_MODEL_NAME}”缺少卡片模板“${GENERIC_TEMPLATE_NAME}”。`,
    );
  }

  const expected = {
    Front: replaceManagedRuntime(current.Front, runtime),
    Back: replaceManagedRuntime(current.Back, runtime),
  };
  const expectedStyling = relaxGlobalFontSelector(styling.css);
  const templateChanged =
    current.Front !== expected.Front || current.Back !== expected.Back;
  const stylingChanged = styling.css !== expectedStyling;

  const resources = await syncResources({
    request,
    dryRun,
    resourceManifest,
    managedResourcePatterns,
    downloadResource,
    log,
  });

  if (!templateChanged && !stylingChanged) {
    log(
      `Anki 笔记类型“${GENERIC_MODEL_NAME}”已经使用最新通用渲染器和数学字体兼容样式。`,
    );
    return {action: resources.updated.length ? "resources" : "none", resources};
  }
  if (dryRun) {
    const changes = [
      templateChanged && "正反面通用渲染器",
      stylingChanged && "数学字体兼容样式",
    ].filter(Boolean);
    log(
      `[dry-run] 将更新“${GENERIC_MODEL_NAME} / ${GENERIC_TEMPLATE_NAME}”的${changes.join("和")}；保留其余卡面 HTML 与 CSS。`,
    );
    return {action: "update", templateChanged, stylingChanged, resources};
  }

  const backup = await saveBackup({
    modelName: GENERIC_MODEL_NAME,
    templateName: GENERIC_TEMPLATE_NAME,
    fields,
    templates,
    css: styling.css,
  });
  if (templateChanged) {
    await request("updateModelTemplates", {
      model: {
        name: GENERIC_MODEL_NAME,
        templates: {[GENERIC_TEMPLATE_NAME]: expected},
      },
    });
  }
  if (stylingChanged) {
    await request("updateModelStyling", {
      model: {name: GENERIC_MODEL_NAME, css: expectedStyling},
    });
  }
  log(
    `已更新“${GENERIC_MODEL_NAME} / ${GENERIC_TEMPLATE_NAME}”通用渲染器和数学字体兼容样式；原模板备份：${backup}`,
  );
  return {action: "update", templateChanged, stylingChanged, backup, resources};
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  installGenericAnki({
    dryRun: process.argv.includes("--dry-run"),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
