from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PROHIBITED_AUTO_MUTATION = (
    "automatic file replacement",
    "automatic test replacement",
    "automatic commit",
    "automatic push",
)


def build_diagnostic(output: str = "") -> dict:
    """Build a repair proposal without mutating production source or git state."""
    return {
        "status": "BLOCKED",
        "reason": "independent-repair-verification-required",
        "capability": "product.web-application-shell",
        "prohibitedActions": list(PROHIBITED_AUTO_MUTATION),
        "outputFingerprint": (output or "")[-4000:],
        "nextAction": "produce a governed repair proposal for an independent verification gate",
    }


def main() -> int:
    """Fail closed on automatic commercial repair.

    This command is diagnostic-only. It never writes production source/tests and
    never creates, commits, or pushes a repair as a consequence of a build failure.
    """
    print("COMMERCIAL_AUTOREPAIR_MODE=DIAGNOSTIC_ONLY", flush=True)
    payload = build_diagnostic()
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True), flush=True)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
