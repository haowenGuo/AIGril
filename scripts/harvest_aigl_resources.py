#!/usr/bin/env python3
"""
License-aware resource discovery for AIGril.

The harvester only uses public APIs, keeps source/license metadata, and downloads
files only when --download is provided. It intentionally does not scrape login
gated marketplaces, lyric sites, or pages with unclear rights.
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import robotparser
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen


APP_VERSION = "0.1.0"
CONTACT = os.getenv("AIGRIL_HARVESTER_CONTACT", "local-run")
USER_AGENT = os.getenv(
    "AIGRIL_HARVESTER_USER_AGENT",
    f"AIGrilResourceHarvester/{APP_VERSION} ({CONTACT})",
)

MOTION_EXTENSIONS = {".fbx", ".vrma"}
MOTION_REVIEW_EXTENSIONS = MOTION_EXTENSIONS | {".zip", ".7z"}
MUSIC_TEXT_EXTENSIONS = {".musicxml", ".mxl", ".mei", ".abc", ".krn", ".ly", ".mid", ".midi"}
DOWNLOADABLE_EXTENSIONS = MOTION_EXTENSIONS | MUSIC_TEXT_EXTENSIONS

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
            "extension:musicxml",
            "extension:mxl music",
            "extension:mei music",
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
    "curated-commercial": {
        "motion": [
            "thingiverse",
            "rokoko",
            "commercial-free",
        ],
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
            except Exception as error:  # noqa: BLE001 - robotparser raises broad network errors.
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

    def get_json(
        self,
        url: str,
        params: dict[str, Any] | list[tuple[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
        min_delay: float | None = None,
    ) -> dict[str, Any]:
        full_url = url
        if params:
            full_url = f"{url}?{urlencode(params, doseq=True)}"
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

        return results[: max(limit, len(results))]


ADAPTERS = {
    "internet-archive": InternetArchiveAdapter(),
    "github": GitHubAdapter(),
    "musicbrainz": MusicBrainzAdapter(),
    "openverse": OpenverseAdapter(),
    "curated-commercial": CuratedCommercialAdapter(),
}


def queries_for(source: str, kind: str, user_queries: list[str] | None) -> list[str]:
    if user_queries:
        return user_queries
    return list(DEFAULT_QUERIES.get(source, {}).get(kind, []))


def should_run_source(source: str, kind: str) -> bool:
    if source == "curated-commercial" and kind == "motion":
        return True
    return bool(DEFAULT_QUERIES.get(source, {}).get(kind)) or source in {"internet-archive", "github"}


def dedupe(candidates: list[ResourceCandidate]) -> list[ResourceCandidate]:
    seen: set[tuple[str, str, str]] = set()
    unique: list[ResourceCandidate] = []
    for candidate in candidates:
        key = (candidate.source, candidate.source_id, candidate.asset_url or candidate.page_url)
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)
    return unique


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
        except Exception as error:  # noqa: BLE001 - report and continue other resources.
            candidate.review_notes.append(f"Download failed: {error}")
            eprint(f"[download] Failed {candidate.asset_url}: {error}")
        return

    if candidate.file_ext == ".json":
        name = safe_file_name(candidate.file_name, f"{candidate.source}_{candidate.source_id}.json")
        target = category_dir / name
        target.write_text(json.dumps(candidate.metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        candidate.download_path = str(target)
        candidate.sha256 = hashlib.sha256(target.read_bytes()).hexdigest()


def write_manifests(candidates: list[ResourceCandidate], run_dir: Path) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = run_dir / "manifest.jsonl"
    csv_path = run_dir / "manifest.csv"
    attribution_path = run_dir / "ATTRIBUTIONS.md"

    with manifest_path.open("w", encoding="utf-8") as manifest:
        for candidate in candidates:
            manifest.write(json.dumps(dataclasses.asdict(candidate), ensure_ascii=False) + "\n")

    fieldnames = [
        "kind",
        "source",
        "title",
        "creator",
        "license",
        "license_url",
        "page_url",
        "asset_url",
        "file_name",
        "file_ext",
        "size",
        "download_path",
        "sha256",
        "review_notes",
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for candidate in candidates:
            row = dataclasses.asdict(candidate)
            row["review_notes"] = " | ".join(candidate.review_notes)
            writer.writerow({field: row.get(field, "") for field in fieldnames})

    lines = [
        "# AIGril Harvested Resource Attributions",
        "",
        "Review each license before shipping these resources in the app.",
        "",
    ]
    for candidate in candidates:
        lines.append(f"- {candidate.title} ({candidate.source})")
        if candidate.creator:
            lines.append(f"  - Creator: {candidate.creator}")
        if candidate.license or candidate.license_url:
            lines.append(f"  - License: {candidate.license} {candidate.license_url}".strip())
        if candidate.page_url:
            lines.append(f"  - Source page: {candidate.page_url}")
        if candidate.download_path:
            lines.append(f"  - Local file: {candidate.download_path}")
    attribution_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover license-aware FBX/VRMA motion resources and open music metadata/text resources."
    )
    parser.add_argument("--kind", choices=["motion", "music-text", "all"], default="all")
    parser.add_argument(
        "--source",
        action="append",
        choices=sorted(ADAPTERS.keys()),
        help="Source adapter to use. Repeatable. Defaults to all compatible adapters.",
    )
    parser.add_argument("--query", action="append", help="Search query. Repeatable. Defaults are source-specific.")
    parser.add_argument("--limit", type=int, default=10, help="Max search results per query/source.")
    parser.add_argument("--output", type=Path, default=Path("output/resource-harvest"))
    parser.add_argument("--download", action="store_true", help="Download allowed files or metadata JSON.")
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
        "--disable-robots-check",
        action="store_true",
        help="Disable robots.txt checks for direct downloads. Keep this off unless you know the source permits it.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be >= 1")

    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
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
            queries = queries_for(source_name, kind, args.query)
            if not queries:
                continue
            candidates.extend(adapter.discover(kind, queries, args.limit, ctx))

    candidates = dedupe(candidates)
    for candidate in candidates:
        materialize_candidate(candidate, run_dir, ctx)

    write_manifests(candidates, run_dir)

    summary = {
        "run_dir": str(run_dir),
        "candidates": len(candidates),
        "downloaded": sum(1 for candidate in candidates if candidate.download_path),
        "sources": selected_sources,
        "kinds": selected_kinds,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
