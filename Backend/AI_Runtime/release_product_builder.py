"""Customer-artifact builder for HooshyarOS productization.

Windows packaging is deliberately production-oriented: the installer payload
contains only runtime source, a minimal Node runtime dependency closure, web
assets and the launcher. Development tests, caches, repository metadata and
Python bytecode are rejected before IExpress packaging.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
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
    "platform-tools": ("platform-tools_r36.0.0-win.zip", "sha256", "12c2841f354e92a0eb2fd7bf6f0f9bf8538abce7bd6b060ac8349d6f6a61107c"),
    "platforms;android-35": ("platform-35_r02.zip", "sha1", "0988cacad01b38a18a47bac14a0695f246bc76c1b06c0eeb8eb0dc825ab0c8e0"),
    "build-tools;34.0.0": ("build-tools_r34-windows.zip", "sha1", "62cfde1b6fcc3ad12a4d2ba1b537e752768bfd47"),
}
WINDOWS_SKIP_DIRS = {
    ".git", ".github", ".venv", ".toolcache", "coverage", "dist", "docs",
    "test", "tests", "__pycache__", ".pytest_cache", ".mypy_cache",
}
WINDOWS_REQUIRED_FILES = {
    "package.json",
    "runtime/node.exe",
    "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts",
    "Frontend/HooshyarWebApp/index.ts",
}


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def _download_with_urllib(url: str, target: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HooshyarOS-ReleaseBuilder/1.0",
            "Accept": "application/zip,application/octet-stream,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as fh:
        shutil.copyfileobj(response, fh)


def _download_with_curl(url: str, target: Path) -> None:
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        raise RuntimeError("curl.exe is unavailable for download fallback")
    result = subprocess.run(
        [curl, "-L", "--fail", "--retry", "3", "--retry-all-errors", "--connect-timeout", "30", "--max-time", "600", "-A", "Mozilla/5.0", "-o", str(target), url],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.returncode:
        raise RuntimeError(f"curl download failed with exit code {result.returncode}")


def _validate_zip(target: Path) -> None:
    if not target.exists() or target.stat().st_size <= 0 or not zipfile.is_zipfile(target):
        raise RuntimeError("downloaded artifact is not a valid non-empty ZIP archive")


def _digest(path: Path, algorithm: str) -> str:
    digest = hashlib.sha256() if algorithm == "sha256" else hashlib.sha1()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size and (target.suffix.lower() != ".zip" or zipfile.is_zipfile(target)):
        return
    emit("AUTONOMOUS_RELEASE_DOWNLOAD", url=url, target=str(target.relative_to(ROOT)))
    try:
        _download_with_urllib(url, target)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
        emit("AUTONOMOUS_RELEASE_DOWNLOAD_FALLBACK", platform="ANDROID", target=str(target.relative_to(ROOT)), method="curl.exe", reason=str(exc))
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
            emit("AUTONOMOUS_RELEASE_DOWNLOAD_FALLBACK", platform=platform, artifact=artifact, failedUrl=url, reason=str(exc))
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
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        shutil.rmtree(destination, ignore_errors=True)
    shutil.move(str(source), str(destination))
    shutil.rmtree(staging, ignore_errors=True)


def _install_android_components_direct() -> None:
    emit("AUTONOMOUS_RELEASE_ANDROID_FALLBACK", strategy="DIRECT_PACKAGE_DOWNLOAD", reason="sdkmanager repository manifest unavailable")
    for package, (filename, checksum_algorithm, expected_checksum) in ANDROID_PACKAGE_SPECS.items():
        destination = SDK / ("platform-tools" if package == "platform-tools" else "platforms/android-35" if package == "platforms;android-35" else "build-tools/34.0.0")
        marker = destination / ("adb.exe" if package == "platform-tools" else "android.jar" if package == "platforms;android-35" else "aapt2.exe")
        if marker.exists():
            continue
        archive = CACHE / filename
        urls = tuple(f"{base}{filename}" for base in ANDROID_REPO_URLS)
        selected = download_any(urls, archive, "ANDROID", package)
        actual = _digest(archive, checksum_algorithm)
        if actual != expected_checksum:
            raise RuntimeError(f"checksum mismatch for {package}: expected {expected_checksum}, got {actual}")
        emit("AUTONOMOUS_RELEASE_ANDROID_COMPONENT_SOURCE_SELECTED", package=package, source=selected, checksumAlgorithm=checksum_algorithm, checksum=actual)
        _extract_component(archive, destination)


def ensure_android_toolchain() -> tuple[Path, Path, Path]:
    for directory in (CACHE, JDK, GRADLE, SDK):
        directory.mkdir(parents=True, exist_ok=True)
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
    env["PATH"] = os.pathsep.join([str(java_home / "bin"), str(sdkmanager.parent), str(SDK / "platform-tools"), env.get("PATH", "")])
    try:
        result = subprocess.run([str(sdkmanager), "platform-tools", "platforms;android-35", "build-tools;34.0.0"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False, timeout=20 * 60)
        if result.stdout:
            print(result.stdout, end="")
        if result.returncode:
            raise RuntimeError(f"sdkmanager failed with exit code {result.returncode}")
    except Exception as exc:
        emit("AUTONOMOUS_RELEASE_ANDROID_SDKMANAGER_FALLBACK", strategy="DIRECT_PACKAGE_DOWNLOAD", reason=str(exc))
        _install_android_components_direct()
    return java_home, ghome, SDK


def _should_skip_file(path: Path) -> bool:
    name = path.name
    if any(part in WINDOWS_SKIP_DIRS for part in path.relative_to(ROOT).parts):
        return True
    if name == "Thumbs.db" or name.endswith(".pyc") or name.endswith(".pyo"):
        return True
    if name.endswith(".map") or name.endswith(".tsbuildinfo") or name.endswith(".log"):
        return True
    if re.search(r"(?:^|\.)test\.[^.]+$", name) or re.search(r"(?:^|\.)spec\.[^.]+$", name):
        return True
    if name.endswith(".backup") or name.endswith("~"):
        return True
    if path.name in {"jest.config.js", "tsconfig.tsbuildinfo"}:
        return True
    return False


def _copy_filtered_tree(source: Path, destination: Path) -> int:
    copied = 0
    for path in source.rglob("*"):
        if _should_skip_file(path):
            continue
        relative = path.relative_to(source)
        target = destination / relative
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            copied += 1
    return copied


def _runtime_dependency_names() -> list[str]:
    manifest = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    roots = list((manifest.get("dependencies") or {}).keys())
    if "tsx" not in roots:
        roots.append("tsx")
    return roots


def _copy_node_dependency(node_modules: Path, destination: Path, package_name: str, seen: set[str]) -> None:
    if package_name in seen:
        return
    seen.add(package_name)
    source = node_modules / Path(*package_name.split("/"))
    manifest_path = source / "package.json"
    if not manifest_path.exists():
        raise RuntimeError(f"runtime dependency is missing from node_modules: {package_name}")
    target = destination / Path(*package_name.split("/"))
    shutil.copytree(source, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns("*.map", "*.tsbuildinfo"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for dependency in set((manifest.get("dependencies") or {}).keys()) | set((manifest.get("optionalDependencies") or {}).keys()):
        _copy_node_dependency(node_modules, destination, dependency, seen)


def _copy_runtime_node_modules(destination: Path) -> int:
    node_modules = ROOT / "node_modules"
    if not node_modules.exists():
        raise RuntimeError("node_modules is required for the Windows product build")
    seen: set[str] = set()
    for dependency in _runtime_dependency_names():
        _copy_node_dependency(node_modules, destination, dependency, seen)
    return len(seen)


def _validate_windows_payload(payload: Path) -> tuple[int, int]:
    forbidden: list[str] = []
    files = 0
    for path in payload.rglob("*"):
        if not path.is_file():
            continue
        files += 1
        relative = path.relative_to(payload).as_posix()
        lower = relative.lower()
        if "__pycache__/" in lower or lower.endswith(".pyc") or lower.endswith(".pyo"):
            forbidden.append(relative)
        if re.search(r"(?:^|/)tests?(/|$)", lower) or re.search(r"(?:^|/)[^/]+\.(test|spec)\.[^.]+$", lower):
            forbidden.append(relative)
        if ".git/" in lower or lower.startswith(".github/"):
            forbidden.append(relative)
    missing = sorted(item for item in WINDOWS_REQUIRED_FILES if not (payload / Path(item)).exists())
    if missing:
        raise RuntimeError("Windows payload missing required runtime files: " + ", ".join(missing))
    if forbidden:
        raise RuntimeError("Windows payload contains forbidden development artifacts: " + ", ".join(forbidden[:12]))
    return files, len(forbidden)


def _write_windows_install_script(path: Path) -> None:
    path.write_text(r'''$ErrorActionPreference="Stop"
$here=Split-Path -Parent $MyInvocation.MyCommand.Path
$zip=Join-Path $here "HooshyarOS-Windows-Bootstrap.zip"
$bundle=Join-Path $here "bundle"
$installRoot=Join-Path $env:ProgramData "HooshyarOS"
$runtime=Join-Path $installRoot "runtime"
$data=Join-Path $installRoot "data"
if(Test-Path $bundle){Remove-Item $bundle -Recurse -Force}
Expand-Archive -Path $zip -DestinationPath $bundle -Force
if(Test-Path $runtime){Remove-Item $runtime -Recurse -Force}
New-Item -ItemType Directory -Force -Path $runtime,$data | Out-Null
Copy-Item (Join-Path $bundle "payload\*") $runtime -Recurse -Force
$launcher=Join-Path $runtime "start-hooshyar.cmd"
"@echo off`r`ncd /d `"$runtime`"`r`nset HOOSHYAR_DATA_ROOT=$data`r`n`"$runtime\runtime\node.exe`" `"$runtime\node_modules\tsx\dist\cli.mjs`" `"$runtime\Backend\HBOS\Autonomous\Runtime\CommercialRuntimeServer.ts`"" | Set-Content $launcher -Encoding ASCII
$ws=New-Object -ComObject WScript.Shell
$desktop=[Environment]::GetFolderPath("Desktop")
$start=Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\HooshyarOS"
New-Item -ItemType Directory -Force -Path $start | Out-Null
foreach($link in @((Join-Path $desktop "HooshyarOS.lnk"),(Join-Path $start "HooshyarOS.lnk"))){
  $shortcut=$ws.CreateShortcut($link)
  $shortcut.TargetPath=$launcher
  $shortcut.WorkingDirectory=$runtime
  $shortcut.Description="HooshyarOS"
  $shortcut.IconLocation=(Join-Path $runtime "runtime\node.exe")
  $shortcut.Save()
}
$uninstall=Join-Path $installRoot "uninstall.ps1"
@"
`$ErrorActionPreference="Stop"
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {`$_.CommandLine -like '*HooshyarOS*CommercialRuntimeServer.ts*'} | ForEach-Object {Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue}
Remove-Item '$start' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item '$desktop\HooshyarOS.lnk' -Force -ErrorAction SilentlyContinue
Remove-Item '$installRoot' -Recurse -Force -ErrorAction SilentlyContinue
"@ | Set-Content $uninstall -Encoding UTF8
$health=$false
$proc=Start-Process -FilePath $launcher -WorkingDirectory $runtime -WindowStyle Hidden -PassThru
for($i=0;$i -lt 30;$i++){
  Start-Sleep -Seconds 1
  try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 2; if($r.StatusCode -eq 200){$health=$true;break} } catch {}
}
if(-not $health){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; throw 'HooshyarOS runtime health check failed after installation.'}
Write-Host "HooshyarOS installed and health-checked: $installRoot"
Write-Host "Desktop shortcut: $desktop\HooshyarOS.lnk"
''', encoding="utf-8")


def windows() -> int:
    source = WIN / "iexpress-source"
    payload = source / "payload"
    installer_dir = WIN / "installer"
    if source.exists():
        shutil.rmtree(source, ignore_errors=True)
    installer_dir.mkdir(parents=True, exist_ok=True)
    payload.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    if not node or not (ROOT / "node_modules").exists():
        raise RuntimeError("Windows self-contained build requires local Node.js and node_modules")

    for name in ("package.json",):
        shutil.copy2(ROOT / name, payload / name)
    for name in ("Backend", "Frontend"):
        source_tree = ROOT / name
        if source_tree.exists():
            _copy_filtered_tree(source_tree, payload / name)

    runtime = payload / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node, runtime / "node.exe")
    dependency_count = _copy_runtime_node_modules(payload / "node_modules")

    manifest = {
        "product": "HooshyarOS",
        "version": json.loads((ROOT / "package.json").read_text(encoding="utf-8")).get("version", "0.0.0"),
        "platform": "WINDOWS",
        "runtime": "node + tsx",
        "entrypoint": "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts",
        "health": "http://127.0.0.1:3000/health",
        "runtimeDependencyCount": dependency_count,
    }
    (payload / "product-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    files, _ = _validate_windows_payload(payload)
    emit("AUTONOMOUS_WINDOWS_PAYLOAD_VALIDATED", files=files, runtimeDependencies=dependency_count)

    install_inner = source / "install.ps1"
    _write_windows_install_script(install_inner)
    package = source / "HooshyarOS-Windows-Bootstrap.zip"
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in source.rglob("*"):
            if path.is_file() and path != package:
                zf.write(path, path.relative_to(source))

    target = WIN / "HooshyarOS-Setup.exe"
    sed = WIN / "HooshyarOS-Setup.sed"
    iexpress = Path(os.environ.get("WINDIR", r"C:\Windows")) / "System32" / "iexpress.exe"
    if not iexpress.exists():
        raise RuntimeError("IExpress is unavailable")
    sed.write_text(
        f'''[Version]\nClass=IEXPRESS\nSEDVersion=3\n[Options]\nPackagePurpose=InstallApp\nShowInstallProgramWindow=1\nHideExtractAnimation=1\nUseLongFileName=1\nInsideCompressed=1\nCAB_FixedSize=0\nCAB_ResvCodeSigning=0\nRebootMode=N\nInstallPrompt=\nDisplayLicense=\nFinishMessage=HooshyarOS installation completed.\nTargetName={target}\nFriendlyName=HooshyarOS Setup\nAppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nPostInstallCmd=<None>\nAdminQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nUserQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nSourceFiles=SourceFiles\n[Strings]\nFILE0="install.ps1"\nFILE1="HooshyarOS-Windows-Bootstrap.zip"\n[SourceFiles]\nSourceFiles0={source}\n[SourceFiles0]\n%FILE0%=\n%FILE1%=\n''', encoding="utf-8")
    if target.exists():
        target.unlink()
    result = subprocess.run([str(iexpress), "/N", "/Q", str(sed)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False)
    print(result.stdout, end="")
    if result.returncode or not target.exists():
        raise RuntimeError("IExpress did not produce HooshyarOS-Setup.exe")
    emit("AUTONOMOUS_RELEASE_ARTIFACT", platform="WINDOWS", artifact=str(target.relative_to(ROOT)), size=target.stat().st_size)
    return 0


def android() -> int:
    java_home, gradle_home, sdk = ensure_android_toolchain()
    env = os.environ.copy()
    env.update(JAVA_HOME=str(java_home), ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(sdk))
    env["PATH"] = os.pathsep.join([str(java_home / "bin"), str(gradle_home / "bin"), str(sdk / "platform-tools"), env.get("PATH", "")])
    result = subprocess.run([str(gradle_home / "bin" / "gradle.bat"), "-p", str(ANDROID), "assembleDebug", "--no-daemon"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=90 * 60, check=False)
    print(result.stdout, end="")
    if result.returncode:
        return result.returncode
    apks = list((ANDROID / "app" / "build" / "outputs" / "apk").rglob("*.apk"))
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
