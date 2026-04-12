#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
import re


CATEGORIES = ("idle", "walk", "run", "dance", "fight", "sports", "zombie", "superhero")

PACK_CATEGORY_MAP = {
    "DANCE-MOTIONS-MOCAP": ("dance", "pack"),
    "EVERYDAY-IDLES-MOCAP": ("idle", "pack"),
    "FIGHT-MOTIONS-MOCAP": ("fight", "pack"),
    "MARTIAL-ARTS-MOCAP": ("fight", "pack"),
    "MotionLibrary_EricJacobus": ("fight", "pack"),
    "MotionLibrary_Weapons": ("fight", "pack"),
    "SHOTS-FIRED-MOCAP": ("fight", "pack"),
    "SPORTS-MOCAP": ("sports", "pack"),
    "SUPERHEROES-IN-MOTION-MOCAP": ("superhero", "pack"),
    "WALKING-THE-DEAD-MOCAP": ("zombie", "pack"),
    "Spider-man_butterfly_kick_animation_3538156": ("fight", "pack"),
    "Virgo_Shaka__4087249": ("superhero", "pack"),
}

FILENAME_CATEGORY_RULES = (
    ("run", ("run", "running", "sprint", "jog", "treadmill")),
    ("walk", ("walk", "walking", "pacing", "stroll")),
    ("dance", ("dance", "macarena", "flappy", "silly", "weird")),
    ("fight", ("fight", "kick", "punch", "attack", "martial", "shot", "weapon", "combat")),
    ("sports", ("sport", "baseball", "basketball", "soccer", "tennis", "golf", "skate", "swim", "boxing")),
    ("zombie", ("zombie", "dead", "undead")),
    ("superhero", ("superhero", "hero", "flying", "hover", "power")),
    ("idle", ("idle", "breath", "breathing", "relax")),
)

SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass
class MotionRecord:
    tier: str
    category: str
    confidence: str
    pack: str
    file_name: str
    source_path: str
    classified_fbx_path: str
    vrma_path: str
    convert_status: str
    convert_error: str


@dataclass
class SkippedRecord:
    tier: str
    reason: str
    source_path: str


def slugify(value: str) -> str:
    cleaned = SAFE_NAME_RE.sub("_", value).strip("._")
    return cleaned[:180] or "asset"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify harvested FBX animations and convert them to VRMA.")
    parser.add_argument(
        "--verified-root",
        type=Path,
        default=Path("output/resource-harvest/final-20260412-collection/downloads/motion/verified/extracted"),
    )
    parser.add_argument(
        "--review-root",
        type=Path,
        default=Path("output/resource-harvest/final-20260412-collection/downloads/motion/review/rokoko-extracted"),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("Resources/harvested/motions"),
    )
    parser.add_argument(
        "--converter",
        type=Path,
        default=Path("Resources/fbx/fbx2vrma-converter.js"),
    )
    parser.add_argument(
        "--fbx2gltf",
        type=Path,
        default=Path("Resources/fbx/FBX2glTF-windows-x64.exe"),
    )
    parser.add_argument("--clean", action="store_true", help="Remove the output root before organizing.")
    parser.add_argument("--skip-convert", action="store_true", help="Only classify/copy FBX files without VRMA conversion.")
    parser.add_argument("--limit", type=int, default=0, help="Only process the first N FBX files.")
    return parser.parse_args()


def classify_motion(pack: str, file_name: str) -> tuple[str, str]:
    if pack == "WALK-RUN-CYCLES-MOCAP":
        lowered = file_name.lower()
        if any(keyword in lowered for keyword in ("run", "running", "sprint", "jog", "treadmill")):
            return "run", "filename"
        return "walk", "filename"

    pack_match = PACK_CATEGORY_MAP.get(pack)
    if pack_match:
        return pack_match

    lowered = file_name.lower()
    for category, keywords in FILENAME_CATEGORY_RULES:
        if any(keyword in lowered for keyword in keywords):
            return category, "filename"

    return "fight", "fallback"


def scan_fbx_files(root: Path) -> tuple[list[Path], list[SkippedRecord]]:
    if not root.exists():
        return [], []

    valid: list[Path] = []
    skipped: list[SkippedRecord] = []
    for path in sorted(root.rglob("*.fbx")):
        if "__MACOSX" in path.parts:
            skipped.append(SkippedRecord(tier="", reason="macos_metadata", source_path=str(path)))
            continue
        if path.name.startswith("._"):
            skipped.append(SkippedRecord(tier="", reason="appledouble_sidecar", source_path=str(path)))
            continue
        valid.append(path)
    return valid, skipped


def copy_asset(source_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, target_path)


def convert_to_vrma(
    source_path: Path,
    vrma_path: Path,
    converter_path: Path,
    fbx2gltf_path: Path,
    cwd: Path,
) -> tuple[str, str]:
    vrma_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "node",
        str(converter_path),
        "-i",
        str(source_path),
        "-o",
        str(vrma_path),
        "--fbx2gltf",
        str(fbx2gltf_path),
    ]
    result = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode == 0 and vrma_path.exists():
        return "converted", ""
    error = (result.stderr or result.stdout or f"converter exited with {result.returncode}").strip()
    return "failed", error[:4000]


def write_manifest(
    records: list[MotionRecord],
    skipped_records: list[SkippedRecord],
    raw_counts_by_tier: dict[str, int],
    output_root: Path,
) -> None:
    manifest_csv = output_root / "manifest.csv"
    manifest_jsonl = output_root / "manifest.jsonl"
    skipped_csv = output_root / "skipped_invalid.csv"
    skipped_jsonl = output_root / "skipped_invalid.jsonl"
    summary_json = output_root / "summary.json"

    fieldnames = list(asdict(records[0]).keys()) if records else list(MotionRecord("", "", "", "", "", "", "", "", "", "").__dict__.keys())
    with manifest_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            writer.writerow(asdict(record))

    with manifest_jsonl.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")

    skipped_fieldnames = list(asdict(skipped_records[0]).keys()) if skipped_records else list(SkippedRecord("", "", "").__dict__.keys())
    with skipped_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=skipped_fieldnames)
        writer.writeheader()
        for record in skipped_records:
            writer.writerow(asdict(record))

    with skipped_jsonl.open("w", encoding="utf-8") as handle:
        for record in skipped_records:
            handle.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")

    by_category = Counter(record.category for record in records)
    by_tier = Counter(record.tier for record in records)
    by_status = Counter(record.convert_status for record in records)
    skipped_by_reason = Counter(record.reason for record in skipped_records)
    skipped_by_tier = Counter(record.tier for record in skipped_records)
    summary = {
        "raw_fbx_candidates": sum(raw_counts_by_tier.values()),
        "raw_by_tier": raw_counts_by_tier,
        "records": len(records),
        "by_category": dict(by_category),
        "by_tier": dict(by_tier),
        "by_status": dict(by_status),
        "skipped_invalid": len(skipped_records),
        "skipped_by_reason": dict(skipped_by_reason),
        "skipped_by_tier": dict(skipped_by_tier),
    }
    summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    output_root = args.output_root.resolve()
    cwd = Path.cwd()

    if args.clean and output_root.exists():
        shutil.rmtree(output_root)

    source_roots = [
        ("verified", args.verified_root.resolve()),
        ("review", args.review_root.resolve()),
    ]

    records: list[MotionRecord] = []
    skipped_records: list[SkippedRecord] = []
    raw_counts_by_tier: dict[str, int] = {}
    processed = 0
    for tier, root in source_roots:
        valid_files, tier_skipped = scan_fbx_files(root)
        raw_counts_by_tier[tier] = len(valid_files) + len(tier_skipped)
        for skipped in tier_skipped:
            skipped.tier = tier
        skipped_records.extend(tier_skipped)

        for source_path in valid_files:
            if args.limit and processed >= args.limit:
                break
            relative = source_path.relative_to(root)
            pack = relative.parts[0]
            category, confidence = classify_motion(pack, source_path.name)
            safe_pack = slugify(pack)
            safe_file = slugify(source_path.name)
            target_fbx = output_root / "fbx" / tier / category / f"{safe_pack}__{safe_file}"
            target_vrma = output_root / "vrma" / tier / category / f"{safe_pack}__{source_path.stem}.vrma"

            copy_asset(source_path, target_fbx)
            if args.skip_convert:
                status, error = "skipped", ""
            else:
                status, error = convert_to_vrma(
                    source_path=target_fbx,
                    vrma_path=target_vrma,
                    converter_path=args.converter.resolve(),
                    fbx2gltf_path=args.fbx2gltf.resolve(),
                    cwd=cwd,
                )

            records.append(
                MotionRecord(
                    tier=tier,
                    category=category,
                    confidence=confidence,
                    pack=pack,
                    file_name=source_path.name,
                    source_path=str(source_path),
                    classified_fbx_path=str(target_fbx),
                    vrma_path=str(target_vrma),
                    convert_status=status,
                    convert_error=error,
                )
            )
            processed += 1
            print(f"[{processed}] {tier}/{category}: {source_path.name} -> {status}")

    write_manifest(records, skipped_records, raw_counts_by_tier, output_root)
    summary = Counter(record.category for record in records)
    print(
        json.dumps(
            {
                "raw_fbx_candidates": sum(raw_counts_by_tier.values()),
                "processed_valid": processed,
                "skipped_invalid": len(skipped_records),
                "categories": dict(summary),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
