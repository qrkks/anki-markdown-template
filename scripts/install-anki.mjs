import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {
  KATEX_VERSION,
  MANAGED_RESOURCE_PATTERNS,
  RESOURCE_MANIFEST,
} from "./resource-manifest.mjs";

const releaseConfig = JSON.parse(
  await readFile(
    new URL("../config/vocabulary-release.json", import.meta.url),
    "utf8",
  ),
);

export const MODEL_NAME = releaseConfig.noteTypeName;
export const MODEL_ID = releaseConfig.modelId;
export const TEMPLATE_NAMES = Object.keys(releaseConfig.templateIds);
export const TEMPLATE_NAME = TEMPLATE_NAMES[0];
export const REQUIRED_FIELDS = Object.keys(releaseConfig.fieldIds);

const LEGACY_FIELDS = new Map([
  ["词性 1", "词性1"],
  ["释义 1", "释义1"],
  ["词性 2", "词性2"],
  ["释义 2", "释义2"],
]);

export async function ankiRequest(action, params = {}) {
  const endpoint = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {"content-type": "application/json; charset=utf-8"},
      body: JSON.stringify({action, version: 6, params}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(
      `无法连接 AnkiConnect (${endpoint})。请确认 Anki 正在运行并已启用 AnkiConnect。`,
      {cause: error},
    );
  }

  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP ${response.status}: ${response.statusText}`);
  }
  const payload = await response.json();
  if (payload.error) throw new Error(`AnkiConnect ${action}: ${payload.error}`);
  return payload.result;
}

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function transformResource(resource, data) {
  if (resource.transform !== "katex-css") return data;

  const transformed = data
    .toString("utf8")
    .replace(
      /,url\(fonts\/[^)]*\.woff\) format\("woff"\),url\(fonts\/[^)]*\.ttf\) format\("truetype"\)/g,
      "",
    )
    .replace(
      /url\(fonts\/([^)]+\.woff2)\)/g,
      (_, name) => `url(_katex-${KATEX_VERSION}-font-${name})`,
    );
  if (/url\(fonts\//.test(transformed)) {
    throw new Error("KaTeX CSS 中仍有未转换的字体路径。");
  }
  return Buffer.from(transformed, "utf8");
}

async function defaultDownloadResource(resource) {
  const response = await fetch(resource.url, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(
      `下载 ${resource.filename} 失败：HTTP ${response.status} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function findManagedMedia(request, patterns) {
  const files = new Set();
  for (const pattern of patterns) {
    const matches = await request("getMediaFilesNames", {pattern});
    for (const filename of matches || []) files.add(filename);
  }
  return [...files].sort();
}

export async function syncResources({
  request = ankiRequest,
  dryRun = false,
  pruneResources = false,
  resourceManifest = RESOURCE_MANIFEST,
  managedResourcePatterns = MANAGED_RESOURCE_PATTERNS,
  downloadResource = defaultDownloadResource,
  log = console.log,
} = {}) {
  if (resourceManifest.length === 0 && managedResourcePatterns.length === 0) {
    return {
      current: [],
      missing: [],
      mismatched: [],
      oldFiles: [],
      updated: [],
      deleted: [],
    };
  }

  const expectedNames = new Set(resourceManifest.map(({filename}) => filename));
  const missing = [];
  const mismatched = [];
  const current = [];

  for (const resource of resourceManifest) {
    const encoded = await request("retrieveMediaFile", {
      filename: resource.filename,
    });
    if (!encoded) {
      missing.push(resource);
      continue;
    }
    const actualHash = sha256(Buffer.from(encoded, "base64"));
    if (actualHash === resource.sha256) current.push(resource);
    else mismatched.push(resource);
  }

  const managedMedia = await findManagedMedia(request, managedResourcePatterns);
  const oldFiles = managedMedia.filter((filename) => !expectedNames.has(filename));
  if (oldFiles.length) {
    log(
      `发现 ${oldFiles.length} 个旧版受管资源，默认保留：${oldFiles.join("、")}`,
    );
  }

  const pending = [...missing, ...mismatched];
  if (dryRun) {
    log(
      `[dry-run] 资源：${current.length} 个有效，${missing.length} 个缺失，${mismatched.length} 个校验不符。`,
    );
    if (pruneResources && oldFiles.length) {
      log(`[dry-run] 将删除 ${oldFiles.length} 个旧版受管资源。`);
    }
    return {
      current: current.map(({filename}) => filename),
      missing: missing.map(({filename}) => filename),
      mismatched: mismatched.map(({filename}) => filename),
      oldFiles,
      updated: [],
      deleted: [],
    };
  }

  const updated = [];
  for (const resource of pending) {
    const downloaded = await downloadResource(resource);
    const data = transformResource(resource, Buffer.from(downloaded));
    const actualHash = sha256(data);
    if (actualHash !== resource.sha256) {
      throw new Error(
        `${resource.filename} SHA-256 校验失败：期望 ${resource.sha256}，实际 ${actualHash}`,
      );
    }
    const stored = await request("storeMediaFile", {
      filename: resource.filename,
      data: data.toString("base64"),
    });
    if (stored !== resource.filename) {
      throw new Error(`Anki 未确认写入资源：${resource.filename}`);
    }
    updated.push(resource.filename);
    log(`已安装资源：${resource.filename}`);
  }

  const deleted = [];
  if (pruneResources) {
    for (const filename of oldFiles) {
      await request("deleteMediaFile", {filename});
      deleted.push(filename);
      log(`已删除旧版资源：${filename}`);
    }
  }

  return {
    current: current.map(({filename}) => filename),
    missing: missing.map(({filename}) => filename),
    mismatched: mismatched.map(({filename}) => filename),
    oldFiles,
    updated,
    deleted,
  };
}

async function loadArtifacts() {
  const base = "dist/english-vocabulary";
  const [front, back, spellingFront, spellingBack, dictationFront, dictationBack, css] =
    await Promise.all([
    readFile(path.join(base, "recite/front.html"), "utf8"),
    readFile(path.join(base, "recite/back.html"), "utf8"),
    readFile(path.join(base, "spelling/front.html"), "utf8"),
    readFile(path.join(base, "spelling/back.html"), "utf8"),
    readFile(path.join(base, "dictation/front.html"), "utf8"),
    readFile(path.join(base, "dictation/back.html"), "utf8"),
    readFile(path.join(base, "styling.css"), "utf8"),
  ]);
  return {
    templates: {
      RECITE: {Front: front, Back: back},
      SPELLING: {Front: spellingFront, Back: spellingBack},
      DICTATION: {Front: dictationFront, Back: dictationBack},
    },
    css,
  };
}

export function validateExistingModel(modelId, fields, templates) {
  if (modelId !== MODEL_ID) {
    throw new Error(
      `笔记类型“${MODEL_NAME}”的 ID 为 ${modelId}，与受管模板 ID ${MODEL_ID} 不同；为避免覆盖同名模板，已停止。`,
    );
  }
  const missing = REQUIRED_FIELDS.filter((field) => !fields.includes(field));
  if (missing.length) {
    const migrations = missing
      .map((field) => [LEGACY_FIELDS.get(field), field])
      .filter(([legacy]) => legacy && fields.includes(legacy));
    if (migrations.length) {
      const details = migrations
        .map(([legacy, current]) => `${legacy} → ${current}`)
        .join("，");
      throw new Error(`检测到旧字段名。请先在 Anki 的“字段…”窗口重命名：${details}`);
    }
    throw new Error(`笔记类型“${MODEL_NAME}”缺少字段：${missing.join("，")}`);
  }
  const missingTemplates = TEMPLATE_NAMES.filter(
    (name) => !Object.hasOwn(templates, name),
  );
  if (missingTemplates.length) {
    throw new Error(
      `笔记类型“${MODEL_NAME}”缺少卡片模板：${missingTemplates.join("，")}`,
    );
  }
}

export function getVocabularyFieldOrderChanges(fields) {
  const plannedFields = [...fields];
  const changes = [];

  const moveAfter = (fieldName, targetName, description) => {
    const fieldIndex = plannedFields.indexOf(fieldName);
    const targetIndex = plannedFields.indexOf(targetName);
    if (fieldIndex < 0 || targetIndex < 0 || fieldIndex === targetIndex + 1) return;
    plannedFields.splice(fieldIndex, 1);
    const index = plannedFields.indexOf(targetName) + 1;
    plannedFields.splice(index, 0, fieldName);
    changes.push({fieldName, index, description});
  };

  const moveBeforeWhenReversed = (fieldName, targetName, description) => {
    const fieldIndex = plannedFields.indexOf(fieldName);
    const targetIndex = plannedFields.indexOf(targetName);
    if (fieldIndex < 0 || targetIndex < 0 || fieldIndex < targetIndex) return;
    plannedFields.splice(fieldIndex, 1);
    const index = plannedFields.indexOf(targetName);
    plannedFields.splice(index, 0, fieldName);
    changes.push({fieldName, index, description});
  };

  moveAfter("发音", "音标", "发音移至音标后");
  moveBeforeWhenReversed("词组短语", "拓展", "词组短语移至拓展前");
  return changes;
}

async function defaultSaveBackup(data) {
  const directory = ".anki-backups";
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const file = path.join(directory, `${MODEL_NAME}-${timestamp}.json`);
  await mkdir(directory, {recursive: true});
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return file;
}

export async function installAnki({
  request = ankiRequest,
  dryRun = false,
  pruneResources = false,
  resourceManifest = RESOURCE_MANIFEST,
  managedResourcePatterns = MANAGED_RESOURCE_PATTERNS,
  downloadResource = defaultDownloadResource,
  saveBackup = defaultSaveBackup,
  log = console.log,
} = {}) {
  const artifacts = await loadArtifacts();
  const version = await request("version");
  if (version < 6) throw new Error(`需要 AnkiConnect API 6，当前为 ${version}。`);

  const resources = await syncResources({
    request,
    dryRun,
    pruneResources,
    resourceManifest,
    managedResourcePatterns,
    downloadResource,
    log,
  });

  const modelNamesAndIds = await request("modelNamesAndIds");
  if (!Object.hasOwn(modelNamesAndIds, MODEL_NAME)) {
    throw new Error(
      `未找到笔记类型“${MODEL_NAME}”。请先导入 ${releaseConfig.artifactName}，再运行本更新器。`,
    );
  }

  const fields = await request("modelFieldNames", {modelName: MODEL_NAME});
  const templates = await request("modelTemplates", {modelName: MODEL_NAME});
  const styling = await request("modelStyling", {modelName: MODEL_NAME});
  validateExistingModel(modelNamesAndIds[MODEL_NAME], fields, templates);
  const fieldOrderChanges = getVocabularyFieldOrderChanges(fields);

  const changedTemplates = TEMPLATE_NAMES.filter((name) => {
    const current = templates[name];
    const expected = artifacts.templates[name];
    return current.Front !== expected.Front || current.Back !== expected.Back;
  });
  const templateChanged = changedTemplates.length > 0;
  const stylingChanged = styling.css !== artifacts.css;
  if (!templateChanged && !stylingChanged && fieldOrderChanges.length === 0) {
    log(`Anki 笔记类型“${MODEL_NAME}”已经是最新版本。`);
    const resourcesChanged = resources.updated.length > 0 || resources.deleted.length > 0;
    return {action: resourcesChanged ? "resources" : "none", resources};
  }

  if (dryRun) {
    log(
      `[dry-run] 将更新：${[
        templateChanged && `${changedTemplates.join("/")} 正反面`,
        stylingChanged && "共享 CSS",
        fieldOrderChanges.length > 0 &&
          `字段顺序（${fieldOrderChanges.map(({description}) => description).join("、")}）`,
      ]
        .filter(Boolean)
        .join("、")}。`,
    );
    return {action: "update", templateChanged, stylingChanged, resources};
  }

  const backup = await saveBackup({
    modelName: MODEL_NAME,
    templateName: TEMPLATE_NAME,
    fields,
    templates,
    css: styling.css,
  });
  if (templateChanged) {
    await request("updateModelTemplates", {
      model: {
        name: MODEL_NAME,
        templates: Object.fromEntries(
          changedTemplates.map((name) => [name, artifacts.templates[name]]),
        ),
      },
    });
  }
  if (stylingChanged) {
    await request("updateModelStyling", {
      model: {name: MODEL_NAME, css: artifacts.css},
    });
  }
  for (const {fieldName, index} of fieldOrderChanges) {
    await request("modelFieldReposition", {modelName: MODEL_NAME, fieldName, index});
  }
  if (fieldOrderChanges.length > 0) {
    const updatedFields = await request("modelFieldNames", {modelName: MODEL_NAME});
    if (getVocabularyFieldOrderChanges(updatedFields).length > 0) {
      throw new Error("字段顺序读回验证失败。");
    }
  }
  log(`已更新 Anki；原模板备份：${backup}`);
  return {
    action: "update",
    templateChanged,
    stylingChanged,
    fieldOrderChanged: fieldOrderChanges.length > 0,
    backup,
    resources,
  };
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  installAnki({
    dryRun: process.argv.includes("--dry-run"),
    pruneResources: process.argv.includes("--prune-resources"),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
