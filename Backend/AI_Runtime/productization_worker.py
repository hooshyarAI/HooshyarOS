"""Explicit HooshyarOS productization worker.

This worker is intentionally separate from platform construction. In productization
mode it may only report completion after real release artifacts and their
acceptance evidence exist. It never treats platform/backlog completion as
installer or mobile completion.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
ANDROID_ROOT = RELEASE_ROOT / "android"


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def env_true(name: str) -> bool:
    return os.environ.get(name, "").strip() == "1"


def run(command: str, args: list[str], timeout: int = 45 * 60) -> int:
    executable = command
    if os.name == "nt" and command in {"npm", "npx"}:
        executable = f"{command}.cmd"
    result = subprocess.run(
        [executable, *args],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    return result.returncode


def tool_exists(name: str) -> bool:
    return shutil.which(name) is not None


def run_required_verification() -> bool:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="BUILD_VERIFY")
    if run("npm", ["run", "build"], 45 * 60) != 0:
        return False
    return run("npm", ["test", "--", "--runInBand"], 60 * 60) == 0


def windows_productize() -> tuple[bool, str]:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="WINDOWS")
    WINDOWS_ROOT.mkdir(parents=True, exist_ok=True)

    # Prefer a real installer toolchain when available.
    inno = tool_exists("iscc") or tool_exists("ISCC")
    wix = tool_exists("wix")
    if not inno and not wix:
        emit(
            "AUTONOMOUS_PRODUCTIZATION_BLOCKED",
            platform="WINDOWS",
            reason="no supported Windows installer toolchain detected",
            requiredTools=["Inno Setup (iscc)", "WiX (wix)"],
        )
        return False, "missing-windows-installer-toolchain"

    return False, "installer-project-generation-required"


def android_productize() -> tuple[bool, str]:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="ANDROID")
    if not (ROOT / "android").exists() and not (ROOT / "Android").exists():
        emit(
            "AUTONOMOUS_PRODUCTIZATION_BLOCKED",
            platform="ANDROID",
            reason="no Android application project exists yet",
            required="real Android application project and Gradle build",
        )
        return False, "missing-android-project"
    gradle = "gradlew.bat" if os.name == "nt" else "./gradlew"
    if not (ROOT / gradle).exists() and not tool_exists("gradle"):
        emit(
            "AUTONOMOUS_PRODUCTIZATION_BLOCKED",
            platform="ANDROID",
            reason="Android Gradle toolchain not available",
        )
        return False, "missing-gradle-toolchain"
    return False, "android-build-project-not-yet-wired"


def main() -> int:
    if not env_true("HOOSHYAR_PRODUCTIZATION_MODE"):
        emit("AUTONOMOUS_PRODUCTIZATION_SKIPPED", reason="productization mode disabled")
        return 0

    emit(
        "AUTONOMOUS_PRODUCTIZATION_START",
        windowsRequired=env_true("HOOSHYAR_WINDOWS_INSTALLER"),
        androidRequired=env_true("HOOSHYAR_ANDROID_APP"),
        webRuntimeRequired=env_true("HOOSHYAR_REQUIRE_WEB_RUNTIME_ACCEPTANCE"),
    )

    if not run_required_verification():
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", stage="BUILD_VERIFY", reason="verification failed")
        return 21

    failures: list[str] = []
    if env_true("HOOSHYAR_WINDOWS_INSTALLER"):
        ok, reason = windows_productize()
        if not ok:
            failures.append(reason)

    if env_true("HOOSHYAR_ANDROID_APP"):
        ok, reason = android_productize()
        if not ok:
            failures.append(reason)

    if failures:
        emit(
            "AUTONOMOUS_PRODUCTIZATION_BLOCKED",
            stage="PACKAGE",
            reasons=failures,
            productComplete=False,
        )
        return 22

    emit(
        "AUTONOMOUS_PRODUCTIZATION_COMPLETE",
        productComplete=True,
        windowsInstaller=True,
        android=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
