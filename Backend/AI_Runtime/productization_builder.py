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
    source_script = sed.parent / "source" / "install.cmd"
    if not source_script.exists():
        return
    source_script.write_text(r'''@echo off
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" exit /b 91
"%PS%" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0install.ps1" > "%ProgramData%\HooshyarOS-install.log" 2>&1
set "RC=%ERRORLEVEL%"
exit /b %RC%
''', encoding="ascii")


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
