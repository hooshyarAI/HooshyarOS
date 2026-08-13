"""Repository-native release artifact builder for HooshyarOS productization.

This module is invoked by the autonomous productization worker. It creates
release scaffolding/artifacts without changing the HBOS business architecture.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE_ROOT = ROOT / "dist" / "productization"
WINDOWS_ROOT = RELEASE_ROOT / "windows"
WINDOWS_INSTALLER = WINDOWS_ROOT / "installer"
ANDROID_ROOT = ROOT / "android"


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


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

    readme.write_text("""# HooshyarOS Windows Productization\n\nThis is the Windows-native bootstrap installer boundary for the existing HooshyarOS web runtime.\n\n- `install.ps1`: installs runtime files and creates the local data directory.\n- `build-installer.ps1`: produces a deterministic ZIP bootstrap package.\n- `uninstall.ps1`: removes the local installation.\n\nA native `.exe` can be layered later when an approved installer toolchain is available; the core platform architecture is unchanged.\n""", encoding="utf-8")

    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="WINDOWS", status="READY", artifacts=[str(p.relative_to(ROOT)) for p in (install, uninstall, build, readme)])
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

    settings.write_text("""pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name='HooshyarOS'\ninclude ':app'\n""", encoding="utf-8")
    root_gradle.write_text("""plugins { id 'com.android.application' version '8.6.1' apply false }\n""", encoding="utf-8")
    gradle.write_text("""plugins { id 'com.android.application' }\n\nandroid { namespace 'ai.hooshyar.app'; compileSdk 35\n    defaultConfig { applicationId 'ai.hooshyar.app'; minSdk 26; targetSdk 35; versionCode 1; versionName '1.0.0' }\n}\n\ndependencies { implementation 'androidx.appcompat:appcompat:1.7.0'; implementation 'androidx.webkit:webkit:1.12.1' }\n""", encoding="utf-8")
    manifest.write_text("""<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <uses-permission android:name=\"android.permission.INTERNET\"/>\n    <application android:theme=\"@style/Theme.AppCompat.Light.NoActionBar\" android:label=\"HooshyarOS\">\n        <activity android:name=\".MainActivity\" android:exported=\"true\">\n            <intent-filter>\n                <action android:name=\"android.intent.action.MAIN\"/>\n                <category android:name=\"android.intent.category.LAUNCHER\"/>\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n""", encoding="utf-8")
    (app / "src" / "main" / "res" / "values").mkdir(parents=True, exist_ok=True)
    (app / "src" / "main" / "res" / "values" / "styles.xml").write_text("""<resources><style name=\"Theme.AppCompat.Light.NoActionBar\" parent=\"Theme.AppCompat.Light.NoActionBar\"/></resources>\n""", encoding="utf-8")
    main.write_text("""package ai.hooshyar.app;\n\nimport android.app.Activity;\nimport android.os.Bundle;\nimport android.webkit.WebView;\nimport android.webkit.WebViewClient;\n\npublic class MainActivity extends Activity {\n    @Override public void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        WebView web = new WebView(this);\n        web.setWebViewClient(new WebViewClient());\n        web.getSettings().setJavaScriptEnabled(true);\n        String endpoint = getSharedPreferences(\"hooshyar\", MODE_PRIVATE).getString(\"endpoint\", \"http://10.0.2.2:3000\");\n        web.loadUrl(endpoint);\n        setContentView(web);\n    }\n}\n""", encoding="utf-8")
    gradlew.write_text("""@echo off\ngradle %*\n""", encoding="utf-8")

    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", platform="ANDROID", status="READY", project=str(ANDROID_ROOT.relative_to(ROOT)))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    return windows() if args.platform == "WINDOWS" else android()


if __name__ == "__main__":
    raise SystemExit(main())
