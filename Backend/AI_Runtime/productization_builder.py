"""Repository-native release artifact builder for HooshyarOS productization."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path

from android_toolchain_repair import AndroidRepairError, install_from_metadata

ROOT = Path(__file__).resolve().parents[2]
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
WINDOWS_INSTALLER = WINDOWS_ROOT / "installer"
ANDROID_ROOT = ROOT / "android"
ANDROID_RELEASE = RELEASE_ROOT / "android"
TOOLCACHE = RELEASE_ROOT / ".toolcache"

JDK17_URL = "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip"
ANDROID_CLI_URL = "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip"
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

    readme.write_text("""# HooshyarOS Windows Productization

The Windows release contains the existing HooshyarOS runtime and a native bootstrap EXE when IExpress is available.

- `install.ps1`: installs runtime files and creates the local data directory.
- `uninstall.ps1`: removes the local installation.
- `build-installer.ps1`: builds the deterministic bootstrap ZIP payload.
""", encoding="utf-8")

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
        sed.write_text(f'''[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
CABFileName=HooshyarOS.cab
TargetName={exe}
FriendlyName=HooshyarOS
AppLaunched=install.cmd
PostInstallCmd=<None>
SourceFiles=SourceFiles
[Strings]
FILE0="install.cmd"
FILE1="install.ps1"
FILE2="uninstall.ps1"
FILE3="{zip_result.name}"
[SourceFiles]
SourceFiles0={source}
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
''', encoding="utf-8")
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

    java_home = Path(os.environ.get("JAVA_HOME", "")) if os.environ.get("JAVA_HOME") else None
    if not java_home or not (java_home / "bin" / "javac.exe").exists():
        jdk_zip = local / "microsoft-jdk-17-windows-x64.zip"
        jdk_root = local / "jdk17"
        download(JDK17_URL, jdk_zip)
        extract_zip(jdk_zip, jdk_root)
        javac_path = find_file(jdk_root, "javac.exe")
        if not javac_path:
            return None
        java_home = javac_path.parent.parent

    sdk_root = local / "sdk"
    cmdline_zip = local / "commandlinetools-win-latest.zip"
    cmdline_root = sdk_root / "cmdline-tools" / "latest"
    sdkmanager = cmdline_root / "bin" / "sdkmanager.bat"
    if not sdkmanager.exists():
        download(ANDROID_CLI_URL, cmdline_zip)
        temp_extract = local / "cmdline-extract"
        if temp_extract.exists():
            shutil.rmtree(temp_extract)
        extract_zip(cmdline_zip, temp_extract)
        inner = temp_extract / "cmdline-tools"
        if not inner.exists():
            return None
        cmdline_root.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(inner, cmdline_root, dirs_exist_ok=True)

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
    env.update({"JAVA_HOME": str(java_home), "ANDROID_SDK_ROOT": str(sdk_root), "ANDROID_HOME": str(sdk_root)})
    env["PATH"] = os.pathsep.join([str(java_home / "bin"), str(sdk_root / "platform-tools"), str(sdk_root / "cmdline-tools" / "latest" / "bin"), str(gradle_bin.parent), env.get("PATH", "")])
    packages = ["platform-tools", "platforms;android-35", "build-tools;35.0.0"]
    result = run(str(sdkmanager), [f"--sdk_root={sdk_root}", *packages], env=env, timeout=90 * 60, input_text="y\n" * 30)
    if result != 0:
        try:
            install_from_metadata(sdk_root, packages)
        except AndroidRepairError as exc:
            emit("AUTONOMOUS_ANDROID_REPAIR", stage="DIAGNOSE", status="BLOCKED", reason=str(exc))
            return None
    return java_home, sdk_root, gradle_bin


def android() -> int:
    app = ANDROID_ROOT / "app"
    src = app / "src" / "main" / "java" / "ai" / "hooshyar" / "app"
    values = app / "src" / "main" / "res" / "values"
    src.mkdir(parents=True, exist_ok=True)
    values.mkdir(parents=True, exist_ok=True)

    (ANDROID_ROOT / "settings.gradle").write_text("""pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name='HooshyarOS'
include ':app'
""", encoding="utf-8")
    (ANDROID_ROOT / "build.gradle").write_text("plugins { id 'com.android.application' version '8.6.1' apply false }\n", encoding="utf-8")
    (app / "build.gradle").write_text("""plugins { id 'com.android.application' }

android {
    namespace 'ai.hooshyar.app'
    compileSdk 35
    defaultConfig { applicationId 'ai.hooshyar.app'; minSdk 26; targetSdk 35; versionCode 1; versionName '1.0.0' }
    buildTypes {
        debug { buildConfigField 'String', 'HOOSHYAR_ENDPOINT', '\"' + (project.findProperty('HOOSHYAR_ENDPOINT') ?: 'http://10.0.2.2:3000') + '\"' }
        release { buildConfigField 'String', 'HOOSHYAR_ENDPOINT', '\"' + (project.findProperty('HOOSHYAR_ENDPOINT') ?: '') + '\"' }
    }
    buildFeatures { buildConfig true }
}

dependencies { implementation 'androidx.appcompat:appcompat:1.7.0'; implementation 'androidx.webkit:webkit:1.12.1' }
""", encoding="utf-8")
    (app / "src" / "main" / "AndroidManifest.xml").write_text("""<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\"><uses-permission android:name=\"android.permission.INTERNET\"/><application android:theme=\"@style/Theme.AppCompat.Light.NoActionBar\" android:label=\"HooshyarOS\"><activity android:name=\".MainActivity\" android:exported=\"true\"><intent-filter><action android:name=\"android.intent.action.MAIN\"/><category android:name=\"android.intent.category.LAUNCHER\"/></intent-filter></activity></application></manifest>\n""", encoding="utf-8")
    (values / "styles.xml").write_text("<resources><style name=\"Theme.AppCompat.Light.NoActionBar\" parent=\"Theme.AppCompat.Light.NoActionBar\"/></resources>\n", encoding="utf-8")
    (src / "MainActivity.java").write_text("""package ai.hooshyar.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView web = new WebView(this);
        web.setWebViewClient(new WebViewClient());
        web.getSettings().setJavaScriptEnabled(true);
        String endpoint = BuildConfig.HOOSHYAR_ENDPOINT;
        if (endpoint == null || endpoint.trim().isEmpty()) {
            throw new IllegalStateException("HOOSHYAR_ENDPOINT is required for release builds");
        }
        web.loadUrl(endpoint);
        setContentView(web);
    }
}
""", encoding="utf-8")

    toolchain = provision_android_toolchain()
    if toolchain is None:
        return 31
    java_home, sdk_root, gradle_bin = toolchain
    env = os.environ.copy()
    env.update({"JAVA_HOME": str(java_home), "ANDROID_SDK_ROOT": str(sdk_root), "ANDROID_HOME": str(sdk_root)})
    env["PATH"] = os.pathsep.join([str(java_home / "bin"), str(sdk_root / "platform-tools"), str(sdk_root / "cmdline-tools" / "latest" / "bin"), str(gradle_bin.parent), env.get("PATH", "")])
    endpoint = os.environ.get("HOOSHYAR_ENDPOINT", "").strip()
    if not endpoint:
        emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="ANDROID", status="BLOCKED", reason="android-release-endpoint-required")
        return 34
    if run(str(gradle_bin), ["-p", str(ANDROID_ROOT), "assembleDebug", "--no-daemon", f"-PHOOSHYAR_ENDPOINT={endpoint}"], env=env, timeout=90 * 60) != 0:
        return 32
    apk_candidates = list((ANDROID_ROOT / "app" / "build" / "outputs" / "apk").rglob("*.apk"))
    if not apk_candidates:
        return 33
    ANDROID_RELEASE.mkdir(parents=True, exist_ok=True)
    final_apk = ANDROID_RELEASE / "HooshyarOS.apk"
    shutil.copy2(apk_candidates[0], final_apk)
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="ANDROID", status="COMPLETE", artifact=str(final_apk.relative_to(ROOT)), endpoint=endpoint)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    return windows() if args.platform == "WINDOWS" else android()


if __name__ == "__main__":
    raise SystemExit(main())
