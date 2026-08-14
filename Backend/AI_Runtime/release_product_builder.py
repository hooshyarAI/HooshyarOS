"""Customer artifact builder for HooshyarOS productization."""
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


def emit(kind: str, **payload: object) -> None:
    print(json.dumps({"type": kind, **payload}, ensure_ascii=False), flush=True)


def _download_with_urllib(url: str, target: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 HooshyarOS-ReleaseBuilder/2.0"})
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as fh:
        shutil.copyfileobj(response, fh)


def _download_with_curl(url: str, target: Path) -> None:
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        raise RuntimeError("curl.exe is unavailable")
    result = subprocess.run(
        [curl, "-L", "--fail", "--retry", "3", "--retry-all-errors", "--connect-timeout", "30", "--max-time", "600", "-A", "Mozilla/5.0", "-o", str(target), url],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.returncode:
        raise RuntimeError(f"curl download failed with exit code {result.returncode}")


def _validate_zip(path: Path) -> None:
    if not path.exists() or path.stat().st_size <= 0 or not zipfile.is_zipfile(path):
        raise RuntimeError(f"invalid ZIP artifact: {path}")


def _digest(path: Path, algorithm: str) -> str:
    h = hashlib.sha256() if algorithm == "sha256" else hashlib.sha1()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


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
    shutil.rmtree(staging, ignore_errors=True)
    unzip(archive, staging)
    roots = [p for p in staging.iterdir() if p.is_dir()]
    source = roots[0] if len(roots) == 1 else staging
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(destination, ignore_errors=True)
    shutil.move(str(source), str(destination))
    shutil.rmtree(staging, ignore_errors=True)


def _install_android_components_direct() -> None:
    emit("AUTONOMOUS_RELEASE_ANDROID_FALLBACK", strategy="DIRECT_PACKAGE_DOWNLOAD", reason="sdkmanager repository manifest unavailable")
    for package, (filename, algorithm, expected) in ANDROID_PACKAGE_SPECS.items():
        destination = SDK / ("platform-tools" if package == "platform-tools" else "platforms/android-35" if package == "platforms;android-35" else "build-tools/34.0.0")
        marker = destination / ("adb.exe" if package == "platform-tools" else "android.jar" if package == "platforms;android-35" else "aapt2.exe")
        if marker.exists():
            continue
        archive = CACHE / filename
        selected = download_any(tuple(f"{base}{filename}" for base in ANDROID_REPO_URLS), archive, "ANDROID", package)
        actual = _digest(archive, algorithm)
        if actual != expected:
            raise RuntimeError(f"checksum mismatch for {package}: expected {expected}, got {actual}")
        emit("AUTONOMOUS_RELEASE_ANDROID_COMPONENT_SOURCE_SELECTED", package=package, source=selected, checksumAlgorithm=algorithm, checksum=actual)
        _extract_component(archive, destination)


def ensure_android_toolchain() -> tuple[Path, Path, Path]:
    for directory in (CACHE, JDK, GRADLE, SDK):
        directory.mkdir(parents=True, exist_ok=True)
    jzip = CACHE / "jdk17.zip"
    if not (JDK / "bin" / "java.exe").exists():
        source = download_any(JDK_URLS, jzip, "ANDROID", "jdk17")
        emit("AUTONOMOUS_RELEASE_JDK_SOURCE_SELECTED", platform="ANDROID", source=source)
        unzip(jzip, JDK)
    java_home = next((p for p in [JDK, *JDK.iterdir()] if (p / "bin" / "java.exe").exists()), None)
    if java_home is None:
        raise RuntimeError("JDK 17 provisioning failed")
    gradle_home = GRADLE / f"gradle-{GRADLE_VERSION}"
    gzip = CACHE / f"gradle-{GRADLE_VERSION}.zip"
    if not (gradle_home / "bin" / "gradle.bat").exists():
        download(GRADLE_URL, gzip)
        unzip(gzip, GRADLE)
    if not (gradle_home / "bin" / "gradle.bat").exists():
        raise RuntimeError("Gradle provisioning failed")
    sdkmanager = SDK / "cmdline-tools" / "latest" / "bin" / "sdkmanager.bat"
    czip = CACHE / "commandlinetools.zip"
    if not sdkmanager.exists():
        source = download_any(CMDLINE_TOOLS_URLS, czip, "ANDROID", "command-line-tools")
        emit("AUTONOMOUS_RELEASE_CMDLINE_TOOLS_SOURCE_SELECTED", platform="ANDROID", source=source)
        staging = CACHE / "cmdline-tools-stage"
        destination = SDK / "cmdline-tools" / "latest"
        unzip(czip, staging)
        shutil.rmtree(destination, ignore_errors=True)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(staging / "cmdline-tools"), str(destination))
        shutil.rmtree(staging, ignore_errors=True)
    env = os.environ.copy()
    env.update(JAVA_HOME=str(java_home), ANDROID_HOME=str(SDK), ANDROID_SDK_ROOT=str(SDK))
    env["PATH"] = os.pathsep.join([str(java_home / "bin"), str(sdkmanager.parent), str(SDK / "platform-tools"), env.get("PATH", "")])
    result = subprocess.run([str(sdkmanager), "platform-tools", "platforms;android-35", "build-tools;34.0.0"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=20 * 60, check=False)
    print(result.stdout or "", end="")
    if result.returncode:
        emit("AUTONOMOUS_RELEASE_ANDROID_SDKMANAGER_FALLBACK", strategy="DIRECT_PACKAGE_DOWNLOAD", reason=f"sdkmanager failed with exit code {result.returncode}")
        _install_android_components_direct()
    return java_home, gradle_home, SDK


def _should_skip_file(path: Path, root: Path) -> bool:
    parts = set(path.relative_to(root).parts)
    name = path.name.lower()
    if parts & {".git", ".github", ".venv", ".toolcache", "coverage", "dist", "test", "tests", "__pycache__", ".pytest_cache", ".mypy_cache"}:
        return True
    if name.endswith((".pyc", ".pyo", ".map", ".tsbuildinfo", ".backup", "~", ".log")):
        return True
    if re.search(r"(?:^|\.)test\.[^.]+$", name) or re.search(r"(?:^|\.)spec\.[^.]+$", name):
        return True
    return False


def _copy_runtime_tree(source: Path, destination: Path) -> int:
    count = 0
    for path in source.rglob("*"):
        if _should_skip_file(path, source):
            continue
        target = destination / path.relative_to(source)
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            count += 1
    return count


def _copy_node_dependency(node_modules: Path, destination: Path, package_name: str, seen: set[str]) -> None:
    if package_name in seen:
        return
    source = node_modules / Path(*package_name.split("/"))
    manifest = source / "package.json"
    if not manifest.exists():
        raise RuntimeError(f"runtime dependency missing: {package_name}")
    seen.add(package_name)
    target = destination / Path(*package_name.split("/"))
    shutil.copytree(source, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns("*.map", "*.tsbuildinfo", "__pycache__", "*.pyc"))
    data = json.loads(manifest.read_text(encoding="utf-8"))
    children = set((data.get("dependencies") or {}).keys()) | set((data.get("optionalDependencies") or {}).keys())
    for child in children:
        _copy_node_dependency(node_modules, destination, child, seen)


def _runtime_dependency_names() -> set[str]:
    manifest = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    roots = set((manifest.get("dependencies") or {}).keys())
    roots.add("tsx")
    return roots


def _copy_runtime_node_modules(destination: Path) -> int:
    seen: set[str] = set()
    for root in sorted(_runtime_dependency_names()):
        _copy_node_dependency(ROOT / "node_modules", destination, root, seen)
    return len(seen)


def _validate_windows_payload(payload: Path) -> None:
    required = [
        "package.json",
        "runtime/node.exe",
        "node_modules/tsx/dist/cli.mjs",
        "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts",
        "Frontend/HooshyarWebApp/index.ts",
        "web/index.html",
    ]
    missing = [item for item in required if not (payload / Path(item)).exists()]
    if missing:
        raise RuntimeError("Windows payload missing: " + ", ".join(missing))
    forbidden: list[str] = []
    for path in payload.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(payload).as_posix().lower()
        if "__pycache__/" in relative or relative.endswith((".pyc", ".pyo", ".test.ts", ".spec.ts", ".map", ".tsbuildinfo")):
            forbidden.append(relative)
        if re.search(r"(?:^|/)tests?(/|$)", relative):
            forbidden.append(relative)
    if forbidden:
        raise RuntimeError("Windows payload contains development artifacts: " + ", ".join(forbidden[:10]))


def _write_windows_install_script(path: Path) -> None:
    script = '''$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$zip = Join-Path $here "HooshyarOS-Windows-Bootstrap.zip"
$stage = Join-Path $here "bundle"
$installRoot = Join-Path $env:ProgramFiles "HooshyarOS"
$dataRoot = Join-Path $env:ProgramData "HooshyarOS"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $stage -Force

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*HooshyarOS*CommercialRuntimeServer.ts*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if (Test-Path $installRoot) { Remove-Item $installRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $installRoot, $dataRoot | Out-Null
Copy-Item (Join-Path $stage "payload\\*") $installRoot -Recurse -Force

$launcherCmd = Join-Path $installRoot "launch-hooshyar.cmd"
@(
    "@echo off",
    "set HOOSHYAR_DATA_ROOT=$dataRoot",
    "cd /d \"$installRoot\"",
    "start \"HooshyarOS\" /b \"$installRoot\runtime\node.exe\" \"$installRoot\node_modules\tsx\dist\cli.mjs\" \"$installRoot\Backend\HBOS\Autonomous\Runtime\CommercialRuntimeServer.ts\""
) | Set-Content $launcherCmd -Encoding ASCII

$launcherVbs = Join-Path $installRoot "launch-hooshyar.vbs"
@"
Set shell = CreateObject("WScript.Shell")
shell.Run Chr(34) & "$launcherCmd" & Chr(34), 0, False
WScript.Sleep 1500
shell.Run "http://127.0.0.1:3000/", 1, False
"@ | Set-Content $launcherVbs -Encoding ASCII

$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$start = Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\HooshyarOS"
New-Item -ItemType Directory -Force -Path $start | Out-Null
foreach ($link in @((Join-Path $desktop "HooshyarOS.lnk"), (Join-Path $start "HooshyarOS.lnk"))) {
    $s = $ws.CreateShortcut($link)
    $s.TargetPath = "$env:SystemRoot\System32\wscript.exe"
    $s.Arguments = "`"$launcherVbs`""
    $s.WorkingDirectory = $installRoot
    $s.Description = "HooshyarOS"
    $s.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,167"
    $s.Save()
}

$uninstall = Join-Path $installRoot "uninstall.ps1"
@"
`$ErrorActionPreference = "Stop"
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { `$_.CommandLine -like '*HooshyarOS*CommercialRuntimeServer.ts*' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item '$desktop\HooshyarOS.lnk' -Force -ErrorAction SilentlyContinue
Remove-Item '$start' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item '$installRoot' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item '$dataRoot' -Recurse -Force -ErrorAction SilentlyContinue
"@ | Set-Content $uninstall -Encoding UTF8

$proc = Start-Process -FilePath "$env:SystemRoot\System32\wscript.exe" -ArgumentList "`"$launcherVbs`"" -WindowStyle Hidden -PassThru
$healthy = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
}
if (-not $healthy) { throw 'HooshyarOS installation health check failed.' }
Write-Host "HooshyarOS installed and health-checked at $installRoot"
Write-Host "Desktop shortcut created at $desktop\HooshyarOS.lnk"
'''
    path.write_text(script, encoding="utf-8")


def windows() -> int:
    source = WIN / "iexpress-source"
    payload = source / "payload"
    if source.exists():
        shutil.rmtree(source, ignore_errors=True)
    payload.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    if not node or not (ROOT / "node_modules").exists():
        raise RuntimeError("Windows product build requires Node.js and node_modules")
    shutil.copy2(ROOT / "package.json", payload / "package.json")
    if (ROOT / "package-lock.json").exists():
        shutil.copy2(ROOT / "package-lock.json", payload / "package-lock.json")
    _copy_runtime_tree(ROOT / "Backend" / "HBOS", payload / "Backend" / "HBOS")
    shutil.copy2(ROOT / "Frontend" / "HooshyarWebApp" / "index.ts", payload / "Frontend" / "HooshyarWebApp" / "index.ts")
    web_source = ROOT / "Frontend" / "HooshyarWebApp" / "web"
    if not (web_source / "index.html").exists():
        raise RuntimeError("commercial web shell is missing")
    shutil.copytree(web_source, payload / "web", dirs_exist_ok=True)
    runtime = payload / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node, runtime / "node.exe")
    dependency_count = _copy_runtime_node_modules(payload / "node_modules")
    manifest = json.loads((payload / "package.json").read_text(encoding="utf-8"))
    (payload / "product-manifest.json").write_text(
        json.dumps({
            "product": "HooshyarOS",
            "version": manifest.get("version", "0.0.0"),
            "platform": "WINDOWS",
            "entrypoint": "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts",
            "web": "web/index.html",
            "runtimeDependencies": dependency_count,
            "health": "http://127.0.0.1:3000/health",
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    _validate_windows_payload(payload)
    emit("AUTONOMOUS_WINDOWS_PAYLOAD_VALIDATED", runtimeDependencies=dependency_count)
    install_script = source / "install.ps1"
    _write_windows_install_script(install_script)
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
        f'''[Version]\nClass=IEXPRESS\nSEDVersion=3\n[Options]\nPackagePurpose=InstallApp\nShowInstallProgramWindow=1\nHideExtractAnimation=1\nUseLongFileName=1\nInsideCompressed=1\nRebootMode=N\nFinishMessage=HooshyarOS installation completed.\nTargetName={target}\nFriendlyName=HooshyarOS Setup\nAppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nAdminQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1\nSourceFiles=SourceFiles\n[Strings]\nFILE0="install.ps1"\nFILE1="HooshyarOS-Windows-Bootstrap.zip"\n[SourceFiles]\nSourceFiles0={source}\n[SourceFiles0]\n%FILE0%=\n%FILE1%=\n''',
        encoding="utf-8",
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()
    result = subprocess.run([str(iexpress), "/N", "/Q", str(sed)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False)
    print(result.stdout or "", end="")
    if result.returncode or not target.exists():
        raise RuntimeError("IExpress failed to produce installer")
    emit("AUTONOMOUS_RELEASE_ARTIFACT", platform="WINDOWS", artifact=str(target.relative_to(ROOT)), size=target.stat().st_size)
    return 0


def android() -> int:
    java_home, gradle_home, sdk = ensure_android_toolchain()
    env = os.environ.copy()
    env.update(JAVA_HOME=str(java_home), ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(sdk))
    env["PATH"] = os.pathsep.join([str(java_home / "bin"), str(gradle_home / "bin"), str(sdk / "platform-tools"), env.get("PATH", "")])
    result = subprocess.run([str(gradle_home / "bin" / "gradle.bat"), "-p", str(ANDROID), "assembleDebug", "--no-daemon"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=90 * 60, check=False)
    print(result.stdout or "", end="")
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
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    try:
        return windows() if args.platform == "WINDOWS" else android()
    except Exception as exc:
        emit("AUTONOMOUS_RELEASE_BLOCKED", platform=args.platform, reason=str(exc))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
