"""Two-command autonomous HooshyarOS construction entrypoint.

The Assistant phase runs the canonical autonomous daemon until the Assistant
completion gate hands off to platform construction. The platform phase then
runs the same daemon to exhaustion. Python remains the repository-native worker
and this wrapper does not replace the TypeScript HBOS architecture.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DAEMON = ROOT / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "AutonomousBuildDaemon.ts"
TSX = ROOT / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")
HANDOFF_MARKER = '"type":"AUTONOMOUS_PLATFORM_CONTINUATION"'
COMPLETE_MARKER = '"type":"AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE"'


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

    return process.wait()


def main() -> int:
    parser = argparse.ArgumentParser(description="HooshyarOS two-command autonomous builder")
    parser.add_argument("phase", choices=("assistant", "platform"))
    args = parser.parse_args()

    if args.phase == "assistant":
        return run_daemon(assistant_phase=True)

    return run_daemon(assistant_phase=False)


if __name__ == "__main__":
    raise SystemExit(main())
