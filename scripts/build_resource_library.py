#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
LIBRARY_ROOT = ROOT / "Resources" / "library"
IMPORT_MANIFEST = LIBRARY_ROOT / "import-manifest.jsonl"
MOTION_CATALOG = ROOT / "Resources" / "motion-catalog.json"
OUTPUT_PATH = ROOT / "Resources" / "resource-library.json"
SAFE_NAME_RE = re.compile(r"[^a-z0-9._-]+")


def slugify(value: str, fallback: str) -> str:
    normalized = SAFE_NAME_RE.sub("-", (value or "").strip().lower()).strip("-.")
    return normalized[:160] or fallback


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_imported_assets() -> list[dict[str, Any]]:
    if not IMPORT_MANIFEST.exists():
        return []
    assets: list[dict[str, Any]] = []
    for line in IMPORT_MANIFEST.read_text(encoding="utf-8").splitlines():
        if line.strip():
            assets.append(json.loads(line))
    return assets


def load_motion_entries() -> list[dict[str, Any]]:
    if not MOTION_CATALOG.exists():
        return []
    payload = load_json(MOTION_CATALOG)
    entries: list[dict[str, Any]] = []
    for item in payload.get("entries", []):
        entries.append(
            {
                "id": item.get("id"),
                "title": item.get("label") or item.get("id"),
                "kind": "motion",
                "role": "motion",
                "groupId": f"motion-{item.get('category', 'general')}",
                "path": item.get("path"),
                "category": item.get("category"),
                "intensity": item.get("intensity"),
                "tier": item.get("tier"),
                "source": item.get("source"),
                "tags": [item.get("category", ""), item.get("intensity", ""), item.get("tier", ""), "motion-catalog"],
                "metadata": {
                    "legacyActionNames": item.get("legacyActionNames", []),
                    "weight": item.get("weight"),
                    "desktopOnly": item.get("desktopOnly", False),
                },
            }
        )
    return entries


def prettify_title(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("_", " ").replace("-", " ")).strip()


def build_work_groups(imported_assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for asset in imported_assets:
        group_id = asset.get("group_id") or "ungrouped"
        group = groups.setdefault(
            group_id,
            {
                "id": group_id,
                "title": asset.get("metadata", {}).get("work_title") or asset.get("title") or prettify_title(group_id),
                "artist": asset.get("artist") or "",
                "tags": set(),
                "assets": {
                    "audio": [],
                    "lyrics": [],
                    "scores": [],
                    "motions": [],
                },
            },
        )
        if asset.get("artist") and not group["artist"]:
            group["artist"] = asset["artist"]
        group["tags"].update(asset.get("tags", []))
        asset_record = {
            "id": asset.get("asset_id"),
            "title": asset.get("title"),
            "role": asset.get("role"),
            "ext": asset.get("ext"),
            "path": asset.get("imported_path"),
            "size": asset.get("size"),
            "sha256": asset.get("sha256"),
            "metadata": asset.get("metadata", {}),
        }
        kind = asset.get("kind")
        if kind == "audio":
            group["assets"]["audio"].append(asset_record)
        elif kind == "lyrics":
            group["assets"]["lyrics"].append(asset_record)
        elif kind == "score":
            group["assets"]["scores"].append(asset_record)
        elif kind == "motion":
            group["assets"]["motions"].append(asset_record)

    works: list[dict[str, Any]] = []
    for group in groups.values():
        group["tags"] = sorted(tag for tag in group["tags"] if tag)
        group["searchText"] = " ".join(
            [
                group["title"],
                group["artist"],
                " ".join(group["tags"]),
                " ".join(asset["title"] for bucket in group["assets"].values() for asset in bucket),
            ]
        ).strip()
        works.append(group)

    works.sort(key=lambda item: (item["title"].lower(), item["artist"].lower(), item["id"]))
    return works


def build_search_index(works: list[dict[str, Any]], motions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for work in works:
        for kind, bucket in work["assets"].items():
            for asset in bucket:
                records.append(
                    {
                        "id": asset["id"],
                        "groupId": work["id"],
                        "kind": kind[:-1] if kind.endswith("s") else kind,
                        "title": asset["title"],
                        "artist": work["artist"],
                        "role": asset["role"],
                        "path": asset["path"],
                        "tags": work["tags"],
                    }
                )
    for motion in motions:
        records.append(
            {
                "id": motion["id"],
                "groupId": motion["groupId"],
                "kind": "motion",
                "title": motion["title"],
                "artist": "",
                "role": "motion",
                "path": motion["path"],
                "tags": [tag for tag in motion.get("tags", []) if tag],
            }
        )
    records.sort(key=lambda item: (item["kind"], item["title"].lower(), item["id"]))
    return records


def main() -> int:
    imported_assets = load_imported_assets()
    works = build_work_groups(imported_assets)
    motions = load_motion_entries()
    search_index = build_search_index(works, motions)

    asset_kind_counts = Counter(asset.get("kind", "unknown") for asset in imported_assets)
    motion_category_counts = Counter(item.get("category", "unknown") for item in motions)

    payload = {
        "version": 1,
        "generatedAt": now_iso(),
        "libraryRoot": "Resources/library",
        "stats": {
            "works": len(works),
            "importedAssets": len(imported_assets),
            "motionEntries": len(motions),
            "searchRecords": len(search_index),
            "importedByKind": dict(asset_kind_counts),
            "motionsByCategory": dict(motion_category_counts),
        },
        "works": works,
        "motions": motions,
        "searchIndex": search_index,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))
    print(f"wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
