"""Repository-native autonomous construction worker.

Known canonical capabilities retain explicit architecture-aware generators.
Unknown capabilities are no longer rejected: the worker derives a minimal
engine/test/documentation scaffold from the mission contract, while keeping
business semantics deliberately out of the generator.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Backend.AI_Runtime.autonomous_spec import generic_artifacts, spec_from_prompt, write_missing, write_overwrite

ALLOWED_AGENT = "python"


def enforce_construction_policy() -> None:
    """Refuse non-Python construction workers at the repository boundary."""
    agent = os.environ.get("HOOSHYAR_AGENT", ALLOWED_AGENT).strip().lower()
    if agent != ALLOWED_AGENT:
        raise RuntimeError(
            f"Unsupported autonomous construction provider: {agent or '<empty>'}; "
            "repository-native Python is the only approved construction worker."
        )


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


def platform_artifacts(capability_id: str):
    engine = PLATFORM_CAPABILITIES[capability_id]
    method = {
        "UserManagementEngine": "registerUser",
        "OrganizationModelEngine": "createOrganization",
        "SecurityLayerEngine": "authorize",
    }[engine]
    test_input = {
        "UserManagementEngine": "ali",
        "OrganizationModelEngine": "hooshyar",
        "SecurityLayerEngine": "admin",
    }[engine]
    docs = {
        "UserManagementEngine": "# User Management Engine\n\nCanonical Phase 2 capability. Owns the minimal user-management contract and remains governed by HBOS Core and Governance Engine.\n",
        "OrganizationModelEngine": "# Organization Model Engine\n\nCanonical Phase 2 capability. Owns the minimal organization model contract and depends on User Management.\n",
        "SecurityLayerEngine": "# Security Layer Engine\n\nCanonical Phase 2 capability. Owns the minimal authorization contract and depends on User Management and Organization Model.\n",
    }
    engine_code = f'''import {{ Engine }} from "../Core/Engine";\n\nexport class {engine} implements Engine {{\n    name = "{engine}";\n    initialize(): void {{}}\n    health(): boolean {{ return true; }}\n    {method}(value: string): {{ value: string; status: "READY" | "BLOCKED" }} {{\n        const status = value && value.trim() ? "READY" : "BLOCKED";\n        return {{ value, status }};\n    }}\n}}\n'''
    test_code = f'''import {{ {engine} }} from "../Engines/{engine}";\n\ndescribe("{engine}", () => {{\n    it("accepts its canonical minimal operation", () => {{\n        expect(new {engine}().{method}("{test_input}").status).toBe("READY");\n    }});\n    it("blocks an empty operation", () => {{\n        expect(new {engine}().{method}(" ").status).toBe("BLOCKED");\n    }});\n}});\n'''
    return [
        (f"Backend/HBOS/Engines/{engine}.ts", engine_code),
        (f"Backend/HBOS/test/{engine}.test.ts", test_code),
        (f"Docs/Engines/{engine}.md", docs[engine]),
    ]


def main() -> int:
    enforce_construction_policy()

    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--repair", action="store_true")
    parser.add_argument("--issue", default="")
    args = parser.parse_args()
    match = re.search(r"Capability ID:\s*([^\n]+)", args.prompt)
    capability_id = match.group(1).strip() if match else ""
    artifacts = None

    if capability_id in PLATFORM_CAPABILITIES:
        artifacts = platform_artifacts(capability_id)
    else:
        spec = spec_from_prompt(args.prompt)
        if spec is None:
            print("Invalid autonomous capability contract")
            return 2
        artifacts = generic_artifacts(spec)

    if args.repair:
        repaired = write_overwrite(ROOT, artifacts)
        print("Repaired: " + ", ".join(repaired))
        if args.issue:
            print(f"Repair reason: {args.issue}")
        return 0

    generated = write_missing(ROOT, artifacts)
    if not generated:
        print(f"Already implemented: {capability_id}")
        return 0

    print("Generated: " + ", ".join(generated))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
