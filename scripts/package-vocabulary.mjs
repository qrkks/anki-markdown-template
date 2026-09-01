import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {sha256, transformResource} from "./install-anki.mjs";
import {RESOURCE_MANIFEST} from "./resource-manifest.mjs";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const releaseConfig = JSON.parse(
  await readFile(path.join(root, "config/vocabulary-release.json"), "utf8"),
);
const sourceDateEpoch = Number.parseInt(
  process.env.SOURCE_DATE_EPOCH || `${Math.floor(Date.now() / 1000)}`,
  10,
);

if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch <= 0) {
  throw new Error("SOURCE_DATE_EPOCH 必须是正整数 Unix 时间戳。");
}

async function downloadResource(resource, mediaDirectory) {
  const response = await fetch(resource.url, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(
      `下载 ${resource.filename} 失败：HTTP ${response.status} ${response.statusText}`,
    );
  }

  const transformed = transformResource(
    resource,
    Buffer.from(await response.arrayBuffer()),
  );
  const actualHash = sha256(transformed);
  if (actualHash !== resource.sha256) {
    throw new Error(
      `${resource.filename} SHA-256 校验失败：期望 ${resource.sha256}，实际 ${actualHash}`,
    );
  }

  const destination = path.join(mediaDirectory, resource.filename);
  await writeFile(destination, transformed);
  await utimes(destination, sourceDateEpoch, sourceDateEpoch);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      shell: false,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `${command} 失败${signal ? `（信号 ${signal}）` : `（退出码 ${code}）`}`,
          ),
        );
      }
    });
  });
}

const stagingDirectory = await mkdtemp(
  path.join(os.tmpdir(), "anki-english-vocabulary-"),
);
const resolvedTemp = `${path.resolve(os.tmpdir())}${path.sep}`;
if (!path.resolve(stagingDirectory).startsWith(resolvedTemp)) {
  throw new Error(`临时目录不在系统临时目录内：${stagingDirectory}`);
}

try {
  const mediaDirectory = path.join(stagingDirectory, "media");
  const releaseDirectory = path.join(root, "release");
  const artifactPath = path.join(releaseDirectory, releaseConfig.artifactName);
  await Promise.all([
    mkdir(mediaDirectory),
    mkdir(releaseDirectory, {recursive: true}),
  ]);

  await Promise.all(
    RESOURCE_MANIFEST.map((resource) =>
      downloadResource(resource, mediaDirectory),
    ),
  );

  const uv = process.env.UV || "uv";
  await run(uv, [
    "run",
    "--script",
    "scripts/build-vocabulary-apkg.py",
    "--config",
    "config/vocabulary-release.json",
    "--template",
    "RECITE",
    "dist/english-vocabulary/recite/front.html",
    "dist/english-vocabulary/recite/back.html",
    "--template",
    "SPELLING",
    "dist/english-vocabulary/spelling/front.html",
    "dist/english-vocabulary/spelling/back.html",
    "--template",
    "DICTATION",
    "dist/english-vocabulary/dictation/front.html",
    "dist/english-vocabulary/dictation/back.html",
    "--styling",
    "dist/english-vocabulary/styling.css",
    "--media-directory",
    mediaDirectory,
    "--output",
    artifactPath,
    "--version",
    packageJson.version,
    "--timestamp",
    `${sourceDateEpoch}`,
  ]);

  const artifact = await readFile(artifactPath);
  const artifactHash = createHash("sha256").update(artifact).digest("hex");
  await writeFile(
    path.join(releaseDirectory, "SHA256SUMS.txt"),
    `${artifactHash}  ${releaseConfig.artifactName}\n`,
    "utf8",
  );
  console.log(
    `已生成 ${path.relative(root, artifactPath)}（${artifact.length} bytes，SHA-256 ${artifactHash}）。`,
  );
} finally {
  await rm(stagingDirectory, {recursive: true, force: true});
}
