import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const configs = await Promise.all(
  ["basic-release.json", "vocabulary-release.json"].map(async (filename) =>
    JSON.parse(
      await readFile(path.join(root, "config", filename), "utf8"),
    ),
  ),
);

const lines = [];
for (const {artifactName} of configs) {
  const artifact = await readFile(path.join(root, "release", artifactName));
  const hash = createHash("sha256").update(artifact).digest("hex");
  lines.push(`${hash}  ${artifactName}`);
}

await writeFile(
  path.join(root, "release", "SHA256SUMS.txt"),
  `${lines.join("\n")}\n`,
  "utf8",
);
console.log("已生成两个公开 APKG 的 SHA256SUMS.txt。");
