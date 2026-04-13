#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_ROOT = ROOT / "input" / "authorized-media"
DEFAULT_LIBRARY_ROOT = ROOT / "Resources" / "library"
MANIFEST_JSONL = "import-manifest.jsonl"
MANIFEST_CSV = "import-manifest.csv"
SUMMARY_JSON = "import-summary.json"

AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"}
LYRICS_EXTENSIONS = {".lrc", ".txt", ".vtt", ".srt", ".ass"}
SCORE_EXTENSIONS = {".musicxml", ".mxl", ".mei", ".abc", ".krn", ".ly", ".mid", ".midi"}
MOTION_EXTENSIONS = {".vrma", ".fbx", ".glb", ".gltf", ".vmd"}
SIDECAR_SUFFIX = ".meta.json"
SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
ROLE_TOKEN_RE = re.compile(
    r"(?i)(?:^|[\s._\-()\[\]【】]+)(?:instrumental|伴奏|karaoke|backing|accompaniment|inst|offvocal|off-vocal|lyrics|歌词|lrc|vocal|lead|acapella|score|sheet|midi|musicxml)(?:$|[\s._\-()\[\]【】]+)"
)
MOTION_CATEGORY_RULES = (
    ("dance", ("dance", "舞", "hiphop", "hip-hop", "macarena")),
    ("idle", ("idle", "stand", "relax")),
    ("walk", ("walk", "stroll")),
    ("run", ("run", "sprint", "jog")),
    ("fight", ("fight", "kick", "punch", "combat")),
    ("sports", ("sport", "golf", "baseball", "basketball", "pingpong", "swim")),
    ("superhero", ("hero", "superhero", "magic", "flying")),
    ("zombie", ("zombie", "undead", "dead")),
)
TEXT_LYRIC_HINTS = ("lyric", "lyrics", "歌词", "lrc", "subtitle", "subtitles", "caption", "captions")
TEXT_SKIP_HINTS = ("license", "readme", "notice", "credit", "credits", "attribution")


@dataclass
class ImportedAsset:
    asset_id: str
    group_id: str
    title: str
    artist: str
    kind: str
    role: str
    ext: str
    original_path: str
    imported_path: str
    imported_at: str
    size: int
    sha256: str
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def safe_name(value: str, fallback: str) -> str:
    cleaned = SAFE_NAME_RE.sub("_", value).strip("._")
    return cleaned[:180] or fallback


def slugify(value: str, fallback: str) -> str:
    return safe_name((value or "").lower(), fallback).replace(".", "-")


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("_", " ").replace("-", " ")).strip()


def to_posix_relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 256), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def is_text_lyrics_candidate(path: Path, metadata: dict[str, Any]) -> bool:
    role = str(metadata.get("role") or "").strip().lower()
    if role == "lyrics":
        return True
    lowered = " ".join(part.lower() for part in path.parts)
    if any(token in lowered for token in TEXT_SKIP_HINTS):
        return False
    return any(token in lowered for token in TEXT_LYRIC_HINTS)


def detect_kind(path: Path, metadata: dict[str, Any]) -> str | None:
    ext = path.suffix.lower()
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    if ext in {".lrc", ".vtt", ".srt", ".ass"}:
        return "lyrics"
    if ext == ".txt":
        return "lyrics" if is_text_lyrics_candidate(path, metadata) else None
    if ext in SCORE_EXTENSIONS:
        return "score"
    if ext in MOTION_EXTENSIONS:
        return "motion"
    return None


def load_sidecar(path: Path) -> dict[str, Any]:
    sidecar = path.with_name(f"{path.stem}{SIDECAR_SUFFIX}")
    if not sidecar.exists():
        return {}
    return json.loads(sidecar.read_text(encoding="utf-8"))


def infer_role(kind: str, path: Path, metadata: dict[str, Any]) -> str:
    if metadata.get("role"):
        return str(metadata["role"]).strip().lower()
    lowered = " ".join(part.lower() for part in path.parts)
    if kind == "audio":
        if any(token in lowered for token in ("伴奏", "instrumental", "karaoke", "backing", "accompaniment", "offvocal", "off-vocal", "inst")):
            return "accompaniment"
        if any(token in lowered for token in ("vocal", "lead", "acapella")):
            return "voice"
        return "song"
    if kind == "lyrics":
        return "lyrics"
    if kind == "score":
        return "score"
    if kind == "motion":
        return "motion"
    return kind


def infer_motion_category(path: Path, metadata: dict[str, Any]) -> str:
    if metadata.get("motion_category"):
        return str(metadata["motion_category"]).strip().lower()
    lowered = path.stem.lower()
    for category, tokens in MOTION_CATEGORY_RULES:
        if any(token in lowered for token in tokens):
            return category
    return "general"


def infer_group_id(path: Path, kind: str, metadata: dict[str, Any]) -> str:
    if metadata.get("group_id"):
        return slugify(str(metadata["group_id"]), "group")
    stem = normalize_text(path.stem)
    stem = ROLE_TOKEN_RE.sub(" ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    if kind == "motion" and metadata.get("motion_category"):
        stem = f"{stem} {metadata['motion_category']}".strip()
    return slugify(stem or path.stem, "group")


def infer_title(path: Path, metadata: dict[str, Any]) -> str:
    if metadata.get("title"):
        return str(metadata["title"]).strip()
    if metadata.get("work_title"):
        return str(metadata["work_title"]).strip()
    stem = normalize_text(path.stem)
    stem = ROLE_TOKEN_RE.sub(" ", stem)
    return re.sub(r"\s+", " ", stem).strip() or path.stem


def load_existing_manifest(manifest_path: Path) -> list[ImportedAsset]:
    if not manifest_path.exists():
        return []
    items: list[ImportedAsset] = []
    for line in manifest_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        items.append(ImportedAsset(**json.loads(line)))
    return items


def write_manifest(entries: list[ImportedAsset], library_root: Path) -> None:
    manifest_jsonl = library_root / MANIFEST_JSONL
    manifest_csv = library_root / MANIFEST_CSV
    summary_json = library_root / SUMMARY_JSON
    manifest_jsonl.parent.mkdir(parents=True, exist_ok=True)

    with manifest_jsonl.open("w", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(asdict(entry), ensure_ascii=False) + "\n")

    fieldnames = [
        "asset_id",
        "group_id",
        "title",
        "artist",
        "kind",
        "role",
        "ext",
        "original_path",
        "imported_path",
        "imported_at",
        "size",
        "sha256",
        "tags",
    ]
    with manifest_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for entry in entries:
            row = asdict(entry)
            row["tags"] = " | ".join(entry.tags)
            writer.writerow({field: row.get(field, "") for field in fieldnames})

    by_kind: dict[str, int] = {}
    by_role: dict[str, int] = {}
    for entry in entries:
        by_kind[entry.kind] = by_kind.get(entry.kind, 0) + 1
        by_role[entry.role] = by_role.get(entry.role, 0) + 1
    summary = {
        "generatedAt": now_iso(),
        "assets": len(entries),
        "groups": len({entry.group_id for entry in entries}),
        "byKind": by_kind,
        "byRole": by_role,
    }
    summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_target_path(library_root: Path, kind: str, role: str, source_path: Path, digest: str) -> Path:
    file_name = safe_name(source_path.name, f"asset{source_path.suffix.lower()}")
    target = library_root / "authorized" / kind / role / file_name
    if target.exists():
        existing_digest = sha256_file(target)
        if existing_digest == digest:
            return target
        target = target.with_name(f"{target.stem}_{digest[:8]}{target.suffix}")
    return target


def import_one(source_path: Path, library_root: Path, dry_run: bool) -> ImportedAsset | None:
    metadata = load_sidecar(source_path)
    kind = detect_kind(source_path, metadata)
    if not kind:
        return None
    digest = sha256_file(source_path)
    role = infer_role(kind, source_path, metadata)
    group_id = infer_group_id(source_path, kind, metadata)
    title = infer_title(source_path, metadata)
    artist = str(metadata.get("artist") or "").strip()

    if kind == "motion":
        metadata.setdefault("motion_category", infer_motion_category(source_path, metadata))

    imported_at = now_iso()
    target_path = resolve_target_path(library_root, kind, role, source_path, digest)
    if not dry_run:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        if not target_path.exists():
            shutil.copy2(source_path, target_path)

    tags = [kind, role, "authorized", "local-import"]
    if metadata.get("tags"):
        tags.extend(str(tag).strip() for tag in metadata.get("tags", []) if str(tag).strip())

    asset_id = slugify(f"{group_id}-{kind}-{role}-{source_path.stem}-{digest[:8]}", "asset")
    return ImportedAsset(
        asset_id=asset_id,
        group_id=group_id,
        title=title,
        artist=artist,
        kind=kind,
        role=role,
        ext=source_path.suffix.lower(),
        original_path=to_posix_relative(source_path),
        imported_path=to_posix_relative(target_path),
        imported_at=imported_at,
        size=source_path.stat().st_size,
        sha256=digest,
        tags=sorted({tag for tag in tags if tag}),
        metadata=metadata,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import locally authorized songs, accompaniments, lyrics, scores, and motions.")
    parser.add_argument("--source-root", action="append", type=Path, help="Source root to scan. Repeatable.")
    parser.add_argument("--library-root", type=Path, default=DEFAULT_LIBRARY_ROOT)
    parser.add_argument("--dry-run", action="store_true", help="Scan and manifest entries without copying files.")
    parser.add_argument("--rebuild", action="store_true", help="Ignore any existing manifest and rebuild from the provided source roots.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_roots = args.source_root or [DEFAULT_SOURCE_ROOT]
    library_root = args.library_root.resolve()
    manifest_path = library_root / MANIFEST_JSONL

    existing = [] if args.rebuild else load_existing_manifest(manifest_path)
    by_key: dict[tuple[str, str], ImportedAsset] = {(entry.sha256, entry.kind): entry for entry in existing}

    discovered = 0
    for source_root in source_roots:
        root = source_root.resolve()
        if not root.exists():
            print(f"[import] skipped missing root: {root}")
            continue
        for source_path in sorted(root.rglob("*")):
            if not source_path.is_file():
                continue
            if source_path.name.endswith(SIDECAR_SUFFIX):
                continue
            entry = import_one(source_path, library_root, args.dry_run)
            if not entry:
                continue
            discovered += 1
            by_key[(entry.sha256, entry.kind)] = entry
            print(f"[import] {entry.kind}/{entry.role}: {source_path}")

    entries = sorted(by_key.values(), key=lambda item: (item.kind, item.group_id, item.role, item.title.lower()))
    if not args.dry_run:
        write_manifest(entries, library_root)

    summary = {
        "libraryRoot": str(library_root),
        "assets": len(entries),
        "discoveredThisRun": discovered,
        "dryRun": args.dry_run,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
