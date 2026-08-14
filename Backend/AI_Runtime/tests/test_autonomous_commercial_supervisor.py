from __future__ import annotations

import json
import os
import unittest

from Backend.AI_Runtime.autonomous_commercial_supervisor import (
    GOVERNING_FILES,
    REQUIRED_MARKERS,
    enforce_construction_toolchain,
    read_governing_context,
    validate_plan,
)


class AutonomousCommercialSupervisorPolicyTests(unittest.TestCase):
    def test_governing_context_is_repository_backed(self) -> None:
        ok, reason = read_governing_context()
        self.assertTrue(ok, reason)
        self.assertTrue(reason)
        self.assertGreaterEqual(len(GOVERNING_FILES), 7)
        self.assertEqual(len({path.resolve() for path in GOVERNING_FILES}), len(GOVERNING_FILES))
        self.assertGreaterEqual(len(REQUIRED_MARKERS), 5)

    def test_python_first_toolchain_is_enforced(self) -> None:
        previous = os.environ.get("HOOSHYAR_AGENT")
        try:
            os.environ["HOOSHYAR_AGENT"] = "python"
            ok, reason = enforce_construction_toolchain()
            self.assertTrue(ok, reason)
            self.assertEqual(reason, "python+github+assistant")
        finally:
            if previous is None:
                os.environ.pop("HOOSHYAR_AGENT", None)
            else:
                os.environ["HOOSHYAR_AGENT"] = previous

    def test_weaving_plan_requires_one_real_capability_with_checkpoint_and_stop_conditions(self) -> None:
        output = "\n".join(
            [
                json.dumps({
                    "type": "AUTONOMOUS_WEAVING_PLAN",
                    "plan": {
                        "capabilityId": "product.web-application-shell",
                        "dependencyOrder": ["API Gateway"],
                        "verificationOrder": ["focused test", "integration verification"],
                        "stopConditions": ["verification failure"],
                    },
                }),
                json.dumps({
                    "type": "AUTONOMOUS_MISSION",
                    "commit": "abc123",
                    "capability": "repair commercial quality failure for product.web-application-shell",
                }),
            ]
        )
        ok, reason = validate_plan(output)
        self.assertTrue(ok, reason)
        self.assertEqual(reason, "product.web-application-shell")

    def test_continuation_token_cannot_be_selected_as_product_capability(self) -> None:
        output = "\n".join(
            [
                json.dumps({
                    "type": "AUTONOMOUS_WEAVING_PLAN",
                    "plan": {
                        "capabilityId": "platform.continuation",
                        "dependencyOrder": [],
                        "verificationOrder": ["repository audit"],
                        "stopConditions": ["failure"],
                    },
                }),
                json.dumps({
                    "type": "AUTONOMOUS_MISSION",
                    "commit": "abc123",
                    "capability": "continue platform construction",
                }),
            ]
        )
        ok, reason = validate_plan(output)
        self.assertFalse(ok)
        self.assertEqual(reason, "continuation-token-selected-as-capability")


if __name__ == "__main__":
    unittest.main()
