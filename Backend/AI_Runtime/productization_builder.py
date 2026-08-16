"""Repository-native release artifact builder for HooshyarOS productization."""
from __future__ import annotations

# NOTE: Release installer hardening is intentionally kept in the canonical builder.
# The generated install.cmd uses the system Windows PowerShell explicitly, captures
# installation logs, and propagates the child exit code so IExpress cannot mask a
# real install failure.

from pathlib import Path

from _productization_builder_original import *  # type: ignore[F401,F403]

ROOT = Path(__file__).resolve().parents[2]
WINDOWS_INSTALLER = ROOT / "dist" / "productization" / "windows" / "installer"


def _harden_windows_bootstrap() -> None:
    payload_script = WINDOWS_INSTALLER / "install.cmd"
    if not payload_script.parent.exists():
        return
    payload_script.write_text(r'''@echo off
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" exit /b 91
"%PS%" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0install.ps1" > "%ProgramData%\HooshyarOS-install.log" 2>&1
set "RC=%ERRORLEVEL%"
exit /b %RC%
''', encoding="ascii")


_original_windows = windows


def windows() -> int:
    result = _original_windows()
    if result == 0:
        _harden_windows_bootstrap()
    return result
