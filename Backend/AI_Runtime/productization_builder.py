"""Repository-native release artifact builder for HooshyarOS productization.

Builds real customer artifacts while keeping the existing HBOS/business architecture intact.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
WINDOWS_INSTALLER = WINDOWS_ROOT / "installer"
ANDROID_ROOT = ROOT / "android"
TOOLCACHE = ROOT / ".toolcache"
ANDROID_TOOLCACHE = TOOLCACHE / "android"
JDK_ROOT = ANDROID_TOOLCACHE / "jdk17"
GRADLE_ROOT = ANDROID_TOOLCACHE / "gradle"
SDK_ROOT = ANDROID_TOOLCACHE / "android-sdk"

ANDROID_CMD_TOOLS_URL = "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip"
JDK17_URL = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
GRADLE_VERSION = "8.7"
GRADLE_URL = f"https://services.gradle.org/distributions/gradle-{GRADLE_VERSION}-bin.zip"


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 0:
        return
    emit("AUTONOMOUS_PRODUCTIZATION_DOWNLOAD", url=url, target=str(target.relative_to(ROOT)))
    urllib.request.urlretrieve(url, target)


def extract_zip(archive: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zf:
        zf.extractall(target)


def find_java_home(root: Path) -> Path:
    direct = root / "jdk-17"
    if (direct / "bin" / "java.exe").exists():
        return direct
    candidates = [p for p in root.iterdir() if p.is_dir()] if root.exists() else []
    for p in candidates:
        if (p / "bin" / "java.exe").exists():
            return p
    raise RuntimeError("JDK 17 could not be located after extraction")


def find_gradle_home(root: Path) -> Path:
    direct = root / f"gradle-{GRADLE_VERSION}"
    if (direct / "bin" / "gradle.bat").exists():
        return direct
    candidates = [p for p in root.iterdir() if p.is_dir()] if root.exists() else []
    for p in candidates:
        if (p / "bin" / "gradle.bat").exists():
            return p
    raise RuntimeError("Gradle distribution could not be located after extraction")


def ensure_android_toolchain() -> tuple[Path, Path, Path]:
    ANDROID_TOOLCACHE.mkdir(parents=True, exist_ok=True)
    JDK_ROOT.mkdir(parents=True, exist_ok=True)
    GRADLE_ROOT.mkdir(parents=True, exist_ok=True)
    SDK_ROOT.mkdir(parents=True, exist_ok=True)

    jdk_zip = ANDROID_TOOLCACHE / "jdk17.zip"
    if not (JDK_ROOT / "bin" / "java.exe").exists():
        download(JDK17_URL, jdk_zip)
        for child in list(JDK_ROOT.iterdir()):
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
        extract_zip(jdk_zip, JDK_ROOT)
    java_home = find_java_home(JDK_ROOT)

    gradle_zip = ANDROID_TOOLCACHE / f"gradle-{GRADLE_VERSION}-bin.zip"
    if not (GRADLE_ROOT / f"gradle-{GRADLE_VERSION}" / "bin" / "gradle.bat").exists():
        download(GRADLE_URL, gradle_zip)
        for child in list(GRADLE_ROOT.iterdir()):
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
        extract_zip(gradle_zip, GRADLE_ROOT)
    gradle_home = find_gradle_home(GRADLE_ROOT)

    cmd_zip = ANDROID_TOOLCACHE / "commandlinetools-win.zip"
    sdkmanager = SDK_ROOT / "cmdline-tools" / "latest" / "bin" / "sdkmanager.bat"
    if not sdkmanager.exists():
        download(ANDROID_CMD_TOOLS_URL, cmd_zip)
        staging = ANDROID_TOOLCACHE / "cmdline-tools-staging"
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        extract_zip(cmd_zip, staging)
        source = staging / "cmdline-tools"
        destination = SDK_ROOT / "cmdline-tools" / "latest"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            shutil.rmtree(destination, ignore_errors=True)
        if source.exists():
            shutil.move(str(source), str(destination))
        else:
            raise RuntimeError("Android command-line tools archive layout was unexpected")

    env = os.environ.copy()
    env["JAVA_HOME"] = str(java_home)
    env["ANDROID_HOME"] = str(SDK_ROOT)
    env["ANDROID_SDK_ROOT"] = str(SDK_ROOT)
    env["PATH"] = os.pathsep.join([
        str(java_home / "bin"),
        str(sdkmanager.parent),
        str(SDK_ROOT / "platform-tools"),
        env.get("PATH", ""),
    ])

    packages = ["platform-tools", "platforms;android-35", "build-tools;34.0.0"]
    subprocess.run([str(sdkmanager), *packages], cwd=ROOT, env=env, input=None, text=True,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)
    license_process = subprocess.run([str(sdkmanager), "--licenses"], cwd=ROOT, env=env,
                                     input=("y\n" * 50), text=True,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    print(license_process.stdout, end="")
    if license_process.returncode != 0:
        emit("AUTONOMOUS_PRODUCTIZATION_NOTE", platform="ANDROID", action="sdkmanager-license-nonzero", returnCode=license_process.returncode)

    return java_home, gradle_home, SDK_ROOT


def write_windows_installer_files() -> tuple[Path, Path, Path, Path]:
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
"$RuntimeRoot\runtime\node.exe" "$RuntimeRoot\node_modules\tsx\dist\cli.mjs" "$RuntimeRoot\Backend\HBOS\Autonomous\Runtime\CommercialRuntimeServer.ts"
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
$Package = Join-Path $Root "HooshyarOS-Windows-Bootstrap.zip"
if (Test-Path $Package) { Remove-Item $Package -Force }
Compress-Archive -Path (Join-Path $Root "payload\*") -DestinationPath $Package -Force
Write-Host "Built $Package"
''', encoding="utf-8")

    readme.write_text("""# HooshyarOS Windows Productization

This directory contains the customer installer boundary for the existing HooshyarOS runtime.

The autonomous builder produces a real self-extracting `HooshyarOS-Setup.exe` with Windows IExpress when available.
""", encoding="utf-8")
    return install, uninstall, build, readme


def stage_windows_payload() -> Path:
    WINDOWS_ROOT.mkdir(parents=True, exist_ok=True)
    source = WINDOWS_ROOT / "iexpress-source"
    if source.exists():
        shutil.rmtree(source, ignore_errors=True)
    payload = source / "payload"
    payload.mkdir(parents=True, exist_ok=True)

    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node or not npm:
        raise RuntimeError("Node.js and npm are required on the build machine to create the self-contained Windows product")

    package_files = [ROOT / "package.json"]
    lock = ROOT / "package-lock.json"
    if lock.exists():
        package_files.append(lock)
    for p in package_files:
        shutil.copy2(p, payload / p.name)
    for dirname in ("Backend", "Frontend", "node_modules"):
        src = ROOT / dirname
        if src.exists():
            shutil.copytree(src, payload / dirname, dirs_exist_ok=True)
    runtime = payload / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node, runtime / "node.exe")

    install, _, _, _ = write_windows_installer_files()
    shutil.copy2(install, source / "install.ps1")
    zip_path = source / "HooshyarOS-Windows-Bootstrap.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in payload.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(source))
    return source


def create_iexpress_exe() -> Path:
    if os.name != "nt":
        raise RuntimeError("Windows EXE packaging requires Windows")
    iexpress = Path(os.environ.get("WINDIR", r"C:\Windows")) / "System32" / "iexpress.exe"
    if not iexpress.exists():
        raise RuntimeError("Windows IExpress is not available")

    source = stage_windows_payload()
    sed = WINDOWS_ROOT / "HooshyarOS-Setup.sed"
    target = WINDOWS_ROOT / "HooshyarOS-Setup.exe"
    if target.exists():
        target.unlink()

    sed.write_text(f'''[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName={target}
FriendlyName=HooshyarOS Setup
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=HooshyarOS installation completed.
TargetName={target}
FriendlyName=HooshyarOS Setup
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1
UserQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1
FILE0="install.ps1"
FILE1="HooshyarOS-Windows-Bootstrap.zip"
[SourceFiles]
SourceFiles0={source}
[SourceFiles0]
%FILE0%=
%FILE1%=
''', encoding="utf-8")

    result = subprocess.run([str(iexpress), "/N", "/Q", str(sed)], cwd=ROOT,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, encoding="utf-8", errors="replace", check=False)
    if result.stdout:
        print(result.stdout, end="")
    if result.returncode != 0 or not target.exists():
        raise RuntimeError(f"IExpress failed with code {result.returncode}")
    return target


def windows() -> int:
    install, uninstall, build, readme = write_windows_installer_files()
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="WINDOWS", status="READY",
         artifacts=[str(p.relative_to(ROOT)) for p in (install, uninstall, build, readme)])
    exe = create_iexpress_exe()
    emit("AUTONOMOUS_PRODUCTIZATION_ARTIFACT", platform="WINDOWS", artifact=str(exe.relative_to(ROOT)), size=exe.stat().st_size)
    return 0


def android() -> int:
    app = ANDROID_ROOT / "app"
    src = app / "src" / "main" / "java" / "ai" / "hooshyar" / "app"
    main = src / "MainActivity.java"
    manifest = app / "src" / "main" / "AndroidManifest.xml"
    gradle = app / "build.gradle"
    settings = ANDROID_ROOT / "settings.gradle"
    root_gradle = ANDROID_ROOT / "build.gradle"
    gradlew = ANDROID_ROOT / "gradlew.bat"

    src.mkdir(parents=True, exist_ok=True)
    (app / "src" / "main" / "res" / "values").mkdir(parents=True, exist_ok=True)

    settings.write_text("""pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name='HooshyarOS'\ninclude ':app'\n""", encoding="utf-8")
    root_gradle.write_text("""plugins { id 'com.android.application' version '8.6.1' apply false }\n""", encoding="utf-8")
    gradle.write_text("""plugins { id 'com.android.application' }\n\nandroid { namespace 'ai.hooshyar.app'; compileSdk 35\n    defaultConfig { applicationId 'ai.hooshyar.app'; minSdk 26; targetSdk 35; versionCode 1; versionName '1.0.0' }\n}\n\ndependencies { implementation 'androidx.appcompat:appcompat:1.7.0'; implementation 'androidx.webkit:webkit:1.12.1' }\n""", encoding="utf-8")
    manifest.write_text("""<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <uses-permission android:name=\"android.permission.INTERNET\"/>\n    <application android:theme=\"@style/Theme.AppCompat.Light.NoActionBar\" android:label=\"HooshyarOS\">\n        <activity android:name=\".MainActivity\" android:exported=\"true\">\n            <intent-filter><action android:name=\"android.intent.action.MAIN\"/><category android:name=\"android.intent.category.LAUNCHER\"/></intent-filter>\n        </activity>\n    </application>\n</manifest>\n""", encoding="utf-8")
    (app / "src" / "main" / "res" / "values" / "styles.xml").write_text("""<resources><style name=\"Theme.AppCompat.Light.NoActionBar\" parent=\"Theme.AppCompat.Light.NoActionBar\"/></resources>\n""", encoding="utf-8")
    main.write_text("""package ai.hooshyar.app;\n\nimport android.app.Activity;\nimport android.os.Bundle;\nimport android.webkit.WebView;\nimport android.webkit.WebViewClient;\n\npublic class MainActivity extends Activity {\n    @Override public void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        WebView web = new WebView(this);\n        web.setWebViewClient(new WebViewClient());\n        web.getSettings().setJavaScriptEnabled(true);\n        String endpoint = getSharedPreferences(\"hooshyar\", MODE_PRIVATE).getString(\"endpoint\", \"http://10.0.2.2:3000\");\n        web.loadUrl(endpoint);\n        setContentView(web);\n    }\n}\n""", encoding="utf-8")

    java_home, gradle_home, sdk_home = ensure_android_toolchain()
    env = os.environ.copy()
    env["JAVA_HOME"] = str(java_home)
    env["ANDROID_HOME"] = str(sdk_home)
    env["ANDROID_SDK_ROOT"] = str(sdk_home)
    env["PATH"] = os.pathsep.join([str(java_home / "bin"), str(gradle_home / "bin"), str(sdk_home / "platform-tools"), env.get("PATH", "")])

    result = subprocess.run([str(gradle_home / "bin" / "gradle.bat"), "-p", str(ANDROID_ROOT), "assembleDebug", "--no-daemon"],
                            cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, encoding="utf-8", errors="replace", check=False, timeout=90 * 60)
    print(result.stdout, end="")
    if result.returncode != 0:
        return result.returncode
    apks = list((app / "build" / "outputs" / "apk").rglob("*.apk"))
    if not apks:
        raise RuntimeError("Android build completed without an APK")
    final_apk = RELEASE_ROOT / "android" / "HooshyarOS.apk"
    final_apk.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(apks[0], final_apk)
    emit("AUTONOMOUS_PRODUCTIZATION_ARTIFACT", platform="ANDROID", artifact=str(final_apk.relative_to(ROOT)), size=final_apk.stat().st_size)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    try:
        return windows() if args.platform == "WINDOWS" else android()
    except Exception as exc:
        emit("AUTONOMOUS_PRODUCTIZATION_BUILDER_ERROR", platform=args.platform, error=str(exc))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
