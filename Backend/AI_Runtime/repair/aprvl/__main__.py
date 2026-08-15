from __future__ import annotations

import argparse
import json
from pathlib import Path

from .contracts import RepairRequest
from .runner import APRVLRunner


def main() -> int:
    parser = argparse.ArgumentParser(description="Governed HooshyarOS APRVL inspection")
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--problem", default="repository health")
    parser.add_argument("--ci-log")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    ci_log = Path(args.ci_log).read_text(encoding="utf-8", errors="replace") if args.ci_log else None
    request = RepairRequest("repository", args.problem, {"ci_log": ci_log} if ci_log else {}, ())
    runner = APRVLRunner(root)
    findings = runner.detect(request)
    evidence = runner.evidence(request, findings)
    print(json.dumps({
        "status": "VERIFIED" if not any(f.severity == "ERROR" for f in findings) else "BLOCKED",
        "findings": [f.__dict__ for f in findings],
        "evidence": {"source": evidence.source, "checks": evidence.checks, "digest": evidence.digest},
    }, ensure_ascii=False, indent=2))
    return 0 if not any(f.severity == "ERROR" for f in findings) else 2


if __name__ == "__main__":
    raise SystemExit(main())
