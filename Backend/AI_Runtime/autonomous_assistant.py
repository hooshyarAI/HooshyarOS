"""Explicit autonomous-assistant entrypoint.

This is a thin, governed adapter over the canonical ``hooshyar_build.py
assistant`` mode. The TypeScript HBOS daemon remains authoritative; this module
only provides the explicit Python productization entrypoint required by the
assistant contract.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANONICAL = ROOT / "Backend" / "AI_Runtime" / "hooshyar_build.py"


def main() -> int:
    if not CANONICAL.exists():
        print(f"ERROR: canonical assistant entrypoint missing: {CANONICAL}", file=sys.stderr)
        return 2
    return subprocess.call([sys.executable, str(CANONICAL), "assistant"], cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
