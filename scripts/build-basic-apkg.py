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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build and verify the Markdown Basic APKG release artifact."
    )
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--front", type=Path, required=True)
    parser.add_argument("--back", type=Path, required=True)
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
        "noteTypeName": "Markdown Basic",
        "cardTemplateName": "Basic",
        "deckName": "Markdown Basic Demo",
        "artifactName": "anki-markdown-basic.apkg",
    }
    for key, expected in expected_names.items():
        if config.get(key) != expected:
            raise ValueError(f"{key} 必须为 {expected!r}。")

    ids = [
        config["modelId"],
        config["deckId"],
        config["templateId"],
        *config["fieldIds"].values(),
    ]
    if any(not isinstance(value, int) or value <= 0 for value in ids):
        raise ValueError("模型、牌组、字段和模板 ID 必须是正整数。")
    if len(ids) != len(set(ids)):
        raise ValueError("模型、牌组、字段和模板 ID 必须互不相同。")


def build_package(
    *,
    config: dict[str, object],
    front: str,
    back: str,
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
            {"name": name, "id": field_id}
            for name, field_id in config["fieldIds"].items()
        ],
        templates=[
            {
                "name": config["cardTemplateName"],
                "id": config["templateId"],
                "qfmt": front,
                "afmt": back,
            }
        ],
        css=styling,
    )
    deck = genanki.Deck(config["deckId"], config["deckName"])
    demo_front = """What can this card render?"""
    demo_back = rf"""# Renderer features

It renders Markdown with local, offline-capable resources.

## Supported content

- **Formatted text** and tables
- Fenced code with syntax highlighting
- KaTeX mathematics
- Mermaid diagrams

\[
\boxed{{E=mc^2}}
\]

```python
from sympy import Matrix

Matrix([[1, 0], [0, 1]])
```

```mermaid
flowchart LR
    Markdown --> Anki
    Anki --> Review
```

Template version: `{version}`"""
    demo_fields = {
        "Front": demo_front,
        "Back": demo_back,
    }
    note = genanki.Note(
        model=model,
        fields=[demo_fields[name] for name in config["fieldIds"]],
        tags=["markdown-basic", "demo"],
        guid=genanki.guid_for(config["guidSeed"]),
    )
    deck.add_note(note)

    package = genanki.Package(deck)
    package.media_files = [str(path) for path in media_files]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    package.write_to_file(str(output), timestamp=float(timestamp))
    normalize_archive(output, timestamp)
    return demo_fields


def verify_package(
    *,
    config: dict[str, object],
    front: str,
    back: str,
    styling: str,
    media_files: list[Path],
    output: Path,
    demo_fields: dict[str, str],
) -> None:
    expected_media = {path.name: sha256(path) for path in media_files}
    with ZipFile(output) as archive:
        media_map = json.loads(archive.read("media"))
        packaged_names = set(media_map.values())
        if packaged_names != set(expected_media):
            raise AssertionError("APKG 媒体清单与受管资源不一致。")

    with TemporaryDirectory(prefix="anki-markdown-basic-verify-") as temporary:
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
                raise AssertionError("导入后的 Markdown Basic 模型 ID 不正确。")
            fields = {
                field["name"]: field.get("id") for field in notetype["flds"]
            }
            if fields != config["fieldIds"]:
                raise AssertionError(f"导入后的字段或字段 ID 不正确：{fields}")
            templates = {
                template["name"]: template for template in notetype["tmpls"]
            }
            template = templates.get(config["cardTemplateName"])
            if template is None or template.get("id") != config["templateId"]:
                raise AssertionError("导入后的 Basic 卡片模板 ID 不正确。")
            if normalized(template["qfmt"]) != normalized(front):
                raise AssertionError("导入后的正面模板与构建产物不一致。")
            if normalized(template["afmt"]) != normalized(back):
                raise AssertionError("导入后的背面模板与构建产物不一致。")
            if normalized(notetype["css"]) != normalized(styling):
                raise AssertionError("导入后的 Styling CSS 与构建产物不一致。")

            deck_names = {deck.name for deck in collection.decks.all_names_and_ids()}
            if config["deckName"] not in deck_names:
                raise AssertionError("导入后未找到 Markdown Basic Demo 牌组。")
            note_ids = collection.find_notes(f'note:"{config["noteTypeName"]}"')
            if len(note_ids) != 1:
                raise AssertionError("示例牌组必须恰好包含一条 Markdown Basic 笔记。")
            imported_note = collection.get_note(note_ids[0])
            if any(
                imported_note[name] != value
                for name, value in demo_fields.items()
            ):
                raise AssertionError("导入后的示例内容与构建输入不一致。")

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
        raise ValueError("输出文件名必须与 basic-release.json 一致。")

    front = args.front.read_text(encoding="utf8")
    back = args.back.read_text(encoding="utf8")
    styling = args.styling.read_text(encoding="utf8")
    media_files = sorted(
        (path for path in args.media_directory.iterdir() if path.is_file()),
        key=lambda path: path.name,
    )
    if not media_files or any(not path.name.startswith("_") for path in media_files):
        raise ValueError("Release 媒体目录必须包含以下划线开头的受管资源。")

    demo_fields = build_package(
        config=config,
        front=front,
        back=back,
        styling=styling,
        media_files=media_files,
        output=args.output,
        version=args.version,
        timestamp=args.timestamp,
    )
    verify_package(
        config=config,
        front=front,
        back=back,
        styling=styling,
        media_files=media_files,
        output=args.output,
        demo_fields=demo_fields,
    )
    print(
        f"APKG 验证通过：{config['noteTypeName']} / "
        f"{config['cardTemplateName']}，{len(media_files)} 个媒体资源。"
    )


if __name__ == "__main__":
    main()
