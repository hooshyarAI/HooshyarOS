from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization" / "windows"


def _should_skip_file(path: Path) -> bool:
    name = path.name
    return (path.is_dir() and name in {"__pycache__", "node_modules"}) or name.endswith((".pyc", ".test", ".spec")) or name == ".git"


def _validate_windows_node_executable(node_exe: Path) -> None:
    if node_exe.read_bytes()[:2] != b"MZ":
        raise RuntimeError(f"Windows packaging requires a Windows PE node.exe; got: {node_exe}")


def _validate_windows_payload(payload: Path) -> None:
    required = [
        payload / "node-runtime" / "node.exe",
        payload / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "start-commercial-runtime.ts",
        payload / "Backend" / "AI_Runtime" / "node_modules" / "tsx" / "dist" / "cli.mjs",
        payload / "web" / "index.html",
        payload / "web" / "app.js",
        payload / "web" / "styles.css",
        payload / "web" / "manifest.webmanifest",
        payload / "web" / "sw.js",
        payload / "launch-hooshyar.vbs",
        payload / "install-health.ps1",
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise RuntimeError(f"customer payload incomplete: {missing}")
    if any(p.suffix == ".pyc" or "__pycache__" in p.parts for p in payload.rglob("*")):
        raise RuntimeError("development artifacts leaked into customer payload")
    _validate_windows_node_executable(payload / "node-runtime" / "node.exe")


def _runtime_dependency_names() -> list[str]:
    roots = ["tsx", "typescript"]
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
            package = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        dependencies = {
            **package.get("dependencies", {}),
            **package.get("optionalDependencies", {}),
        }
        pending.extend(name for name in dependencies if name not in seen)
    return sorted(seen)


def _copy_runtime_node_modules(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for name in _runtime_dependency_names():
        src = source / name
        if src.exists():
            shutil.copytree(src, destination / name, dirs_exist_ok=True)


def _write_launch_surface(payload: Path) -> None:
    # Direct WScript -> bundled node.exe. This avoids cmd.exe entirely and
    # makes process.cwd() deterministic for the packaged commercial runtime.
    (payload / "launch-hooshyar.vbs").write_text(
        'Option Explicit\r\n'
        'Dim shell, fso, here, node, tsx, entry, command\r\n'
        'Set shell = CreateObject("WScript.Shell")\r\n'
        'Set fso = CreateObject("Scripting.FileSystemObject")\r\n'
        'here = fso.GetParentFolderName(WScript.ScriptFullName)\r\n'
        'shell.CurrentDirectory = here\r\n'
        'node = here & "\\node-runtime\\node.exe"\r\n'
        'tsx = here & "\\Backend\\AI_Runtime\\node_modules\\tsx\\dist\\cli.mjs"\r\n'
        'entry = here & "\\Backend\\HBOS\\Autonomous\\Runtime\\start-commercial-runtime.ts"\r\n'
        'command = Chr(34) & node & Chr(34) & " " & Chr(34) & tsx & Chr(34) & " " & Chr(34) & entry & Chr(34)\r\n'
        'shell.Run command, 0, False\r\n'
        'WScript.Sleep 2500\r\n'
        'shell.Run "http://127.0.0.1:4173/", 1, False\r\n',
        encoding="utf-8",
    )
    (payload / "launch-hooshyar.cmd").write_text(
        "@echo off\r\n"
        "setlocal\r\n"
        "cd /d \"%~dp0\"\r\n"
        "set HOOSHYAR_HOST=127.0.0.1\r\n"
        "set HOOSHYAR_PORT=4173\r\n"
        '"%~dp0node-runtime\\node.exe" "%~dp0Backend\\AI_Runtime\\node_modules\\tsx\\dist\\cli.mjs" "%~dp0Backend\\HBOS\\Autonomous\\Runtime\\start-commercial-runtime.ts"\r\n',
        encoding="utf-8",
    )
    (payload / "install-health.ps1").write_text(
        "$ErrorActionPreference='Stop'\r\n"
        "$here = Split-Path -Parent $MyInvocation.MyCommand.Path\r\n"
        "$env:HOOSHYAR_HOST='127.0.0.1'\r\n"
        "$env:HOOSHYAR_PORT='4173'\r\n"
        "$node = Join-Path $here 'node-runtime\\node.exe'\r\n"
        "$tsx = Join-Path $here 'Backend\\AI_Runtime\\node_modules\\tsx\\dist\\cli.mjs'\r\n"
        "$entry = Join-Path $here 'Backend\\HBOS\\Autonomous\\Runtime\\start-commercial-runtime.ts'\r\n"
        "$process = Start-Process -FilePath $node -ArgumentList @($tsx,$entry) -WorkingDirectory $here -PassThru\r\n"
        "try {\r\n"
        "  $deadline=(Get-Date).AddSeconds(20)\r\n"
        "  do {\r\n"
        "    try { $response=Invoke-RestMethod -Uri 'http://127.0.0.1:4173/health' -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 500 }\r\n"
        "  } while ((Get-Date) -lt $deadline)\r\n"
        "  if (-not $response -or $response.status -ne 'ok') { throw 'HooshyarOS runtime health check failed' }\r\n"
        "  Write-Output 'HooshyarOS installed and health-checked'\r\n"
        "}\r\n"
        "finally { if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force } }\r\n",
        encoding="utf-8",
    )


def _copy_repository_tree(source: Path, target: Path) -> None:
    shutil.copytree(
        source,
        target,
        ignore=lambda directory, names: [
            name for name in names
            if name in {"__pycache__", "node_modules"} or name.endswith((".pyc", ".test", ".spec"))
        ],
        dirs_exist_ok=True,
    )


def build_windows() -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    payload = DIST / "payload"
    if payload.exists():
        shutil.rmtree(payload)
    payload.mkdir(parents=True)

    for relative in ("Backend", "Docs", "Frontend", "product-manifest.json"):
        source = ROOT / relative
        if source.exists():
            target = payload / relative
            if source.is_dir():
                _copy_repository_tree(source, target)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)

    node_exe = shutil.which("node")
    if not node_exe:
        raise RuntimeError("Windows packaging requires Node.js on PATH")
    node_runtime = payload / "node-runtime"
    node_runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node_exe, node_runtime / "node.exe")

    runtime_modules = payload / "Backend" / "AI_Runtime" / "node_modules"
    _copy_runtime_node_modules(ROOT / "node_modules", runtime_modules)

    # IMPORTANT: package the real production web surface from ROOT/web.
    source_web = ROOT / "web"
    web = payload / "web"
    if not source_web.exists():
        raise RuntimeError(f"real web surface missing: {source_web}")
    shutil.copytree(source_web, web, ignore=lambda directory, names: [
        name for name in names if name in {"node_modules", "__pycache__"}
    ])

    (payload / "product-manifest.json").write_text(
        json.dumps({
            "name": "HooshyarOS",
            "runtime": "Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts",
            "health": "/health",
            "web": "web/index.html",
        }, ensure_ascii=False),
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
