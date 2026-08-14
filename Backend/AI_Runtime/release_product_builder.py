"""Final customer-artifact builder for HooshyarOS productization."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from android_toolchain_sources import CMDLINE_TOOLS_URLS

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization"
WIN = DIST / "windows"
ANDROID = ROOT / "android"
CACHE = ROOT / ".toolcache" / "android"
JDK = CACHE / "jdk17"
GRADLE = CACHE / "gradle"
SDK = CACHE / "android-sdk"
GRADLE_VERSION = "8.7"
JDK_URLS = (
    "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip",
    "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse",
)
GRADLE_URL = f"https://services.gradle.org/distributions/gradle-{GRADLE_VERSION}-bin.zip"
ANDROID_REPO_URLS = (
    "https://dl.google.com/android/repository/",
    "https://redirector.gvt1.com/edgedl/android/repository/",
)
ANDROID_PACKAGE_SPECS = {
    "platform-tools": ("platform-tools-latest-windows.zip", None),
    "platforms;android-35": ("platform-35_r02.zip", "0bb560a90a7a2cbd0dd8348224d518b638fe7949"),
    "build-tools;34.0.0": ("build-tools_r34-windows.zip", "62cfde1b6fcc3ad12a4d2ba1b537e752768bfd47"),
}


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def _download_with_urllib(url: str, target: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HooshyarOS-ReleaseBuilder/1.0",
            "Accept": "application/zip,application/octet-stream,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as fh:
        shutil.copyfileobj(response, fh)


def _download_with_curl(url: str, target: Path) -> None:
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        raise RuntimeError("curl.exe is unavailable for download fallback")
    result = subprocess.run(
        [
            curl,
            "-L",
            "--fail",
            "--retry",
            "3",
            "--retry-all-errors",
            "--connect-timeout",
            "30",
            "--max-time",
            "600",
            "-A",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HooshyarOS-ReleaseBuilder/1.0",
            "-o",
            str(target),
            url,
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.returncode != 0:
        raise RuntimeError(f"curl download failed with exit code {result.returncode}")


def _validate_zip(target: Path) -> None:
    if not target.exists() or target.stat().st_size <= 0:
        raise RuntimeError("download produced an empty artifact")
    if not zipfile.is_zipfile(target):
        raise RuntimeError("downloaded artifact is not a valid ZIP archive")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size:
        if target.suffix.lower() != ".zip" or zipfile.is_zipfile(target):
            return
        target.unlink()

    emit("AUTONOMOUS_RELEASE_DOWNLOAD", url=url, target=str(target.relative_to(ROOT)))
    try:
        _download_with_urllib(url, target)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
        emit(
            "AUTONOMOUS_RELEASE_DOWNLOAD_FALLBACK",
            platform="ANDROID",
            target=str(target.relative_to(ROOT)),
            method="curl.exe",
            reason=str(exc),
        )
        if target.exists():
            target.unlink()
        _download_with_curl(url, target)

    if target.suffix.lower() == ".zip":
        _validate_zip(target)


def download_any(urls: tuple[str, ...], target: Path, platform: str, artifact: str) -> str:
    errors: list[str] = []
    for url in urls:
        try:
            download(url, target)
            return url
        except Exception as exc:
            errors.append(f"{url}: {exc}")
            if target.exists():
                target.unlink()
            emit(
                "AUTONOMOUS_RELEASE_DOWNLOAD_FALLBACK",
                platform=platform,
                artifact=artifact,
                failedUrl=url,
                reason=str(exc),
            )
    raise RuntimeError("all download sources failed: " + " | ".join(errors))


def unzip(src: Path, dest: Path) -> None:
    _validate_zip(src)
    if dest.exists():
        shutil.rmtree(dest, ignore_errors=True)
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as zf:
        zf.extractall(dest)


def _extract_component(archive: Path, destination: Path) -> None:
    staging = CACHE / "android-component-stage"
    if staging.exists():
        shutil.rmtree(staging, ignore_errors=True)
    unzip(archive, staging)
    roots = [p for p in staging.iterdir() if p.is_dir()] if staging.exists() else []
    source = roots[0] if len(roots) == 1 else staging
    if destination.exists():
        shutil.rmtree(destination, ignore_errors=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
    if staging.exists():
        shutil.rmtree(staging, ignore_errors=True)


def _install_android_components_direct() -> None:
    emit(
        "AUTONOMOUS_RELEASE_ANDROID_FALLBACK",
        strategy="DIRECT_PACKAGE_DOWNLOAD",
        reason="sdkmanager repository manifest unavailable",
    )

    for package, (filename, expected_sha256) in ANDROID_PACKAGE_SPECS.items():
        if package == "platform-tools":
            destination = SDK / "platform-tools"
        elif package == "platforms;android-35":
            destination = SDK / "platforms" / "android-35"
        elif package == "build-tools;34.0.0":
            destination = SDK / "build-tools" / "34.0.0"
        else:
            raise RuntimeError(f"unsupported direct Android package: {package}")

        marker = destination / ("adb.exe" if package == "platform-tools" else "android.jar" if package == "platforms;android-35" else "aapt2.exe")
        if marker.exists():
            continue

        archive = CACHE / filename
        urls = tuple(f"{base}{filename}" for base in ANDROID_REPO_URLS)
        selected = download_any(urls, archive, "ANDROID", package)
        if expected_sha256:
            actual = _sha256(archive)
            if actual != expected_sha256:
                raise RuntimeError(f"checksum mismatch for {package}: expected {expected_sha256}, got {actual}")
        emit(
            "AUTONOMOUS_RELEASE_ANDROID_COMPONENT_SOURCE_SELECTED",
            package=package,
            source=selected,
        )
        _extract_component(archive, destination)


def ensure_android_toolchain() -> tuple[Path, Path, Path]:
    CACHE.mkdir(parents=True, exist_ok=True)
    JDK.mkdir(parents=True, exist_ok=True)
    GRADLE.mkdir(parents=True, exist_ok=True)
    SDK.mkdir(parents=True, exist_ok=True)

    jzip = CACHE / "jdk17.zip"
    if not (JDK / "bin" / "java.exe").exists():
        selected = download_any(JDK_URLS, jzip, "ANDROID", "jdk17")
        emit("AUTONOMOUS_RELEASE_JDK_SOURCE_SELECTED", platform="ANDROID", source=selected)
        unzip(jzip, JDK)

    java_home = next((p for p in [JDK, *JDK.iterdir()] if (p / "bin" / "java.exe").exists()), None)
    if java_home is None:
        raise RuntimeError("JDK 17 provisioning failed")

    ghome = GRADLE / f"gradle-{GRADLE_VERSION}"
    gzip = CACHE / f"gradle-{GRADLE_VERSION}.zip"
    if not (ghome / "bin" / "gradle.bat").exists():
        download(GRADLE_URL, gzip)
        unzip(gzip, GRADLE)
    if not (ghome / "bin" / "gradle.bat").exists():
        raise RuntimeError("Gradle provisioning failed")

    czip = CACHE / "commandlinetools.zip"
    sdkmanager = SDK / "cmdline-tools" / "latest" / "bin" / "sdkmanager.bat"
    if not sdkmanager.exists():
        selected = download_any(CMDLINE_TOOLS_URLS, czip, "ANDROID", "command-line-tools")
        emit("AUTONOMOUS_RELEASE_CMDLINE_TOOLS_SOURCE_SELECTED", platform="ANDROID", source=selected)
        staging = CACHE / "cmdline-tools-stage"
        unzip(czip, staging)
        source = staging / "cmdline-tools"
        destination = SDK / "cmdline-tools" / "latest"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            shutil.rmtree(destination, ignore_errors=True)
        shutil.move(str(source), str(destination))

    env = os.environ.copy()
    env.update(JAVA_HOME=str(java_home), ANDROID_HOME=str(SDK), ANDROID_SDK_ROOT=str(SDK))
    env["PATH"] = os.pathsep.join(
        [str(java_home / "bin"), str(sdkmanager.parent), str(SDK / "platform-tools"), env.get("PATH", "")]
    )

    try:
        result = subprocess.run(
            [str(sdkmanager), "platform-tools", "platforms;android-35", "build-tools;34.0.0"],
            cwd=ROOT,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
            timeout=20 * 60,
        )
        if result.stdout:
            print(result.stdout, end="")
        if result.returncode != 0:
            raise RuntimeError(f"sdkmanager failed with exit code {result.returncode}")
    except Exception as exc:
        emit(
            "AUTONOMOUS_RELEASE_ANDROID_SDKMANAGER_FALLBACK",
            strategy="DIRECT_PACKAGE_DOWNLOAD",
            reason=str(exc),
        )
        _install_android_components_direct()

    subprocess.run(
        [str(sdkmanager), "--licenses"],
        cwd=ROOT,
        env=env,
        input="y\n" * 64,
        text=True,
        check=False,
    )
    return java_home, ghome, SDK


def windows() -> int:
    installer = WIN / "installer"
    source = WIN / "iexpress-source"
    payload = source / "payload"
    installer.mkdir(parents=True, exist_ok=True)
    if source.exists():
        shutil.rmtree(source, ignore_errors=True)
    payload.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    if not node or not (ROOT / "node_modules").exists():
        raise RuntimeError("Windows self-contained build requires local Node.js and node_modules")
    for name in ("package.json", "package-lock.json"):
        src = ROOT / name
        if src.exists():
            shutil.copy2(src, payload / name)
    for name in ("Backend", "Frontend", "node_modules"):
        src = ROOT / name
        if src.exists():
            shutil.copytree(src, payload / name, dirs_exist_ok=True)
    runtime = payload / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node, runtime / "node.exe")
    install_inner = source / "install.ps1"
    install_inner.write_text(
        r'''$ErrorActionPreference="Stop"
$here=Split-Path -Parent $MyInvocation.MyCommand.Path
$zip=Join-Path $here "HooshyarOS-Windows-Bootstrap.zip"
$bundle=Join-Path $here "bundle"
if(Test-Path $bundle){Remove-Item $bundle -Recurse -Force}
Expand-Archive -Path $zip -DestinationPath $bundle -Force
$installRoot=Join-Path $env:ProgramData "HooshyarOS"
$runtime=Join-Path $installRoot "runtime"
$data=Join-Path $installRoot "data"
New-Item -ItemType Directory -Force -Path $runtime,$data | Out-Null
Copy-Item (Join-Path $bundle "payload\*") $runtime -Recurse -Force
$launcher=Join-Path $runtime "start-hooshyar.cmd"
"@echo off`r`ncd /d `"$runtime`"`r`n`"$runtime\runtime\node.exe`" `"$runtime\node_modules\tsx\dist\cli.mjs`" `"$runtime\Backend\HBOS\Autonomous\Runtime\CommercialRuntimeServer.ts`"" | Set-Content $launcher -Encoding ASCII
Write-Host "HooshyarOS installed to $installRoot"
''',
        encoding="utf-8",
    )
    uninstall = installer / "uninstall.ps1"
    uninstall.write_text(
        '$ErrorActionPreference="Stop"\n$root=Join-Path $env:ProgramData "HooshyarOS"\nif(Test-Path $root){Remove-Item $root -Recurse -Force}\nWrite-Host "HooshyarOS uninstalled."\n',
        encoding="utf-8",
    )
    package = source / "HooshyarOS-Windows-Bootstrap.zip"
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in payload.rglob("*"):
            if p.is_file():
                zf.write(p, p.relative_to(source))
    target = WIN / "HooshyarOS-Setup.exe"
    sed = WIN / "HooshyarOS-Setup.sed"
    iexpress = Path(os.environ.get("WINDIR", r"C:\Windows")) / "System32" / "iexpress.exe"
    if not iexpress.exists():
        raise RuntimeError("IExpress is unavailable")
    sed.write_text(
        f'''[Version]\nClass=IEXPRESS\nSEDVersion=3\n[Options]\nPackagePurpose=InstallApp\nShowInstallProgramWindow=1\nHideExtractAnimation=1\nUseLongFileName=1\nInsideCompressed=1\nCAB_FixedSize=0\nCAB_ResvCodeSigning=0\nRebootMode=N\nInstallPrompt=\nDisplayLicense=\nFinishMessage=HooshyarOS installation completed.\nTargetName={target}\nFriendlyName=HooshyarOS Setup\nAppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nPostInstallCmd=<None>\nAdminQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nUserQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nSourceFiles=SourceFiles\n[Strings]\nFILE0="install.ps1"\nFILE1="HooshyarOS-Windows-Bootstrap.zip"\n[SourceFiles]\nSourceFiles0={source}\n[SourceFiles0]\n%FILE0%=\n%FILE1%=\n''',
        encoding="utf-8",
    )
    if target.exists():
        target.unlink()
    result = subprocess.run(
        [str(iexpress), "/N", "/Q", str(sed)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    print(result.stdout, end="")
    if result.returncode or not target.exists():
        raise RuntimeError("IExpress did not produce HooshyarOS-Setup.exe")
    emit("AUTONOMOUS_RELEASE_ARTIFACT", platform="WINDOWS", artifact=str(target.relative_to(ROOT)), size=target.stat().st_size)
    return 0


def android() -> int:
    java_home, gradle_home, sdk = ensure_android_toolchain()
    app = ANDROID / "app"
    app.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.update(JAVA_HOME=str(java_home), ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(sdk))
    env["PATH"] = os.pathsep.join(
        [str(java_home / "bin"), str(gradle_home / "bin"), str(sdk / "platform-tools"), env.get("PATH", "")]
    )
    result = subprocess.run(
        [str(gradle_home / "bin" / "gradle.bat"), "-p", str(ANDROID), "assembleDebug", "--no-daemon"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=90 * 60,
        check=False,
    )
    print(result.stdout, end="")
    if result.returncode:
        return result.returncode
    apks = list((app / "build" / "outputs" / "apk").rglob("*.apk"))
    if not apks:
        raise RuntimeError("Android build produced no APK")
    out = DIST / "android" / "HooshyarOS.apk"
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(apks[0], out)
    emit("AUTONOMOUS_RELEASE_ARTIFACT", platform="ANDROID", artifact=str(out.relative_to(ROOT)), size=out.stat().st_size)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=["WINDOWS", "ANDROID"], required=True)
    args = parser.parse_args()
    try:
        return windows() if args.platform == "WINDOWS" else android()
    except Exception as exc:
        emit("AUTONOMOUS_RELEASE_BLOCKED", platform=args.platform, reason=str(exc))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())