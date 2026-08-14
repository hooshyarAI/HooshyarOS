"""Explicit HooshyarOS productization worker."""
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


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def env_true(name: str) -> bool:
    return os.environ.get(name, "").strip() == "1"


def run(command: str, args: list[str], timeout: int) -> int:
    executable = f"{command}.cmd" if os.name == "nt" and command in {"npm", "npx"} else command
    result = subprocess.run([executable, *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, check=False)
    if result.stdout: print(result.stdout, end="")
    return result.returncode


def verify() -> bool:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="BUILD_VERIFY")
    return run("npm", ["run", "build"], 45*60) == 0 and run("npm", ["test", "--", "--runInBand"], 60*60) == 0


def build(platform: str) -> bool:
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER_DELEGATE", platform=platform, worker=str(PRODUCT_BUILDER))
    if not PRODUCT_BUILDER.exists():
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", platform=platform, reason="missing release builder")
        return False
    result = subprocess.run([sys.executable, str(PRODUCT_BUILDER), "--platform", platform], cwd=ROOT, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90*60, check=False)
    print(result.stdout, end="")
    return result.returncode == 0


def main() -> int:
    if not env_true("HOOSHYAR_PRODUCTIZATION_MODE"):
        emit("AUTONOMOUS_PRODUCTIZATION_SKIPPED", reason="productization mode disabled")
        return 0
    windows = env_true("HOOSHYAR_WINDOWS_INSTALLER")
    android = env_true("HOOSHYAR_ANDROID_APP")
    emit("AUTONOMOUS_PRODUCTIZATION_START", windowsRequired=windows, androidRequired=android, webRuntimeRequired=env_true("HOOSHYAR_REQUIRE_WEB_RUNTIME_ACCEPTANCE"))
    if not verify():
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", stage="BUILD_VERIFY", reason="verification failed", productComplete=False)
        return 21
    failures=[]
    if windows and not build("WINDOWS"): failures.append("windows-release-builder-failed")
    if android and not build("ANDROID"): failures.append("android-release-builder-failed")
    win_artifact = WINDOWS_ROOT / os.environ.get("HOOSHYAR_WINDOWS_FINAL_ARTIFACT", "HooshyarOS-Setup.exe")
    apk_artifact = RELEASE_ROOT / "android" / os.environ.get("HOOSHYAR_ANDROID_FINAL_ARTIFACT", "HooshyarOS.apk")
    if windows and (not win_artifact.exists() or win_artifact.stat().st_size <= 0): failures.append("windows-exe-artifact-not-produced")
    if android and (not apk_artifact.exists() or apk_artifact.stat().st_size <= 0): failures.append("android-apk-artifact-not-produced")
    if failures:
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", stage="PACKAGE", reasons=failures, productComplete=False)
        return 22
    emit("AUTONOMOUS_PRODUCTIZATION_COMPLETE", productComplete=True, finalArtifacts={"windows": str(win_artifact.relative_to(ROOT)), "android": str(apk_artifact.relative_to(ROOT))})
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
