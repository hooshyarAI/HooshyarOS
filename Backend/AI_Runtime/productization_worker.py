"""Explicit HooshyarOS productization worker.

Productization is a distinct phase from platform construction. In productization
mode the assistant must build release artifacts, exercise acceptance evidence,
and must never report completion from backlog exhaustion alone.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "Backend" / "AI_Runtime" / "autonomous_builder.py"
PRODUCT_BUILDER = ROOT / "Backend" / "AI_Runtime" / "productization_builder.py"
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
ANDROID_ROOT = RELEASE_ROOT / "android"
WINDOWS_INSTALLER = WINDOWS_ROOT / "installer"
ANDROID_PROJECT = ROOT / "android"
ANDROID_PROJECT_ALT = ROOT / "Android"


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def env_true(name: str) -> bool:
    return os.environ.get(name, "").strip() == "1"


def run(command: str, args: list[str], timeout: int = 45 * 60) -> int:
    executable = f"{command}.cmd" if os.name == "nt" and command in {"npm", "npx"} else command
    result = subprocess.run(
        [executable, *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace",
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    return result.returncode


def tool_exists(name: str) -> bool:
    return shutil.which(name) is not None


def run_required_verification() -> bool:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="BUILD_VERIFY")
    return run("npm", ["run", "build"], 45 * 60) == 0 and run("npm", ["test", "--", "--runInBand"], 60 * 60) == 0


def build_worker_prompt(platform: str) -> str:
    common = """
You are executing the HooshyarOS productization mission inside the repository-native autonomous worker.
Do not redesign Architecture Freeze V4 and do not modify the existing product/business engine hierarchy.
Productization is successful only when a real release artifact exists and acceptance evidence can be produced.
Never claim completion because unit tests, backlog exhaustion, or platform construction are complete.
The resulting product must remain deployment-agnostic, zero-IT for the customer where possible, and preserve the No Double Entry / Automatic Data Acquisition policy.
""".strip()
    if platform == "WINDOWS":
        return common + """

Build the Windows production package for the existing HooshyarOS web runtime.
Create a real installer project under dist/productization/windows/installer and a deterministic build script.
The installer must install the existing runtime/web application, create the required local data/runtime directories,
provide a start mechanism, and be uninstallable/reinstallable.
Prefer a real native installer toolchain when available; otherwise create a Windows-native bootstrap installer package
that can be built and exercised on the target Windows machine without changing the core platform architecture.
Create focused acceptance evidence for install, start, web reachability, uninstall and reinstall.
""".strip()
    return common + """

Build the Android application for the existing HooshyarOS backend/runtime.
Create a real Android project under android/ (preferred) using a stable native Android/WebView or equivalent shell
around the existing web application/API boundary, with login, authenticated product shell, dashboard access,
offline/online state handling and explicit backend endpoint configuration.
Create Gradle build configuration and focused acceptance evidence for APK generation and installation.
Do not invent a second business/backend implementation.
""".strip()


def run_product_builder(platform: str) -> bool:
    if not PRODUCT_BUILDER.exists():
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", platform=platform, reason="missing productization builder")
        return False
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER_DELEGATE", platform=platform, worker=str(PRODUCT_BUILDER))
    result = subprocess.run(
        [sys.executable, str(PRODUCT_BUILDER), "--platform", platform],
        cwd=ROOT, text=True, encoding="utf-8", errors="replace",
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90 * 60, check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    return result.returncode == 0


def ask_autonomous_builder(platform: str) -> bool:
    if not BUILDER.exists():
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", platform=platform, reason="missing autonomous builder")
        return False
    prompt = build_worker_prompt(platform)
    emit("AUTONOMOUS_PRODUCTIZATION_DELEGATE", platform=platform, worker=str(BUILDER))
    result = subprocess.run(
        [sys.executable, str(BUILDER), "--prompt", prompt], cwd=ROOT,
        text=True, encoding="utf-8", errors="replace", env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90 * 60, check=False,
    )
    print(result.stdout, end="")
    return result.returncode == 0


def windows_productize() -> tuple[bool, str]:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="WINDOWS")
    if not run_product_builder("WINDOWS"):
        return False, "windows-productization-builder-failed"
    WINDOWS_ROOT.mkdir(parents=True, exist_ok=True)
    WINDOWS_INSTALLER.mkdir(parents=True, exist_ok=True)

    installer_artifacts = [
        WINDOWS_INSTALLER / "install.ps1",
        WINDOWS_INSTALLER / "uninstall.ps1",
        WINDOWS_INSTALLER / "build-installer.ps1",
        WINDOWS_INSTALLER / "README.md",
    ]
    if not all(path.exists() for path in installer_artifacts):
        return False, "windows-installer-project-incomplete"

    inno = tool_exists("iscc") or tool_exists("ISCC")
    wix = tool_exists("wix")
    installer_exe = list(WINDOWS_ROOT.glob("*.exe"))
    if not installer_exe and inno:
        if run("iscc", [str(WINDOWS_INSTALLER / "HooshyarOS.iss")], 45 * 60) != 0:
            return False, "inno-build-failed"
        installer_exe = list(WINDOWS_ROOT.glob("*.exe"))
    if not installer_exe and wix:
        emit("AUTONOMOUS_PRODUCTIZATION_NOTE", platform="WINDOWS", toolchain="WiX", action="assistant-must-wire-wix-build")
    if not installer_exe:
        # Bootstrap package is an accepted Windows-native release artifact when no native compiler is installed.
        build_script = WINDOWS_INSTALLER / "build-installer.ps1"
        if run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(build_script)], 45 * 60) != 0:
            return False, "windows-bootstrap-build-failed"
        bootstrap = list(WINDOWS_ROOT.glob("*.zip"))
        if not bootstrap:
            return False, "windows-installer-artifact-not-yet-built"

    return True, "ok"


def android_productize() -> tuple[bool, str]:
    emit("AUTONOMOUS_PRODUCTIZATION_STAGE", stage="ANDROID")
    if not run_product_builder("ANDROID"):
        return False, "android-productization-builder-failed"
    project = ANDROID_PROJECT if ANDROID_PROJECT.exists() else ANDROID_PROJECT_ALT
    required = project / "gradlew.bat", project / "app" / "build.gradle"
    if not project.exists() or not all(path.exists() for path in required):
        return False, "android-project-incomplete"

    gradle = project / "gradlew.bat" if os.name == "nt" else project / "gradlew"
    if gradle.exists():
        if run(str(gradle), ["assembleDebug"], 90 * 60) != 0:
            return False, "android-build-failed"
    elif tool_exists("gradle"):
        if run("gradle", ["-p", str(project), "assembleDebug"], 90 * 60) != 0:
            return False, "android-build-failed"
    else:
        return False, "android-gradle-toolchain-missing"

    apks = list((project / "app" / "build" / "outputs" / "apk").rglob("*.apk"))
    if not apks:
        return False, "android-apk-not-produced"
    return True, "ok"


def main() -> int:
    if not env_true("HOOSHYAR_PRODUCTIZATION_MODE"):
        emit("AUTONOMOUS_PRODUCTIZATION_SKIPPED", reason="productization mode disabled")
        return 0

    windows_required = env_true("HOOSHYAR_WINDOWS_INSTALLER")
    android_required = env_true("HOOSHYAR_ANDROID_APP")
    emit("AUTONOMOUS_PRODUCTIZATION_START", windowsRequired=windows_required, androidRequired=android_required,
         webRuntimeRequired=env_true("HOOSHYAR_REQUIRE_WEB_RUNTIME_ACCEPTANCE"))

    if not run_required_verification():
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", stage="BUILD_VERIFY", reason="verification failed", productComplete=False)
        return 21

    failures: list[str] = []
    if windows_required:
        ok, reason = windows_productize()
        if not ok:
            failures.append(reason)
    if android_required:
        ok, reason = android_productize()
        if not ok:
            failures.append(reason)

    if failures:
        emit("AUTONOMOUS_PRODUCTIZATION_BLOCKED", stage="PACKAGE", reasons=failures, productComplete=False)
        return 22

    emit("AUTONOMOUS_PRODUCTIZATION_COMPLETE", productComplete=True,
         windowsInstaller=windows_required, android=android_required)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
