from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Finding:
    category: str
    message: str
    path: str = ""
    severity: str = "INFO"


@dataclass(frozen=True)
class Evidence:
    source: str
    checks: tuple[str, ...]
    findings: tuple[Finding, ...]
    digest: str


def canonical_path(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def scan_repository(root: Path, excluded: Iterable[str] = (".git", "node_modules", "dist")) -> tuple[Finding, ...]:
    excluded_set = set(excluded)
    findings: list[Finding] = []
    for directory, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in excluded_set]
        for name in files:
            path = Path(directory) / name
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if size > 25 * 1024 * 1024:
                findings.append(Finding("artifact", "oversized repository file", canonical_path(path, root), "WARN"))
            if path.suffix.lower() in {".env", ".pem", ".key"} and name not in {".env.example"}:
                findings.append(Finding("secret-boundary", "sensitive-looking file requires policy review", canonical_path(path, root), "WARN"))
    return tuple(findings)


def analyze_ci_log(text: str) -> tuple[Finding, ...]:
    patterns = {
        "test-failure": r"(?:FAIL|failed|failure|Failures:)",
        "typescript": r"(?:TS\d{3,5}|TypeScript).*(?:error|Error)",
        "dependency": r"(?:module not found|cannot find module|dependency|npm ERR!)",
        "path": r"(?:ENOENT|No such file|not found).*(?:/|\\)",
        "timeout": r"(?:timeout|timed out|exceeded.*time)",
    }
    findings: list[Finding] = []
    for category, pattern in patterns.items():
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            findings.append(Finding(category, f"CI log contains {category} evidence", severity="WARN"))
    return tuple(findings)


def compare_artifacts(left: Path, right: Path) -> tuple[Finding, ...]:
    findings: list[Finding] = []
    if not left.exists() or not right.exists():
        return (Finding("artifact", "artifact comparison target missing", severity="ERROR"),)
    if left.is_file() and right.is_file():
        if sha256(left) != sha256(right):
            findings.append(Finding("artifact", "file digests differ", severity="WARN"))
        else:
            findings.append(Finding("artifact", "file digests match"))
        return tuple(findings)
    left_files = {p.relative_to(left).as_posix() for p in left.rglob("*") if p.is_file()}
    right_files = {p.relative_to(right).as_posix() for p in right.rglob("*") if p.is_file()}
    for name in sorted(left_files - right_files):
        findings.append(Finding("artifact", "missing from right artifact", name, "WARN"))
    for name in sorted(right_files - left_files):
        findings.append(Finding("artifact", "missing from left artifact", name, "WARN"))
    for name in sorted(left_files & right_files):
        left_digest = sha256(left / name)
        right_digest = sha256(right / name)
        if left_digest != right_digest:
            findings.append(Finding("artifact", "file digests differ", name, "WARN"))
    return tuple(findings)


def dependency_closure(root: Path) -> tuple[Finding, ...]:
    findings: list[Finding] = []
    package = root / "package.json"
    if not package.exists():
        return (Finding("dependency", "package.json missing", severity="WARN"),)
    try:
        data = json.loads(package.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return (Finding("dependency", f"invalid package.json: {exc}", severity="ERROR"),)
    declared = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    lock = root / "package-lock.json"
    if declared and not lock.exists():
        findings.append(Finding("dependency", "declared npm dependencies have no lockfile", severity="WARN"))
    return tuple(findings)


def run_readonly(command: list[str], root: Path, timeout: int = 120) -> tuple[int, str]:
    result = subprocess.run(command, cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            timeout=timeout, check=False, env={**os.environ, "PYTHONUTF8": "1"})
    return result.returncode, result.stdout
