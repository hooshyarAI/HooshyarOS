"""Explicit HooshyarOS productization worker."""
from __future__ import annotations
import json
import os
import subprocess
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "Backend" / "AI_Runtime" / "autonomous_builder.py"
PRODUCT_BUILDER = ROOT / "Backend" / "AI_Runtime" / "productization_builder.py"
WINDOWS_RELEASE_BUILDER = ROOT / "Backend" / "AI_Runtime" / "release_product_builder.py"
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
ANDROID_ROOT = RELEASE_ROOT / "android"
WINDOWS_INSTALLER = WINDOWS_ROOT / "installer"
ANDROID_PROJECT = ROOT / "android"
ANDROID_PROJECT_ALT = ROOT / "Android"
def emit(kind: str, **payload: object) -> None: print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)
def env_true(name: str) -> bool: return os.environ.get(name, "").strip() == "1"
def run(command: str, args: list[str], timeout: int = 45 * 60) -> int:
    executable = f"{command}.cmd" if os.name == "nt" and command in {"npm", "npx"} else command
    result = subprocess.run([executable, *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace", env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, check=False)
    if result.stdout: print(result.stdout, end="")
    return result.returncode
def run_product_builder(platform: str) -> bool:
    builder = WINDOWS_RELEASE_BUILDER if platform == "WINDOWS" else PRODUCT_BUILDER
    if not builder.exists(): emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", platform=platform, reason="missing productization builder"); return False
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER_DELEGATE", platform=platform, worker=str(builder)); args = ["--windows"] if platform == "WINDOWS" else ["--platform", platform]
    result = subprocess.run([sys.executable, str(builder), *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace", env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90 * 60, check=False)
    if result.stdout: print(result.stdout, end="")
    return result.returncode == 0
def run_required_verification() -> bool:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="BUILD_VERIFY"); return run("npm", ["run", "build"], 45 * 60) == 0 and run("npm", ["test", "--", "--runInBand"], 60 * 60) == 0
def windows_productize() -> tuple[bool, str]:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="WINDOWS")
    if not run_product_builder("WINDOWS"): return False, "windows-productization-builder-failed"
    exe = WINDOWS_ROOT / os.environ.get("HOOSHYAR_WINDOWS_FINAL_ARTIFACT", "HooshyarOS-Setup.exe")
    if env_true("HOOSHYAR_REQUIRE_REAL_WINDOWS_EXE") and (not exe.exists() or exe.stat().st_size < 100 * 1024): return False, "windows-exe-artifact-not-produced"
    if not exe.exists():
        bootstrap = WINDOWS_ROOT / "HooshyarOS-Windows-Bootstrap.zip"
        if not bootstrap.exists(): return False, "windows-exe-artifact-not-produced"
        if env_true("HOOSHYAR_REQUIRE_REAL_WINDOWS_EXE"): return False, "windows-exe-artifact-not-produced"
    emit("AUTONOMOUS_PRODUCTIZATION_ARTIFACT", platform="WINDOWS", artifact=str(exe.relative_to(ROOT)) if exe.exists() else "HooshyarOS-Windows-Bootstrap.zip"); return True, "ok"
def android_productize() -> tuple[bool, str]:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="ANDROID")
    if not run_product_builder("ANDROID"): return False, "android-productization-builder-failed"
    apk = RELEASE_ROOT / "android" / os.environ.get("HOOSHYAR_ANDROID_FINAL_ARTIFACT", "HooshyarOS.apk")
    if not apk.exists() or apk.stat().st_size < 100 * 1024: return False, "android-apk-artifact-not-produced"
    emit("AUTONOMOUS_PRODUCTIZATION_ARTIFACT", platform="ANDROID", artifact=str(apk.relative_to(ROOT))); return True, "ok"
def main() -> int:
    if not env_true("HOOSHYAR_PRODUCTIZATION_MODE"): emit("AUTONOMOUS_PRODUCTIZATION_SKIPPED", reason="productization mode disabled"); return 0
    windows_required = env_true("HOOSHYAR_WINDOWS_INSTALLER"); android_required = env_true("HOOSHYAR_ANDROID_APP")
    emit("AUTONOMOUS_PRODUCTIZATION_START", windowsRequired=windows_required, androidRequired=android_required, webRuntimeRequired=env_true("HOOSHYAR_REQUIRE_WEB_RUNTIME_ACCEPTANCE"))
    if not run_required_verification(): emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", stage="BUILD_VERIFY", reason="verification failed", productComplete=False); return 21
    failures: list[str] = []
    if windows_required:
        ok, reason = windows_productize()
        if not ok: failures.append(reason)
    if android_required:
        ok, reason = android_productize()
        if not ok: failures.append(reason)
    if failures: emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", stage="PACKAGE", reasons=failures, productComplete=False); return 22
    emit("AUTONOMOUS_PRODUCTIZATION_COMPLETE", productComplete=True, windowsInstaller=windows_required, android=android_required); return 0
if __name__ == "__main__": raise SystemExit(main())
