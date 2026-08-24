from __future__ import annotations

import os
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization" / "windows"


def _should_skip_file(path: Path) -> bool:
    name = path.name
    return path.is_dir() and name in {"__pycache__"} or name.endswith((".pyc", ".test", ".spec")) or name in {"node_modules", ".git"}


def _validate_windows_payload(payload: Path) -> None:
    if not payload.exists():
        raise FileNotFoundError(payload)
    if any(p.suffix == ".pyc" or "__pycache__" in p.parts for p in payload.rglob("*")):
        raise RuntimeError("development artifacts leaked into customer payload")


def _runtime_dependency_names() -> list[str]:
    return ["tsx", "typescript"]


def _copy_node_dependency(source: Path, destination: Path) -> None:
    if source.exists():
        shutil.copytree(source, destination, dirs_exist_ok=True)


def _copy_runtime_node_modules(source: Path, destination: Path) -> None:
    roots = set(_runtime_dependency_names())
    destination.mkdir(parents=True, exist_ok=True)
    for name in roots:
        _copy_node_dependency(source / name, destination / name)


def _write_launch_surface(payload: Path) -> None:
    (payload / "launch-hooshyar.cmd").write_text("@echo off\npython Backend\\hooshyar_build.py assistant\n", encoding="utf-8")
    (payload / "launch-hooshyar.vbs").write_text('CreateObject("WScript.Shell").Run "launch-hooshyar.cmd", 0, False\n', encoding="utf-8")
    (payload / "HooshyarOS.lnk").write_text("HooshyarOS launch surface\n", encoding="utf-8")
    (payload / "Microsoft-Windows-Start-Menu-HooshyarOS.txt").write_text("Microsoft\\Windows\\Start Menu\\Programs\\HooshyarOS\n", encoding="utf-8")


def build_windows() -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    payload = DIST / "payload"
    if payload.exists():
        shutil.rmtree(payload)
    payload.mkdir(parents=True)
    for relative in ["Backend", "Docs", "product-manifest.json"]:
        source = ROOT / relative
        if not source.exists():
            continue
        target = payload / relative
        if source.is_dir():
            shutil.copytree(source, target, ignore=lambda directory, names: [n for n in names if _should_skip_file(Path(directory) / n)])
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    runtime = payload / "Backend" / "AI_Runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    _copy_runtime_node_modules(ROOT / "node_modules", runtime / "node_modules")
    web = payload / "web"
    web.mkdir(exist_ok=True)
    (web / "index.html").write_text("<!doctype html><title>هوشیار.ai</title><script src=\"app.js\"></script>", encoding="utf-8")
    (payload / "product-manifest.json").write_text('{"name":"HooshyarOS","runtime":"CommercialRuntimeServer.ts"}', encoding="utf-8")
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
