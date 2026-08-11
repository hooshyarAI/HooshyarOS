"""Repository-native autonomous construction worker.

Known canonical capabilities retain explicit architecture-aware generators.
Unknown capabilities are no longer rejected: the worker derives a minimal
engine/test/documentation scaffold from the mission contract, while keeping
business semantics deliberately out of the generator.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Backend.AI_Runtime.autonomous_spec import generic_artifacts, spec_from_prompt, write_missing, write_overwrite

PLATFORM_CAPABILITIES = {
    "platform.user-management": "UserManagementEngine",
    "platform.organization-model": "OrganizationModelEngine",
    "platform.security-layer": "SecurityLayerEngine",
}

PLATFORM_DEPENDENCIES = {
    "platform.user-management": [],
    "platform.organization-model": [
        "Backend/HBOS/Engines/UserManagementEngine.ts",
        "Backend/HBOS/test/UserManagementEngine.test.ts",
        "Docs/Engines/UserManagementEngine.md",
    ],
    "platform.security-layer": [
        "Backend/HBOS/Engines/UserManagementEngine.ts",
        "Backend/HBOS/test/UserManagementEngine.test.ts",
        "Backend/HBOS/Engines/OrganizationModelEngine.ts",
        "Backend/HBOS/test/OrganizationModelEngine.test.ts",
        "Docs/Engines/UserManagementEngine.md",
        "Docs/Engines/OrganizationModelEngine.md",
    ],
}
