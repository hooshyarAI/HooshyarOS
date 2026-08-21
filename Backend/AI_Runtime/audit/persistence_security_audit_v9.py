from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


class PersistenceSecurityAuditV9:
    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def read(self, relative: str) -> str:
        return (self.root / relative).read_text(encoding="utf-8", errors="replace")

    def audit(self) -> dict:
        findings = []

        persistence_path = self.root / "Backend/HBOS/Product/SQLitePersistenceStore.ts"
        ingestion_path = self.root / "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts"
        security_root = self.root / "Backend/HBOS/Security"

        evidence = {
            "persistence_exists": persistence_path.exists(),
            "financial_ingestion_exists": ingestion_path.exists(),
            "security_root_exists": security_root.exists(),
            "persistence_primary_key_tenant_scoped": False,
            "prepared_statements": False,
            "explicit_transactions": False,
            "ingestion_untrusted_path_read": False,
            "ingestion_path_root_policy": False,
            "subprocess_calls_in_security_surface": [],
        }

        if persistence_path.exists():
            text = self.read("Backend/HBOS/Product/SQLitePersistenceStore.ts")
            evidence["persistence_primary_key_tenant_scoped"] = bool(
                re.search(r"PRIMARY KEY\s*\(\s*tenant_id\s*,\s*key\s*\)", text, re.I)
            )
            evidence["prepared_statements"] = ".prepare(" in text
            evidence["explicit_transactions"] = bool(
                re.search(r"BEGIN|COMMIT|ROLLBACK|transaction", text, re.I)
            )
            if not evidence["persistence_primary_key_tenant_scoped"]:
                findings.append({
                    "severity": "HIGH",
                    "id": "PERSIST-BOUNDARY-001",
                    "title": "Persistence key is not provably tenant-scoped",
                    "confidence": 0.98,
                    "disposition": "CONFIRMED_PERSISTENCE_BOUNDARY_GAP",
                })
            if not evidence["explicit_transactions"]:
                findings.append({
                    "severity": "MEDIUM",
                    "id": "PERSIST-TRANSACTION-001",
                    "title": "Persistence transaction boundaries are not explicit",
                    "confidence": 0.82,
                    "disposition": "MEASURE_AND_CONTEXT_REQUIRED",
                })

        if ingestion_path.exists():
            text = self.read("Backend/HBOS/Product/FinancialDataIngestionAdapter.ts")
            evidence["ingestion_untrusted_path_read"] = "readFile(normalizedPath" in text
            evidence["ingestion_path_root_policy"] = any(
                token in text
                for token in ("allowedRoot", "ingestionRoot", "allowedIngestionRoot", "path.relative")
            )
            if evidence["ingestion_untrusted_path_read"] and not evidence["ingestion_path_root_policy"]:
                findings.append({
                    "severity": "HIGH",
                    "id": "SEC-PATH-002",
                    "title": "Financial ingestion reads caller-supplied filesystem paths without an explicit allowed-root policy",
                    "confidence": 0.96,
                    "disposition": "CONFIRMED_SECURITY_BOUNDARY_GAP",
                })

        if security_root.exists():
            for path in security_root.rglob("*.ts"):
                text = path.read_text(encoding="utf-8", errors="replace")
                if "exec(" in text or "spawn(" in text or "execFile(" in text:
                    evidence["subprocess_calls_in_security_surface"].append(path.relative_to(self.root).as_posix())

        return {
            "audit_version": "9.0",
            "status": "FAIL" if any(f["severity"] in {"CRITICAL", "HIGH"} for f in findings) else "PASS",
            "findings": findings,
            "evidence": evidence,
        }

    def write(self, out: str) -> dict:
        output = Path(out).resolve()
        output.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (output / "persistence_security_audit_v9.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        lines = [
            "# HooshyarOS Persistence & Security Audit V9",
            "",
            f"- Status: **{result['status']}**",
            "",
            "## Findings",
            "",
        ]
        if not result["findings"]:
            lines.append("- None")
        else:
            for f in result["findings"]:
                lines.append(
                    f"- **{f['severity']}** `{f['id']}` — {f['title']} "
                    f"(confidence={f['confidence']:.2f}, disposition={f['disposition']})"
                )
        lines += ["", "## Evidence", "", "```json", json.dumps(result["evidence"], ensure_ascii=False, indent=2), "```", ""]
        (output / "persistence_security_audit_v9_report.md").write_text("\n".join(lines), encoding="utf-8")
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = PersistenceSecurityAuditV9(args.repository).write(args.out)
    print(json.dumps({"status": result["status"], "audit_version": "9.0", "findings": len(result["findings"])}, ensure_ascii=False, indent=2))
