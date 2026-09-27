"""Focused contract for the user-facing Inno Setup Windows installer.

The Windows productization layer used to ship an IExpress bootstrap: installer
scripts plus a thin ZIP whose ``install.ps1`` expected a sibling payload
directory. That was not a normal Windows setup experience and could not present
a Setup Wizard. The canonical installer is now the Inno Setup definition at
``installer/HooshyarOS.iss``, compiled by ``productization_builder.py`` with the
complete, behaviorally validated runtime payload embedded in the Setup EXE.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import Backend.AI_Runtime.productization_builder as builder


ISS = builder.WINDOWS_INSTALLER_SCRIPT


def _iss() -> str:
    return ISS.read_text(encoding="utf-8")


def test_installer_is_an_inno_setup_wizard_definition() -> None:
    assert ISS.exists()
    script = _iss()
    for section in ("[Setup]", "[Files]", "[Icons]", "[Run]", "[Tasks]", "[UninstallDelete]"):
        assert section in script
    assert "WizardStyle=modern" in script
    assert "DisableWelcomePage=no" in script
    assert "AppName={#AppName}" in script
    assert "AppVersion={#AppVersion}" in script


def test_wizard_embeds_the_complete_validated_payload() -> None:
    script = _iss()
    assert 'Source: "..\\dist\\productization\\windows\\payload\\*"' in script
    assert "recursesubdirs createallsubdirs" in script


def test_installation_directory_and_shortcuts_are_deterministic() -> None:
    script = _iss()
    assert "DefaultDirName={localappdata}\\Programs\\HooshyarOS" in script
    assert 'Name: "{autoprograms}\\HooshyarOS\\HooshyarOS"' in script
    assert 'Name: "{autodesktop}\\HooshyarOS"' in script
    assert "Tasks: startmenuicon" in script
    assert "Tasks: desktopicon" in script
    assert 'Name: "desktopicon"' in script
    # Desktop shortcut is offered as an option, unchecked by default (Inno convention).
    assert "Flags: unchecked" in script


def test_completion_page_launch_and_uninstall_registration() -> None:
    script = _iss()
    run_entries = [line.strip() for line in script.splitlines() if line.strip().startswith("Filename:")]
    launch_entries = [line for line in run_entries if "launch-hooshyar.vbs" in line]
    assert launch_entries, "installer must offer to launch the installed runtime"
    for entry in launch_entries:
        assert "wscript.exe" in entry
        assert "postinstall" in entry
        assert "skipifsilent" in entry
        assert "nowait" in entry
    assert "UninstallDisplayName={#AppName}" in script
    assert "UninstallDisplayIcon={app}\\hooshyaros.ico" in script


def test_bootstrap_validation_rejects_thin_payloads(tmp_path: Path) -> None:
    import zipfile

    thin = tmp_path / "thin.zip"
    with zipfile.ZipFile(thin, "w") as archive:
        archive.writestr("package.json", "{}")
        archive.writestr("Backend/HBOS/index.ts", "// thin")
    missing = builder._validate_windows_bootstrap(thin)
    assert "node-runtime/node.exe" in missing
    assert "node_modules/tsx/dist/cli.mjs" in missing
    assert "launch-hooshyar.vbs" in missing
    assert "web/index.html" in missing


def test_bootstrap_validation_accepts_the_canonical_payload(tmp_path: Path) -> None:
    import zipfile

    full = tmp_path / "full.zip"
    with zipfile.ZipFile(full, "w") as archive:
        for name in builder.WINDOWS_BOOTSTRAP_REQUIRED_MEMBERS:
            archive.writestr(name, "x")
    assert builder._validate_windows_bootstrap(full) == []


def test_builder_has_no_iexpress_bootstrap_mechanism() -> None:
    source = Path(builder.__file__).read_text(encoding="utf-8")
    # The obsolete IExpress package definition and self-elevating install scripts.
    assert "AppLaunched=install.cmd" not in source
    assert "TargetName={exe}" not in source
    assert "_write_windows_installer_scripts" not in source
    assert "Expand-Archive" not in source
    # The canonical Inno Setup wizard compilation is wired in instead.
    assert "def discover_inno_setup" in source
    assert "def provision_inno_setup" in source
    assert "INNO_SETUP_PACKAGE_ID = \"JRSoftware.InnoSetup.7\"" in source
    assert "def windows_setup_output" in source
    assert "def _validate_windows_setup_exe" in source
    assert "WINDOWS_INSTALLER_SCRIPT" in source


def test_windows_setup_output_follows_the_iss_definition() -> None:
    exe = builder.windows_setup_output()
    assert exe.name == "HooshyarOS-Setup-1.0.0.exe"
    assert exe.parent == builder.WINDOWS_INSTALLER


def test_iss_helpers_parse_defines_and_values() -> None:
    script = _iss()
    assert builder._iss_define(script, "AppVersion") == "1.0.0"
    assert builder._iss_value(script, "OutputBaseFilename") == "HooshyarOS-Setup-{#AppVersion}"


def test_setup_exe_validation_rejects_non_installers(tmp_path: Path) -> None:
    missing = tmp_path / "missing.exe"
    assert builder._validate_windows_setup_exe(missing) == "windows-setup-exe-not-produced"

    too_small = tmp_path / "small.exe"
    too_small.write_bytes(b"MZ" + b"\x00" * 16)
    assert builder._validate_windows_setup_exe(too_small) == "windows-setup-exe-too-small"

    not_pe = tmp_path / "fake.exe"
    not_pe.write_bytes(b"NOTPE" + b"\x00" * (2 * 1024 * 1024))
    assert builder._validate_windows_setup_exe(not_pe) == "windows-setup-exe-not-pe"

    real = tmp_path / "real.exe"
    real.write_bytes(b"MZ" + b"\x00" * (2 * 1024 * 1024))
    assert builder._validate_windows_setup_exe(real) is None


def test_provision_inno_setup_uses_the_canonical_winget_package(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(builder.shutil, "which", lambda name: "winget.exe" if "winget" in name else None)

    captured: dict[str, list[str]] = {}

    class _Result:
        returncode = 0
        stdout = ""

    def fake_run(command: list[str], **_: object) -> _Result:
        captured["command"] = command
        return _Result()

    monkeypatch.setattr(builder.subprocess, "run", fake_run)
    monkeypatch.setattr(builder, "discover_inno_setup", lambda: Path("ISCC.exe"))

    assert builder.provision_inno_setup() == Path("ISCC.exe")
    command = captured["command"]
    assert "--id" in command and "JRSoftware.InnoSetup.7" in command
    assert "--source" in command and "winget" in command


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
