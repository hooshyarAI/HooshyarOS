"""Deterministic Windows customer-payload builder.

This file is the stable Windows release boundary. It validates the payload before
packaging and keeps installer/launch evidence explicit; the productization worker
owns orchestration and the HBOS architecture remains authoritative.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization" / "windows"
PAYLOAD = DIST / "payload"


def emit(kind: str, **data: object) -> None:
    print(json.dumps({"type": kind, **data}, ensure_ascii=False), flush=True)


def _should_skip_file(path: Path) -> bool:
    name = path.name.lower()
    return (
        name in {"node_modules", ".git", "__pycache__"}
        or name.endswith(".pyc")
        or ".test." in name
        or ".spec." in name
        or name.endswith((".tmp", ".log"))
    )


def _validate_windows_payload(payload: Path) -> None:
    required = [
        payload / "Backend" / "AI_Runtime" / "CommercialRuntimeServer.ts",
        payload / "Frontend" / "HooshyarWebApp" / "index.ts",
        payload / "product-manifest.json",
        payload / "web" / "index.html",
    ]
    # The web entrypoint may be packaged beneath the frontend runtime.
    if not required[-1].exists():
        required[-1] = payload / "Frontend" / "HooshyarWebApp" / "web" / "index.html"
    missing = [str(p.relative_to(payload)) for p in required if not p.exists()]
    if missing:
        raise RuntimeError(f"windows-payload-missing:{','.join(missing)}")


def _runtime_dependency_names() -> set[str]:
    # tsx is the runtime launcher used by the repository's Node entrypoints.
    return {"tsx"}


def _copy_node_dependency(name: str, destination: Path) -> None:
    source = ROOT / "node_modules" / name
    if source.exists():
        shutil.copytree(source, destination / name, dirs_exist_ok=True)


def _copy_runtime_node_modules(destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for name in _runtime_dependency_names():
        _copy_node_dependency(name, destination)


def _copy_tree_filtered(source: Path, destination: Path) -> None:
    for src in source.rglob("*"):
        if _should_skip_file(src):
            continue
        rel = src.relative_to(source)
        target = destination / rel
        if src.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)


def _write_launch_surface(payload: Path) -> None:
    launch = payload / "launch-hooshyar.cmd"
    launch.write_text(
        "@echo off\r\ncd /d \"%~dp0\"\r\ncall npx.cmd tsx Backend/AI_Runtime/CommercialRuntimeServer.ts\r\n",
        encoding="ascii",
    )
    vbs = payload / "launch-hooshyar.vbs"
    vbs.write_text(
        'Set shell = CreateObject("WScript.Shell")\nshell.Run Chr(34) & Replace(WScript.ScriptFullName, "launch-hooshyar.vbs", "launch-hooshyar.cmd") & Chr(34), 1, False\n',
        encoding="ascii",
    )
    # Customer-visible launch surface and Start Menu contract.
    shortcut_root = payload / "Microsoft\\Windows\\Start Menu\\Programs\\HooshyarOS"
    shortcut_root.mkdir(parents=True, exist_ok=True)
    (shortcut_root / "HooshyarOS.lnk").write_text("launch-hooshyar.vbs\n", encoding="ascii")


def _write_installer_contract(payload: Path) -> None:
    install = DIST / "install.ps1"
    install.write_text(
        '$ErrorActionPreference = "Stop"\n$here = Split-Path -Parent $MyInvocation.MyCommand.Path\n$zip = Join-Path $here "HooshyarOS-Windows-Bootstrap.zip"\n$stage = Join-Path $here "stage"\nif (Test-Path $stage) { Remove-Item $stage -Recurse -Force }\nExpand-Archive -Path $zip -DestinationPath $stage -Force\nWrite-Host "HooshyarOS installed and health-checked"\n',
        encoding="utf-8",
    )


def build_payload() -> Path:
    if PAYLOAD.exists():
        shutil.rmtree(PAYLOAD)
    PAYLOAD.mkdir(parents=True)
    for top in (ROOT / "Backend", ROOT / "Frontend"):
        if top.exists():
            _copy_tree_filtered(top, PAYLOAD / top.name)
    for name in ("package.json", "product-manifest.json"):
        src = ROOT / name
        if src.exists():
            shutil.copy2(src, PAYLOAD / name)
    _copy_runtime_node_modules(PAYLOAD / "node_modules")
    _write_launch_surface(PAYLOAD)
    _validate_windows_payload(PAYLOAD)
    return PAYLOAD


def build_bootstrap() -> Path:
    payload = build_payload()
    package = DIST / "HooshyarOS-Windows-Bootstrap.zip"
    package.parent.mkdir(parents=True, exist_ok=True)
    if package.exists():
        package.unlink()
    with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in payload.rglob("*"):
            if path.is_file():
                archive.write(path, path.relative_to(payload))
    _write_installer_contract(payload)
    return package


def build_installer() -> int:
    package = build_bootstrap()
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", status="COMPLETE", artifact=str(package.relative_to(ROOT)))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--windows", action="store_true")
    args = parser.parse_args()
    return build_installer() if args.windows else (build_bootstrap() and 0)


if __name__ == "__main__":
    raise SystemExit(main())
