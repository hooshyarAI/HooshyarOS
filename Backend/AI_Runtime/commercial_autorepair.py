from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


PROHIBITED_AUTO_MUTATION = (
    "automatic file replacement",
    "automatic test replacement",
    "automatic commit",
    "automatic push",
)


def build_diagnostic(output: str) -> dict:
    text = output or ""
    return {
        "status": "BLOCKED",
        "reason": "independent-repair-verification-required",
        "capability": "product.web-application-shell",
        "prohibitedActions": list(PROHIBITED_AUTO_MUTATION),
        "outputFingerprint": text[-4000:],
        "nextAction": "produce a governed repair proposal for an independent verification gate",
    }


def main() -> int:
    """Fail closed instead of manufacturing code/tests or pushing autonomous repairs.

    This command is intentionally diagnostic-only. It may collect evidence needed
    for a repair decision, but it must never write production source/tests or
    create a commit/push as a consequence of a detected build failure.
    """
    print("COMMERCIAL_AUTOREPAIR_MODE=DIAGNOSTIC_ONLY", flush=True)
    print("COMMERCIAL_AUTOREPAIR_STATUS=BLOCKED", flush=True)
    payload = build_diagnostic(\n        \n    )
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True), flush=True)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
