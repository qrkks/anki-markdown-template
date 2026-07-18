import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

export const MODEL_NAME = "单词";
export const TEMPLATE_NAMES = ["RECITE", "SPELLING", "DICTATION"];
export const TEMPLATE_NAME = TEMPLATE_NAMES[0];
export const REQUIRED_FIELDS = [
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
      signal: AbortSignal.timeout(5000),
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

export function validateExistingModel(fields, templates) {
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
  saveBackup = defaultSaveBackup,
  log = console.log,
} = {}) {
  const artifacts = await loadArtifacts();
  const version = await request("version");
  if (version < 6) throw new Error(`需要 AnkiConnect API 6，当前为 ${version}。`);

  const modelNames = await request("modelNames");
  if (!modelNames.includes(MODEL_NAME)) {
    if (dryRun) {
      log(`[dry-run] 将创建笔记类型“${MODEL_NAME}”及三套卡片模板。`);
      return {action: "create"};
    }
    await request("createModel", {
      modelName: MODEL_NAME,
      inOrderFields: REQUIRED_FIELDS,
      cardTemplates: TEMPLATE_NAMES.map((name) => ({
        Name: name,
        ...artifacts.templates[name],
      })),
      css: artifacts.css,
      isCloze: false,
    });
    log(`已创建 Anki 笔记类型“${MODEL_NAME}”及三套卡片模板。`);
    return {action: "create"};
  }

  const fields = await request("modelFieldNames", {modelName: MODEL_NAME});
  const templates = await request("modelTemplates", {modelName: MODEL_NAME});
  const styling = await request("modelStyling", {modelName: MODEL_NAME});
  validateExistingModel(fields, templates);

  const changedTemplates = TEMPLATE_NAMES.filter((name) => {
    const current = templates[name];
    const expected = artifacts.templates[name];
    return current.Front !== expected.Front || current.Back !== expected.Back;
  });
  const templateChanged = changedTemplates.length > 0;
  const stylingChanged = styling.css !== artifacts.css;
  if (!templateChanged && !stylingChanged) {
    log(`Anki 笔记类型“${MODEL_NAME}”已经是最新版本。`);
    return {action: "none"};
  }

  if (dryRun) {
    log(
      `[dry-run] 将更新：${[
        templateChanged && `${changedTemplates.join("/")} 正反面`,
        stylingChanged && "共享 CSS",
      ]
        .filter(Boolean)
        .join("、")}。`,
    );
    return {action: "update", templateChanged, stylingChanged};
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
  log(`已更新 Anki；原模板备份：${backup}`);
  return {action: "update", templateChanged, stylingChanged, backup};
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  installAnki({dryRun: process.argv.includes("--dry-run")}).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
