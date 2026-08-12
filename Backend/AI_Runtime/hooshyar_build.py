"""Two-command autonomous HooshyarOS construction entrypoint.

The Assistant phase runs the canonical autonomous daemon until the Assistant
completion gate hands off to platform construction. The platform phase then
runs the same daemon to exhaustion. Python remains the repository-native worker
and this wrapper does not replace the TypeScript HBOS architecture.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DAEMON = ROOT / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "AutonomousBuildDaemon.ts"
TSX = ROOT / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")
HANDOFF_MARKER = '\"type\":\"AUTONOMOUS_PLATFORM_CONTINUATION\"'
ROADMAP = ROOT / "Docs" / "Product" / "PRODUCT_CONSTRUCTION_ROADMAP.json"


def run(command: str, args: list[str], timeout: int = 30 * 60) -> subprocess.CompletedProcess[str]:
    executable = command
    if os.name == "nt" and command == "npm":
        executable = "npm.cmd"
    return subprocess.run(
        [executable, *args],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
    )


def status_paths() -> list[str]:
    result = run("git", ["status", "--porcelain=v1", "--untracked-files=all"])
    if result.returncode != 0:
        return []
    paths: list[str] = []
    for line in result.stdout.splitlines():
        if len(line) >= 4:
            paths.append(line[3:].strip().replace("/", os.sep))
    return paths


def resumable_product_paths() -> list[Path]:
    if not ROADMAP.exists():
        return []
    try:
        roadmap = json.loads(ROADMAP.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    candidates: list[Path] = []
    for capability in roadmap.get("capabilities", []):
        capability_id = str(capability.get("capabilityId", ""))
        implementation = capability.get("implementationPath")
        test = capability.get("testPath")
        documentation = capability.get("documentationPath")
        if not capability_id or not implementation or not test or not documentation:
            continue
        expected = [ROOT / str(implementation), ROOT / str(test), ROOT / str(documentation)]
        if all(path.exists() for path in expected):
            candidates.extend(expected)
    return candidates


def is_resumable_generation_state() -> tuple[bool, list[str]]:
    dirty = status_paths()
    if not dirty:
        return False, []
    expected = [p.resolve() for p in resumable_product_paths()]
    if not expected:
        return False, dirty

    for relative in dirty:
        candidate = (ROOT / relative).resolve()
        allowed = any(
            candidate == path
            or (path.is_dir() and path in candidate.parents)
            for path in expected
        )
        if not allowed:
            return False, dirty
    return True, dirty


def resume_interrupted_generation() -> bool:
    resumable, dirty = is_resumable_generation_state()
    if not resumable:
        return False

    print(json.dumps({
        "type": "AUTONOMOUS_RESUME_GENERATION",
        "status": "detected",
        "changedPaths": dirty,
        "action": "VERIFY → COMMIT → PUSH → CONTINUE"
    }, ensure_ascii=False))

    verification = run("npm", ["test", "--", "--runInBand"], timeout=45 * 60)
    print(verification.stdout, end="")
    if verification.returncode != 0:
        print(json.dumps({
            "type": "AUTONOMOUS_RESUME_GENERATION",
            "status": "blocked",
            "reason": "verification failed",
            "exitCode": verification.returncode
        }, ensure_ascii=False))
        return False

    add = run("git", ["add", "-A"])
    print(add.stdout, end="")
    if add.returncode != 0:
        return False

    commit = run("git", ["commit", "-m", "feat(hbos): autonomous construction progress"])
    print(commit.stdout, end="")
    if commit.returncode != 0:
        return False

    branch = run("git", ["branch", "--show-current"])
    print(branch.stdout, end="")
    branch_name = branch.stdout.strip()
    if branch.returncode != 0 or not branch_name:
        return False

    push = run("git", ["push", "origin", branch_name])
    print(push.stdout, end="")
    if push.returncode != 0:
        return False

    print(json.dumps({
        "type": "AUTONOMOUS_RESUME_GENERATION",
        "status": "completed",
        "action": "VERIFY → COMMIT → PUSH → CONTINUE"
    }, ensure_ascii=False))
    return True


def run_daemon(*, assistant_phase: bool) -> int:
    if not DAEMON.exists():
        print(f"ERROR: missing autonomous daemon: {DAEMON}", file=sys.stderr)
        return 2
    if not TSX.exists():
        print(f"ERROR: missing local tsx executable: {TSX}", file=sys.stderr)
        return 2

    env = os.environ.copy()
    env["HOOSHYAR_AGENT"] = "python"
    env["HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS"] = "7"
    env["HOOSHYAR_BUILD_PHASE"] = "assistant" if assistant_phase else "platform"
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    process = subprocess.Popen(
        [str(TSX), str(DAEMON)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    assert process.stdout is not None
    handoff_seen = False

    try:
        for line in process.stdout:
            print(line, end="")
            if assistant_phase and HANDOFF_MARKER in line:
                handoff_seen = True
                print('{"type":"AUTONOMOUS_ASSISTANT_PHASE_COMPLETE","status":"completed","next":"platform","deadlineDays":7}')
                process.terminate()
                break
    finally:
        if process.stdout is not None:
            process.stdout.close()

    if assistant_phase and handoff_seen:
        try:
            return_code = process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            return_code = process.wait(timeout=10)
        if return_code not in (0, -15, 1, 130, 143):
            return return_code
        return 0

    return_code = process.wait()
    if not assistant_phase and return_code != 0 and resume_interrupted_generation():
        return run_daemon(assistant_phase=False)
    return return_code


def main() -> int:
    parser = argparse.ArgumentParser(description="HooshyarOS two-command autonomous builder")
    parser.add_argument("phase", choices=("assistant", "platform"))
    args = parser.parse_args()

    if args.phase == "assistant":
        return run_daemon(assistant_phase=True)
    return run_daemon(assistant_phase=False)


if __name__ == "__main__":
    raise SystemExit(main())