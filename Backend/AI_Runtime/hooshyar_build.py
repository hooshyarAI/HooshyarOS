"""Autonomous HooshyarOS construction entrypoint.

Python is only the repository-native supervisor/worker bridge. The TypeScript
HBOS architecture and its AutonomousBuildDaemon remain authoritative for
mission selection, construction, verification, commit and continuation.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DAEMON = ROOT / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "AutonomousBuildDaemon.ts"
ASSISTANT_ENTRY = ROOT / "Backend" / "HBOS" / "Assistant" / "Autonomous" / "start-autonomous-assistant.ts"
TSX = ROOT / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")
LOCK = ROOT / ".git" / "hooshyar-commercial-build.lock"


def _stream_process(args: list[str], env: dict[str, str]) -> tuple[int, list[str]]:
    process = subprocess.Popen(
        args,
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
    lines: list[str] = []
    try:
        for line in process.stdout:
            print(line, end="")
            lines.append(line.rstrip("\r\n"))
    finally:
        process.stdout.close()
    return process.wait(), lines


def run_assistant_orchestrator() -> tuple[int, str | None]:
    """Run the canonical AssistantOrchestrator entrypoint exactly once."""
    if not ASSISTANT_ENTRY.exists():
        print(f"ERROR: missing canonical Assistant entrypoint: {ASSISTANT_ENTRY}", file=sys.stderr)
        return 2, None
    if not TSX.exists():
        print(f"ERROR: missing local tsx executable: {TSX}", file=sys.stderr)
        return 2, None

    env = os.environ.copy()
    env["HOOSHYAR_AGENT"] = env.get("HOOSHYAR_AGENT", "auto")
    env["HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS"] = env.get("HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS", "7")
    code, lines = _stream_process([str(TSX), str(ASSISTANT_ENTRY)], env)
    result_status: str | None = None
    for line in reversed(lines):
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if payload.get("type") == "AUTONOMOUS_ASSISTANT_ORCHESTRATION_RESULT":
            result_status = payload.get("status")
            break
    return code, result_status


def run_daemon() -> tuple[int, bool, bool]:
    """Run the canonical platform daemon; it owns mission/repair decisions."""
    if not DAEMON.exists():
        print(f"ERROR: missing autonomous daemon: {DAEMON}", file=sys.stderr)
        return 2, False, False
    if not TSX.exists():
        print(f"ERROR: missing local tsx executable: {TSX}", file=sys.stderr)
        return 2, False, False

    env = os.environ.copy()
    env["HOOSHYAR_AGENT"] = env.get("HOOSHYAR_AGENT", "auto")
    env["HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS"] = env.get("HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS", "7")
    env["HOOSHYAR_BUILD_PHASE"] = "platform"
    code, lines = _stream_process([str(TSX), str(DAEMON)], env)
    completed = any('"type":"AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE"' in line for line in lines)
    blocked = any('"type":"AUTONOMOUS_BLOCKED"' in line for line in lines)
    return code, completed, blocked


def commercial_supervisor(max_attempts: int, retry_seconds: int, deadline_hours: float) -> int:
    """Run the canonical Assistant -> platform pipeline until completion/block."""
    started = time.monotonic()
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    if LOCK.exists():
        print('{"type":"AUTONOMOUS_COMMERCIAL_BLOCKED","reason":"ANOTHER_COMMERCIAL_SUPERVISOR_IS_RUNNING"}')
        return 2

    LOCK.write_text(f"pid={os.getpid()}\nstarted={time.time()}\n", encoding="utf-8")
    print('{"type":"AUTONOMOUS_COMMERCIAL_SUPERVISOR_START","mode":"commercial","orchestrator":"AssistantOrchestrator"}')
    try:
        for attempt in range(1, max_attempts + 1):
            elapsed = time.monotonic() - started
            if elapsed >= deadline_hours * 3600:
                print('{"type":"AUTONOMOUS_COMMERCIAL_DEADLINE","status":"blocked","reason":"SUPERVISOR_DEADLINE_EXCEEDED"}')
                return 1

            agent = os.environ.get("HOOSHYAR_AGENT", "auto")
            print(f'{{"type":"AUTONOMOUS_COMMERCIAL_ATTEMPT","attempt":{attempt},"elapsedSeconds":{int(elapsed)},"agent":"{agent}"}}')

            assistant_code, assistant_status = run_assistant_orchestrator()
            print(json.dumps({
                "type": "AUTONOMOUS_ASSISTANT_HANDOFF",
                "attempt": attempt,
                "returnCode": assistant_code,
                "status": assistant_status,
            }, ensure_ascii=False))
            if assistant_code != 0:
                print(json.dumps({
                    "type": "AUTONOMOUS_COMMERCIAL_BLOCKED",
                    "status": "blocked",
                    "attempt": attempt,
                    "returnCode": assistant_code,
                    "reason": "ASSISTANT_ORCHESTRATION_DID_NOT_COMPLETE",
                }))
                return 1

            return_code, completed, blocked = run_daemon()
            if completed:
                print(f'{{"type":"AUTONOMOUS_COMMERCIAL_COMPLETE","status":"completed","attempts":{attempt}}}')
                return 0
            if blocked:
                print(f'{{"type":"AUTONOMOUS_COMMERCIAL_BLOCKED","status":"blocked","attempt":{attempt},"returnCode":{return_code},"reason":"CANONICAL_DAEMON_TERMINAL_BLOCK"}}')
                return 1

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
        return run_assistant_orchestrator()[0]
    if args.phase == "platform":
        return run_daemon()[0]
    return commercial_supervisor(args.max_attempts, args.retry_seconds, args.deadline_hours)


if __name__ == "__main__":
    raise SystemExit(main())
