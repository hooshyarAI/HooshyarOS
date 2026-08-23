import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools.audit.multi_agent_audit import build_audit


class MultiAgentAuditTest(unittest.TestCase):
    def test_fuses_independent_reports_and_preserves_conflicts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "Docs/Product").mkdir(parents=True)
            (root / ".audit/evidence").mkdir(parents=True)
            (root / "Docs/HOOSHYAROS_MASTER_CHARTER.md").write_text("charter", encoding="utf-8")
            (root / "Docs/ARCHITECTURE.md").write_text("architecture", encoding="utf-8")
            (root / "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md").write_text("governance", encoding="utf-8")
            (root / ".audit/evidence/cursor.json").write_text(json.dumps({
                "auditor": "cursor",
                "findings": [{"fingerprint": "engine-owner", "severity": "HIGH", "claim": "Decision owner mismatch"}]
            }), encoding="utf-8")
            (root / ".audit/evidence/claude-code.json").write_text(json.dumps({
                "auditor": "claude-code",
                "findings": [{"fingerprint": "engine-owner", "severity": "HIGH", "claim": "Different owner interpretation"}]
            }), encoding="utf-8")

            result = build_audit(root)
            self.assertEqual(result["status"], "REVIEW_REQUIRED")
            self.assertEqual(len(result["fusedFindings"]), 1)
            finding = result["fusedFindings"][0]
            self.assertEqual(finding["independentSupport"], 2)
            self.assertTrue(finding["consensus"])
            self.assertTrue(finding["conflict"])
            self.assertEqual(len(result["conflicts"]), 1)

    def test_clean_repository_has_no_external_findings(self):
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
            self.assertEqual(result["status"], "CLEAN")
            self.assertEqual(result["deterministicFindings"], [])


if __name__ == "__main__":
    unittest.main()
