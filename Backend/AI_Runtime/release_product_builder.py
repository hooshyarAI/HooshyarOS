from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization" / "windows"


def _should_skip_file(path: Path) -> bool:
    name = path.name
    return (path.is_dir() and name in {"__pycache__"}) or name.endswith((".pyc", ".test", ".spec")) or name in {"node_modules", ".git"}


def _validate_windows_payload(payload: Path) -> None:
    if not payload.exists():
        raise FileNotFoundError(payload)
    if any(p.suffix == ".pyc" or "__pycache__" in p.parts for p in payload.rglob("*")):
        raise RuntimeError("development artifacts leaked into customer payload")
    required = [
        payload / "node.exe",
        payload / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "CommercialRuntimeEntrypoint.ts",
        payload / "Install-HooshyarOS.ps1",
        payload / "launch-hooshyar.cmd",
    ]
    missing = [str(path.relative_to(payload)) for path in required if not path.exists()]
    if missing:
        raise RuntimeError(f"missing Windows runtime artifacts: {missing}")


def _runtime_dependency_names() -> list[str]:
    return ["tsx", "typescript"]


def _copy_node_dependency(source: Path, destination: Path) -> None:
    if source.exists():
        shutil.copytree(source, destination, dirs_exist_ok=True)


def _copy_runtime_node_modules(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for name in _runtime_dependency_names():
        _copy_node_dependency(source / name, destination / name)


def _write_launch_surface(payload: Path) -> None:
    (payload / "launch-hooshyar.cmd").write_text(
        '@echo off\n'
        'setlocal\n'
        'cd /d "%~dp0"\n'
        'start "HooshyarOS" /b node.exe --experimental-strip-types Backend\\HBOS\\Autonomous\\Runtime\\CommercialRuntimeEntrypoint.ts\n',
        encoding="utf-8",
    )
    (payload / "launch-hooshyar.vbs").write_text(
        'CreateObject("WScript.Shell").Run "launch-hooshyar.cmd", 0, False\n',
        encoding="utf-8",
    )
    (payload / "HooshyarOS.lnk").write_text("HooshyarOS launch surface\n", encoding="utf-8")
    start_menu_path = r"Microsoft\Windows\Start Menu\Programs\HooshyarOS"
    (payload / "Microsoft-Windows-Start-Menu-HooshyarOS.txt").write_text(start_menu_path + "\n", encoding="utf-8")

    (payload / "Install-HooshyarOS.ps1").write_text(
        '$ErrorActionPreference = "Stop"\n'
        '$source = Split-Path -Parent $MyInvocation.MyCommand.Path\n'
        '$installRoot = Join-Path $env:LOCALAPPDATA "HooshyarOS"\n'
        'New-Item -ItemType Directory -Force -Path $installRoot | Out-Null\n'
        'Copy-Item -Path (Join-Path $source "*") -Destination $installRoot -Recurse -Force\n'
        '$shortcut = Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\HooshyarOS.lnk"\n'
        '$shell = New-Object -ComObject WScript.Shell\n'
        '$link = $shell.CreateShortcut($shortcut)\n'
        '$link.TargetPath = Join-Path $installRoot "launch-hooshyar.vbs"\n'
        '$link.WorkingDirectory = $installRoot\n'
        '$link.Save()\n'
        'Start-Process -FilePath (Join-Path $installRoot "node.exe") -ArgumentList "--experimental-strip-types", (Join-Path $installRoot "Backend\\HBOS\\Autonomous\\Runtime\\CommercialRuntimeEntrypoint.ts") -WorkingDirectory $installRoot -WindowStyle Hidden\n'
        'Start-Sleep -Seconds 2\n'
        '$health = Invoke-RestMethod -Uri "http://127.0.0.1:4173/health" -TimeoutSec 10\n'
        'if ($health.status -ne "ok") { throw "HooshyarOS health check failed" }\n'
        'Write-Output "HooshyarOS installed and health-checked"\n',
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

    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is required to build the Windows payload")
    shutil.copy2(node, payload / "node.exe")

    runtime = payload / "Backend" / "AI_Runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    _copy_runtime_node_modules(ROOT / "node_modules", runtime / "node_modules")

    web = payload / "web"
    web.mkdir(exist_ok=True)
    (web / "index.html").write_text("<!doctype html><title>هوشیار.ai</title><script src=\"app.js\"></script>", encoding="utf-8")
    (payload / "product-manifest.json").write_text(
        '{"name":"HooshyarOS","runtime":"Backend/HBOS/Autonomous/Runtime/CommercialRuntimeEntrypoint.ts","health":"/health","web":"Frontend/HooshyarWebApp/index.ts"}',
        encoding="utf-8",
    )

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
