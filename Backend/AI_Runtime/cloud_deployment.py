from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "error": "deployment manifest path required"}))
        return 2

    manifest = Path(sys.argv[1]).resolve()
    if not manifest.exists():
        print(json.dumps({"ok": False, "error": f"manifest not found: {manifest}"}))
        return 3

    data = json.loads(manifest.read_text(encoding="utf-8"))
    command = data.get("command")
    if not isinstance(command, list) or not command or not all(isinstance(x, str) for x in command):
        print(json.dumps({"ok": False, "error": "manifest.command must be a non-empty string list"}))
        return 4

    result = subprocess.run(command, cwd=manifest.parent, capture_output=True, text=True, check=False)
    print(json.dumps({
        "ok": result.returncode == 0,
        "provider": data.get("provider", "generic"),
        "command": command,
        "returnCode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
