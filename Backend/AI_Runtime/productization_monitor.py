"""Live terminal progress monitor for the autonomous productization workflow."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / "Backend" / "AI_Runtime" / "productization_worker.py"

STAGES = {
    "BUILD_VERIFY": (0, 25, "Build + full verification"),
    "WINDOWS": (25, 45, "Windows product packaging"),
    "ANDROID": (45, 85, "Android product packaging"),
    "PACKAGE": (85, 95, "Release artifact verification"),
    "COMPLETE": (100, 100, "Commercialization complete"),
}


def emit_status(percent: int, stage: str, detail: str, started: float, state: str = "RUNNING") -> None:
    elapsed = int(time.monotonic() - started)
    print(
        "\x1b[2J\x1b[H"
        f"HOOSHYAROS AUTONOMOUS PRODUCTIZATION\n"
        f"{'=' * 52}\n"
        f"STATUS   : {state}\n"
        f"STAGE    : {stage}\n"
        f"PROGRESS : {percent:3d}%\n"
        f"CURRENT  : {detail}\n"
        f"ELAPSED  : {elapsed // 60:02d}:{elapsed % 60:02d}\n"
        f"{'=' * 52}\n",
        end="",
        flush=True,
    )


def stage_from_event(event: dict[str, object]) -> tuple[int, str, str]:
    kind = str(event.get("type", ""))
    if kind == "AUTONOMOUS_PRODUCTIZATION_STAGE":
        stage = str(event.get("stage", "UNKNOWN"))
        start, _, label = STAGES.get(stage, (0, 0, stage))
        return start, stage, label
    if kind == "AUTONOMOUS_PRODUCTIZATION_DELEGATE":
        platform = str(event.get("platform", ""))
        stage = "WINDOWS" if platform == "WINDOWS" else "ANDROID"
        start, end, label = STAGES[stage]
        return start + max(1, (end - start) // 5), stage, f"Delegating {platform} release builder"
    if kind == "AUTONOMOUS_PRODUCTIZATION_BUILDER_DELEGATE":
        platform = str(event.get("platform", ""))
        stage = "WINDOWS" if platform == "WINDOWS" else "ANDROID"
        start, end, label = STAGES[stage]
        return start + max(2, (end - start) // 4), stage, f"Builder executing {platform} packaging"
    if kind == "AUTONOMOUS_RELEASE_DOWNLOAD":
        return 55, "ANDROID", f"Downloading release dependency: {event.get('target', '')}"
    if kind == "AUTONOMOUS_RELEASE_DOWNLOAD_FALLBACK":
        return 58, "ANDROID", f"Retrying download via fallback: {event.get('artifact', event.get('target', ''))}"
    if kind == "AUTONOMOUS_RELEASE_ANDROID_SDKMANAGER_FALLBACK":
        return 62, "ANDROID", "SDK manager unavailable; switching to governed direct-package fallback"
    if kind == "AUTONOMOUS_RELEASE_ANDROID_COMPONENT_SOURCE_SELECTED":
        return 66, "ANDROID", f"Android component selected: {event.get('package', '')}"
    if kind == "AUTONOMOUS_RELEASE_ARTIFACT":
        platform = str(event.get("platform", ""))
        return (82 if platform == "ANDROID" else 40), platform, f"Artifact produced: {event.get('artifact', '')}"
    if kind == "AUTONOMOUS_PRODUCTIZATION_ARTIFACT_VERIFIED":
        platform = str(event.get("platform", ""))
        return (92 if platform == "ANDROID" else 44), platform, f"Artifact verified: {event.get('artifact', '')}"
    if kind == "AUTONOMOUS_PRODUCTIZATION_COMPLETE":
        return 100, "COMPLETE", "Windows + Android + runtime gates passed"
    if kind == "AUTONOMOUS_PRODUCTIZATION_BLOCKED":
        return 100 if bool(event.get("productComplete")) else 0, str(event.get("stage", "BLOCKED")), f"BLOCKED: {event.get('reason', event.get('reasons', 'unknown'))}"
    return -1, "", ""


def main() -> int:
    started = time.monotonic()
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    process = subprocess.Popen(
        [sys.executable, str(WORKER)],
        cwd=ROOT,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
    )
    assert process.stdout is not None
    current_percent = 0
    current_stage = "START"
    current_detail = "Starting autonomous productization"
    emit_status(current_percent, current_stage, current_detail, started)

    try:
        for line in process.stdout:
            raw = line.rstrip("\r\n")
            if raw:
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    print(raw, flush=True)
                    continue
                percent, stage, detail = stage_from_event(event)
                if percent >= 0:
                    current_percent = max(current_percent, percent)
                    current_stage = stage or current_stage
                    current_detail = detail or current_detail
                    state = "BLOCKED" if event.get("type") == "AUTONOMOUS_PRODUCTIZATION_BLOCKED" else "RUNNING"
                    emit_status(current_percent, current_stage, current_detail, started, state)
                else:
                    print(raw, flush=True)
    finally:
        process.stdout.close()

    code = process.wait()
    if code == 0:
        emit_status(100, "COMPLETE", "Commercialization workflow completed", started, "COMPLETED")
    else:
        emit_status(current_percent, current_stage, current_detail, started, "STOPPED / REPAIR REQUIRED")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
