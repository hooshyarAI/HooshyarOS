"""Assistant entrypoint that separates productization from platform completion."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "Backend" / "AI_Runtime" / "hooshyar_build.py"
WORKER = ROOT / "Backend" / "AI_Runtime" / "productization_worker.py"


def main() -> int:
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    if env.get("HOOSHYAR_PRODUCTIZATION_MODE", "").strip() == "1":
        return subprocess.run([sys.executable, str(WORKER)], cwd=ROOT, env=env, check=False).returncode
    return subprocess.run([sys.executable, str(BUILDER), "assistant"], cwd=ROOT, env=env, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
