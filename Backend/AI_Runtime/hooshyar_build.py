"""Autonomous HooshyarOS construction entrypoint.

Python is only the repository-native supervisor/worker bridge. The TypeScript
HBOS architecture and its AutonomousBuildDaemon remain authoritative for
mission selection, construction, verification, commit and continuation.
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
LOCK = ROOT / ".git" / "hooshyar-commercial-build.lock"
HANDOFF_MARKER = '"type":"AUTONOMOUS_PLATFORM_CONTINUATION"'
COMPLETE_MARKER = '"type":"AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE"'
BLOCKED_MARKER = '"type":"AUTONOMOUS_BLOCKED"'


def run_daemon(*, assistant_phase: bool) -> tuple[int, bool, bool]:
    """Run one canonical daemon invocation.

    The daemon owns all construction decisions. This supervisor only streams
    output and distinguishes proven completion from a terminal blocked result.
    """
    if not DAEMON.exists():
        print(f"ERROR: missing autonomous daemon: {DAEMON}", file=sys.stderr)
        return 2, False, False
    if not TSX.exists():
        print(f"ERROR: missing local tsx executable: {TSX}", file=sys.stderr)
        return 2, False, False

    env = os.environ.copy()
    # Preserve the selected implementation agent. The canonical
    # LocalConstructionToolset owns the kilo/python selection policy.
    env["HOOSHYAR_AGENT"] = env.get("HOOSHYAR_AGENT", "auto")
    env["HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS"] = env.get("HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS", "7")
    env["HOOSHYAR_BUILD_PHASE"] = "assistant" if assistant_phase else "platform"

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
    complete_seen = False
    blocked_seen = False

    try:
        for line in process.stdout:
            print(line, end="")
            if HANDOFF_MARKER in line:
                handoff_seen = True
            if COMPLETE_MARKER in line:
                complete_seen = True
            if BLOCKED_MARKER in line:
                blocked_seen = True
            if assistant_phase and handoff_seen:
                print('{"type":"AUTONOMOUS_ASSISTANT_PHASE_COMPLETE","status":"completed","next":"platform","deadlineDays":7}')
                process.terminate()
                break
    finally:
        process.stdout.close()

    return_code = process.wait()
    if assistant_phase and handoff_seen:
        return 0, True, False
    return return_code, complete_seen, blocked_seen


def commercial_supervisor(max_attempts: int, retry_seconds: int, deadline_hours: float) -> int:
    """Continuously run the canonical daemon until completion or terminal block."""
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

            print(f'{{"type":"AUTONOMOUS_COMMERCIAL_ATTEMPT","attempt":{attempt},"elapsedSeconds":{int(elapsed)},"agent":"{os.environ.get("HOOSHYAR_AGENT", "auto")}"}}')
            return_code, completed, blocked = run_daemon(assistant_phase=False)
            if completed:
                print(f'{{"type":"AUTONOMOUS_COMMERCIAL_COMPLETE","status":"completed","attempts":{attempt}}}')
                return 0
            if blocked:
                print(f'{{"type":"AUTONOMOUS_COMMERCIAL_BLOCKED","status":"blocked","attempt":{attempt},"returnCode":{return_code},"reason":"CANONICAL_DAEMON_TERMINAL_BLOCK"}}')
                return 1

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
