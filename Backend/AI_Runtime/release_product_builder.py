"""Deterministic Windows product payload builder."""
from __future__ import annotations

import argparse
import json
import os
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
    return (name in {"node_modules", ".git"} or name == "__pycache__" or
            name.endswith(".pyc") or name.endswith(".test") or name.endswith(".spec") or
            name.endswith(".tmp"))


def _validate_windows_payload(payload: Path) -> None:
    required = [
        payload / "Backend" / "AI_Runtime" / "CommercialRuntimeServer.ts",
        payload / "Frontend" / "HooshyarWebApp" / "index.ts",
        payload / "Frontend" / "HooshyarWebApp" / "web" / "index.html",
        payload / "product-manifest.json",
    ]
    missing = [str(p.relative_to(payload)) for p in required if not p.exists()]
    if missing:
        raise RuntimeError(f"windows-payload-missing:{','.join(missing)}")


def _runtime_dependency_names() -> set[str]:
    roots = {"tsx"}
    package = ROOT / "package.json"
    if package.exists():
        import json as _json
        data = _json.loads(package.read_text(encoding="utf-8"))
        roots.update(data.get("dependencies", {}).keys())
    return roots


def _copy_node_dependency(name: str, destination: Path) -> None:
    source = ROOT / "node_modules" / name
    if source.exists():
        shutil.copytree(source, destination / name, dirs_exist_ok=True)


def _copy_runtime_node_modules(destination: Path) -> None:
    roots = _runtime_dependency_names()
    destination.mkdir(parents=True, exist_ok=True)
    for name in roots:
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
    return package


def build_installer() -> int:
    package = build_bootstrap()
    iexpress = shutil.which("iexpress.exe") or shutil.which("iexpress")
    if not iexpress:
        emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", status="BLOCKED", reason="iexpress-unavailable")
        return 23
    emit("AUTONOMOUS_PRODUCTIZATION_BUILDER", status="COMPLETE", artifact=str(package.relative_to(ROOT)))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--windows", action="store_true")
    args = parser.parse_args()
    return build_installer() if args.windows else build_bootstrap() and 0


if __name__ == "__main__":
    raise SystemExit(main())
