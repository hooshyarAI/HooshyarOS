from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSISTANT = ROOT / "Backend" / "AI_Runtime" / "autonomous_assistant.py"

STAGE_NAMES = {
    "BUILD_VERIFY": "Build + full verification",
    "WINDOWS": "Windows productization",
    "ANDROID": "Android productization",
    "PACKAGE": "Packaging / release gate",
    "ACCEPTANCE": "Runtime acceptance",
    "COMPLETE": "Commercial completion",
}


def clear() -> None:
    if os.name == "nt":
        os.system("cls")
    else:
        print("\033[2J\033[H", end="")


def fmt_seconds(seconds: float) -> str:
    seconds = max(0, int(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, seconds = divmod(rem, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def render(
    started: float,
    stage: str,
    platform: str,
    event_type: str,
    message: str,
    history: deque[str],
    terminal_status: str,
) -> None:
    clear()
    elapsed = fmt_seconds(time.time() - started)
    stage_label = STAGE_NAMES.get(stage, stage or "Starting")
    print("=" * 78)
    print(" HooshyarOS — Autonomous Productization Console")
    print("=" * 78)
    print(f" STATUS      : {terminal_status}")
    print(f" STAGE       : {stage_label}")
    print(f" PLATFORM    : {platform or '—'}")
    print(f" LAST EVENT  : {event_type or '—'}")
    print(f" LAST DETAIL : {message[:78]}")
    print(f" ELAPSED     : {elapsed}")
    print("-" * 78)
    print(" LIVE EVENTS")
    for item in history:
        print(f"  {item[:74]}")
    print("-" * 78)
    print("The autonomous worker owns repair, verification, commit and continuation.")
    print("=" * 78)


def decode_event(line: str) -> tuple[str, str, str, str] | None:
    text = line.strip()
    if not text.startswith("{"):
        return None
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    event_type = str(payload.get("type", ""))
    if not event_type:
        return None
    stage = str(payload.get("stage", ""))
    platform = str(payload.get("platform", ""))
    if event_type == "AUTONOMOUS_PRODUCTIZATION_STAGE":
        stage = stage or str(payload.get("stage", ""))
    message = ""
    for key in ("reason", "artifact", "worker", "action", "status", "strategy", "capabilityId"):
        if key in payload:
            message = f"{key}={payload[key]}"
            break
    return event_type, stage, platform, message


def main() -> int:
    if not ASSISTANT.exists():
        print(f"ERROR: missing assistant: {ASSISTANT}", file=sys.stderr)
        return 2

    env = os.environ.copy()
    env.setdefault("HOOSHYAR_PRODUCTIZATION_MODE", "1")
    env.setdefault("HOOSHYAR_WINDOWS_INSTALLER", "1")
    env.setdefault("HOOSHYAR_ANDROID_APP", "1")
    env.setdefault("HOOSHYAR_REQUIRE_WEB_RUNTIME_ACCEPTANCE", "1")

    process = subprocess.Popen(
        [sys.executable, str(ASSISTANT)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    started = time.time()
    stage = ""
    platform = ""
    event_type = ""
    message = ""
    status = "RUNNING"
    history: deque[str] = deque(maxlen=10)

    assert process.stdout is not None
    for line in process.stdout:
        print(line, end="")
        event = decode_event(line)
        if event is None:
            continue
        event_type, event_stage, event_platform, message = event
        if event_stage:
            stage = event_stage
        if event_platform:
            platform = event_platform
        if event_type in {"AUTONOMOUS_PRODUCTIZATION_BLOCKED", "AUTONOMOUS_RELEASE_BLOCKED", "AUTONOMOUS_BLOCKED"}:
            status = "BLOCKED — autonomous repair required"
        elif event_type in {"AUTONOMOUS_PRODUCTIZATION_COMPLETE", "AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE"}:
            status = "COMPLETE"
        else:
            status = "RUNNING"
        history.append(f"{event_type}: {message or event_stage or event_platform or 'event received'}")
        render(started, stage, platform, event_type, message, history, status)

    return_code = process.wait()
    if return_code != 0 and status != "BLOCKED — autonomous repair required":
        status = f"FAILED (exit {return_code})"
    elif return_code == 0 and status == "RUNNING":
        status = "FINISHED — inspect final acceptance evidence"
    render(started, stage, platform, event_type, message, history, status)
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
