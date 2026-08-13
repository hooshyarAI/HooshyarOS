"""Two-command autonomous HooshyarOS construction entrypoint."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DAEMON = ROOT / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "AutonomousBuildDaemon.ts"
BUILDER = ROOT / "Backend" / "AI_Runtime" / "autonomous_builder.py"
TSX = ROOT / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")
HANDOFF_MARKER = '"type":"AUTONOMOUS_PLATFORM_CONTINUATION"'
ROADMAP = ROOT / "Docs" / "Product" / "PRODUCT_CONSTRUCTION_ROADMAP.json"

MAX_SELF_HEAL_ATTEMPTS = 3


def run(command: str, args: list[str], timeout: int = 30 * 60) -> subprocess.CompletedProcess[str]:
    executable = "npm.cmd" if os.name == "nt" and command == "npm" else command
    return subprocess.run(
        [executable, *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace",
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, check=False,
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
    )


def status_paths() -> list[str]:
    result = run("git", ["status", "--porcelain=v1", "--untracked-files=all"])
    if result.returncode != 0:
        return []
    return [line[3:].strip().replace("/", os.sep) for line in result.stdout.splitlines() if len(line) >= 4]


def roadmap_capabilities() -> list[dict]:
    if not ROADMAP.exists():
        return []
    try:
        roadmap = json.loads(ROADMAP.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return [c for c in roadmap.get("capabilities", []) if c.get("capabilityId")]


def _artifact_is_complete(path: Path) -> bool:
    if not path.exists():
        return False
    return path.is_dir() if path.suffix == "" else path.is_file()


def resumable_product_paths() -> list[Path]:
    candidates: list[Path] = []
    for capability in roadmap_capabilities():
        implementation = capability.get("implementationPath")
        test = capability.get("testPath")
        documentation = capability.get("documentationPath")
        if not implementation or not test or not documentation:
            continue
        expected = [ROOT / str(implementation), ROOT / str(test), ROOT / str(documentation)]
        if all(_artifact_is_complete(path) for path in expected):
            candidates.extend(expected)
    return candidates


def _path_matches(candidate: Path, declared: Path) -> bool:
    return candidate == declared or (declared.is_dir() and declared in candidate.parents)


def _capability_complete(capability: dict) -> bool:
    implementation = capability.get("implementationPath")
    test = capability.get("testPath")
    documentation = capability.get("documentationPath")
    return bool(
        implementation and test and documentation and
        _artifact_is_complete(ROOT / str(implementation)) and
        _artifact_is_complete(ROOT / str(test)) and
        _artifact_is_complete(ROOT / str(documentation))
    )


def _dirty_overlaps_capability(dirty: list[str], capability: dict) -> bool:
    values = [capability.get("implementationPath"), capability.get("testPath"), capability.get("documentationPath")]
    declared = [(ROOT / str(value)).resolve() for value in values if value]
    return any(
        any(_path_matches((ROOT / relative).resolve(), path) or _path_matches(path, (ROOT / relative).resolve()) for path in declared)
        for relative in dirty
    )


def _capability_prompt(capability: dict) -> str:
    dependencies = ", ".join(str(x) for x in capability.get("dependencies", [])) or "none"
    rules = "; ".join([
        "Architecture Freeze V4", "One Capability = One Engine", "Engine must be observable",
        "Engine must be testable", "Engine must be recoverable", "No duplicate capability owner",
        "Generated artifacts must stay inside the declared capability boundary",
    ])
    directives = "; ".join([
        "Implement exactly one concrete capability from the canonical mission.",
        "Create or update the focused implementation, focused test and documentation required by the architecture.",
        "Repair verification failures before finalization.", "Do not redesign Architecture Freeze V4.",
        "Never modify an existing dependency, engine, test or document merely to make the selected capability appear implemented.",
        "For a product capability, implement the product artifact paths declared by the durable product roadmap.",
        "Use only repository-native Python construction.",
    ])
    return "\n".join([
        "You are the repository-native Python implementation worker inside HooshyarOS Autonomous Operations Engine.",
        "Read AGENTS.md, Docs/ARCHITECTURE.md, and Assistant/SYSTEM_PROMPT.md before changing code.",
        f"Capability ID: {capability.get('capabilityId')}",
        f"Capability: {capability.get('capability')}",
        f"Target Engine: {capability.get('targetEngine')}",
        f"Dependencies: {dependencies}",
        "Required artifact paths: " + "; ".join([
            str(capability.get("implementationPath", "")), str(capability.get("testPath", "")), str(capability.get("documentationPath", ""))
        ]),
        f"Architecture rules: {rules}", f"Directives: {directives}",
        "Reuse existing capabilities and engine boundaries; never invent business semantics that are absent from repository architecture or evidence.",
    ])


def _frontend_directory_import(implementation: str) -> str | None:
    normalized = implementation.replace("\\", "/").rstrip("/")
    if not normalized.startswith("Frontend/"):
        return None
    if normalized.endswith("/index.ts"):
        normalized = normalized[: -len("/index.ts")]
    elif normalized.endswith("/index"):
        normalized = normalized[: -len("/index")]
    if not normalized:
        return None
    return "../../../" + normalized


def _frontend_product_symbol(implementation: str) -> str | None:
    normalized = implementation.replace("\\", "/").rstrip("/")
    if not normalized.startswith("Frontend/"):
        return None
    if normalized.endswith("/index.ts"):
        return Path(normalized.split("/")[-2]).name
    if normalized.endswith("/index"):
        return Path(normalized.split("/")[-2]).name
    return Path(normalized.split("/")[-1]).stem


def _repair_generated_product_test(capability: dict) -> bool:
    implementation = str(capability.get("implementationPath", "")).replace("\\", "/")
    test_path_value = capability.get("testPath")
    if not test_path_value or not implementation.startswith("Frontend/"):
        return False
    test_path = ROOT / str(test_path_value)
    if not test_path.exists() or not test_path.is_file():
        return False
    import_target = _frontend_directory_import(implementation)
    class_name = _frontend_product_symbol(implementation)
    if not import_target or not class_name:
        return False
    content = test_path.read_text(encoding="utf-8", errors="replace")
    import_pattern = re.compile(r'^import\s*\{[^}]+\}\s*from\s*"[^"]+";?$', re.MULTILINE)
    replacement = f'import {{ {class_name} }} from "{import_target}";'
    repaired, count = import_pattern.subn(replacement, content, count=1)
    if count != 1 or repaired == content:
        return False
    test_path.write_text(repaired, encoding="utf-8")
    print(json.dumps({
        "type": "AUTONOMOUS_SELF_HEAL",
        "capabilityId": capability.get("capabilityId"),
        "repair": "normalize frontend directory artifact import",
        "testPath": str(test_path),
        "import": replacement,
    }, ensure_ascii=False))
    return True


def reweave_interrupted_capabilities(dirty: list[str]) -> bool:
    matched = [c for c in roadmap_capabilities() if _dirty_overlaps_capability(dirty, c)]
    if not matched:
        return False
    changed = False
    for capability in matched:
        result = subprocess.run(
            [sys.executable, str(BUILDER), "--prompt", _capability_prompt(capability)],
            cwd=ROOT, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, timeout=15 * 60, check=False,
            env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        )
        print(result.stdout, end="")
        if result.returncode != 0:
            return False
        changed = True
        _repair_generated_product_test(capability)
    return changed


def _matching_dirty_capabilities(dirty: list[str]) -> list[dict]:
    return [c for c in roadmap_capabilities() if _dirty_overlaps_capability(dirty, c)]


def is_resumable_generation_state() -> tuple[bool, list[str]]:
    dirty = status_paths()
    if not dirty:
        return False, []
    expected = [p.resolve() for p in resumable_product_paths()]
    if not expected:
        return False, dirty
    for relative in dirty:
        candidate = (ROOT / relative).resolve()
        if not any(candidate == path or (path.is_dir() and path in candidate.parents) for path in expected):
            return False, dirty
    return True, dirty


def _verify_and_self_heal(dirty: list[str]) -> subprocess.CompletedProcess[str]:
    verification = run("npm", ["test", "--", "--runInBand"], timeout=45 * 60)
    print(verification.stdout, end="")
    if verification.returncode == 0:
        return verification

    for attempt in range(1, MAX_SELF_HEAL_ATTEMPTS + 1):
        latest_dirty = status_paths()
        matched = _matching_dirty_capabilities(latest_dirty or dirty)
        if not matched:
            break
        print(json.dumps({
            "type": "AUTONOMOUS_SELF_HEAL_RETRY",
            "attempt": attempt,
            "maxAttempts": MAX_SELF_HEAL_ATTEMPTS,
            "capabilities": [c.get("capabilityId") for c in matched],
            "action": "DIAGNOSE → REWEAVE → NORMALIZE → VERIFY",
        }, ensure_ascii=False))
        if not reweave_interrupted_capabilities(latest_dirty or dirty):
            break
        verification = run("npm", ["test", "--", "--runInBand"], timeout=45 * 60)
        print(verification.stdout, end="")
        if verification.returncode == 0:
            return verification
    return verification


def resume_interrupted_generation() -> bool:
    resumable, dirty = is_resumable_generation_state()
    if not resumable:
        return False
    print(json.dumps({"type": "AUTONOMOUS_RESUME_GENERATION", "status": "detected", "changedPaths": dirty, "action": "REWEAVE → VERIFY → COMMIT → PUSH → CONTINUE"}, ensure_ascii=False))
    if not reweave_interrupted_capabilities(dirty):
        return False
    verification = _verify_and_self_heal(dirty)
    if verification.returncode != 0:
        print(json.dumps({"type": "AUTONOMOUS_RESUME_GENERATION", "status": "blocked", "reason": "verification failed after self-heal", "exitCode": verification.returncode}, ensure_ascii=False))
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
    print(json.dumps({"type": "AUTONOMOUS_RESUME_GENERATION", "status": "completed", "action": "REWEAVE → VERIFY → COMMIT → PUSH → CONTINUE"}, ensure_ascii=False))
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
    process = subprocess.Popen([str(TSX), str(DAEMON)], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", bufsize=1)
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
        return 0 if return_code in (0, -15, 1, 130, 143) else return_code
    return_code = process.wait()
    if not assistant_phase and return_code != 0 and resume_interrupted_generation():
        return run_daemon(assistant_phase=False)
    return return_code


def main() -> int:
    parser = argparse.ArgumentParser(description="HooshyarOS two-command autonomous builder")
    parser.add_argument("phase", choices=("assistant", "platform"))
    args = parser.parse_args()
    return run_daemon(assistant_phase=args.phase == "assistant")


if __name__ == "__main__":
    raise SystemExit(main())
