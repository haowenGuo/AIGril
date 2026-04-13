#!/usr/bin/env python3
"""
License-aware resource discovery for AIGril.

The harvester uses public APIs and public index pages, keeps source/license
metadata, and downloads files only when --download is provided. It intentionally
does not scrape login-gated marketplaces, lyric sites, or pages with unclear
rights.
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import hashlib
import html
import json
import os
import re
import shutil
import sys
import time
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import robotparser
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen


APP_VERSION = "0.2.0"
CONTACT = os.getenv("AIGRIL_HARVESTER_CONTACT", "local-run")
USER_AGENT = os.getenv(
    "AIGRIL_HARVESTER_USER_AGENT",
    f"AIGrilResourceHarvester/{APP_VERSION} ({CONTACT})",
)

MOTION_EXTENSIONS = {".fbx", ".vrma"}
MOTION_REVIEW_EXTENSIONS = MOTION_EXTENSIONS | {".zip", ".7z"}
MUSIC_TEXT_EXTENSIONS = {".musicxml", ".mxl", ".mei", ".abc", ".krn", ".ly", ".mid", ".midi"}
ARCHIVE_EXTENSIONS = {".zip"}
DOWNLOADABLE_EXTENSIONS = MOTION_REVIEW_EXTENSIONS | MUSIC_TEXT_EXTENSIONS

LICENSE_URL_ALLOW_MARKERS = (
    "creativecommons.org/publicdomain/zero",
    "creativecommons.org/publicdomain/mark",
    "creativecommons.org/licenses/by/",
    "creativecommons.org/licenses/by-sa/",
)
LICENSE_URL_NONCOMMERCIAL_MARKERS = (
    "creativecommons.org/licenses/by-nc/",
    "creativecommons.org/licenses/by-nc-sa/",
)
LICENSE_URL_DENY_MARKERS = (
    "creativecommons.org/licenses/by-nd/",
    "creativecommons.org/licenses/by-nc-nd/",
)

LICENSE_TEXT_ALLOW_MARKERS = (
    "public domain",
    "cc by",
    "cc-by",
    "cc by-sa",
    "cc-by-sa",
    "cc0",
)
LICENSE_TEXT_NONCOMMERCIAL_MARKERS = (
    "cc by-nc",
    "cc-by-nc",
    "cc by-nc-sa",
    "cc-by-nc-sa",
)
LICENSE_TEXT_DENY_MARKERS = (
    "all rights reserved",
    "cc by-nd",
    "cc-by-nd",
    "cc by-nc-nd",
    "cc-by-nc-nd",
)

SPDX_ALLOW = {
    "0BSD",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "CC-BY-4.0",
    "CC-BY-SA-4.0",
    "CC0-1.0",
    "ISC",
    "MIT",
    "Unlicense",
    "Zlib",
}
SPDX_NONCOMMERCIAL = {
    "CC-BY-NC-4.0",
    "CC-BY-NC-SA-4.0",
}
SPDX_DENY = {
    "CC-BY-ND-4.0",
    "CC-BY-NC-ND-4.0",
}

DEFAULT_QUERIES = {
    "internet-archive": {
        "motion": [
            "vrma motion",
            "fbx animation",
            "mocap fbx",
            "avatar animation fbx",
        ],
        "music_text": [
            "musicxml",
            "lilypond music",
            "abc notation music",
            "mei music notation",
        ],
    },
    "github": {
        "motion": [
            "extension:vrma",
            "extension:fbx animation",
            "extension:fbx mocap",
            "extension:fbx avatar",
        ],
        "music_text": [
            "extension:musicxml score",
            "extension:mxl score",
            "extension:mei score",
            "extension:abc music",
            "extension:ly lilypond",
        ],
    },
    "musicbrainz": {
        "music_text": [
            "dance",
            "happy",
            "ambient",
            "electronic",
        ],
    },
    "openverse": {
        "music_text": [
            "dance music",
            "ambient music",
            "happy music",
            "electronic music",
        ],
    },
    "mutopia": {
        "music_text": [
            "voice",
            "song",
            "vocalise",
            "dance",
            "waltz",
        ],
    },
    "curated-commercial": {
        "motion": [
            "thingiverse",
            "rokoko",
            "commercial-free",
        ],
    },
}

PROFILE_QUERIES = {
    "performer": {
        "internet-archive": {
            "motion": [
                "dance mocap zip",
                "idle mocap zip",
                "walk run cycles mocap",
                "stage performance fbx",
            ],
            "music_text": [
                "vocal musicxml",
                "dance midi",
                "lilypond song",
                "public domain vocal score",
            ],
        },
        "github": {
            "motion": [
                "extension:fbx dance animation",
                "extension:vrma idle",
            ],
            "music_text": [
                "extension:musicxml vocal score",
                "extension:mid waltz",
                "extension:ly song",
            ],
        },
        "musicbrainz": {
            "music_text": ["dance", "song", "waltz", "vocal"],
        },
        "openverse": {
            "music_text": ["dance music", "waltz music", "vocal music"],
        },
        "mutopia": {
            "music_text": ["voice", "song", "vocalise", "waltz", "dance"],
        },
        "curated-commercial": {
            "motion": ["rokoko", "dance", "idle", "walk", "commercial-free"],
        },
    },
}

SOURCE_DENY_PATTERN = re.compile(
    r"(?:crack|keygen|patch|warez|serial|pirate|torrent|repack|activator)",
    re.IGNORECASE,
)
FILE_DENY_PATTERN = re.compile(
    r"(?:ebook|_jp2|_chocr|_hocr|_meta|_files\.xml|_reviews\.xml)",
    re.IGNORECASE,
)
MOTION_REVIEW_NAME_PATTERN = re.compile(
    r"(?:mocap|motion|animation|walk|idle|dance|fight|martial|sports|superhero|shots|weapons|fbx|vrma)",
    re.IGNORECASE,
)
RESULT_TABLE_RE = re.compile(r'<table class="table-bordered result-table">(.*?)</table>', re.IGNORECASE | re.DOTALL)
ROW_RE = re.compile(r"<tr>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
CELL_RE = re.compile(r"<td>(.*?)</td>", re.IGNORECASE | re.DOTALL)
ANCHOR_RE = re.compile(r'<a href="([^"]+)">(.+?)</a>', re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")

MUTOPIA_BASE_URL = "https://www.mutopiaproject.org/"
MUTOPIA_SEARCH_URL = urljoin(MUTOPIA_BASE_URL, "cgibin/make-table.cgi")

MOTION_QUALITY_BY_EXT = {
    ".vrma": 92,
    ".fbx": 86,
    ".zip": 72,
    ".7z": 68,
}
MUSIC_QUALITY_BY_EXT = {
    ".musicxml": 96,
    ".mxl": 94,
    ".mei": 90,
    ".mid": 88,
    ".midi": 88,
    ".ly": 86,
    ".abc": 82,
    ".krn": 80,
    ".json": 30,
}
SOURCE_QUALITY_BONUS = {
    "curated-commercial": 12,
    "mutopia": 10,
    "github": 6,
    "internet-archive": 4,
    "musicbrainz": 0,
    "openverse": 0,
}
PERFORMANCE_KEYWORDS = (
    ("dance", 8),
    ("song", 8),
    ("voice", 9),
    ("vocal", 9),
    ("sing", 10),
    ("waltz", 7),
    ("opera", 7),
    ("performance", 6),
    ("stage", 5),
    ("idle", 4),
    ("gesture", 4),
    ("clap", 4),
    ("mocap", 4),
)


@dataclass
class ResourceCandidate:
    discovered_at: str
    kind: str
    source: str
    source_id: str
    title: str
    creator: str = ""
    license: str = ""
    license_url: str = ""
    page_url: str = ""
    asset_url: str = ""
    file_name: str = ""
    file_ext: str = ""
    size: int | None = None
    tags: list[str] = field(default_factory=list)
    review_notes: list[str] = field(default_factory=list)
    download_path: str = ""
    sha256: str = ""
    license_status: str = ""
    quality_score: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def eprint(message: str) -> None:
    print(message, file=sys.stderr)


def normalize_kind(kind: str) -> str:
    return "music_text" if kind == "music-text" else kind


def target_extensions(kind: str) -> set[str]:
    if kind == "motion":
        return MOTION_EXTENSIONS
    if kind == "music_text":
        return MUSIC_TEXT_EXTENSIONS
    return MOTION_EXTENSIONS | MUSIC_TEXT_EXTENSIONS


def review_extensions(kind: str) -> set[str]:
    if kind == "motion":
        return MOTION_REVIEW_EXTENSIONS
    return target_extensions(kind)


def get_file_ext(file_name: str) -> str:
    return Path(file_name.split("?", 1)[0]).suffix.lower()


def safe_file_name(name: str, fallback: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return cleaned[:180] or fallback


def quote_archive_path(path: str) -> str:
    return "/".join(quote(part) for part in path.split("/"))


def normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return [str(value)]


def unique_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = value.strip()
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(cleaned)
    return result


def first_text(value: Any) -> str:
    values = normalize_list(value)
    return values[0] if values else ""


def looks_disallowed_source(*values: str) -> bool:
    return any(SOURCE_DENY_PATTERN.search(value or "") for value in values)


def looks_like_motion_review_file(file_name: str, file_ext: str) -> bool:
    if file_ext in MOTION_EXTENSIONS:
        return True
    return bool(MOTION_REVIEW_NAME_PATTERN.search(file_name)) and not FILE_DENY_PATTERN.search(file_name)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def strip_html_fragment(fragment: str) -> str:
    normalized = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.IGNORECASE)
    normalized = TAG_RE.sub(" ", normalized)
    normalized = html.unescape(normalized).replace("\xa0", " ")
    return WHITESPACE_RE.sub(" ", normalized).strip()


def is_license_url_allowed(license_url: str, allow_noncommercial: bool) -> bool:
    license_lower = (license_url or "").lower()
    if not license_lower:
        return False
    if any(marker in license_lower for marker in LICENSE_URL_DENY_MARKERS):
        return False
    if any(marker in license_lower for marker in LICENSE_URL_NONCOMMERCIAL_MARKERS):
        return allow_noncommercial
    return any(marker in license_lower for marker in LICENSE_URL_ALLOW_MARKERS)


def is_spdx_allowed(spdx_id: str, allow_noncommercial: bool) -> bool:
    normalized = (spdx_id or "").strip()
    if not normalized or normalized in {"NOASSERTION", "NONE"}:
        return False
    if normalized in SPDX_DENY:
        return False
    if normalized in SPDX_NONCOMMERCIAL:
        return allow_noncommercial
    return normalized in SPDX_ALLOW


def is_license_text_allowed(license_text: str, allow_noncommercial: bool) -> bool:
    lowered = (license_text or "").lower()
    if not lowered:
        return False
    if any(marker in lowered for marker in LICENSE_TEXT_DENY_MARKERS):
        return False
    if any(marker in lowered for marker in LICENSE_TEXT_NONCOMMERCIAL_MARKERS):
        return allow_noncommercial
    return any(marker in lowered for marker in LICENSE_TEXT_ALLOW_MARKERS)


def infer_license_status(candidate: ResourceCandidate, allow_noncommercial: bool) -> str:
    download_allowed = candidate.metadata.get("download_allowed")
    review_download_allowed = candidate.metadata.get("review_download_allowed")
    if download_allowed is True:
        return "verified"
    if review_download_allowed:
        return "review"
    if candidate.file_ext == ".json" and candidate.source in {"musicbrainz", "openverse"}:
        return "metadata"
    if is_license_url_allowed(candidate.license_url, allow_noncommercial):
        return "verified"
    if is_license_text_allowed(candidate.license, allow_noncommercial):
        return "verified"
    return "review"


def clamp_score(score: int) -> int:
    return max(0, min(100, score))


def keyword_bonus(candidate: ResourceCandidate) -> int:
    haystack = " ".join(
        [
            candidate.title,
            candidate.file_name,
            " ".join(candidate.tags),
            " ".join(candidate.review_notes),
        ]
    ).lower()
    score = 0
    for keyword, bonus in PERFORMANCE_KEYWORDS:
        if keyword in haystack:
            score += bonus
    return min(score, 15)


def base_quality_for(candidate: ResourceCandidate) -> int:
    from_metadata = candidate.metadata.get("quality_score")
    if isinstance(from_metadata, int):
        return from_metadata
    if candidate.kind == "motion":
        return MOTION_QUALITY_BY_EXT.get(candidate.file_ext, 60)
    return MUSIC_QUALITY_BY_EXT.get(candidate.file_ext, 45)


def source_bonus_for(candidate: ResourceCandidate) -> int:
    return SOURCE_QUALITY_BONUS.get(candidate.source, 0)


def score_candidate(candidate: ResourceCandidate, allow_noncommercial: bool) -> int:
    score = base_quality_for(candidate)
    score += source_bonus_for(candidate)
    status = infer_license_status(candidate, allow_noncommercial)
    if status == "verified":
        score += 10
    elif status == "review":
        score -= 12
    elif status == "metadata":
        score -= 18
    if candidate.asset_url and candidate.file_ext in ARCHIVE_EXTENSIONS:
        score -= 6
    score += keyword_bonus(candidate)
    return clamp_score(score)


def merge_candidate_records(left: ResourceCandidate, right: ResourceCandidate) -> ResourceCandidate:
    winner = left if left.quality_score >= right.quality_score else right
    loser = right if winner is left else left
    winner.tags = unique_strings(winner.tags + loser.tags)
    winner.review_notes = unique_strings(winner.review_notes + loser.review_notes)
    winner.metadata = {**loser.metadata, **winner.metadata}
    if not winner.page_url:
        winner.page_url = loser.page_url
    if not winner.asset_url:
        winner.asset_url = loser.asset_url
    if not winner.license and loser.license:
        winner.license = loser.license
    if not winner.license_url and loser.license_url:
        winner.license_url = loser.license_url
    if not winner.creator and loser.creator:
        winner.creator = loser.creator
    if winner.size is None:
        winner.size = loser.size
    return winner


class RobotsCache:
    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self.parsers: dict[str, robotparser.RobotFileParser | None] = {}

    def can_fetch(self, url: str) -> bool:
        if not self.enabled:
            return True
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        base = f"{parsed.scheme}://{parsed.netloc}"
        if base not in self.parsers:
            parser = robotparser.RobotFileParser()
            parser.set_url(f"{base}/robots.txt")
            try:
                parser.read()
                self.parsers[base] = parser
            except Exception as error:  # noqa: BLE001
                eprint(f"[robots] Could not read {base}/robots.txt: {error}; skipping robots gate for this host.")
                self.parsers[base] = None
        parser = self.parsers[base]
        return True if parser is None else parser.can_fetch(USER_AGENT, url)


class HttpClient:
    def __init__(self, delay_seconds: float, timeout_seconds: int, robots: RobotsCache, retries: int) -> None:
        self.delay_seconds = delay_seconds
        self.timeout_seconds = timeout_seconds
        self.retries = retries
        self.robots = robots
        self.last_request_by_host: dict[str, float] = {}

    def _wait_for_host(self, url: str, min_delay: float | None = None) -> None:
        parsed = urlparse(url)
        delay = self.delay_seconds if min_delay is None else max(self.delay_seconds, min_delay)
        last_request = self.last_request_by_host.get(parsed.netloc, 0)
        remaining = delay - (time.monotonic() - last_request)
        if remaining > 0:
            time.sleep(remaining)
        self.last_request_by_host[parsed.netloc] = time.monotonic()

    def _full_url(self, url: str, params: dict[str, Any] | list[tuple[str, Any]] | None) -> str:
        if not params:
            return url
        return f"{url}?{urlencode(params, doseq=True)}"

    def get_json(
        self,
        url: str,
        params: dict[str, Any] | list[tuple[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
        min_delay: float | None = None,
    ) -> dict[str, Any]:
        full_url = self._full_url(url, params)
        self._wait_for_host(full_url, min_delay=min_delay)
        request_headers = {
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }
        request_headers.update(headers or {})
        request = Request(full_url, headers=request_headers)
        for attempt in range(self.retries + 1):
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as error:
                if error.code not in {429, 500, 502, 503, 504} or attempt >= self.retries:
                    raise
                time.sleep(1.5 * (attempt + 1))
            except (URLError, TimeoutError, ConnectionError) as error:
                if attempt >= self.retries:
                    raise
                eprint(f"[http] transient error for {full_url}: {error}; retrying")
                time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"unreachable retry state for {full_url}")

    def get_text(
        self,
        url: str,
        params: dict[str, Any] | list[tuple[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
        min_delay: float | None = None,
        respect_robots: bool = False,
    ) -> str:
        full_url = self._full_url(url, params)
        if respect_robots and not self.robots.can_fetch(full_url):
            raise RuntimeError(f"robots.txt disallows fetch: {full_url}")
        self._wait_for_host(full_url, min_delay=min_delay)
        request_headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": USER_AGENT,
        }
        request_headers.update(headers or {})
        request = Request(full_url, headers=request_headers)
        for attempt in range(self.retries + 1):
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    charset = response.headers.get_content_charset() or "utf-8"
                    return response.read().decode(charset, errors="replace")
            except HTTPError as error:
                if error.code not in {429, 500, 502, 503, 504} or attempt >= self.retries:
                    raise
                time.sleep(1.5 * (attempt + 1))
            except (URLError, TimeoutError, ConnectionError) as error:
                if attempt >= self.retries:
                    raise
                eprint(f"[http] transient error for {full_url}: {error}; retrying")
                time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"unreachable retry state for {full_url}")

    def download(self, url: str, target: Path, max_bytes: int) -> tuple[str, int]:
        if not self.robots.can_fetch(url):
            raise RuntimeError(f"robots.txt disallows download: {url}")

        request = Request(url, headers={"User-Agent": USER_AGENT})
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = target.with_suffix(target.suffix + ".part")

        for attempt in range(self.retries + 1):
            self._wait_for_host(url)
            hasher = hashlib.sha256()
            bytes_written = 0
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response, tmp_path.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 256)
                        if not chunk:
                            break
                        bytes_written += len(chunk)
                        if bytes_written > max_bytes:
                            tmp_path.unlink(missing_ok=True)
                            raise RuntimeError(f"download exceeded --max-bytes ({max_bytes}): {url}")
                        hasher.update(chunk)
                        output.write(chunk)

                tmp_path.replace(target)
                return hasher.hexdigest(), bytes_written
            except HTTPError as error:
                tmp_path.unlink(missing_ok=True)
                if error.code not in {429, 500, 502, 503, 504} or attempt >= self.retries:
                    raise
                time.sleep(1.5 * (attempt + 1))
            except (URLError, TimeoutError, ConnectionError) as error:
                tmp_path.unlink(missing_ok=True)
                if attempt >= self.retries:
                    raise
                eprint(f"[download] transient error for {url}: {error}; retrying")
                time.sleep(1.5 * (attempt + 1))

        raise RuntimeError(f"unreachable retry state for {url}")


class CrawlContext:
    def __init__(self, args: argparse.Namespace, http: HttpClient) -> None:
        self.args = args
        self.http = http
        self.github_license_cache: dict[str, dict[str, Any] | None] = {}


class InternetArchiveAdapter:
    name = "internet-archive"

    def discover(self, kind: str, queries: list[str], limit: int, ctx: CrawlContext) -> list[ResourceCandidate]:
        results: list[ResourceCandidate] = []
        extensions = target_extensions(kind)
        review_only_extensions = review_extensions(kind)
        fields = ["identifier", "title", "creator", "licenseurl", "mediatype", "subject", "downloads", "date"]

        for query in queries:
            eprint(f"[internet-archive] Searching: {query}")
            params: list[tuple[str, Any]] = [
                ("q", query),
                ("rows", limit),
                ("page", 1),
                ("output", "json"),
            ]
            for field_name in fields:
                params.append(("fl[]", field_name))

            try:
                payload = ctx.http.get_json("https://archive.org/advancedsearch.php", params=params)
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
                eprint(f"[internet-archive] Search failed for {query!r}: {error}")
                continue

            docs = payload.get("response", {}).get("docs", [])
            for doc in docs:
                identifier = str(doc.get("identifier") or "")
                title = first_text(doc.get("title")) or identifier
                if looks_disallowed_source(identifier, title):
                    continue
                license_url = first_text(doc.get("licenseurl"))
                license_allowed = is_license_url_allowed(license_url, ctx.args.allow_noncommercial)
                include_review = ctx.args.include_review_candidates and kind == "motion"
                if not identifier or (not license_allowed and not include_review):
                    continue

                try:
                    metadata = ctx.http.get_json(f"https://archive.org/metadata/{quote(identifier)}")
                except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
                    eprint(f"[internet-archive] Metadata failed for {identifier}: {error}")
                    continue

                review_count = 0
                for item_file in metadata.get("files", []):
                    file_name = str(item_file.get("name") or "")
                    file_ext = get_file_ext(file_name)
                    if license_allowed:
                        if file_ext not in extensions:
                            continue
                    elif file_ext not in review_only_extensions:
                        continue
                    elif kind == "motion" and not looks_like_motion_review_file(file_name, file_ext):
                        continue
                    elif review_count >= ctx.args.review_files_per_item:
                        continue

                    size_text = item_file.get("size")
                    size = int(size_text) if str(size_text or "").isdigit() else None
                    asset_url = f"https://archive.org/download/{quote(identifier)}/{quote_archive_path(file_name)}"
                    creator = first_text(doc.get("creator"))
                    if not license_allowed:
                        review_count += 1
                    results.append(
                        ResourceCandidate(
                            discovered_at=now_iso(),
                            kind=kind,
                            source=self.name,
                            source_id=f"{identifier}/{file_name}",
                            title=title,
                            creator=creator,
                            license="Internet Archive metadata licenseurl" if license_allowed else "UNVERIFIED",
                            license_url=license_url,
                            page_url=f"https://archive.org/details/{quote(identifier)}",
                            asset_url=asset_url,
                            file_name=file_name,
                            file_ext=file_ext,
                            size=size,
                            tags=normalize_list(doc.get("subject"))[:20],
                            review_notes=(
                                ["Verify item page license and per-file rights before shipping."]
                                if license_allowed
                                else [
                                    "License is missing or not in the allowlist; kept only as a review candidate.",
                                    "Do not ship or redistribute this file until terms are verified.",
                                ]
                            ),
                            metadata={
                                "archive_doc": doc,
                                "archive_file": item_file,
                                "download_allowed": license_allowed,
                            },
                        )
                    )
        return results


class GitHubAdapter:
    name = "github"

    def _headers(self) -> dict[str, str]:
        token = os.getenv("GITHUB_TOKEN", "").strip()
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _repo_license(self, repo_full_name: str, ctx: CrawlContext) -> dict[str, Any] | None:
        if repo_full_name in ctx.github_license_cache:
            return ctx.github_license_cache[repo_full_name]
        owner, repo = repo_full_name.split("/", 1)
        url = f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}/license"
        try:
            payload = ctx.http.get_json(url, headers=self._headers())
        except HTTPError as error:
            eprint(f"[github] No detected license for {repo_full_name}: HTTP {error.code}")
            ctx.github_license_cache[repo_full_name] = None
            return None
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            eprint(f"[github] License lookup failed for {repo_full_name}: {error}")
            ctx.github_license_cache[repo_full_name] = None
            return None

        ctx.github_license_cache[repo_full_name] = payload
        return payload

    def discover(self, kind: str, queries: list[str], limit: int, ctx: CrawlContext) -> list[ResourceCandidate]:
        if not os.getenv("GITHUB_TOKEN", "").strip():
            eprint("[github] Skipped: set GITHUB_TOKEN to use GitHub code search.")
            return []

        results: list[ResourceCandidate] = []
        extensions = target_extensions(kind)

        for query in queries:
            eprint(f"[github] Searching: {query}")
            params = {"q": query, "per_page": min(limit, 50)}
            try:
                payload = ctx.http.get_json("https://api.github.com/search/code", params=params, headers=self._headers())
            except HTTPError as error:
                eprint(f"[github] Search failed for {query!r}: HTTP {error.code} {error.reason}")
                continue
            except (URLError, TimeoutError, json.JSONDecodeError) as error:
                eprint(f"[github] Search failed for {query!r}: {error}")
                continue

            for item in payload.get("items", []):
                repo_info = item.get("repository") or {}
                repo_full_name = repo_info.get("full_name")
                if not repo_full_name:
                    continue
                license_payload = self._repo_license(repo_full_name, ctx)
                license_info = (license_payload or {}).get("license") or {}
                spdx_id = license_info.get("spdx_id", "")
                if not is_spdx_allowed(spdx_id, ctx.args.allow_noncommercial):
                    continue

                try:
                    content = ctx.http.get_json(item["url"], headers=self._headers())
                except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, KeyError) as error:
                    eprint(f"[github] Content lookup failed for {item.get('html_url')}: {error}")
                    continue

                file_name = str(content.get("name") or item.get("name") or "")
                file_ext = get_file_ext(file_name)
                download_url = content.get("download_url") or ""
                if file_ext not in extensions or not download_url:
                    continue

                repo_url = repo_info.get("html_url") or f"https://github.com/{repo_full_name}"
                results.append(
                    ResourceCandidate(
                        discovered_at=now_iso(),
                        kind=kind,
                        source=self.name,
                        source_id=f"{repo_full_name}:{content.get('path', file_name)}",
                        title=file_name,
                        creator=repo_info.get("owner", {}).get("login", ""),
                        license=spdx_id,
                        license_url=(license_info.get("url") or ""),
                        page_url=item.get("html_url") or repo_url,
                        asset_url=download_url,
                        file_name=file_name,
                        file_ext=file_ext,
                        size=content.get("size"),
                        tags=[repo_full_name],
                        review_notes=[
                            "GitHub license is repository-level; verify asset-specific license before shipping."
                        ],
                        metadata={
                            "repository": repo_full_name,
                            "repository_url": repo_url,
                            "path": content.get("path"),
                            "license": license_info,
                        },
                    )
                )
        return results


class MusicBrainzAdapter:
    name = "musicbrainz"

    def _metadata_for_recording(self, recording: dict[str, Any], include_supplementary: bool) -> dict[str, Any]:
        if include_supplementary:
            return recording
        core_keys = ["id", "title", "length", "disambiguation", "artist-credit"]
        return {key: recording[key] for key in core_keys if key in recording}

    def discover(self, kind: str, queries: list[str], limit: int, ctx: CrawlContext) -> list[ResourceCandidate]:
        if kind != "music_text":
            return []

        results: list[ResourceCandidate] = []
        for query in queries:
            eprint(f"[musicbrainz] Searching recordings: {query}")
            params = {"query": query, "limit": min(limit, 100), "fmt": "json"}
            try:
                payload = ctx.http.get_json("https://musicbrainz.org/ws/2/recording/", params=params, min_delay=1.1)
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
                eprint(f"[musicbrainz] Search failed for {query!r}: {error}")
                continue

            for recording in payload.get("recordings", []):
                recording_id = recording.get("id")
                if not recording_id:
                    continue
                artists = []
                for credit in recording.get("artist-credit", []) or []:
                    if isinstance(credit, dict) and credit.get("name"):
                        artists.append(credit["name"])
                tags = (
                    [tag.get("name") for tag in recording.get("tags", []) if tag.get("name")]
                    if ctx.args.allow_noncommercial
                    else []
                )
                file_name = f"musicbrainz_{recording_id}.json"
                metadata = self._metadata_for_recording(recording, ctx.args.allow_noncommercial)
                results.append(
                    ResourceCandidate(
                        discovered_at=now_iso(),
                        kind=kind,
                        source=self.name,
                        source_id=recording_id,
                        title=recording.get("title") or recording_id,
                        creator=", ".join(artists),
                        license=(
                            "Mixed MusicBrainz data; core data is CC0, supplementary data may be CC BY-NC-SA"
                            if ctx.args.allow_noncommercial
                            else "MusicBrainz core data CC0"
                        ),
                        license_url="https://musicbrainz.org/doc/About/Data_License",
                        page_url=f"https://musicbrainz.org/recording/{recording_id}",
                        file_name=file_name,
                        file_ext=".json",
                        tags=tags[:20],
                        review_notes=[
                            "Metadata only; this does not include lyrics or audio.",
                            "Default metadata is limited to core-ish recording fields; use --allow-noncommercial to keep supplementary fields.",
                        ],
                        metadata=metadata,
                    )
                )
        return results


class OpenverseAdapter:
    name = "openverse"

    def _headers(self) -> dict[str, str]:
        token = os.getenv("OPENVERSE_ACCESS_TOKEN", "").strip()
        return {"Authorization": f"Bearer {token}"} if token else {}

    def discover(self, kind: str, queries: list[str], limit: int, ctx: CrawlContext) -> list[ResourceCandidate]:
        if kind != "music_text":
            return []

        results: list[ResourceCandidate] = []
        api_base = os.getenv("OPENVERSE_API_BASE", "https://api.openverse.org/v1").rstrip("/")
        for query in queries:
            eprint(f"[openverse] Searching audio metadata: {query}")
            params = {"q": query, "page_size": min(limit, 20), "category": "music"}
            try:
                payload = ctx.http.get_json(f"{api_base}/audio/", params=params, headers=self._headers())
            except HTTPError as error:
                eprint(f"[openverse] Search failed for {query!r}: HTTP {error.code} {error.reason}")
                continue
            except (URLError, TimeoutError, json.JSONDecodeError) as error:
                eprint(f"[openverse] Search failed for {query!r}: {error}")
                continue

            for item in payload.get("results", []):
                license_url = item.get("license_url") or ""
                if not is_license_url_allowed(license_url, ctx.args.allow_noncommercial):
                    continue
                item_id = item.get("id") or hashlib.sha256(json.dumps(item, sort_keys=True).encode()).hexdigest()[:16]
                file_name = f"openverse_audio_{item_id}.json"
                tags = [tag.get("name") for tag in item.get("tags", []) if isinstance(tag, dict) and tag.get("name")]
                results.append(
                    ResourceCandidate(
                        discovered_at=now_iso(),
                        kind=kind,
                        source=self.name,
                        source_id=str(item_id),
                        title=item.get("title") or str(item_id),
                        creator=item.get("creator") or "",
                        license=f"CC {item.get('license', '')} {item.get('license_version', '')}".strip(),
                        license_url=license_url,
                        page_url=item.get("foreign_landing_url") or "",
                        asset_url=item.get("url") or "",
                        file_name=file_name,
                        file_ext=".json",
                        size=item.get("filesize"),
                        tags=tags[:20],
                        review_notes=[
                            "Metadata only by default; audio URL is recorded but not downloaded as a text resource.",
                            "Openverse license metadata should be verified before shipping.",
                        ],
                        metadata=item,
                    )
                )
        return results


def infer_mutopia_filters(query: str) -> dict[str, str]:
    lowered = query.lower()
    filters = {
        "Composer": "",
        "Instrument": "",
        "Style": "",
        "collection": "",
        "id": "",
        "lilyversion": "",
        "preview": "",
        "recent": "",
        "searchingfor": query,
        "solo": "",
        "startat": "0",
        "timelength": "",
        "timeunit": "",
    }
    if any(keyword in lowered for keyword in ("voice", "vocal", "song", "opera", "aria")):
        filters["Instrument"] = "Voice"
    elif "piano" in lowered:
        filters["Instrument"] = "Piano"
    if "waltz" in lowered:
        filters["Style"] = "Waltz"
    elif "dance" in lowered:
        filters["Style"] = "Dance"
    elif "song" in lowered:
        filters["Style"] = "Song"
    return filters


def parse_mutopia_candidates(page_html: str, query: str) -> tuple[list[ResourceCandidate], int, int | None]:
    tables = RESULT_TABLE_RE.findall(page_html)
    piece_count = 0
    results: list[ResourceCandidate] = []

    next_match = re.search(r'make-table\.cgi\?startat=(\d+)[^"]*">Next', page_html, re.IGNORECASE)
    next_start = int(next_match.group(1)) if next_match else None

    for block in tables:
        rows = [CELL_RE.findall(row_html) for row_html in ROW_RE.findall(block)]
        if len(rows) < 4:
            continue
        piece_count += 1

        title = strip_html_fragment(rows[0][0]) if rows[0] else ""
        creator = strip_html_fragment(rows[0][1]) if len(rows[0]) > 1 else ""
        if creator.lower().startswith("by "):
            creator = creator[3:].strip()
        instrumentation = strip_html_fragment(rows[1][0]) if len(rows) > 1 and rows[1] else ""
        style = strip_html_fragment(rows[1][2]) if len(rows) > 1 and len(rows[1]) > 2 else ""
        source_note = strip_html_fragment(rows[2][0]) if len(rows) > 2 and rows[2] else ""
        license_label = strip_html_fragment(rows[2][1]) if len(rows) > 2 and len(rows[2]) > 1 else ""
        updated_at = strip_html_fragment(rows[2][3]) if len(rows) > 2 and len(rows[2]) > 3 else ""

        piece_info_match = re.search(r'href="([^"]*piece-info\.cgi\?id=(\d+))"', block, re.IGNORECASE)
        piece_href = piece_info_match.group(1) if piece_info_match else ""
        piece_id = piece_info_match.group(2) if piece_info_match else safe_file_name(title, "mutopia-piece")
        page_url = urljoin(MUTOPIA_BASE_URL, piece_href) if piece_href else MUTOPIA_BASE_URL

        license_match = re.search(r'href="([^"]*legal\.html#[^"]+)"', block, re.IGNORECASE)
        license_url = urljoin(MUTOPIA_BASE_URL, license_match.group(1)) if license_match else ""

        ftp_area = ""
        links_by_url: dict[str, tuple[str, str]] = {}
        for href, label_html in ANCHOR_RE.findall(block):
            label = strip_html_fragment(label_html)
            absolute_href = urljoin(MUTOPIA_BASE_URL, href)
            if "Appropriate FTP area" in label:
                ftp_area = absolute_href
                continue
            file_ext = get_file_ext(absolute_href)
            if file_ext not in MUSIC_TEXT_EXTENSIONS:
                continue
            links_by_url[absolute_href] = (label, file_ext)

        tags = unique_strings(
            [
                "mutopia",
                style,
                instrumentation,
                query,
                "public-domain-score" if "public domain" in license_label.lower() else "",
            ]
        )

        for absolute_href, (_, file_ext) in links_by_url.items():
            file_name = Path(urlparse(absolute_href).path).name
            results.append(
                ResourceCandidate(
                    discovered_at=now_iso(),
                    kind="music_text",
                    source="mutopia",
                    source_id=f"{piece_id}:{file_name}",
                    title=title or file_name,
                    creator=creator,
                    license=license_label or "Public Domain",
                    license_url=license_url or urljoin(MUTOPIA_BASE_URL, "legal.html#publicdomain"),
                    page_url=page_url,
                    asset_url=absolute_href,
                    file_name=file_name,
                    file_ext=file_ext,
                    tags=tags,
                    review_notes=[
                        "Mutopia is a strong source for public-domain symbolic music files.",
                    ],
                    metadata={
                        "piece_id": piece_id,
                        "instrumentation": instrumentation,
                        "style": style,
                        "source_note": source_note,
                        "updated_at": updated_at,
                        "ftp_area": ftp_area,
                        "query": query,
                        "download_allowed": True,
                    },
                )
            )

    return results, piece_count, next_start


class MutopiaAdapter:
    name = "mutopia"

    def discover(self, kind: str, queries: list[str], limit: int, ctx: CrawlContext) -> list[ResourceCandidate]:
        if kind != "music_text":
            return []

        results: list[ResourceCandidate] = []
        for query in queries:
            eprint(f"[mutopia] Searching: {query}")
            start_at = 0
            pieces_seen = 0
            while pieces_seen < limit:
                params = infer_mutopia_filters(query)
                params["startat"] = str(start_at)
                try:
                    page_html = ctx.http.get_text(
                        MUTOPIA_SEARCH_URL,
                        params=params,
                        min_delay=0.8,
                        respect_robots=True,
                    )
                except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
                    eprint(f"[mutopia] Search failed for {query!r} start={start_at}: {error}")
                    break

                page_results, page_pieces, next_start = parse_mutopia_candidates(page_html, query)
                if not page_results or page_pieces == 0:
                    break
                remaining = max(limit - pieces_seen, 0)
                if remaining <= 0:
                    break
                if page_pieces > remaining:
                    unique_piece_ids: list[str] = []
                    truncated: list[ResourceCandidate] = []
                    for candidate in page_results:
                        piece_id = str(candidate.metadata.get("piece_id") or "")
                        if piece_id not in unique_piece_ids:
                            if len(unique_piece_ids) >= remaining:
                                continue
                            unique_piece_ids.append(piece_id)
                        truncated.append(candidate)
                    page_results = truncated
                    page_pieces = len(unique_strings([str(candidate.metadata.get("piece_id") or "") for candidate in page_results]))

                results.extend(page_results)
                pieces_seen += page_pieces
                if next_start is None or next_start <= start_at:
                    break
                start_at = next_start

        return results


class CuratedCommercialAdapter:
    name = "curated-commercial"

    def __init__(self) -> None:
        catalog_path = Path(__file__).resolve().parent / "resource_catalogs" / "commercial_motion_catalog.json"
        self.catalog = load_json(catalog_path)

    def discover(self, kind: str, queries: list[str], limit: int, ctx: CrawlContext) -> list[ResourceCandidate]:
        if kind != "motion":
            return []

        lowered_queries = [query.lower() for query in queries]
        results: list[ResourceCandidate] = []
        for entry in self.catalog:
            haystack = " ".join(
                [
                    str(entry.get("provider", "")),
                    str(entry.get("title", "")),
                    " ".join(normalize_list(entry.get("tags"))),
                ]
            ).lower()
            if lowered_queries and not any(query in haystack for query in lowered_queries):
                continue

            file_name = str(entry.get("file_name") or Path(str(entry.get("asset_url") or "")).name)
            file_ext = get_file_ext(file_name)
            if not file_name or file_ext not in review_extensions(kind):
                continue

            results.append(
                ResourceCandidate(
                    discovered_at=now_iso(),
                    kind=kind,
                    source=self.name,
                    source_id=str(entry.get("id") or file_name),
                    title=str(entry.get("title") or file_name),
                    creator=str(entry.get("creator") or ""),
                    license=str(entry.get("license") or ""),
                    license_url=str(entry.get("license_url") or ""),
                    page_url=str(entry.get("page_url") or ""),
                    asset_url=str(entry.get("asset_url") or ""),
                    file_name=file_name,
                    file_ext=file_ext,
                    size=entry.get("size"),
                    tags=normalize_list(entry.get("tags")),
                    review_notes=normalize_list(entry.get("review_notes")),
                    metadata={
                        "download_allowed": bool(entry.get("download_allowed")),
                        "review_download_allowed": bool(entry.get("review_download_allowed")),
                        "download_subdir": entry.get("download_subdir"),
                        "quality_score": entry.get("quality_score"),
                        "allow_archive_download": bool(entry.get("allow_archive_download")),
                        "provider": entry.get("provider"),
                    },
                )
            )

        return results[:limit] if limit else results


ADAPTERS = {
    "internet-archive": InternetArchiveAdapter(),
    "github": GitHubAdapter(),
    "musicbrainz": MusicBrainzAdapter(),
    "openverse": OpenverseAdapter(),
    "mutopia": MutopiaAdapter(),
    "curated-commercial": CuratedCommercialAdapter(),
}


def queries_for(source: str, kind: str, user_queries: list[str] | None, profile: str) -> list[str]:
    if user_queries:
        return user_queries
    profile_queries = PROFILE_QUERIES.get(profile, {}).get(source, {}).get(kind, [])
    if profile_queries:
        return list(profile_queries)
    return list(DEFAULT_QUERIES.get(source, {}).get(kind, []))


def should_run_source(source: str, kind: str) -> bool:
    if source == "curated-commercial" and kind == "motion":
        return True
    return bool(DEFAULT_QUERIES.get(source, {}).get(kind)) or source in {"internet-archive", "github"}


def enrich_candidates(candidates: list[ResourceCandidate], ctx: CrawlContext) -> list[ResourceCandidate]:
    for candidate in candidates:
        candidate.tags = unique_strings(candidate.tags)
        candidate.review_notes = unique_strings(candidate.review_notes)
        candidate.license_status = infer_license_status(candidate, ctx.args.allow_noncommercial)
        candidate.quality_score = score_candidate(candidate, ctx.args.allow_noncommercial)
    return candidates


def dedupe(candidates: list[ResourceCandidate]) -> list[ResourceCandidate]:
    by_key: dict[tuple[str, str], ResourceCandidate] = {}
    for candidate in candidates:
        identity = candidate.asset_url or candidate.page_url or candidate.source_id
        key = (candidate.kind, identity)
        if key not in by_key:
            by_key[key] = candidate
            continue
        by_key[key] = merge_candidate_records(by_key[key], candidate)
    return list(by_key.values())


def sort_candidates(candidates: list[ResourceCandidate]) -> list[ResourceCandidate]:
    return sorted(
        candidates,
        key=lambda candidate: (
            candidate.kind,
            -candidate.quality_score,
            candidate.source,
            candidate.title.lower(),
            candidate.file_name.lower(),
        ),
    )


def safe_extract_zip(zip_path: Path, extract_root: Path) -> list[str]:
    extract_root.mkdir(parents=True, exist_ok=True)
    resolved_root = extract_root.resolve()
    extracted: list[str] = []
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            member_name = member.filename.replace("\\", "/")
            if not member_name or member.is_dir():
                continue
            destination = (extract_root / member_name).resolve()
            if not destination.is_relative_to(resolved_root):
                raise RuntimeError(f"zip member escapes extraction root: {member.filename}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)
            extracted.append(str(destination))
    return extracted


def maybe_extract_archive(candidate: ResourceCandidate, target: Path) -> None:
    if target.suffix.lower() not in ARCHIVE_EXTENSIONS:
        return
    extract_root = target.parent / "extracted" / safe_file_name(target.stem, "archive")
    extracted = safe_extract_zip(target, extract_root)
    candidate.metadata["extracted_root"] = str(extract_root)
    candidate.metadata["extracted_count"] = len(extracted)
    candidate.metadata["extracted_sample"] = extracted[:25]
    candidate.review_notes.append(f"Extracted archive into {extract_root}")


def materialize_candidate(candidate: ResourceCandidate, run_dir: Path, ctx: CrawlContext) -> None:
    if not ctx.args.download:
        return

    download_allowed = candidate.metadata.get("download_allowed")
    review_download_allowed = candidate.metadata.get("review_download_allowed")
    if download_allowed is False and not (ctx.args.download_review_motion_packs and review_download_allowed):
        candidate.review_notes.append("Skipped download because the license needs manual review.")
        return

    custom_subdir = candidate.metadata.get("download_subdir")
    if custom_subdir:
        category_dir = run_dir / "downloads" / Path(str(custom_subdir))
    else:
        category_dir = run_dir / "downloads" / candidate.kind / candidate.source
    category_dir.mkdir(parents=True, exist_ok=True)

    allow_archive_download = candidate.metadata.get("allow_archive_download")
    if candidate.asset_url and (candidate.file_ext in DOWNLOADABLE_EXTENSIONS or allow_archive_download):
        name = safe_file_name(candidate.file_name, f"{candidate.source}_{candidate.source_id}{candidate.file_ext}")
        target = category_dir / name
        try:
            sha256, bytes_written = ctx.http.download(candidate.asset_url, target, ctx.args.max_bytes)
            candidate.download_path = str(target)
            candidate.sha256 = sha256
            candidate.size = candidate.size or bytes_written
            if ctx.args.extract_archives and target.suffix.lower() in ARCHIVE_EXTENSIONS:
                maybe_extract_archive(candidate, target)
        except Exception as error:  # noqa: BLE001
            candidate.review_notes.append(f"Download failed: {error}")
            eprint(f"[download] Failed {candidate.asset_url}: {error}")
        return

    if candidate.file_ext == ".json":
        name = safe_file_name(candidate.file_name, f"{candidate.source}_{candidate.source_id}.json")
        target = category_dir / name
        target.write_text(json.dumps(candidate.metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        candidate.download_path = str(target)
        candidate.sha256 = hashlib.sha256(target.read_bytes()).hexdigest()


def _counter(values: list[str] | Any) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[str(value)] = counts.get(str(value), 0) + 1
    return counts


def write_manifests(candidates: list[ResourceCandidate], run_dir: Path) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = run_dir / "manifest.jsonl"
    csv_path = run_dir / "manifest.csv"
    attribution_path = run_dir / "ATTRIBUTIONS.md"
    summary_path = run_dir / "summary.json"

    with manifest_path.open("w", encoding="utf-8") as manifest:
        for candidate in candidates:
            manifest.write(json.dumps(dataclasses.asdict(candidate), ensure_ascii=False) + "\n")

    fieldnames = [
        "kind",
        "source",
        "source_id",
        "title",
        "creator",
        "license",
        "license_status",
        "quality_score",
        "license_url",
        "page_url",
        "asset_url",
        "file_name",
        "file_ext",
        "size",
        "download_path",
        "sha256",
        "tags",
        "review_notes",
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for candidate in candidates:
            row = dataclasses.asdict(candidate)
            row["review_notes"] = " | ".join(candidate.review_notes)
            row["tags"] = " | ".join(candidate.tags)
            writer.writerow({field: row.get(field, "") for field in fieldnames})

    lines = [
        "# AIGril Harvested Resource Attributions",
        "",
        "Review each license before shipping these resources in the app.",
        "",
    ]
    for candidate in candidates:
        lines.append(f"- [{candidate.quality_score:03d}] {candidate.title} ({candidate.source})")
        lines.append(f"  - Kind: {candidate.kind} / License status: {candidate.license_status}")
        if candidate.creator:
            lines.append(f"  - Creator: {candidate.creator}")
        if candidate.tags:
            lines.append(f"  - Tags: {', '.join(candidate.tags)}")
        if candidate.license or candidate.license_url:
            lines.append(f"  - License: {candidate.license} {candidate.license_url}".strip())
        if candidate.page_url:
            lines.append(f"  - Source page: {candidate.page_url}")
        if candidate.download_path:
            lines.append(f"  - Local file: {candidate.download_path}")
    attribution_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    summary = {
        "generated_at": now_iso(),
        "candidates": len(candidates),
        "downloaded": sum(1 for candidate in candidates if candidate.download_path),
        "by_kind": dict(_counter(candidate.kind for candidate in candidates)),
        "by_source": dict(_counter(candidate.source for candidate in candidates)),
        "by_license_status": dict(_counter(candidate.license_status for candidate in candidates)),
        "top_candidates": [
            {
                "title": candidate.title,
                "kind": candidate.kind,
                "source": candidate.source,
                "quality_score": candidate.quality_score,
                "file_name": candidate.file_name,
                "license_status": candidate.license_status,
            }
            for candidate in candidates[:25]
        ],
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover license-aware FBX/VRMA motion resources and open symbolic music resources."
    )
    parser.add_argument("--kind", choices=["motion", "music-text", "all"], default="all")
    parser.add_argument(
        "--source",
        action="append",
        choices=sorted(ADAPTERS.keys()),
        help="Source adapter to use. Repeatable. Defaults to all compatible adapters.",
    )
    parser.add_argument("--query", action="append", help="Search query. Repeatable. Defaults are source-specific.")
    parser.add_argument(
        "--profile",
        choices=sorted(PROFILE_QUERIES.keys()),
        default="performer",
        help="Preset query profile for the virtual-human use case.",
    )
    parser.add_argument("--limit", type=int, default=10, help="Max search results per query/source.")
    parser.add_argument("--output", type=Path, default=Path("output/resource-harvest"))
    parser.add_argument("--download", action="store_true", help="Download allowed files or metadata JSON.")
    parser.add_argument("--extract-archives", action="store_true", help="Unzip downloaded .zip archives into an extracted/ folder.")
    parser.add_argument("--max-bytes", type=int, default=100 * 1024 * 1024, help="Per-file download size cap.")
    parser.add_argument("--delay", type=float, default=0.5, help="Minimum delay between requests to the same host.")
    parser.add_argument("--timeout", type=int, default=45, help="HTTP timeout in seconds.")
    parser.add_argument("--retries", type=int, default=2, help="Retry count for transient HTTP/network errors.")
    parser.add_argument(
        "--allow-noncommercial",
        action="store_true",
        help="Allow CC BY-NC-style licenses. Defaults to false for redistribution safety.",
    )
    parser.add_argument(
        "--include-review-candidates",
        action="store_true",
        help="For motion resources, include candidates with missing/unclear licenses in the manifest without downloading them.",
    )
    parser.add_argument(
        "--download-review-motion-packs",
        action="store_true",
        help="Allow curated motion packs marked review-only to be downloaded into a review directory.",
    )
    parser.add_argument(
        "--review-files-per-item",
        type=int,
        default=5,
        help="Max files to list per unverified Internet Archive item when --include-review-candidates is used.",
    )
    parser.add_argument(
        "--min-quality",
        type=int,
        default=0,
        help="Discard candidates scoring below this threshold after ranking.",
    )
    parser.add_argument(
        "--disable-robots-check",
        action="store_true",
        help="Disable robots.txt checks for direct downloads. Keep this off unless you know the source permits it.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be >= 1")
    if not 0 <= args.min_quality <= 100:
        raise SystemExit("--min-quality must be between 0 and 100")

    run_id = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{time.time_ns()}"
    run_dir = args.output / run_id
    robots = RobotsCache(enabled=not args.disable_robots_check)
    ctx = CrawlContext(args=args, http=HttpClient(args.delay, args.timeout, robots, args.retries))

    selected_sources = args.source or sorted(ADAPTERS.keys())
    selected_kinds = ["motion", "music_text"] if args.kind == "all" else [normalize_kind(args.kind)]
    candidates: list[ResourceCandidate] = []

    for kind in selected_kinds:
        for source_name in selected_sources:
            if not should_run_source(source_name, kind):
                continue
            adapter = ADAPTERS[source_name]
            queries = queries_for(source_name, kind, args.query, args.profile)
            if not queries:
                continue
            candidates.extend(adapter.discover(kind, queries, args.limit, ctx))

    candidates = enrich_candidates(candidates, ctx)
    candidates = dedupe(candidates)
    candidates = [candidate for candidate in candidates if candidate.quality_score >= args.min_quality]
    candidates = sort_candidates(candidates)

    for candidate in candidates:
        materialize_candidate(candidate, run_dir, ctx)

    write_manifests(candidates, run_dir)

    summary = {
        "run_dir": str(run_dir),
        "profile": args.profile,
        "candidates": len(candidates),
        "downloaded": sum(1 for candidate in candidates if candidate.download_path),
        "sources": selected_sources,
        "kinds": selected_kinds,
        "min_quality": args.min_quality,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
