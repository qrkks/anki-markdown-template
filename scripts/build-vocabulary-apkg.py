# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = [
#   "anki==25.09.4",
#   "genanki==0.13.1",
# ]
# ///

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory
from zipfile import ZIP_STORED, ZipFile, ZipInfo

import genanki
from anki import import_export_pb2
from anki.collection import Collection


EXPECTED_FIELDS = [
    "单词",
    "音标",
    "发音",
    "词性 1",
    "释义 1",
    "词性 2",
    "释义 2",
    "例句",
    "例句翻译",
    "词组短语",
    "拓展",
]
EXPECTED_TEMPLATES = ["RECITE", "SPELLING", "DICTATION"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build and verify the English Vocabulary APKG release artifact."
    )
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument(
        "--template",
        action="append",
        nargs=3,
        metavar=("NAME", "FRONT", "BACK"),
        required=True,
    )
    parser.add_argument("--styling", type=Path, required=True)
    parser.add_argument("--media-directory", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--timestamp", type=int, required=True)
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


def normalize_archive(path: Path, timestamp: int) -> None:
    """Rewrite ZIP metadata so identical inputs produce identical APKG bytes."""
    zip_epoch = max(timestamp, 315532800)
    date_time = datetime.fromtimestamp(zip_epoch, timezone.utc).timetuple()[:6]
    with ZipFile(path) as source:
        entries = [(item.filename, source.read(item)) for item in source.infolist()]

    with NamedTemporaryFile(
        dir=path.parent, prefix=f".{path.stem}-", suffix=".tmp", delete=False
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with ZipFile(temporary_path, "w", compression=ZIP_STORED) as target:
            for filename, content in entries:
                item = ZipInfo(filename, date_time)
                item.create_system = 0
                item.compress_type = ZIP_STORED
                target.writestr(item, content)
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def validate_config(config: dict[str, object]) -> None:
    expected_names = {
        "noteTypeName": "单词",
        "deckName": "English Vocabulary Demo",
        "artifactName": "anki-english-vocabulary.apkg",
    }
    for key, expected in expected_names.items():
        if config.get(key) != expected:
            raise ValueError(f"{key} 必须为 {expected!r}。")
    if list(config["fieldIds"]) != EXPECTED_FIELDS:
        raise ValueError("字段 ID 的名称或顺序不正确。")
    if list(config["templateIds"]) != EXPECTED_TEMPLATES:
        raise ValueError("卡片模板 ID 的名称或顺序不正确。")

    ids = [
        config["modelId"],
        config["deckId"],
        *config["fieldIds"].values(),
        *config["templateIds"].values(),
    ]
    if any(not isinstance(value, int) or value <= 0 for value in ids):
        raise ValueError("模型、牌组、字段和模板 ID 必须是正整数。")
    if len(ids) != len(set(ids)):
        raise ValueError("模型、牌组、字段和模板 ID 必须互不相同。")


def demo_fields(version: str) -> dict[str, str]:
    return {
        "单词": "release",
        "音标": "/rɪˈliːs/",
        "发音": "🔊 /rɪˈliːs/",
        "词性 1": "v.",
        "释义 1": "发布；发行；释放",
        "词性 2": "n.",
        "释义 2": "发布的版本；公开提供",
        "例句": "We **release** a verified package after every check passes.",
        "例句翻译": "我们在所有检查通过后发布已验证的安装包。",
        "词组短语": "## Common phrases\n\n- release notes\n- public release\n- release a new version",
        "拓展": rf"""## Markdown extension

Inline math: $E=mc^2$

\[
f(x) = x^2
\]

```python
version = "{version}"
```

```mermaid
flowchart LR
    Check --> Package --> Release
```

Template version: `{version}`""",
    }


def build_package(
    *,
    config: dict[str, object],
    templates: dict[str, dict[str, str]],
    styling: str,
    media_files: list[Path],
    output: Path,
    version: str,
    timestamp: int,
) -> dict[str, str]:
    model = genanki.Model(
        config["modelId"],
        config["noteTypeName"],
        fields=[
            {"name": name, "id": config["fieldIds"][name]}
            for name in EXPECTED_FIELDS
        ],
        templates=[
            {
                "name": name,
                "id": config["templateIds"][name],
                "qfmt": templates[name]["Front"],
                "afmt": templates[name]["Back"],
            }
            for name in EXPECTED_TEMPLATES
        ],
        css=styling,
    )
    deck = genanki.Deck(config["deckId"], config["deckName"])
    fields = demo_fields(version)
    note = genanki.Note(
        model=model,
        fields=[fields[name] for name in EXPECTED_FIELDS],
        tags=["english-vocabulary", "demo"],
        guid=genanki.guid_for(config["guidSeed"]),
    )
    deck.add_note(note)

    package = genanki.Package(deck)
    package.media_files = [str(path) for path in media_files]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    package.write_to_file(str(output), timestamp=float(timestamp))
    normalize_archive(output, timestamp)
    return fields


def verify_package(
    *,
    config: dict[str, object],
    templates: dict[str, dict[str, str]],
    styling: str,
    media_files: list[Path],
    output: Path,
    expected_fields: dict[str, str],
) -> None:
    expected_media = {path.name: sha256(path) for path in media_files}
    with ZipFile(output) as archive:
        media_map = json.loads(archive.read("media"))
        packaged_names = set(media_map.values())
        if packaged_names != set(expected_media):
            raise AssertionError("APKG 媒体清单与受管资源不一致。")

    with TemporaryDirectory(prefix="anki-english-vocabulary-verify-") as temporary:
        collection = Collection(str(Path(temporary) / "collection.anki2"))
        try:
            request = import_export_pb2.ImportAnkiPackageRequest(
                package_path=str(output.resolve()),
                options=import_export_pb2.ImportAnkiPackageOptions(
                    merge_notetypes=True,
                    update_notes=import_export_pb2.IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_ALWAYS,
                    update_notetypes=import_export_pb2.IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_ALWAYS,
                    with_scheduling=False,
                    with_deck_configs=False,
                ),
            )
            collection.import_anki_package(request)

            notetype = collection.models.by_name(config["noteTypeName"])
            if notetype is None or notetype["id"] != config["modelId"]:
                raise AssertionError("导入后的单词模型 ID 不正确。")
            fields = {
                field["name"]: field.get("id") for field in notetype["flds"]
            }
            if fields != config["fieldIds"]:
                raise AssertionError(f"导入后的字段或字段 ID 不正确：{fields}")

            imported_templates = {
                template["name"]: template for template in notetype["tmpls"]
            }
            if list(imported_templates) != EXPECTED_TEMPLATES:
                raise AssertionError("导入后的卡片模板名称或顺序不正确。")
            for name in EXPECTED_TEMPLATES:
                imported = imported_templates[name]
                if imported.get("id") != config["templateIds"][name]:
                    raise AssertionError(f"导入后的 {name} 模板 ID 不正确。")
                if normalized(imported["qfmt"]) != normalized(templates[name]["Front"]):
                    raise AssertionError(f"导入后的 {name} 正面与构建产物不一致。")
                if normalized(imported["afmt"]) != normalized(templates[name]["Back"]):
                    raise AssertionError(f"导入后的 {name} 背面与构建产物不一致。")
            if normalized(notetype["css"]) != normalized(styling):
                raise AssertionError("导入后的 Styling CSS 与构建产物不一致。")

            deck_names = {deck.name for deck in collection.decks.all_names_and_ids()}
            if config["deckName"] not in deck_names:
                raise AssertionError("导入后未找到英语词汇示例牌组。")
            note_ids = collection.find_notes(f'note:"{config["noteTypeName"]}"')
            if len(note_ids) != 1:
                raise AssertionError("示例牌组必须恰好包含一条单词笔记。")
            imported_note = collection.get_note(note_ids[0])
            for name, expected in expected_fields.items():
                if imported_note[name] != expected:
                    raise AssertionError(f"导入后的示例字段 {name} 不正确。")
            card_ids = collection.find_cards(f'note:"{config["noteTypeName"]}"')
            card_ords = sorted(collection.get_card(card_id).ord for card_id in card_ids)
            if card_ords != [0, 1, 2]:
                raise AssertionError(f"示例笔记必须生成三张卡片：{card_ords}")

            imported_media = {
                path.name: sha256(path)
                for path in Path(collection.media.dir()).iterdir()
                if path.is_file()
            }
            if imported_media != expected_media:
                raise AssertionError("导入后的媒体文件或 SHA-256 与构建输入不一致。")
        finally:
            collection.close()


def main() -> None:
    args = parse_args()
    config = json.loads(args.config.read_text(encoding="utf8"))
    validate_config(config)
    if args.output.name != config["artifactName"]:
        raise ValueError("输出文件名必须与 vocabulary-release.json 一致。")

    template_paths = {name: (Path(front), Path(back)) for name, front, back in args.template}
    if list(template_paths) != EXPECTED_TEMPLATES:
        raise ValueError("必须按 RECITE、SPELLING、DICTATION 顺序提供三套模板。")
    templates = {
        name: {
            "Front": front.read_text(encoding="utf8"),
            "Back": back.read_text(encoding="utf8"),
        }
        for name, (front, back) in template_paths.items()
    }
    styling = args.styling.read_text(encoding="utf8")
    media_files = sorted(
        (path for path in args.media_directory.iterdir() if path.is_file()),
        key=lambda path: path.name,
    )
    if not media_files or any(not path.name.startswith("_") for path in media_files):
        raise ValueError("Release 媒体目录必须包含以下划线开头的受管资源。")

    fields = build_package(
        config=config,
        templates=templates,
        styling=styling,
        media_files=media_files,
        output=args.output,
        version=args.version,
        timestamp=args.timestamp,
    )
    verify_package(
        config=config,
        templates=templates,
        styling=styling,
        media_files=media_files,
        output=args.output,
        expected_fields=fields,
    )
    print(
        f"APKG 验证通过：{config['noteTypeName']} / "
        f"{'/'.join(EXPECTED_TEMPLATES)}，{len(media_files)} 个媒体资源。"
    )


if __name__ == "__main__":
    main()
