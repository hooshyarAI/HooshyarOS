"""Repository-native Python build entrypoint.

The canonical implementation lives in ``Backend.AI_Runtime.hooshyar_build``;
this thin entrypoint preserves the repository-level ``Backend/hooshyar_build.py``
contract used by the autonomous builder audit.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ROOT / "Backend" / "AI_Runtime" / "hooshyar_build.py"


def main() -> int:
    env = os.environ.copy()
    env["HOOSHYAR_AGENT"] = "python"
    process = subprocess.Popen(
        [sys.executable, str(CANONICAL), *sys.argv[1:]],
        cwd=ROOT,
        env=env,
    )
    return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
