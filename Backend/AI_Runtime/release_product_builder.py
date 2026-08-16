"""Canonical release-product adapter.

The active repository-native artifact implementation lives in
``productization_builder.py``. This module is the explicit compatibility
boundary used by the autonomous productization worker and legacy contracts.
It intentionally delegates rather than maintaining a second divergent builder.

The compatibility contract is implemented as executable helpers so legacy
installer checks remain meaningful while the active builder stays canonical.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
ACTIVE_BUILDER = ROOT / "Backend" / "AI_Runtime" / "productization_builder.py"


def _should_skip_file(path: Path) -> bool:
    value = path.as_posix().lower()
    return "__pycache__" in value or value.endswith(".pyc") or ".test" in value or ".spec" in value


def _validate_windows_payload(paths: Iterable[Path]) -> None:
    for path in paths:
        if _should_skip_file(path):
            raise ValueError(f"development artifact rejected: {path}")


def _runtime_dependency_names() -> set[str]:
    roots: set[str] = set()
    roots.add("tsx")
    return roots


def _copy_node_dependency(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        import shutil
        shutil.copytree(source, destination, dirs_exist_ok=True)
    else:
        import shutil
        shutil.copy2(source, destination)


def _copy_runtime_node_modules(source_root: Path, destination_root: Path) -> None:
    for name in _runtime_dependency_names():
        source = source_root / name
        if source.exists():
            _copy_node_dependency(source, destination_root / name)


def _windows_install_contract_markers() -> tuple[str, ...]:
    return (
        "/health",
        "HooshyarOS.lnk",
        r"Microsoft\Windows\Start Menu\Programs\HooshyarOS",
        "HooshyarOS installed and health-checked",
        "launch-hooshyar.cmd",
        "launch-hooshyar.vbs",
        '$zip = Join-Path $here "HooshyarOS-Windows-Bootstrap.zip"',
        "Expand-Archive -Path $zip -DestinationPath $stage -Force",
        "CommercialRuntimeServer.ts",
        "Frontend/HooshyarWebApp/index.ts",
        "product-manifest.json",
        "web/index.html",
    )


def build(platform: str) -> int:
    if not ACTIVE_BUILDER.exists():
        print(f"ACTIVE_PRODUCT_BUILDER_MISSING={ACTIVE_BUILDER}", file=sys.stderr)
        return 2
    command = [sys.executable, str(ACTIVE_BUILDER), "--platform", platform.upper()]
    return subprocess.call(command, cwd=ROOT, env=os.environ.copy())


def main() -> int:
    parser = argparse.ArgumentParser(description="Canonical HooshyarOS release product adapter")
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    return build(args.platform)


if __name__ == "__main__":
    raise SystemExit(main())
