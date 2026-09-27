"""Focused contract for the self-contained IExpress Windows installer.

The productization builder used to package installer scripts plus a thin ZIP,
while ``install.ps1`` copied a sibling ``payload`` directory that never existed
after IExpress extraction. These tests lock the repaired contract:

* the installer expands the bundled payload from its own extracted directory;
* it never depends on a repository path or a sibling payload directory;
* it creates the runtime, data directory, launcher and uninstall entry;
* it self-elevates for the ProgramData install root; and
* it is behaviorally smoke-tested against an isolated temporary install root.
"""
from __future__ import annotations

import os
import subprocess
import zipfile
from pathlib import Path

import pytest

import Backend.AI_Runtime.productization_builder as builder


def _generate(installer_dir: Path) -> dict[str, Path]:
    return builder._write_windows_installer_scripts(installer_dir)


def test_installer_expands_its_own_bundled_payload(tmp_path: Path) -> None:
    scripts = _generate(tmp_path / "installer")
    install = scripts["install"].read_text(encoding="utf-8")

    assert "Expand-Archive" in install
    assert builder.WINDOWS_BOOTSTRAP_NAME in install
    assert 'Join-Path $Here $BundleName' in install
    # The defect: copying a sibling payload directory that does not exist at
    # install time. The repaired installer must never do this.
    assert 'Join-Path $Root "payload' not in install
    assert "payload\\*" not in install
    assert "npm.cmd start" not in install


def test_installer_creates_runtime_data_launcher_and_uninstall(tmp_path: Path) -> None:
    scripts = _generate(tmp_path / "installer")
    install = scripts["install"].read_text(encoding="utf-8")
    uninstall = scripts["uninstall"].read_text(encoding="utf-8")
    build = scripts["build"].read_text(encoding="utf-8")

    assert "data" in install and "New-Item -ItemType Directory" in install
    assert "Start HooshyarOS.cmd" in install
    assert "launch-hooshyar.vbs" in install
    assert "Uninstall HooshyarOS.cmd" in install
    assert "Remove-Item -LiteralPath $InstallRoot -Recurse -Force" in uninstall

    # Required elevation for the ProgramData install root.
    for script in (install, uninstall):
        assert "WindowsBuiltInRole]::Administrator" in script
        assert "-Verb RunAs" in script

    # The payload ZIP is the canonical, behaviorally validated release payload.
    assert "release_product_builder.py" in build
    assert builder.WINDOWS_BOOTSTRAP_NAME in build


def test_bootstrap_validation_rejects_thin_payloads(tmp_path: Path) -> None:
    thin = tmp_path / "thin.zip"
    with zipfile.ZipFile(thin, "w") as archive:
        archive.writestr("package.json", "{}")
        archive.writestr("Backend/HBOS/index.ts", "// thin")
    missing = builder._validate_windows_bootstrap(thin)
    assert "node-runtime/node.exe" in missing
    assert "node_modules/tsx/dist/cli.mjs" in missing
    assert "launch-hooshyar.vbs" in missing
    assert "web/index.html" in missing


@pytest.mark.skipif(os.name != "nt", reason="Windows installer smoke test requires Windows PowerShell")
def test_install_uninstall_smoke_in_isolated_root(tmp_path: Path) -> None:
    scripts = _generate(tmp_path / "scripts")
    install_ps1 = scripts["install"]
    uninstall_ps1 = scripts["uninstall"]

    bundle = install_ps1.parent / builder.WINDOWS_BOOTSTRAP_NAME
    with zipfile.ZipFile(bundle, "w") as archive:
        archive.writestr("launch-hooshyar.vbs", "WScript.Quit 0\r\n")
        archive.writestr("launch-hooshyar.ps1", "exit 0\r\n")
        archive.writestr("web/index.html", "<!doctype html><title>HooshyarOS</title>\r\n")

    install_root = tmp_path / "isolated-install"

    install = subprocess.run(
        [
            "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", str(install_ps1),
            "-InstallRoot", str(install_root),
            "-NoElevate",
        ],
        text=True, encoding="utf-8", errors="replace",
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=300, check=False,
    )
    assert install.returncode == 0, install.stdout

    runtime = install_root / "runtime"
    assert (runtime / "launch-hooshyar.vbs").exists()
    assert (runtime / "web" / "index.html").exists()
    assert (install_root / "data").is_dir()
    launcher = install_root / "Start HooshyarOS.cmd"
    assert launcher.exists()
    assert "wscript.exe" in launcher.read_text(encoding="ascii", errors="replace")
    assert (install_root / "uninstall.ps1").exists()
    assert (install_root / "Uninstall HooshyarOS.cmd").exists()

    uninstall = subprocess.run(
        [
            "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", str(uninstall_ps1),
            "-InstallRoot", str(install_root),
            "-NoElevate",
        ],
        text=True, encoding="utf-8", errors="replace",
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=300, check=False,
    )
    assert uninstall.returncode == 0, uninstall.stdout
    assert not install_root.exists()


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
