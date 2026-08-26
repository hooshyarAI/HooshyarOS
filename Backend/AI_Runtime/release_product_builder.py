from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization" / "windows"


def _should_skip_file(path: Path) -> bool:
    name = path.name
    return (path.is_dir() and name in {"__pycache__", "node_modules"}) or name.endswith((".pyc", ".test", ".spec")) or name in {".git"}


def _validate_windows_node_executable(node_exe: Path) -> None:
    data = node_exe.read_bytes()[:2]
    if data != b"MZ":
        raise RuntimeError(f"Windows packaging requires a Windows PE node.exe; got non-PE executable: {node_exe}")


def _validate_windows_payload(payload: Path) -> None:
    if not payload.exists():
        raise FileNotFoundError(payload)
    if any(p.suffix == ".pyc" or "__pycache__" in p.parts for p in payload.rglob("*")):
        raise RuntimeError("development artifacts leaked into customer payload")
    required = [
        payload / "node-runtime" / "node.exe",
        payload / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "start-commercial-runtime.ts",
        payload / "Backend" / "AI_Runtime" / "node_modules" / "tsx",
        payload / "web" / "index.html",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise RuntimeError(f"customer payload incomplete: {missing}")
    _validate_windows_node_executable(payload / "node-runtime" / "node.exe")


def _runtime_dependency_names() -> list[str]:
    roots = {"tsx", "typescript"}
    package_root = ROOT / "node_modules"
    pending = list(roots)
    seen: set[str] = set()
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        seen.add(name)
        manifest = package_root / name / "package.json"
        if not manifest.exists():
            continue
        try:
            import json
            package = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for dependency in {**package.get("dependencies", {}), **package.get("optionalDependencies", {})}:
            if dependency not in seen:
                pending.append(dependency)
    return sorted(seen)


def _copy_node_dependency(source: Path, destination: Path) -> None:
    if source.exists():
        shutil.copytree(source, destination, dirs_exist_ok=True)


def _copy_runtime_node_modules(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for name in _runtime_dependency_names():
        _copy_node_dependency(source / name, destination / name)


def _write_launch_surface(payload: Path) -> None:
    (payload / "launch-hooshyar.cmd").write_text(
        "@echo off\r\n"
        "setlocal\r\n"
        "set HOOSHYAR_HOST=127.0.0.1\r\n"
        "set HOOSHYAR_PORT=4173\r\n"
        '"%~dp0node-runtime\\node.exe" "%~dp0Backend\\AI_Runtime\\node_modules\\tsx\\dist\\cli.mjs" "%~dp0Backend\\HBOS\\Autonomous\\Runtime\\start-commercial-runtime.ts"\r\n',
        encoding="utf-8",
    )
    (payload / "launch-hooshyar.vbs").write_text(
        'CreateObject("WScript.Shell").Run """" & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\\launch-hooshyar.cmd"""", 0, False\r\n',
        encoding="utf-8",
    )
    start_menu_path = r"Microsoft\Windows\Start Menu\Programs\HooshyarOS"
    (payload / "HooshyarOS-StartMenu.txt").write_text(start_menu_path + "\n", encoding="utf-8")
    (payload / "install-health.ps1").write_text(
        "$ErrorActionPreference='Stop'\n"
        "$here = Split-Path -Parent $MyInvocation.MyCommand.Path\n"
        "& (Join-Path $here 'launch-hooshyar.cmd')\n"
        "$deadline=(Get-Date).AddSeconds(20)\n"
        "do {\n"
        "  try { $response=Invoke-RestMethod -Uri 'http://127.0.0.1:4173/health' -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 500 }\n"
        "} while ((Get-Date) -lt $deadline)\n"
        "if (-not $response -or $response.status -ne 'ok') { throw 'HooshyarOS runtime health check failed' }\n"
        "Write-Output 'HooshyarOS installed and health-checked'\n",
        encoding="utf-8",
    )


def build_windows() -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    payload = DIST / "payload"
    if payload.exists():
        shutil.rmtree(payload)
    payload.mkdir(parents=True)
    for relative in ["Backend", "Docs", "Frontend", "product-manifest.json"]:
        source = ROOT / relative
        if not source.exists():
            continue
        target = payload / relative
        if source.is_dir():
            shutil.copytree(source, target, ignore=lambda directory, names: [n for n in names if _should_skip_file(Path(directory) / n)])
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)

    node_exe = shutil.which("node")
    if not node_exe:
        raise RuntimeError("Windows packaging requires a Node.js executable on PATH")
    node_runtime = payload / "node-runtime"
    node_runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node_exe, node_runtime / "node.exe")

    runtime = payload / "Backend" / "AI_Runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    _copy_runtime_node_modules(ROOT / "node_modules", runtime / "node_modules")

    web = payload / "web"
    web.mkdir(exist_ok=True)
    index = web / "index.html"
    index.write_text("<!doctype html><html lang=\"fa\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>هوشیار.ai</title></head><body><main><h1>هوشیار.ai</h1><p>Commercial runtime is starting…</p></main></body></html>", encoding="utf-8")
    (payload / "product-manifest.json").write_text('{"name":"HooshyarOS","runtime":"Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts","health":"/health","web":"web/index.html"}', encoding="utf-8")
    _write_launch_surface(payload)
    _validate_windows_payload(payload)
    bootstrap = DIST / "HooshyarOS-Windows-Bootstrap.zip"
    with zipfile.ZipFile(bootstrap, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in payload.rglob("*"):
            if file.is_file():
                archive.write(file, file.relative_to(payload))
    return bootstrap


def main() -> int:
    build_windows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
