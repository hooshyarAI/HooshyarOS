"""Repository-native release artifact builder for HooshyarOS productization.

This module is invoked by the autonomous productization worker. It creates
real Windows and Android release artifacts without changing the HBOS business
architecture. Windows uses the native IExpress tool when available. Android
provisions a user-local JDK/Android SDK/Gradle toolchain when missing.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
WINDOWS_INSTALLER = WINDOWS_ROOT / "installer"
ANDROID_ROOT = ROOT / "android"
ANDROID_RELEASE = RELEASE_ROOT / "android"
TOOLCACHE = RELEASE_ROOT / ".toolcache"

JDK17_URL = "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip"
ANDROID_CLI_PACKAGE_ID = "Google.AndroidCLI"
ANDROID_CLI_INSTALL_URL = "https://dl.google.com/android/cli/latest/windows_x86_64/install.cmd"
GRADLE_URL = "https://services.gradle.org/distributions/gradle-8.7-bin.zip"


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def run(command: str, args: list[str], *, cwd: Path = ROOT, env: dict[str, str] | None = None,
        timeout: int = 60 * 60, input_text: str | None = None) -> int:
    result = subprocess.run(
        [command, *args],
        cwd=cwd,
        env=env or os.environ.copy(),
        text=True,
        encoding="utf-8",
        errors="replace",
        input=input_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    return result.returncode


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 1024:
        return
    emit("AUTONOMOUS_PRODUCTIZATION_DOWNLOAD", url=url, target=str(target.relative_to(ROOT)))
    with urllib.request.urlopen(url, timeout=120) as response, target.open("wb") as handle:
        shutil.copyfileobj(response, handle)

def install_android_cli() -> Path | None:
    emit("AUTONOMOUS_ANDROID_CLI", stage="INSTALL", method="winget", package=ANDROID_CLI_PACKAGE_ID)
    winget = shutil.which("winget.exe") or shutil.which("winget")
    if not winget:
        emit("AUTONOMOUS_ANDROID_CLI", stage="INSTALL", status="FALLBACK", method="google-official-installer")
        return install_android_cli_official()

    result = subprocess.run(
        [winget, "install", "--id", ANDROID_CLI_PACKAGE_ID, "--exact",
         "--source", "winget", "--accept-source-agreements", "--accept-package-agreements"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=15 * 60,
        check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.returncode != 0:
        emit("AUTONOMOUS_ANDROID_CLI", stage="INSTALL", status="NONZERO", exitCode=result.returncode, source="winget")

    found = discover_android_cli()
    if found:
        return found

    emit("AUTONOMOUS_ANDROID_CLI", stage="INSTALL", status="FALLBACK", method="google-official-installer")
    return install_android_cli_official()


def discover_android_cli() -> Path | None:
    user_path_result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command",
         "[Environment]::GetEnvironmentVariable('Path','User')"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=30,
        check=False,
    )
    user_path = user_path_result.stdout.strip()
    search_path = os.pathsep.join(part for part in [user_path, os.environ.get("PATH", "")] if part)
    android_exe = shutil.which("android.exe", path=search_path) or shutil.which("android", path=search_path)
    if android_exe:
        return Path(android_exe)

    local_app_data = os.environ.get("LOCALAPPDATA")
    program_files = os.environ.get("ProgramFiles")
    roots = [Path(p) for p in (local_app_data, program_files) if p]
    roots.append(TOOLCACHE / "android")
    for base in roots:
        try:
            candidates = sorted(
                (p for p in base.glob("**/android.exe") if p.is_file()),
                key=lambda p: len(str(p)),
            )
        except (OSError, RuntimeError):
            candidates = []
        if candidates:
            return candidates[0]
    return None


def install_android_cli_official() -> Path | None:
    local = TOOLCACHE / "android"
    installer = local / "android-cli-install.cmd"
    download(ANDROID_CLI_INSTALL_URL, installer)
    if not installer.exists() or installer.stat().st_size < 256:
        emit("AUTONOMOUS_ANDROID_CLI", stage="INSTALL", status="BLOCKED", reason="official-android-cli-installer-not-downloaded")
        return None

    result = subprocess.run(
        ["cmd.exe", "/d", "/c", str(installer)],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=15 * 60,
        check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.returncode != 0:
        emit("AUTONOMOUS_ANDROID_CLI", stage="INSTALL", status="NONZERO", exitCode=result.returncode, method="google-official-installer")

    found = discover_android_cli()
    if found:
        return found

    emit(
        "AUTONOMOUS_ANDROID_CLI",
        stage="VERIFY",
        status="BLOCKED",
        reason="android-executable-not-discoverable-after-install",
    )
    return None


def extract_zip(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    marker = destination / ".complete"
    if marker.exists():
        return
    with zipfile.ZipFile(archive) as zf:
        zf.extractall(destination)
    marker.write_text("ok\n", encoding="utf-8")


def find_file(root: Path, name: str) -> Path | None:
    for path in root.rglob(name):
        if path.is_file():
            return path
    return None


def windows() -> int:
    WINDOWS_INSTALLER.mkdir(parents=True, exist_ok=True)
    install = WINDOWS_INSTALLER / "install.ps1"
    uninstall = WINDOWS_INSTALLER / "uninstall.ps1"
    build = WINDOWS_INSTALLER / "build-installer.ps1"
    readme = WINDOWS_INSTALLER / "README.md"

    install.write_text(r'''$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
$RuntimeRoot = Join-Path $InstallRoot "runtime"
$DataRoot = Join-Path $InstallRoot "data"
New-Item -ItemType Directory -Force -Path $RuntimeRoot, $DataRoot | Out-Null
Copy-Item -Path (Join-Path $Root "payload\*") -Destination $RuntimeRoot -Recurse -Force
$Launcher = Join-Path $RuntimeRoot "start-hooshyar.cmd"
@"
@echo off
cd /d "$RuntimeRoot"
call npm.cmd start
"@ | Set-Content -Encoding ASCII $Launcher
Write-Host "HooshyarOS installed to $InstallRoot"
Write-Host "Start with: $Launcher"
''', encoding="utf-8")

    uninstall.write_text(r'''$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
if (Test-Path $InstallRoot) { Remove-Item $InstallRoot -Recurse -Force }
Write-Host "HooshyarOS uninstalled."
''', encoding="utf-8")

    build.write_text(r'''$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Payload = Join-Path $Root "payload"
$Package = Join-Path $Root "HooshyarOS-Windows-Bootstrap.zip"
if (Test-Path $Payload) { Remove-Item $Payload -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Payload | Out-Null
Copy-Item -Path (Join-Path $Root "..\..\..\package.json") -Destination $Payload -Force
Copy-Item -Path (Join-Path $Root "..\..\..\Backend") -Destination $Payload -Recurse -Force
Copy-Item -Path (Join-Path $Root "..\..\..\Frontend") -Destination $Payload -Recurse -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $Payload "*") -DestinationPath $Package -Force
Write-Host "Built $Package"
''', encoding="utf-8")

    readme.write_text("""# HooshyarOS Windows Productization\n\nThe Windows release contains the existing HooshyarOS runtime and a native bootstrap EXE when IExpress is available.\n\n- `install.ps1`: installs runtime files and creates the local data directory.\n- `uninstall.ps1`: removes the local installation.\n- `build-installer.ps1`: builds the deterministic bootstrap ZIP payload.\n""", encoding="utf-8")

    payload_script = WINDOWS_INSTALLER / "install.cmd"
    payload_script.write_text("@echo off\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0install.ps1\"\n", encoding="ascii")

    zip_result = WINDOWS_ROOT / "HooshyarOS-Windows-Bootstrap.zip"
    if run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(build)], timeout=45 * 60) != 0:
        return 21

    iexpress = shutil.which("iexpress.exe") or shutil.which("iexpress") or (Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "iexpress.exe")
    exe = WINDOWS_ROOT / "HooshyarOS-Setup.exe"
    if iexpress and Path(iexpress).exists():
        sed_root = WINDOWS_ROOT / "iexpress"
        if sed_root.exists():
            shutil.rmtree(sed_root)
        sed_root.mkdir(parents=True)
        source = sed_root / "source"
        source.mkdir()
        shutil.copy2(payload_script, source / payload_script.name)
        shutil.copy2(install, source / install.name)
        shutil.copy2(uninstall, source / uninstall.name)
        shutil.copy2(zip_result, source / zip_result.name)

        sed = sed_root / "HooshyarOS.sed"
        sed.write_text(f'''[Version]\nClass=IEXPRESS\nSEDVersion=3\n[Options]\nPackagePurpose=InstallApp\nShowInstallProgramWindow=1\nHideExtractAnimation=1\nUseLongFileName=1\nInsideCompressed=1\nCABFileName=HooshyarOS.cab\nTargetName={exe}\nFriendlyName=HooshyarOS\nAppLaunched=install.cmd\nPostInstallCmd=<None>\nSourceFiles=SourceFiles\n[Strings]\nFILE0="install.cmd"\nFILE1="install.ps1"\nFILE2="uninstall.ps1"\nFILE3="{zip_result.name}"\n[SourceFiles]\nSourceFiles0={source}\n[SourceFiles0]\n%FILE0%=\n%FILE1%=\n%FILE2%=\n%FILE3%=\n''', encoding="utf-8")
        if run(str(iexpress), ["/N", "/Q", str(sed)], timeout=15 * 60) != 0:
            return 22

    if not exe.exists() or exe.stat().st_size < 100 * 1024:
        emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="WINDOWS", status="BLOCKED", reason="real-exe-not-produced")
        return 23

    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="WINDOWS", status="COMPLETE",
         artifact=str(exe.relative_to(ROOT)), bootstrap=str(zip_result.relative_to(ROOT)))
    return 0


def provision_android_toolchain() -> tuple[Path, Path, Path] | None:
    local = TOOLCACHE / "android"
    local.mkdir(parents=True, exist_ok=True)

    java = shutil.which("java")
    javac = shutil.which("javac")
    java_home = Path(os.environ.get("JAVA_HOME", "")) if os.environ.get("JAVA_HOME") else None
    if not java or not javac or not java_home or not (java_home / "bin" / "javac.exe").exists():
        jdk_zip = local / "microsoft-jdk-17-windows-x64.zip"
        jdk_root = local / "jdk17"
        download(JDK17_URL, jdk_zip)
        extract_zip(jdk_zip, jdk_root)
        javac_path = find_file(jdk_root, "javac.exe")
        if not javac_path:
            return None
        java_home = javac_path.parent.parent

    sdk_root = local / "sdk"
    android_cli = shutil.which("android.exe") or shutil.which("android")
    if android_cli:
        android_cli_path = Path(android_cli)
    else:
        installed = install_android_cli()
        if not installed:
            emit("AUTONOMOUS_ANDROID_REPAIR", stage="VERIFY", status="BLOCKED", reason="android-cli-not-discoverable")
            return None
        android_cli_path = installed

    gradle_root = local / "gradle"
    gradle_zip = local / "gradle-8.7-bin.zip"
    gradle_bin = find_file(gradle_root, "gradle.bat")
    if not gradle_bin:
        download(GRADLE_URL, gradle_zip)
        extract_zip(gradle_zip, gradle_root)
        gradle_bin = find_file(gradle_root, "gradle.bat")
    if not gradle_bin:
        return None

    env = os.environ.copy()
    env.update({
        "JAVA_HOME": str(java_home),
        "ANDROID_SDK_ROOT": str(sdk_root),
        "ANDROID_HOME": str(sdk_root),
        "PATH": str(java_home / "bin") + os.pathsep + str(sdk_root / "platform-tools") + os.pathsep + str(gradle_bin.parent) + os.pathsep + env.get("PATH", ""),
    })

    sdk_root.mkdir(parents=True, exist_ok=True)
    packages = [
        "platform-tools",
        "platforms/android-35",
        "build-tools/35.0.0",
    ]
    result = run(
        str(android_cli_path),
        [f"--sdk={sdk_root}", "sdk", "install", *packages],
        env=env,
        timeout=90 * 60,
    )
    if result != 0:
        emit(
            "AUTONOMOUS_ANDROID_REPAIR",
            stage="DIAGNOSE",
            status="BLOCKED",
            reason="android-cli-sdk-package-install-failed",
        )
        return None
    required = [
        sdk_root / "platform-tools" / "adb.exe",
        sdk_root / "platforms" / "android-35" / "android.jar",
        sdk_root / "build-tools" / "35.0.0" / "aapt2.exe",
    ]
    if not all(path.exists() for path in required):
        emit(
            "AUTONOMOUS_ANDROID_REPAIR",
            stage="VERIFY",
            status="BLOCKED",
            reason="android-sdk-packages-incomplete",
            missing=[str(path) for path in required if not path.exists()],
        )
        return None
    return java_home, sdk_root, gradle_bin


def android() -> int:
    app = ANDROID_ROOT / "app"
    src = app / "src" / "main" / "java" / "ai" / "hooshyar" / "app"
    main = src / "MainActivity.java"
    manifest = app / "src" / "main" / "AndroidManifest.xml"
    gradle = app / "build.gradle"
    settings = ANDROID_ROOT / "settings.gradle"
    root_gradle = ANDROID_ROOT / "build.gradle"

    src.mkdir(parents=True, exist_ok=True)
    (app / "src" / "main" / "res" / "values").mkdir(parents=True, exist_ok=True)

    settings.write_text("""pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name='HooshyarOS'\ninclude ':app'\n""", encoding="utf-8")
    root_gradle.write_text("""plugins { id 'com.android.application' version '8.6.1' apply false }\n""", encoding="utf-8")
    gradle.write_text("""plugins { id 'com.android.application' }\n\nandroid { namespace 'ai.hooshyar.app'; compileSdk 35\n    defaultConfig { applicationId 'ai.hooshyar.app'; minSdk 26; targetSdk 35; versionCode 1; versionName '1.0.0' }\n}\n\ndependencies { implementation 'androidx.appcompat:appcompat:1.7.0'; implementation 'androidx.webkit:webkit:1.12.1' }\n""", encoding="utf-8")
    manifest.write_text("""<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <uses-permission android:name=\"android.permission.INTERNET\"/>\n    <application android:theme=\"@style/Theme.AppCompat.Light.NoActionBar\" android:label=\"HooshyarOS\">\n        <activity android:name=\".MainActivity\" android:exported=\"true\">\n            <intent-filter><action android:name=\"android.intent.action.MAIN\"/><category android:name=\"android.intent.category.LAUNCHER\"/></intent-filter>\n        </activity>\n    </application>\n</manifest>\n""", encoding="utf-8")
    (app / "src" / "main" / "res" / "values" / "styles.xml").write_text("""<resources><style name=\"Theme.AppCompat.Light.NoActionBar\" parent=\"Theme.AppCompat.Light.NoActionBar\"/></resources>\n""", encoding="utf-8")
    main.write_text("""package ai.hooshyar.app;\n\nimport android.app.Activity;\nimport android.os.Bundle;\nimport android.webkit.WebView;\nimport android.webkit.WebViewClient;\n\npublic class MainActivity extends Activity {\n    @Override public void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        WebView web = new WebView(this);\n        web.setWebViewClient(new WebViewClient());\n        web.getSettings().setJavaScriptEnabled(true);\n        String endpoint = getSharedPreferences(\"hooshyar\", MODE_PRIVATE).getString(\"endpoint\", \"http://10.0.2.2:3000\");\n        web.loadUrl(endpoint);\n        setContentView(web);\n    }\n}\n""", encoding="utf-8")

    toolchain = provision_android_toolchain()
    if toolchain is None:
        emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="ANDROID", status="BLOCKED", reason="android-toolchain-provision-failed")
        return 31
    java_home, sdk_root, gradle_bin = toolchain

    env = os.environ.copy()
    env.update({
        "JAVA_HOME": str(java_home),
        "ANDROID_SDK_ROOT": str(sdk_root),
        "ANDROID_HOME": str(sdk_root),
        "PATH": str(java_home / "bin") + os.pathsep + str(sdk_root / "platform-tools") + os.pathsep + str(sdk_root / "cmdline-tools" / "latest" / "bin") + os.pathsep + str(gradle_bin.parent) + os.pathsep + env.get("PATH", ""),
    })
    if run(str(gradle_bin), ["-p", str(ANDROID_ROOT), "assembleDebug", "--no-daemon"], env=env, timeout=90 * 60) != 0:
        return 32

    apk_candidates = list((ANDROID_ROOT / "app" / "build" / "outputs" / "apk").rglob("*.apk"))
    if not apk_candidates:
        return 33
    ANDROID_RELEASE.mkdir(parents=True, exist_ok=True)
    final_apk = ANDROID_RELEASE / "HooshyarOS.apk"
    shutil.copy2(apk_candidates[0], final_apk)
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="ANDROID", status="COMPLETE", artifact=str(final_apk.relative_to(ROOT)))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    return windows() if args.platform == "WINDOWS" else android()


if __name__ == "__main__":
    raise SystemExit(main())
