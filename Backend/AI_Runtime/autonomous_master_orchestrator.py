"""Fail-closed autonomous master cycle for HooshyarOS."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAX_CYCLES = max(1, int(os.environ.get("HOOSHYAR_MASTER_MAX_CYCLES", "10")))
FULL_VERIFY_EVERY = max(1, int(os.environ.get("HOOSHYAR_MASTER_FULL_VERIFY_EVERY", "5")))
BRANCH = "agent/release-final"


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def run(command: list[str], timeout: int) -> tuple[int, str]:
    executable = command[0]
    if os.name == "nt" and executable in {"npm", "npx"}:
        executable = f"{executable}.cmd"
    result = subprocess.run(
        [executable, *command[1:]], cwd=ROOT, text=True, encoding="utf-8", errors="replace",
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    return result.returncode, result.stdout


def git_porcelain() -> str | None:
    code, output = run(["git", "status", "--porcelain"], 60)
    if code != 0:
        emit("AUTONOMOUS_MASTER_BLOCKED", stage="AUDIT", reason="git-status-failed")
        return None
    return output.strip()


def git_clean() -> bool:
    status = git_porcelain()
    return status == "" if status is not None else False


def verify(full: bool) -> bool:
    emit("AUTONOMOUS_MASTER_VERIFY", full=full)
    checks: list[tuple[list[str], int]] = [
        ([sys.executable, "Backend/AI_Runtime/tests/test_autonomous_spec.py", "-q"], 15 * 60),
        ([sys.executable, "Backend/AI_Runtime/tests/test_autonomous_builder_platform.py", "-q"], 15 * 60),
    ]
    if full:
        checks.append((["npm", "test", "--", "--runInBand"], 60 * 60))
    for command, timeout in checks:
        code, _ = run(command, timeout)
        if code != 0:
            emit("AUTONOMOUS_MASTER_BLOCKED", stage="VERIFY", command=command, reason="verification-failed")
            return False
    return True


def run_builder() -> bool:
    emit("AUTONOMOUS_MASTER_STAGE", stage="IMPLEMENT_REPAIR")
    code, _ = run(["npm", "run", "autonomous:build"], 90 * 60)
    return code == 0


def commit_verified_changes(cycle: int) -> bool:
    status = git_porcelain()
    if status is None:
        return False
    if not status:
        emit("AUTONOMOUS_MASTER_NO_REPOSITORY_CHANGE", cycle=cycle)
        return True
    message = f"chore(autonomous): promote verified cycle {cycle}"
    for command, timeout in [
        (["git", "add", "-A"], 60),
        (["git", "commit", "-m", message], 5 * 60),
        (["git", "push", "origin", BRANCH], 15 * 60),
    ]:
        code, _ = run(command, timeout)
        if code != 0:
            emit("AUTONOMOUS_MASTER_BLOCKED", stage="PUBLISH", cycle=cycle, reason="publish-step-failed", command=command)
            return False
    emit("AUTONOMOUS_MASTER_PUBLISHED", cycle=cycle, branch=BRANCH)
    return True


def run_productization() -> bool:
    if os.environ.get("HOOSHYAR_PRODUCTIZATION_MODE", "").strip() != "1":
        emit("AUTONOMOUS_PRODUCTIZATION_DEFERRED", reason="commercial-productization-not-enabled")
        return True
    emit("AUTONOMOUS_MASTER_STAGE", stage="COMMERCIAL_PRODUCTIZATION")
    code, _ = run([sys.executable, "Backend/AI_Runtime/productization_worker.py"], 90 * 60)
    if code != 0:
        emit("AUTONOMOUS_MASTER_BLOCKED", stage="COMMERCIAL_PRODUCTIZATION", reason="productization-failed")
        return False
    return True


def main() -> int:
    emit("AUTONOMOUS_MASTER_START", maxCycles=MAX_CYCLES, fullVerifyEvery=FULL_VERIFY_EVERY)
    if not git_clean():
        emit("AUTONOMOUS_MASTER_BLOCKED", stage="AUDIT", reason="starting-worktree-not-clean")
        return 20

    for cycle in range(1, MAX_CYCLES + 1):
        emit("AUTONOMOUS_MASTER_CYCLE", cycle=cycle)
        if not run_builder():
            emit("AUTONOMOUS_MASTER_BLOCKED", stage="IMPLEMENT_REPAIR", cycle=cycle, reason="builder-failed")
            return 21
        changes = git_porcelain()
        if changes is None:
            return 22
        full = cycle % FULL_VERIFY_EVERY == 0
        if not verify(full):
            emit("AUTONOMOUS_MASTER_EVIDENCE_PRESERVED", cycle=cycle, changes=changes)
            return 23
        if not commit_verified_changes(cycle):
            return 24
        if not git_clean():
            return 25
        emit("AUTONOMOUS_MASTER_CYCLE_COMPLETE", cycle=cycle, fullVerify=full)

    if not verify(True):
        return 26
    if not git_clean():
        return 27
    if not run_productization():
        return 28
    if not git_clean():
        return 29
    emit(
        "AUTONOMOUS_MASTER_COMPLETE",
        engineeringVerified=True,
        commercialReady=False,
        commercialProductizationEnabled=os.environ.get("HOOSHYAR_PRODUCTIZATION_MODE", "").strip() == "1",
        reason="final commercial and standardization gates remain evidence-driven",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
