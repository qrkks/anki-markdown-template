import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {ankiRequest, syncResources} from "./install-anki.mjs";
import {
  MANAGED_RESOURCE_PATTERNS,
  RESOURCE_MANIFEST,
} from "./resource-manifest.mjs";

const releaseConfig = JSON.parse(
  await readFile(new URL("../config/basic-release.json", import.meta.url), "utf8"),
);

export const BASIC_MODEL_NAME = releaseConfig.noteTypeName;
export const BASIC_MODEL_ID = releaseConfig.modelId;
export const BASIC_TEMPLATE_NAME = releaseConfig.cardTemplateName;
export const BASIC_REQUIRED_FIELDS = Object.keys(releaseConfig.fieldIds);

export function normalizeAnkiText(value) {
  return value.replaceAll("\r\n", "\n");
}

async function loadArtifacts() {
  const [front, back, css] = await Promise.all([
    readFile(new URL("../dist/basic/front.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/basic/back.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/basic/styling.css", import.meta.url), "utf8"),
  ]);
  return {template: {Front: front, Back: back}, css};
}

export function validateBasicModel(modelNamesAndIds, fields, templates) {
  const modelId = modelNamesAndIds[BASIC_MODEL_NAME];
  if (modelId == null) {
    throw new Error(
      `找不到笔记类型“${BASIC_MODEL_NAME}”。请先导入 release/${releaseConfig.artifactName}。`,
    );
  }
  if (modelId !== BASIC_MODEL_ID) {
    throw new Error(
      `笔记类型“${BASIC_MODEL_NAME}”的 ID 为 ${modelId}，与受管模板 ID ${BASIC_MODEL_ID} 不同；为避免覆盖同名模板，已停止。`,
    );
  }

  const missingFields = BASIC_REQUIRED_FIELDS.filter(
    (field) => !fields.includes(field),
  );
  if (missingFields.length) {
    throw new Error(
      `笔记类型“${BASIC_MODEL_NAME}”缺少字段：${missingFields.join("、")}。`,
    );
  }
  if (!templates[BASIC_TEMPLATE_NAME]) {
    throw new Error(
      `笔记类型“${BASIC_MODEL_NAME}”缺少卡片模板“${BASIC_TEMPLATE_NAME}”。`,
    );
  }
}

async function defaultSaveBackup(data) {
  const directory = ".anki-backups";
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const file = path.join(directory, `${BASIC_MODEL_NAME}-${timestamp}.json`);
  await mkdir(directory, {recursive: true});
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return file;
}

export async function installMarkdownBasic({
  request = ankiRequest,
  dryRun = false,
  resourceManifest = RESOURCE_MANIFEST,
  managedResourcePatterns = MANAGED_RESOURCE_PATTERNS,
  downloadResource,
  saveBackup = defaultSaveBackup,
  log = console.log,
} = {}) {
  const artifacts = await loadArtifacts();
  const version = await request("version");
  if (version < 6) throw new Error(`需要 AnkiConnect API 6，当前为 ${version}。`);

  const modelNamesAndIds = await request("modelNamesAndIds");
  const [fields, templates, styling] = await Promise.all([
    request("modelFieldNames", {modelName: BASIC_MODEL_NAME}),
    request("modelTemplates", {modelName: BASIC_MODEL_NAME}),
    request("modelStyling", {modelName: BASIC_MODEL_NAME}),
  ]);
  validateBasicModel(modelNamesAndIds, fields, templates);

  const current = templates[BASIC_TEMPLATE_NAME];
  const templateChanged =
    normalizeAnkiText(current.Front) !== normalizeAnkiText(artifacts.template.Front) ||
    normalizeAnkiText(current.Back) !== normalizeAnkiText(artifacts.template.Back);
  const stylingChanged =
    normalizeAnkiText(styling.css) !== normalizeAnkiText(artifacts.css);

  const resources = await syncResources({
    request,
    dryRun,
    resourceManifest,
    managedResourcePatterns,
    downloadResource,
    log,
  });

  if (!templateChanged && !stylingChanged) {
    log(`Anki 笔记类型“${BASIC_MODEL_NAME}”已经是最新版本。`);
    return {action: resources.updated.length ? "resources" : "none", resources};
  }
  if (dryRun) {
    const changes = [
      templateChanged && `${BASIC_TEMPLATE_NAME} 正反面`,
      stylingChanged && "CSS",
    ].filter(Boolean);
    log(`[dry-run] 将更新“${BASIC_MODEL_NAME}”的${changes.join("和")}。`);
    return {action: "update", templateChanged, stylingChanged, resources};
  }

  const backup = await saveBackup({
    modelName: BASIC_MODEL_NAME,
    modelId: BASIC_MODEL_ID,
    templateName: BASIC_TEMPLATE_NAME,
    fields,
    templates,
    css: styling.css,
  });
  if (templateChanged) {
    await request("updateModelTemplates", {
      model: {
        name: BASIC_MODEL_NAME,
        templates: {[BASIC_TEMPLATE_NAME]: artifacts.template},
      },
    });
  }
  if (stylingChanged) {
    await request("updateModelStyling", {
      model: {name: BASIC_MODEL_NAME, css: artifacts.css},
    });
  }
  log(`已更新“${BASIC_MODEL_NAME}”；原模板备份：${backup}`);
  return {action: "update", templateChanged, stylingChanged, backup, resources};
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  installMarkdownBasic({
    dryRun: process.argv.includes("--dry-run"),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
