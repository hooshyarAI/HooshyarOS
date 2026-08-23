"""Autonomous HooshyarOS construction entrypoint.

Modes:
- assistant: build the assistant until the canonical platform handoff.
- platform: run the canonical platform daemon once to exhaustion.
- commercial: unattended commercial construction supervisor. It repeatedly
  invokes the canonical daemon, allowing it to AUDIT -> SELECT -> IMPLEMENT ->
  TEST -> INTEGRATE -> VERIFY -> COMMIT -> PUSH -> AUDIT AGAIN until the
  commercial completion audit succeeds or a bounded supervisor deadline is hit.

Python is only the repository-native implementation worker/supervisor. The
TypeScript HBOS architecture remains authoritative.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DAEMON = ROOT / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "AutonomousBuildDaemon.ts"
TSX = ROOT / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")


def resolve_lock_path() -> Path:
    """Resolve the Git metadata path correctly for normal repos and worktrees."""
    try:
        raw = subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", "--git-path", "hooshyar-commercial-build.lock"],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        path = Path(raw)
        return path if path.is_absolute() else ROOT / path
    except (OSError, subprocess.CalledProcessError):
        return ROOT / ".hooshyar-commercial-build.lock"


LOCK = resolve_lock_path()
HANDOFF_MARKER = '"type":"AUTONOMOUS_PLATFORM_CONTINUATION"'
COMPLETE_MARKER = '"type":"AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE"'
BLOCKED_MARKER = '"type":"AUTONOMOUS_BLOCKED"'
IDLE_MARKER = '"type":"AUTONOMOUS_IDLE"'


def run_daemon(*, assistant_phase: bool) -> tuple[int, bool]:
    """Run one canonical daemon invocation and report whether it completed."""
    if not DAEMON.exists():
        print(f"ERROR: missing autonomous daemon: {DAEMON}", file=sys.stderr)
        return 2, False
    if not TSX.exists():
        print(f"ERROR: missing local tsx executable: {TSX}", file=sys.stderr)
        return 2, False

    env = os.environ.copy()
    env["HOOSHYAR_AGENT"] = "python"
    env["HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS"] = env.get("HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS", "7")
    env["HOOSHYAR_BUILD_PHASE"] = "assistant" if assistant_phase else "platform"

    process = subprocess.Popen(
        [str(TSX), str(DAEMON)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    assert process.stdout is not None
    handoff_seen = False
    complete_seen = False

    try:
        for line in process.stdout:
            print(line, end="")
            if assistant_phase and HANDOFF_MARKER in line:
                handoff_seen = True
                print('{"type":"AUTONOMOUS_ASSISTANT_PHASE_COMPLETE","status":"completed","next":"platform","deadlineDays":7}')
                process.terminate()
                break
            if not assistant_phase and COMPLETE_MARKER in line:
                complete_seen = True
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
            return return_code, False
        return 0, True

    return process.wait(), complete_seen


def commercial_supervisor(max_attempts: int, retry_seconds: int, deadline_hours: float) -> int:
    """Keep the canonical daemon running until commercial completion is proven.

    A failed/blocked daemon invocation is never treated as completion. The
    supervisor restarts the daemon from the repository's verified checkpoint.
    Each daemon invocation itself owns capability selection, implementation,
    focused/full verification, commit and push. This layer only supplies
    unattended continuity and a bounded safety envelope.
    """
    started = time.monotonic()
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    if LOCK.exists():
        print('{"type":"AUTONOMOUS_COMMERCIAL_BLOCKED","reason":"ANOTHER_COMMERCIAL_SUPERVISOR_IS_RUNNING"}')
        return 2

    LOCK.write_text(f"pid={os.getpid()}\nstarted={time.time()}\n", encoding="utf-8")
    print('{"type":"AUTONOMOUS_COMMERCIAL_SUPERVISOR_START","mode":"commercial"}')
    try:
        for attempt in range(1, max_attempts + 1):
            elapsed = time.monotonic() - started
            if elapsed >= deadline_hours * 3600:
                print('{"type":"AUTONOMOUS_COMMERCIAL_DEADLINE","status":"blocked","reason":"SUPERVISOR_DEADLINE_EXCEEDED"}')
                return 1

            print(f'{{"type":"AUTONOMOUS_COMMERCIAL_ATTEMPT","attempt":{attempt},"elapsedSeconds":{int(elapsed)}}}')
            return_code, completed = run_daemon(assistant_phase=False)
            if completed:
                print(f'{{"type":"AUTONOMOUS_COMMERCIAL_COMPLETE","status":"completed","attempts":{attempt}}}')
                return 0

            print(
                f'{{"type":"AUTONOMOUS_COMMERCIAL_RETRY","attempt":{attempt},'
                f'"returnCode":{return_code},"reason":"DAEMON_DID_NOT_PROVE_COMMERCIAL_COMPLETION"}}'
            )
            if attempt == max_attempts:
                print('{"type":"AUTONOMOUS_COMMERCIAL_DEAD_END","status":"blocked","reason":"MAX_SUPERVISOR_ATTEMPTS_EXCEEDED"}')
                return 1
            time.sleep(max(1, retry_seconds))
    finally:
        try:
            LOCK.unlink()
        except FileNotFoundError:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description="HooshyarOS autonomous construction supervisor")
    parser.add_argument("phase", choices=("assistant", "platform", "commercial"))
    parser.add_argument("--max-attempts", type=int, default=int(os.getenv("HOOSHYAR_COMMERCIAL_MAX_ATTEMPTS", "100")))
    parser.add_argument("--retry-seconds", type=int, default=int(os.getenv("HOOSHYAR_COMMERCIAL_RETRY_SECONDS", "15")))
    parser.add_argument("--deadline-hours", type=float, default=float(os.getenv("HOOSHYAR_COMMERCIAL_DEADLINE_HOURS", "168")))
    args = parser.parse_args()

    if args.phase == "assistant":
        return run_daemon(assistant_phase=True)[0]
    if args.phase == "platform":
        return run_daemon(assistant_phase=False)[0]
    return commercial_supervisor(args.max_attempts, args.retry_seconds, args.deadline_hours)


if __name__ == "__main__":
    raise SystemExit(main())
