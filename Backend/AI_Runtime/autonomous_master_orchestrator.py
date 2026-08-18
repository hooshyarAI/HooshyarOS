"""Fail-closed autonomous master cycle with live progress telemetry."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAX_CYCLES = max(1, int(os.environ.get("HOOSHYAR_MASTER_MAX_CYCLES", "10")))
FULL_VERIFY_EVERY = max(1, int(os.environ.get("HOOSHYAR_MASTER_FULL_VERIFY_EVERY", "5")))
BRANCH = "agent/release-final"
STAGES = {"IMPLEMENT_REPAIR": 50, "VERIFY": 75, "PUBLISH": 95, "CYCLE_COMPLETE": 100}


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def progress(cycle: int, stage: str, started: float, *, capability_id: str | None = None, target_engine: str | None = None, status: str = "running") -> None:
    elapsed_ms = int((time.monotonic() - started) * 1000)
    pct = STAGES.get(stage)
    emit("AUTONOMOUS_PROGRESS", cycle=cycle, maxCycles=MAX_CYCLES, stage=stage, stagePercent=pct,
         cyclePercent=pct, percentKnown=pct is not None, capabilityId=capability_id,
         targetEngine=target_engine, elapsedMs=elapsed_ms, estimatedRemainingMs=None,
         status=status)


def run(command: list[str], timeout: int, *, cycle: int | None = None, stage: str | None = None) -> tuple[int, str]:
    executable = command[0]
    if os.name == "nt" and executable in {"npm", "npx"}:
        executable = f"{executable}.cmd"
    started = time.monotonic()
    process = subprocess.Popen(
        [executable, *command[1:]], cwd=ROOT, text=True, encoding="utf-8", errors="replace",
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=1,
    )
    lines: list[str] = []
    try:
        assert process.stdout is not None
        for line in process.stdout:
            lines.append(line)
            print(line, end="", flush=True)
            if cycle is not None and stage is not None:
                progress(cycle, stage, started)
    finally:
        process.stdout.close() if process.stdout else None
    code = process.wait(timeout=timeout)
    return code, "".join(lines)


def git_porcelain() -> str | None:
    code, output = run(["git", "status", "--porcelain"], 60)
    if code != 0:
        emit("AUTONOMOUS_MASTER_BLOCKED", stage="AUDIT", reason="git-status-failed")
        return None
    return output.strip()


def git_clean() -> bool:
    status = git_porcelain()
    return status == "" if status is not None else False


def verify(full: bool, cycle: int | None = None) -> bool:
    emit("AUTONOMOUS_MASTER_VERIFY", full=full)
    if cycle is not None:
        progress(cycle, "VERIFY", time.monotonic())
    checks: list[tuple[list[str], int]] = [
        ([sys.executable, "Backend/AI_Runtime/tests/test_autonomous_spec.py", "-q"], 15 * 60),
        ([sys.executable, "Backend/AI_Runtime/tests/test_autonomous_builder_platform.py", "-q"], 15 * 60),
    ]
    if full:
        checks.append((["npm", "test", "--", "--runInBand"], 60 * 60))
    for command, timeout in checks:
        code, _ = run(command, timeout, cycle=cycle, stage="VERIFY")
        if code != 0:
            emit("AUTONOMOUS_MASTER_BLOCKED", stage="VERIFY", command=command, reason="verification-failed")
            return False
    return True


def run_builder(cycle: int) -> bool:
    emit("AUTONOMOUS_MASTER_STAGE", stage="IMPLEMENT_REPAIR")
    progress(cycle, "IMPLEMENT_REPAIR", time.monotonic())
    code, _ = run(["npm", "run", "autonomous:build"], 90 * 60, cycle=cycle, stage="IMPLEMENT_REPAIR")
    return code == 0


def commit_verified_changes(cycle: int) -> bool:
    progress(cycle, "PUBLISH", time.monotonic())
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
        code, _ = run(command, timeout, cycle=cycle, stage="PUBLISH")
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
    code, _ = run([sys.executable, "Backend/AI_Runtime/productization_worker.py"], 90 * 60, stage="PUBLISH")
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
        cycle_started = time.monotonic()
        emit("AUTONOMOUS_MASTER_CYCLE", cycle=cycle)
        if not run_builder(cycle):
            progress(cycle, "IMPLEMENT_REPAIR", cycle_started, status="blocked")
            emit("AUTONOMOUS_MASTER_BLOCKED", stage="IMPLEMENT_REPAIR", cycle=cycle, reason="builder-failed")
            return 21
        changes = git_porcelain()
        if changes is None:
            return 22
        full = cycle % FULL_VERIFY_EVERY == 0
        if not verify(full, cycle):
            progress(cycle, "VERIFY", cycle_started, status="blocked")
            emit("AUTONOMOUS_MASTER_EVIDENCE_PRESERVED", cycle=cycle, changes=changes)
            return 23
        if not commit_verified_changes(cycle):
            progress(cycle, "PUBLISH", cycle_started, status="blocked")
            return 24
        if not git_clean():
            return 25
        progress(cycle, "CYCLE_COMPLETE", cycle_started, status="completed")
        emit("AUTONOMOUS_MASTER_CYCLE_COMPLETE", cycle=cycle, fullVerify=full)

    if not verify(True):
        return 26
    if not git_clean():
        return 27
    if not run_productization():
        return 28
    if not git_clean():
        return 29
    emit("AUTONOMOUS_MASTER_COMPLETE", engineeringVerified=True, commercialReady=False,
         commercialProductizationEnabled=os.environ.get("HOOSHYAR_PRODUCTIZATION_MODE", "").strip() == "1",
         reason="final commercial and standardization gates remain evidence-driven")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
