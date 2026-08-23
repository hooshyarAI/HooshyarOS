import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools.audit.multi_agent_audit import build_audit


class MultiAgentAuditTest(unittest.TestCase):
    def _report(self, auditor, finding):
        return {
            "auditor": auditor,
            "timestamp": "2026-08-24T00:00:00Z",
            "scope": "repository",
            "commit": "abc123",
            "findings": [finding],
        }

    def test_fuses_independent_reports_and_preserves_conflicts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "Docs/Product").mkdir(parents=True)
            (root / ".audit/evidence").mkdir(parents=True)
            (root / "Docs/HOOSHYAROS_MASTER_CHARTER.md").write_text("charter", encoding="utf-8")
            (root / "Docs/ARCHITECTURE.md").write_text("architecture", encoding="utf-8")
            (root / "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md").write_text("governance", encoding="utf-8")
            (root / ".audit/evidence/cursor.json").write_text(json.dumps(self._report(
                "cursor", {"fingerprint": "engine-owner", "severity": "HIGH", "claim": "Decision owner mismatch"}
            )), encoding="utf-8")
            (root / ".audit/evidence/claude-code.json").write_text(json.dumps(self._report(
                "claude-code", {"fingerprint": "engine-owner", "severity": "HIGH", "claim": "Different owner interpretation"}
            )), encoding="utf-8")

            result = build_audit(root)
            self.assertEqual(result["status"], "REVIEW_REQUIRED")
            self.assertEqual(len(result["fusedFindings"]), 1)
            finding = result["fusedFindings"][0]
            self.assertEqual(finding["independentSupport"], 2)
            self.assertTrue(finding["consensus"])
            self.assertTrue(finding["conflict"])
            self.assertEqual(len(result["conflicts"]), 1)

    def test_missing_external_evidence_is_review_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "Docs").mkdir()
            for name in (
                "HOOSHYAROS_MASTER_CHARTER.md",
                "ARCHITECTURE.md",
                "HOOSHYAROS_GOVERNANCE_CHARTER.md",
            ):
                (root / "Docs" / name).write_text("ok", encoding="utf-8")
            result = build_audit(root)
            self.assertEqual(result["status"], "REVIEW_REQUIRED")
            self.assertEqual(len(result["evidenceDefects"]), 2)

    def test_runtime_duplicate_is_deterministic_finding(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in (
                "HOOSHYAROS_MASTER_CHARTER.md",
                "ARCHITECTURE.md",
                "HOOSHYAROS_GOVERNANCE_CHARTER.md",
            ):
                (root / "Docs").mkdir(exist_ok=True)
                (root / "Docs" / name).write_text("ok", encoding="utf-8")
            (root / "Backend/HBOS/Core").mkdir(parents=True)
            (root / "Backend/HBOS/Engines").mkdir(parents=True)
            (root / "Backend/HBOS/Core/DecisionEngine.ts").write_text("class DecisionEngine {}", encoding="utf-8")
            (root / "Backend/HBOS/Engines/DecisionEngine.ts").write_text("class DecisionEngine {}", encoding="utf-8")
            result = build_audit(root)
            self.assertEqual(result["status"], "REVIEW_REQUIRED")
            self.assertTrue(any(x["id"] == "RUNTIME_SYMBOL_DUPLICATE" for x in result["deterministicFindings"]))


if __name__ == "__main__":
    unittest.main()
