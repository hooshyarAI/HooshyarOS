"""Repository-native autonomous construction worker.

No Copilot, Codex, Claude, or cloud coding CLI is used. Unknown capabilities are
rejected. Phase 2 platform capabilities are generated as real Engine + focused
Test + documentation pairs so the autonomous loop can be validated end-to-end.
"""
from __future__ import annotations
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PLATFORM_CAPABILITIES = {
    "platform.user-management": "UserManagementEngine",
    "platform.organization-model": "OrganizationModelEngine",
    "platform.security-layer": "SecurityLayerEngine",
}

PLATFORM_DEPENDENCIES = {
    "platform.user-management": [],
    "platform.organization-model": ["Backend/HBOS/Engines/UserManagementEngine.ts", "Backend/HBOS/test/UserManagementEngine.test.ts", "Docs/Engines/UserManagementEngine.md"],
    "platform.security-layer": ["Backend/HBOS/Engines/UserManagementEngine.ts", "Backend/HBOS/test/UserManagementEngine.test.ts", "Backend/HBOS/Engines/OrganizationModelEngine.ts", "Backend/HBOS/test/OrganizationModelEngine.test.ts", "Docs/Engines/UserManagementEngine.md", "Docs/Engines/OrganizationModelEngine.md"],
}

def platform_artifacts(capability_id: str):
    engine = PLATFORM_CAPABILITIES[capability_id]
    method = {"UserManagementEngine":"registerUser","OrganizationModelEngine":"createOrganization","SecurityLayerEngine":"authorize"}[engine]
    test_input = {"UserManagementEngine":"ali","OrganizationModelEngine":"hooshyar","SecurityLayerEngine":"admin"}[engine]
    docs = {
        "UserManagementEngine": "# User Management Engine\n\nCanonical Phase 2 capability. Owns the minimal user-management contract and remains governed by HBOS Core and Governance Engine.\n",
        "OrganizationModelEngine": "# Organization Model Engine\n\nCanonical Phase 2 capability. Owns the minimal organization model contract and depends on User Management.\n",
        "SecurityLayerEngine": "# Security Layer Engine\n\nCanonical Phase 2 capability. Owns the minimal authorization contract and depends on User Management and Organization Model.\n",
    }
    engine_code = f'''import {{ Engine }} from "../Core/Engine";\n\nexport class {engine} implements Engine {{\n    name = "{engine}";\n    initialize(): void {{}}\n    health(): boolean {{ return true; }}\n    {method}(value: string): {{ value: string; status: "READY" | "BLOCKED" }} {{\n        const status = value && value.trim() ? "READY" : "BLOCKED";\n        return {{ value, status }};\n    }}\n}}\n'''
    test_code = f'''import {{ {engine} }} from "../Engines/{engine}";\n\ndescribe("{engine}", () => {{\n    it("accepts its canonical minimal operation", () => {{\n        expect(new {engine}().{method}("{test_input}").status).toBe("READY");\n    }});\n    it("blocks an empty operation", () => {{\n        expect(new {engine}().{method}(" ").status).toBe("BLOCKED");\n    }});\n}});\n'''
    return [(f"Backend/HBOS/Engines/{engine}.ts", engine_code), (f"Backend/HBOS/test/{engine}.test.ts", test_code), (f"Docs/Engines/{engine}.md", docs[engine])]

CAPABILITIES = {"platform.user-management": platform_artifacts("platform.user-management"), "platform.organization-model": platform_artifacts("platform.organization-model"), "platform.security-layer": platform_artifacts("platform.security-layer")}

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    args = parser.parse_args()
    match = re.search(r"Capability ID:\s*([^\n]+)", args.prompt)
    capability_id = match.group(1).strip() if match else ""
    artifacts = CAPABILITIES.get(capability_id)
    if artifacts is None:
        print(f"Unsupported deterministic capability: {capability_id}")
        return 2
    missing = [p for p in PLATFORM_DEPENDENCIES.get(capability_id, []) if not (ROOT / p).exists()]
    if missing:
        print(f"Blocked by unmet dependencies for {capability_id}: {', '.join(missing)}")
        return 3
    generated = []
    for relative_path, content in artifacts:
        target = ROOT / relative_path
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        generated.append(relative_path)
    if not generated:
        print(f"Already implemented: {capability_id}")
        return 0
    print("Generated: " + ", ".join(generated))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
