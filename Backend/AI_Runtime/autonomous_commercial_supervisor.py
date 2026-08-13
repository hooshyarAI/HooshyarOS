from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
MAX_CYCLES = int(os.environ.get("HOOSHYAR_AUTONOMOUS_MAX_CYCLES", "50"))


def run(command: list[str], timeout: int = 45 * 60) -> tuple[int, str]:
    print(f"\n>>> {' '.join(command)}", flush=True)
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    completed = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
        env=env,
    )
    output = completed.stdout or ""
    print(output, end="", flush=True)
    return completed.returncode, output


def json_events(output: str) -> list[dict]:
    events: list[dict] = []
    for line in output.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            events.append(value)
    return events


def last_event(output: str, event_type: str) -> dict | None:
    for event in reversed(json_events(output)):
        if event.get("type") == event_type:
            return event
    return None


def blocked_event(output: str) -> dict | None:
    return last_event(output, "AUTONOMOUS_BLOCKED")


def fingerprint(output: str) -> str:
    event = blocked_event(output)
    if event:
        result = event.get("result") or {}
        if isinstance(result, dict):
            return "BLOCKED:" + json.dumps(
                result.get("issues") or result.get("details") or result,
                ensure_ascii=False,
                sort_keys=True,
            )
    return "OUTPUT:" + output[-4000:]


def construction_self_heal() -> bool:
    code, _ = run([sys.executable, "Backend/AI_Runtime/repair_construction_idempotency.py"], timeout=10 * 60)
    return code == 0


def focused_repair(output: str) -> bool:
    repaired = False
    if "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE" in output or "AUTONOMOUS_BEHAVIORAL_EVIDENCE_INCOMPLETE" in output:
        repaired = construction_self_heal() or repaired
    if "product.web-application-shell" in output:
        code, _ = run([sys.executable, "Backend/AI_Runtime/commercial_autorepair.py"], timeout=45 * 60)
        repaired = code == 0 or repaired
    return repaired


def full_regression() -> bool:
    code, _ = run(["npm.cmd", "run", "build"])
    if code != 0:
        return False
    code, _ = run(["npm.cmd", "test", "--", "--runInBand"], timeout=90 * 60)
    return code == 0


def main() -> int:
    print("AUTONOMOUS_COMMERCIAL_SUPERVISOR_START", flush=True)
    print(f"ROOT={ROOT}", flush=True)
    print(f"MAX_CYCLES={MAX_CYCLES}", flush=True)

    seen_failures: dict[str, int] = {}
    for cycle in range(1, MAX_CYCLES + 1):
        print(f"\n=== SUPERVISOR CYCLE {cycle} ===", flush=True)

        construction_self_heal()

        build_code, build_output = run(["npm.cmd", "run", "build"])
        if build_code != 0:
            platform_code, platform_output = run([sys.executable, "Backend/AI_Runtime/hooshyar_build.py", "platform"], timeout=90 * 60)
            blocked = blocked_event(platform_output)
            if platform_code != 0 or blocked:
                key = fingerprint(platform_output or build_output)
                seen_failures[key] = seen_failures.get(key, 0) + 1
                if focused_repair(platform_output or build_output):
                    continue
                if seen_failures[key] >= 3:
                    print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
                    print("REASON=REPEATED_UNRESOLVED_BUILD_FAILURE", flush=True)
                    return 2
                continue

        platform_code, platform_output = run([sys.executable, "Backend/AI_Runtime/hooshyar_build.py", "platform"], timeout=90 * 60)
        blocked = blocked_event(platform_output)
        if platform_code != 0 or blocked:
            key = fingerprint(platform_output)
            seen_failures[key] = seen_failures.get(key, 0) + 1
            if focused_repair(platform_output):
                continue
            if seen_failures[key] >= 3:
                print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
                print("REASON=REPEATED_UNRESOLVED_PLATFORM_FAILURE", flush=True)
                return 3
            continue

        complete_event = last_event(platform_output, "AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE")
        if complete_event:
            if full_regression():
                print("AUTONOMOUS_COMMERCIAL_SUPERVISOR_COMPLETE", flush=True)
                return 0
            continue

        if full_regression():
            time.sleep(0.2)
            continue

        continue

    print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
    print("REASON=MAX_CYCLES_EXCEEDED", flush=True)
    return 4


if __name__ == "__main__":
    raise SystemExit(main())
