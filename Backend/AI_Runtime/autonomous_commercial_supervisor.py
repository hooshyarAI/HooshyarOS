from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAX_CYCLES = int(os.environ.get("HOOSHYAR_AUTONOMOUS_MAX_CYCLES", "50"))
REPAIR_BUDGET = int(os.environ.get("HOOSHYAR_AUTONOMOUS_REPAIR_BUDGET", "3"))

GOVERNING_FILES = (
    "Docs/HOOSHYAROS_MASTER_CHARTER.md",
    "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md",
    "Docs/ARCHITECTURE.md",
    "Assistant/SYSTEM_PROMPT.md",
    "Docs/HOOSHYAROS_FINAL_DECISIONS_REGISTER.md",
    "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json",
)

REQUIRED_MARKERS = (
    "Architecture Freeze V4",
    "One Capability = One Engine = One Test = One Commit",
    "AUDIT → SELECT NEXT GENUINELY MISSING CAPABILITY",
    "Detect → Diagnose → Select Repair Tool",
    "External coding assistants",
    "Python",
    "GitHub",
)

PROHIBITED_CONSTRUCTION_PROVIDERS = (
    "codex",
    "github copilot",
    "copilot",
    "claude",
    "cursor",
    "cline",
    "aider",
)


def run(command: list[str], timeout: int = 45 * 60) -> tuple[int, str]:
    print(f"\n>>> {' '.join(command)}", flush=True)
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


def fingerprint(output: str) -> str:
    events = json_events(output)
    for event in reversed(events):
        if event.get("type") == "AUTONOMOUS_BLOCKED":
            result = event.get("result") or {}
            if isinstance(result, dict):
                return "BLOCKED:" + json.dumps(
                    result.get("issues") or result.get("details") or result,
                    ensure_ascii=False,
                    sort_keys=True,
                )
    return "OUTPUT:" + output[-4000:]


def read_governing_context() -> tuple[bool, str]:
    missing: list[str] = []
    combined: list[str] = []
    for relative in GOVERNING_FILES:
        path = ROOT / relative
        if not path.exists() or not path.is_file():
            missing.append(relative)
            continue
        try:
            combined.append(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError):
            missing.append(relative)
    if missing:
        return False, "missing-governing-files:" + ",".join(missing)

    corpus = "\n".join(combined)
    absent = [marker for marker in REQUIRED_MARKERS if marker.lower() not in corpus.lower()]
    if absent:
        return False, "governing-marker-missing:" + ",".join(absent)

    digest = sha256(corpus.encode("utf-8")).hexdigest()[:16]
    print(f"GOVERNING_CONTEXT_OK digest={digest}", flush=True)
    return True, digest


def enforce_construction_toolchain() -> tuple[bool, str]:
    configured = os.environ.get("HOOSHYAR_AGENT", "python").strip().lower()
    if configured != "python":
        return False, f"invalid-construction-provider:{configured or '<empty>'}"

    env_blob = " ".join(f"{key}={value}" for key, value in os.environ.items()).lower()
    for provider in PROHIBITED_CONSTRUCTION_PROVIDERS:
        if provider in env_blob and f"hooshyar_allow_{provider.replace(' ', '_')}" not in env_blob:
            if re.search(rf"(?:agent|provider|coder|coding|construction)[^\n=]*{re.escape(provider)}|{re.escape(provider)}[^\n=]*(?:agent|provider|coder|coding|construction)", env_blob):
                return False, f"prohibited-construction-provider:{provider}"
    print("CONSTRUCTION_TOOLCHAIN_OK provider=python+github+assistant", flush=True)
    return True, "python+github+assistant"


def validate_plan(output: str) -> tuple[bool, str]:
    plan = last_event(output, "AUTONOMOUS_WEAVING_PLAN")
    mission = last_event(output, "AUTONOMOUS_MISSION")
    if not plan or not mission:
        return False, "missing-weaving-plan-or-mission"

    payload = plan.get("plan") or {}
    mission_capability = mission.get("capability") or ""
    capability_id = payload.get("capabilityId") or ""
    if not capability_id:
        return False, "missing-capability-id"
    if capability_id == "platform.continuation":
        return False, "continuation-token-selected-as-capability"
    if mission.get("commit") is None:
        return False, "missing-checkpoint"
    if not payload.get("dependencyOrder") and not payload.get("verificationOrder"):
        return False, "incomplete-weaving-plan"
    if not payload.get("stopConditions"):
        return False, "missing-stop-conditions"
    if "genuinely missing" not in mission_capability.lower() and not capability_id.startswith("repair-"):
        if "implement" not in mission_capability.lower() and "provide" not in mission_capability.lower():
            return False, "mission-does-not-describe-canonical-capability-work"
    return True, capability_id


def focused_repair(output: str) -> bool:
    if "product.web-application-shell" in output:
        code, _ = run([sys.executable, "Backend/AI_Runtime/commercial_autorepair.py"])
        return code == 0
    return False


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
    print(f"REPAIR_BUDGET={REPAIR_BUDGET}", flush=True)

    context_ok, context_reason = read_governing_context()
    if not context_ok:
        print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
        print(f"REASON=GOVERNING_CONTEXT_INVALID:{context_reason}", flush=True)
        return 10

    toolchain_ok, toolchain_reason = enforce_construction_toolchain()
    if not toolchain_ok:
        print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
        print(f"REASON=CONSTRUCTION_TOOLCHAIN_INVALID:{toolchain_reason}", flush=True)
        return 11

    seen_failures: dict[str, int] = {}
    repair_attempts = 0

    for cycle in range(1, MAX_CYCLES + 1):
        print(f"\n=== SUPERVISOR CYCLE {cycle} ===", flush=True)

        build_code, _ = run(["npm.cmd", "run", "build"])
        if build_code != 0:
            platform_code, platform_output = run(
                [sys.executable, "Backend/AI_Runtime/hooshyar_build.py", "platform"],
                timeout=90 * 60,
            )
            key = fingerprint(platform_output)
            seen_failures[key] = seen_failures.get(key, 0) + 1
            repair_attempts += 1
            if repair_attempts > REPAIR_BUDGET:
                print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
                print("REASON=BOUNDED_REPAIR_BUDGET_EXHAUSTED", flush=True)
                return 2
            if focused_repair(platform_output):
                continue
            if seen_failures[key] >= REPAIR_BUDGET:
                print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
                print("REASON=REPEATED_UNRESOLVED_BUILD_FAILURE", flush=True)
                return 3
            continue

        platform_code, platform_output = run(
            [sys.executable, "Backend/AI_Runtime/hooshyar_build.py", "platform"],
            timeout=90 * 60,
        )

        plan_ok, plan_reason = validate_plan(platform_output)
        if not plan_ok:
            print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
            print(f"REASON=CONSTITUTIONAL_PLAN_VIOLATION:{plan_reason}", flush=True)
            return 12

        blocked = last_event(platform_output, "AUTONOMOUS_BLOCKED")
        if blocked or platform_code != 0:
            key = fingerprint(platform_output)
            seen_failures[key] = seen_failures.get(key, 0) + 1
            repair_attempts += 1
            if focused_repair(platform_output):
                continue
            if repair_attempts >= REPAIR_BUDGET or seen_failures[key] >= REPAIR_BUDGET:
                print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
                print("REASON=BOUNDED_REPAIR_BUDGET_EXHAUSTED", flush=True)
                return 4
            continue

        complete_event = last_event(platform_output, "AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE")
        if complete_event:
            if full_regression():
                print("AUTONOMOUS_COMMERCIAL_SUPERVISOR_COMPLETE", flush=True)
                return 0
            repair_attempts += 1
            if repair_attempts >= REPAIR_BUDGET:
                print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
                print("REASON=REGRESSION_REPAIR_BUDGET_EXHAUSTED", flush=True)
                return 5
            continue

        if full_regression():
            time.sleep(0.2)
            continue

        repair_attempts += 1
        if repair_attempts >= REPAIR_BUDGET:
            print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
            print("REASON=REGRESSION_REPAIR_BUDGET_EXHAUSTED", flush=True)
            return 6

    print("AUTONOMOUS_SUPERVISOR_STOPPED", flush=True)
    print("REASON=MAX_CYCLES_EXCEEDED", flush=True)
    return 7


if __name__ == "__main__":
    raise SystemExit(main())
