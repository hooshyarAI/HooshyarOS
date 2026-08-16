"""Governed release wrapper around the canonical productization builder."""
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import _productization_builder_original as _core  # type: ignore


def _harden_iexpress_payload(args: list[str]) -> None:
    if not args:
        return
    sed = Path(args[-1])
    source = sed.parent / "source"
    source_script = source / "install.cmd"
    install_ps1 = source / "install.ps1"
    if not source_script.exists() or not install_ps1.exists():
        return

    script = install_ps1.read_text(encoding="utf-8")
    script = script.replace(
        '$Root = Split-Path -Parent $PSScriptRoot',
        '$Root = $PSScriptRoot',
    )
    # Use robocopy with junction handling disabled and zero retry/wait so an
    # accidental reparse point or locked payload cannot turn the installer
    # into an unbounded process. Robocopy codes below 8 are successful.
    script = script.replace(
        'Copy-Item -Path (Join-Path $PayloadExtract "*") -Destination $RuntimeRoot -Recurse -Force',
        '$copy = & robocopy.exe $PayloadExtract $RuntimeRoot /E /XJ /R:0 /W:0 /NFL /NDL /NJH /NJS\nif ($LASTEXITCODE -ge 8) { throw "HooshyarOS payload copy failed with robocopy exit code $LASTEXITCODE" }\n$global:LASTEXITCODE = 0',
    )
    script = script.replace(
        'Remove-Item $PayloadExtract -Recurse -Force -ErrorAction SilentlyContinue',
        'Remove-Item $PayloadExtract -Recurse -Force -ErrorAction SilentlyContinue\nexit 0',
    )
    install_ps1.write_text(script, encoding="utf-8")

    source_script.write_text(r'''@echo off
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" exit /b 91
"%PS%" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0install.ps1" > "%ProgramData%\HooshyarOS-install.log" 2>&1
set "RC=%ERRORLEVEL%"
exit /b %RC%
''', encoding="ascii")

    sed_text = sed.read_text(encoding="utf-8")
    sed_text = sed_text.replace("ShowInstallProgramWindow=1", "ShowInstallProgramWindow=0")
    sed.write_text(sed_text, encoding="utf-8")


_original_run = _core.run


def _governed_run(command: str, args: list[str], **kwargs: object) -> int:
    if Path(command).name.lower() == "iexpress.exe":
        _harden_iexpress_payload(args)
    return _original_run(command, args, **kwargs)


_core.run = _governed_run


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    return _core.windows() if args.platform == "WINDOWS" else _core.android()


if __name__ == "__main__":
    raise SystemExit(main())
