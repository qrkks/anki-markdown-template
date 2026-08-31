import path from "node:path";
import {pathToFileURL} from "node:url";
import {installAnki, MODEL_NAME} from "./install-anki.mjs";
import {
  BASIC_MODEL_NAME,
  installMarkdownBasic,
} from "./install-basic-anki.mjs";
import {
  migrateObsidianBasic,
  OBSIDIAN_MODEL_NAME,
} from "./migrate-obsidian-basic.mjs";
import {RESOURCE_MANIFEST} from "./resource-manifest.mjs";

export const EXCLUDED_LEGACY_MODELS = [
  "KaTeX and Markdown Basic",
  "KaTeX and Markdown Cloze",
];

const DEFAULT_TARGETS = [
  {name: MODEL_NAME, install: installAnki},
  {name: BASIC_MODEL_NAME, install: installMarkdownBasic},
  {name: OBSIDIAN_MODEL_NAME, install: migrateObsidianBasic},
];

const NO_RESOURCES = {
  resourceManifest: [],
  managedResourcePatterns: [],
};

function resourceChanges(result) {
  return (
    (result.resources?.missing?.length || 0) +
    (result.resources?.mismatched?.length || 0)
  );
}

export function describeSyncResult(name, result) {
  const pendingResources = resourceChanges(result);
  const templateState =
    result.action === "create"
      ? "将创建"
      : result.action === "update"
        ? "将更新"
        : "模板已是最新";
  const resourceState = pendingResources
    ? `，${pendingResources} 个资源需要同步`
    : "，资源完整";
  return `${name}：${templateState}${resourceState}`;
}

async function runTargets({
  targets,
  dryRun,
  resourceOptions,
  request,
  log,
}) {
  const results = [];
  for (const [index, target] of targets.entries()) {
    log(`${dryRun ? "[预检]" : "[同步]"} ${target.name}`);
    const options = {
      dryRun,
      log,
      ...(request ? {request} : {}),
      ...(index === 0 ? (resourceOptions ?? {}) : NO_RESOURCES),
    };
    results.push({
      name: target.name,
      result: await target.install(options),
    });
  }
  return results;
}

function pendingResourceOptions(preflight) {
  const resources = preflight[0]?.result.resources;
  const pendingNames = new Set([
    ...(resources?.missing || []),
    ...(resources?.mismatched || []),
  ]);
  if (pendingNames.size === 0) return NO_RESOURCES;

  const pendingManifest = RESOURCE_MANIFEST.filter(({filename}) =>
    pendingNames.has(filename),
  );
  if (pendingManifest.length !== pendingNames.size) {
    throw new Error("资源预检结果与当前资源清单不一致；已停止同步。");
  }
  return {
    resourceManifest: pendingManifest,
    managedResourcePatterns: [],
  };
}

function assertVerified(results) {
  const stale = results.filter(
    ({result}) => result.action !== "none" || resourceChanges(result) > 0,
  );
  if (stale.length) {
    throw new Error(
      `同步后回读仍不一致：${stale.map(({name}) => name).join("、")}。`,
    );
  }
}

export async function syncManagedAnki({
  dryRun = false,
  audit = false,
  targets = DEFAULT_TARGETS,
  request,
  log = console.log,
} = {}) {
  const previewOnly = dryRun || audit;
  log(`开始预检 ${targets.length} 个受管笔记类型；此阶段不会修改 Anki。`);
  const preflight = await runTargets({
    targets,
    dryRun: true,
    request,
    log,
  });
  log("预检结果：");
  for (const {name, result} of preflight) {
    log(`- ${describeSyncResult(name, result)}`);
  }
  log(`明确排除旧渲染器：${EXCLUDED_LEGACY_MODELS.join("、")}。`);

  if (previewOnly) {
    log(audit ? "审计完成；未修改 Anki。" : "同步预检完成；未修改 Anki。");
    return {mode: audit ? "audit" : "dry-run", preflight};
  }

  log("预检通过，开始同步。");
  const synchronized = await runTargets({
    targets,
    dryRun: false,
    resourceOptions: pendingResourceOptions(preflight),
    request,
    log,
  });

  const verified = await runTargets({
    targets,
    dryRun: true,
    resourceOptions: NO_RESOURCES,
    request,
    log() {},
  });
  assertVerified(verified);
  log(`回读验证通过：${targets.length} 个受管笔记类型均与当前仓库一致。`);
  return {mode: "sync", preflight, synchronized, verified};
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  syncManagedAnki({
    dryRun: process.argv.includes("--dry-run"),
    audit: process.argv.includes("--audit"),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
