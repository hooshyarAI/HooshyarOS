"""Explicit HooshyarOS productization worker.

Productization is a distinct phase from platform construction. The worker owns
release orchestration and must never report completion from platform completion,
backlog exhaustion, or scaffold creation alone.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCT_BUILDER = ROOT / "Backend" / "AI_Runtime" / "release_product_builder.py"
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
ANDROID_ROOT = RELEASE_ROOT / "android"
ANDROID_PROJECT = ROOT / "android"
ANDROID_PROJECT_ALT = ROOT / "Android"

# These strings are part of the repository productization contract. Keep them
# stable so callers/tests can distinguish artifact and project failures without
# coupling themselves to a particular underlying installer/toolchain.
WINDOWS_ARTIFACT_NOT_YET_BUILT = "windows-installer-artifact-not-yet-built"
ANDROID_PROJECT_INCOMPLETE = "android-project-incomplete"


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def env_true(name: str) -> bool:
    return os.environ.get(name, "").strip() == "1"


def run(command: str, args: list[str], timeout: int) -> int:
    executable = f"{command}.cmd" if os.name == "nt" and command in {"npm", "npx"} else command
    result = subprocess.run(
        [executable, *args],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
    )
    if result.stdout:
        print(result.stdout, end="")
    return result.returncode


def verify() -> bool:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="BUILD_VERIFY")
    return (
        run("npm", ["run", "build"], 45 * 60) == 0
        and run("npm", ["test", "--", "--runInBand"], 60 * 60) == 0
    )


def build(platform: str) -> bool:
    # Compatibility contract: this marker represents productization delegation,
    # while BUILDER_DELEGATE names the concrete release builder implementation.
    emit("AUTONOMOUS_PRODUCTIZATION_DELEGATE", platform=platform, worker=str(PRODUCT_BUILDER))
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER_DELEGATE", platform=platform, worker=str(PRODUCT_BUILDER))

    if not PRODUCT_BUILDER.exists():
        emit(
            "AUTONOMOUS_PRODUCTIZATION_BLOCKED",
            platform=platform,
            reason="missing release builder",
        )
        return False

    if platform == "WINDOWS":
        final_exe = WINDOWS_ROOT / os.environ.get(
            "HOOSHYAR_WINDOWS_FINAL_ARTIFACT", "HooshyarOS-Setup.exe"
        )
        if not final_exe.exists():
            emit(
                "AUTONOMOUS_PRODUCTIZATION_NOTE",
                platform="WINDOWS",
                reason=WINDOWS_ARTIFACT_NOT_YET_BUILT,
            )

    if platform == "ANDROID":
        project = ANDROID_PROJECT if ANDROID_PROJECT.exists() else ANDROID_PROJECT_ALT
        if not project.exists():
            emit(
                "AUTONOMOUS_PRODUCTIZATION_BLOCKED",
                platform="ANDROID",
                reason=ANDROID_PROJECT_INCOMPLETE,
            )
            return False

    result = subprocess.run(
        [
            sys.executable,
            str(PRODUCT_BUILDER),
            "--platform",
            platform,
        ],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=90 * 60,
        check=False,
    )
    print(result.stdout, end="")
    return result.returncode == 0


def verify_artifact(platform: str) -> tuple[bool, str]:
    if platform == "WINDOWS":
        artifact = WINDOWS_ROOT / os.environ.get(
            "HOOSHYAR_WINDOWS_FINAL_ARTIFACT", "HooshyarOS-Setup.exe"
        )
        if not artifact.exists() or artifact.stat().st_size <= 0:
            return False, WINDOWS_ARTIFACT_NOT_YET_BUILT
    else:
        artifact = ANDROID_ROOT / os.environ.get(
            "HOOSHYAR_ANDROID_FINAL_ARTIFACT", "HooshyarOS.apk"
        )
        if not artifact.exists() or artifact.stat().st_size <= 0:
            return False, "android-apk-artifact-not-produced"

    emit(
        "AUTONOMOUS_PRODUCTIZATION_ARTIFACT_VERIFIED",
        platform=platform,
        artifact=str(artifact.relative_to(ROOT)),
        size=artifact.stat().st_size,
    )
    return True, "ok"


def main() -> int:
    if not env_true("HOOSHYAR_PRODUCTIZATION_MODE"):
        emit("AUTONOMOUS_PRODUCTIZATION_SKIPPED", reason="productization mode disabled")
        return 0

    windows = env_true("HOOSHYAR_WINDOWS_INSTALLER")
    android = env_true("HOOSHYAR_ANDROID_APP")
    emit(
        "AUTONOMOUS_PRODUCTIZATION_START",
        windowsRequired=windows,
        androidRequired=android,
        webRuntimeRequired=env_true("HOOSHYAR_REQUIRE_WEB_RUNTIME_ACCEPTANCE"),
    )

    if not verify():
        emit(
            "AUTONOMOUS_PRODUCTIZATION_BLOCKED",
            stage="BUILD_VERIFY",
            reason="verification failed",
            productComplete=False,
        )
        return 21

    failures: list[str] = []

    if windows:
        emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="WINDOWS")
        if not build("WINDOWS"):
            failures.append("windows-release-builder-failed")
        else:
            ok, reason = verify_artifact("WINDOWS")
            if not ok:
                failures.append(reason)

    if android:
        emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="ANDROID")
        if not build("ANDROID"):
            failures.append("android-release-builder-failed")
        else:
            ok, reason = verify_artifact("ANDROID")
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

    final_artifacts: dict[str, str] = {}
    if windows:
        final_artifacts["windows"] = str(
            (WINDOWS_ROOT / os.environ.get("HOOSHYAR_WINDOWS_FINAL_ARTIFACT", "HooshyarOS-Setup.exe")).relative_to(ROOT)
        )
    if android:
        final_artifacts["android"] = str(
            (ANDROID_ROOT / os.environ.get("HOOSHYAR_ANDROID_FINAL_ARTIFACT", "HooshyarOS.apk")).relative_to(ROOT)
        )

    emit(
        "AUTONOMOUS_PRODUCTIZATION_COMPLETE",
        productComplete=True,
        windowsInstaller=windows,
        android=android,
        finalArtifacts=final_artifacts,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
