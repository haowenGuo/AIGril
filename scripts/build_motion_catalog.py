#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CORE_SEED_PATH = ROOT / "scripts" / "resource_catalogs" / "core_motion_seed.json"
HARVEST_MANIFEST_PATH = ROOT / "Resources" / "harvested" / "motions" / "manifest.csv"
OUTPUT_PATH = ROOT / "Resources" / "motion-catalog.json"

INTENSITY_BY_CATEGORY = {
    "idle": "low",
    "walk": "low",
    "run": "high",
    "dance": "high",
    "fight": "high",
    "sports": "medium",
    "zombie": "medium",
    "superhero": "high",
}

SAFE_ID_RE = re.compile(r"[^a-z0-9._-]+")


def slugify(value: str) -> str:
    normalized = SAFE_ID_RE.sub("-", (value or "").strip().lower()).strip("-.")
    return normalized[:160] or "motion"


def to_posix_relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def infer_intensity(category: str, file_name: str) -> str:
    lowered = (file_name or "").lower()
    if any(token in lowered for token in ("idle", "relax", "slow", "sleep", "look", "stand")):
        return "low"
    if any(token in lowered for token in ("run", "fight", "punch", "kick", "jump", "sprint", "flying")):
        return "high"
    return INTENSITY_BY_CATEGORY.get(category, "medium")


def load_core_entries() -> list[dict]:
    if not CORE_SEED_PATH.exists():
        return []
    return json.loads(CORE_SEED_PATH.read_text(encoding="utf-8"))


def load_harvest_entries() -> list[dict]:
    if not HARVEST_MANIFEST_PATH.exists():
        return []

    entries: list[dict] = []
    with HARVEST_MANIFEST_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if (row.get("convert_status") or "").strip() != "converted":
                continue

            vrma_path = Path((row.get("vrma_path") or "").strip())
            if not vrma_path.exists():
                continue

            category = (row.get("category") or "").strip().lower()
            tier = (row.get("tier") or "review").strip().lower() or "review"
            pack = (row.get("pack") or "").strip()
            file_name = (row.get("file_name") or vrma_path.stem).strip()
            label = Path(file_name).stem.replace("_", " ").strip() or vrma_path.stem

            entries.append(
                {
                    "id": f"harvest-{slugify(tier)}-{slugify(category)}-{slugify(pack)}-{slugify(vrma_path.stem)}",
                    "label": label,
                    "path": to_posix_relative(vrma_path),
                    "category": category,
                    "intensity": infer_intensity(category, file_name),
                    "tier": tier,
                    "source": "harvested",
                    "pack": pack,
                    "weight": 3 if tier == "verified" else 1,
                    "preload": False,
                    "desktopOnly": True,
                    "legacyActionNames": [],
                    "confidence": (row.get("confidence") or "").strip(),
                }
            )
    return entries


def main() -> int:
    entries = load_core_entries() + load_harvest_entries()
    entries.sort(key=lambda item: (item.get("category", ""), item.get("tier", ""), item.get("label", "")))

    by_category = Counter(entry.get("category", "unknown") for entry in entries)
    by_tier = Counter(entry.get("tier", "unknown") for entry in entries)

    payload = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "categories": sorted(by_category.keys()),
        "stats": {
            "entries": len(entries),
            "byCategory": dict(by_category),
            "byTier": dict(by_tier),
        },
        "entries": entries,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))
    print(f"wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
