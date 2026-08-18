import unittest
from unittest.mock import patch

import autonomous_master_orchestrator as orchestrator


class AutonomousMasterOrchestratorTests(unittest.TestCase):
    def test_blocks_when_starting_worktree_is_dirty(self):
        with patch.object(orchestrator, "git_clean", return_value=False), patch.object(
            orchestrator, "run_builder"
        ) as builder:
            self.assertEqual(orchestrator.main(), 20)
            builder.assert_not_called()

    def test_verifies_and_publishes_a_built_cycle(self):
        with patch.object(orchestrator, "MAX_CYCLES", 1), patch.object(
            orchestrator, "FULL_VERIFY_EVERY", 1
        ), patch.object(orchestrator, "git_clean", return_value=True), patch.object(
            orchestrator, "git_porcelain", return_value=" M Backend/HBOS/Product/example.ts"
        ), patch.object(orchestrator, "run_builder", return_value=True), patch.object(
            orchestrator, "verify", return_value=True
        ), patch.object(orchestrator, "commit_verified_changes", return_value=True), patch.object(
            orchestrator, "run_productization", return_value=True
        ):
            self.assertEqual(orchestrator.main(), 0)

    def test_productization_can_be_deferred_without_marking_commercial_ready(self):
        with patch.dict(orchestrator.os.environ, {"HOOSHYAR_PRODUCTIZATION_MODE": ""}):
            self.assertTrue(orchestrator.run_productization())


if __name__ == "__main__":
    unittest.main()
