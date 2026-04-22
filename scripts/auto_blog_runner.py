from __future__ import annotations

import argparse
import json
import os
import shutil
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "backend" / "blog_content" / "auto_blog_runs" / "2026-04-22-16h-blog-autowriter"
PROMPT_FILE = RUN_DIR / "RUNNER_PROMPT.md"
RUNNER_LOG = RUN_DIR / "RUNNER_LOG.md"
RUNNER_STATUS = RUN_DIR / "RUNNER_STATUS.json"
LAST_MESSAGE = RUN_DIR / "last_runner_message.md"
LOCK_FILE = RUN_DIR / "runner.lock"

DEFAULT_MAIN_WORKTREE = Path("F:/AIGril_tmp_main")

ALLOWED_EXACT_PATHS = {
    "backend/blog_content/posts.json",
    "backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/STATUS.md",
    "backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/PROGRESS_LOG.md",
    "backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/final_100_page_report.md",
}

ALLOWED_PREFIXES = (
    "backend/blog_content/posts/zh/",
    "backend/blog_content/posts/en/",
)

IGNORED_RUNTIME_PATHS = {
    "backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/RUNNER_LOG.md",
    "backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/RUNNER_STATUS.json",
    "backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/last_runner_message.md",
}


def is_allowed_publish_path(path: str) -> bool:
    normalized = path.replace("\\", "/")
    if normalized in IGNORED_RUNTIME_PATHS:
        return False
    return normalized in ALLOWED_EXACT_PATHS or normalized.startswith(ALLOWED_PREFIXES)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def append_log(text: str) -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    with RUNNER_LOG.open("a", encoding="utf-8") as fh:
        fh.write(text.rstrip() + "\n\n")


def write_status(**updates: object) -> None:
    current: dict[str, object] = {}
    if RUNNER_STATUS.exists():
        try:
            current = json.loads(RUNNER_STATUS.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            current = {"status_parse_error": True}
    current.update(updates)
    current["updated_at"] = now_iso()
    RUNNER_STATUS.write_text(
        json.dumps(current, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def run_cmd(
    args: list[str],
    cwd: Path = ROOT,
    timeout: int | None = None,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd),
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=check,
    )


def resolve_codex_command() -> str:
    """Use the Windows npm command shim; bare `codex` can resolve to a non-executable shim."""
    if os.name == "nt":
        for candidate in ("codex.cmd", "codex.bat"):
            path = shutil.which(candidate)
            if path:
                return path
    path = shutil.which("codex")
    return path or "codex"


def acquire_lock() -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise RuntimeError(f"runner lock already exists: {LOCK_FILE}")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(f"pid={os.getpid()}\nstarted_at={now_iso()}\n")


def release_lock() -> None:
    try:
        LOCK_FILE.unlink()
    except FileNotFoundError:
        pass


def build_codex_prompt() -> str:
    base_prompt = PROMPT_FILE.read_text(encoding="utf-8")
    return (
        base_prompt
        + "\n\n"
        + "## Runner Context\n\n"
        + f"- Runner started at: {now_iso()}\n"
        + "- Remember: do not run Git commands. The Python runner handles Git after you exit.\n"
    )


def run_codex_iteration(model: str, codex_timeout: int) -> int:
    prompt = build_codex_prompt()
    LAST_MESSAGE.write_text("", encoding="utf-8")
    codex_cmd = resolve_codex_command()
    args = [
        codex_cmd,
        "exec",
        "--cd",
        str(ROOT),
        "--model",
        model,
        "--dangerously-bypass-approvals-and-sandbox",
        "--output-last-message",
        str(LAST_MESSAGE),
        "-",
    ]
    append_log(
        "## Runner Iteration Started\n\n"
        f"- Time: `{now_iso()}`\n"
        f"- Command: `{shlex.join(args[:-1])} -`\n"
    )
    proc = subprocess.run(
        args,
        input=prompt,
        cwd=str(ROOT),
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=codex_timeout,
    )
    append_log(
        "## Codex Worker Finished\n\n"
        f"- Time: `{now_iso()}`\n"
        f"- Exit code: `{proc.returncode}`\n\n"
        "```text\n"
        + proc.stdout[-6000:]
        + "\n```\n"
    )
    return proc.returncode


def validate_posts_json() -> None:
    posts_json = ROOT / "backend" / "blog_content" / "posts.json"
    proc = run_cmd([sys.executable, "-m", "json.tool", str(posts_json)], timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"posts.json validation failed:\n{proc.stdout}")


def changed_allowed_paths() -> list[str]:
    proc = run_cmd(["git", "status", "--porcelain=v1"], timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(proc.stdout)

    paths: list[str] = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        raw_path = line[3:]
        if " -> " in raw_path:
            raw_path = raw_path.split(" -> ", 1)[1]
        if is_allowed_publish_path(raw_path):
            paths.append(raw_path)
    return sorted(set(paths))


def commit_allowed_changes() -> str | None:
    cached = run_cmd(["git", "diff", "--cached", "--name-only"], timeout=30)
    if cached.returncode != 0:
        raise RuntimeError(cached.stdout)
    staged_unrelated = [
        path
        for path in cached.stdout.splitlines()
        if path and not is_allowed_publish_path(path)
    ]
    if staged_unrelated:
        raise RuntimeError(
            "refusing to commit because unrelated files are already staged:\n"
            + "\n".join(staged_unrelated)
        )

    paths = changed_allowed_paths()
    if not paths:
        append_log(f"## Git Commit Skipped\n\n- Time: `{now_iso()}`\n- Reason: no allowed blog changes\n")
        return None

    add_proc = run_cmd(["git", "add", "--", *paths], timeout=60)
    if add_proc.returncode != 0:
        raise RuntimeError(f"git add failed:\n{add_proc.stdout}")

    commit_proc = run_cmd(["git", "commit", "-m", "docs: auto blog runner iteration"], timeout=120)
    if commit_proc.returncode != 0:
        raise RuntimeError(f"git commit failed:\n{commit_proc.stdout}")

    rev_proc = run_cmd(["git", "rev-parse", "HEAD"], timeout=30, check=True)
    commit_hash = rev_proc.stdout.strip()
    append_log(
        "## Git Commit Created\n\n"
        f"- Time: `{now_iso()}`\n"
        f"- Commit: `{commit_hash}`\n"
        f"- Files: `{len(paths)}`\n"
    )
    return commit_hash


def push_via_main_worktree(commit_hash: str, main_worktree: Path) -> None:
    if not main_worktree.exists():
        append_log(
            "## Push Skipped\n\n"
            f"- Time: `{now_iso()}`\n"
            f"- Reason: main worktree does not exist: `{main_worktree}`\n"
        )
        return

    status = run_cmd(["git", "status", "--short"], cwd=main_worktree, timeout=30)
    if status.returncode != 0:
        raise RuntimeError(status.stdout)
    if status.stdout.strip():
        append_log(
            "## Push Skipped\n\n"
            f"- Time: `{now_iso()}`\n"
            "- Reason: main worktree is dirty\n\n"
            "```text\n"
            + status.stdout
            + "\n```\n"
        )
        return

    for cmd in (
        ["git", "fetch", "origin", "main"],
        ["git", "pull", "--rebase", "origin", "main"],
        ["git", "cherry-pick", commit_hash],
        ["git", "push", "origin", "HEAD:main"],
    ):
        proc = run_cmd(cmd, cwd=main_worktree, timeout=180)
        if proc.returncode != 0:
            raise RuntimeError(f"{shlex.join(cmd)} failed:\n{proc.stdout}")

    append_log(
        "## Git Push Completed\n\n"
        f"- Time: `{now_iso()}`\n"
        f"- Commit: `{commit_hash}`\n"
        f"- Main worktree: `{main_worktree}`\n"
    )


def run_once(args: argparse.Namespace) -> None:
    started = now_iso()
    write_status(
        runner="active",
        last_run_started_at=started,
        last_error=None,
        mode="local-runner",
    )
    exit_code = run_codex_iteration(args.model, args.codex_timeout)
    if exit_code != 0:
        write_status(runner="error", last_run_finished_at=now_iso(), last_exit_code=exit_code)
        return

    validate_posts_json()
    commit_hash = None if args.no_git else commit_allowed_changes()
    if commit_hash and not args.no_push:
        push_via_main_worktree(commit_hash, Path(args.main_worktree))

    write_status(
        runner="idle",
        last_run_finished_at=now_iso(),
        last_exit_code=exit_code,
        last_commit=commit_hash,
        no_git=args.no_git,
        no_push=args.no_push,
    )


def parse_until(value: str | None) -> float | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).timestamp()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the AIGril auto blog writer locally.")
    parser.add_argument("--once", action="store_true", help="Run one iteration and exit.")
    parser.add_argument("--run-immediately", action="store_true", help="Run once before waiting.")
    parser.add_argument("--interval-seconds", type=int, default=300)
    parser.add_argument("--until", default="2026-04-22T23:50:00+08:00")
    parser.add_argument("--model", default="gpt-5.4")
    parser.add_argument("--codex-timeout", type=int, default=1800)
    parser.add_argument("--main-worktree", default=str(DEFAULT_MAIN_WORKTREE))
    parser.add_argument("--no-git", action="store_true")
    parser.add_argument("--no-push", action="store_true")
    args = parser.parse_args()

    until_ts = parse_until(args.until)
    write_status(
        runner="starting",
        interval_seconds=args.interval_seconds,
        until=args.until,
        main_worktree=args.main_worktree,
        no_git=args.no_git,
        no_push=args.no_push,
    )

    first = True
    while True:
        if until_ts and time.time() >= until_ts:
            write_status(runner="complete", completed_at=now_iso(), reason="until reached")
            append_log(f"## Runner Complete\n\n- Time: `{now_iso()}`\n- Reason: until reached\n")
            return 0

        if first and not args.run_immediately and not args.once:
            first = False
        else:
            try:
                acquire_lock()
                try:
                    run_once(args)
                finally:
                    release_lock()
            except Exception as exc:  # noqa: BLE001 - runner must persist and log failures.
                append_log(
                    "## Runner Error\n\n"
                    f"- Time: `{now_iso()}`\n"
                    f"- Error: `{exc}`\n"
                )
                write_status(runner="error", last_error=str(exc), last_run_finished_at=now_iso())
                release_lock()
                if args.once:
                    return 1

        if args.once:
            return 0

        next_run = time.time() + args.interval_seconds
        write_status(runner="sleeping", next_run_at=datetime.fromtimestamp(next_run).astimezone().isoformat(timespec="seconds"))
        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
