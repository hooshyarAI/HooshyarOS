from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
ASSISTANT_CONTROLLER = ROOT / "Backend/AI_Runtime/hooshyar_build.py"
GOVERNING_FILES = [
    ROOT / "Docs/HOOSHYAROS_MASTER_CHARTER.md",
    ROOT / "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md",
    ROOT / "Docs/ARCHITECTURE.md",
    ROOT / "Assistant/SYSTEM_PROMPT.md",
    ROOT / "Docs/HOOSHYAROS_FINAL_DECISIONS_REGISTER.md",
    ROOT / "Docs/HOOSHYAROS_COMMERCIAL_SCOPE_RECONCILIATION.md",
    ROOT / "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json",
]
GOVERNING_ARTIFACTS = GOVERNING_FILES
REQUIRED_MARKERS = [
    "Architecture Freeze V4", "Everything is an Engine", "One Capability",
    "Reasoning Engine", "Governance Engine", "Executive Intelligence Engine",
    "Organizational Intelligence Engine", "Autonomous Operations Engine",
]
SUBORDINATE_MARKERS = [
    "The Assistant is the autonomous engineering executor",
    "Python is the canonical construction worker/orchestration layer",
    "The autonomous Assistant is NOT the platform's future financial, managerial or commercial advisor",
    "Platform continuation", "REPAIR", "RE-PLAN",
]


def read_governing_context() -> tuple[bool, str]:
    missing = [str(path.relative_to(ROOT)) for path in GOVERNING_FILES if not path.is_file()]
    if missing:
        return False, "missing:" + ",".join(missing)
    merged = "\n".join(path.read_text(encoding="utf-8", errors="replace") for path in GOVERNING_FILES)
    if not all(token in merged for token in REQUIRED_MARKERS):
        return False, "governing-architecture-markers-missing"
    if not all(marker in merged for marker in SUBORDINATE_MARKERS):
        return False, "assistant-supervisor-subordination-contract-missing"
    if not ASSISTANT_CONTROLLER.is_file():
        return False, "assistant-construction-controller-missing"
    return True, "repository-governance-valid"


def enforce_construction_toolchain() -> tuple[bool, str]:
    if os.environ.get("HOOSHYAR_AGENT", "python").strip().lower() != "python":
        return False, "python+github+assistant-only"
    return (True, "python+github+assistant") if ASSISTANT_CONTROLLER.is_file() else (False, "assistant-construction-controller-missing")


def validate_plan(output: str) -> tuple[bool, str]:
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
    weaving = next((event for event in reversed(events) if event.get("type") == "AUTONOMOUS_WEAVING_PLAN"), None)
    mission = next((event for event in reversed(events) if event.get("type") == "AUTONOMOUS_MISSION"), None)
    if not weaving or not mission:
        return False, "missing-weaving-plan-or-mission"
    plan = weaving.get("plan") or {}
    capability_id = str(plan.get("capabilityId") or "")
    if capability_id == "platform.continuation":
        return False, "continuation-token-selected-as-capability"
    for field in ("dependencyOrder", "verificationOrder", "stopConditions"):
        if not isinstance(plan.get(field), list) or not plan[field]:
            return False, f"missing-{field}"
    if not str(mission.get("commit") or "").strip():
        return False, "missing-trusted-checkpoint"
    return (False, "missing-capability-id") if not capability_id else (True, capability_id)


def validate_constitution() -> bool:
    ok, reason = read_governing_context()
    if not ok:
        print(json.dumps({"type": "AUTONOMOUS_GOVERNANCE_BLOCKED", "reason": reason}, ensure_ascii=False), flush=True)
        return False
    tool_ok, tool_reason = enforce_construction_toolchain()
    if not tool_ok:
        print(json.dumps({"type": "AUTONOMOUS_GOVERNANCE_BLOCKED", "reason": tool_reason}, ensure_ascii=False), flush=True)
        return False
    print(json.dumps({
        "type": "AUTONOMOUS_GOVERNANCE_OK",
        "sourceOfTruthCount": len(GOVERNING_FILES),
        "parentController": str(ASSISTANT_CONTROLLER.relative_to(ROOT)),
        "role": "subordinate-recovery-and-verification",
        "independentArchitectureAuthority": False,
        "independentCapabilitySelection": False,
    }, ensure_ascii=False), flush=True)
    return True


def run(command: list[str], timeout: int = 45 * 60) -> int:
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    env["HOOSHYAR_CONSTRUCTION_PARENT"] = "assistant"
    env["HOOSHYAR_SUPERVISOR_ROLE"] = "subordinate-recovery-and-verification"
    print(f"\n>>> {' '.join(command)}", flush=True)
    result = subprocess.run(command, cwd=ROOT, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, check=False, env=env)
    print(result.stdout or "", end="", flush=True)
    return result.returncode


def perform_recovery(failure_output: str) -> int:
    plan_ok, plan_reason = validate_plan(failure_output)
    if not plan_ok:
        print(json.dumps({"type": "AUTONOMOUS_SUPERVISOR_BLOCKED", "reason": plan_reason}, ensure_ascii=False), flush=True)
        return 6
    repaired = False
    repair_markers = (
        "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE",
        "AUTONOMOUS_BEHAVIORAL_EVIDENCE_INCOMPLETE",
        "AUTONOMOUS_WORKTREE_DIRTY",
        "AUTONOMOUS_WORKTREE_DIRTY_AFTER_VERIFY",
        "AUTONOMOUS_ARTIFACT_BOUNDARY_VIOLATION",
    )
    if any(marker in failure_output for marker in repair_markers):
        repaired = run([sys.executable, "Backend/AI_Runtime/repair_construction_idempotency.py"], timeout=10 * 60) == 0 or repaired
    if "product.web-application-shell" in failure_output:
        repaired = run([sys.executable, "Backend/AI_Runtime/commercial_autorepair.py"], timeout=45 * 60) == 0 or repaired
    if not repaired:
        print(json.dumps({"type": "AUTONOMOUS_SUPERVISOR_BLOCKED", "reason": "no-safe-repair-strategy-matched"}, ensure_ascii=False), flush=True)
        return 7
    if run(["npm.cmd", "run", "build"], timeout=30 * 60) != 0:
        return 8
    if run(["npm.cmd", "test", "--", "--runInBand"], timeout=90 * 60) != 0:
        return 9
    print(json.dumps({
        "type": "AUTONOMOUS_SUPERVISOR_RECOVERY_COMPLETE",
        "parentController": str(ASSISTANT_CONTROLLER.relative_to(ROOT)),
        "action": "REPAIR → VERIFY → RETURN_TO_ASSISTANT",
        "independentCapabilitySelection": False,
        "independentArchitectureAuthority": False,
    }, ensure_ascii=False), flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Assistant-subordinate HooshyarOS recovery supervisor")
    parser.add_argument("--failure-file", required=True)
    args = parser.parse_args()
    if os.environ.get("HOOSHYAR_CONSTRUCTION_PARENT") != "assistant":
        print(json.dumps({"type": "AUTONOMOUS_SUPERVISOR_BLOCKED", "reason": "supervisor-must-be-launched-by-construction-assistant"}, ensure_ascii=False), flush=True)
        return 5
    if not validate_constitution():
        return 5
    failure_file = Path(args.failure_file)
    if not failure_file.is_file():
        print(json.dumps({"type": "AUTONOMOUS_SUPERVISOR_BLOCKED", "reason": "failure-context-missing"}, ensure_ascii=False), flush=True)
        return 6
    return perform_recovery(failure_file.read_text(encoding="utf-8", errors="replace"))


if __name__ == "__main__":
    raise SystemExit(main())
