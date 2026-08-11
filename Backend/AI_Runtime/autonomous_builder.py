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


def reasoning_artifacts():
    engine = '''import { execFileSync } from "node:child_process";
import { Engine } from "../Core/Engine";

export interface ReasoningResult {
    problem: string;
    status: string;
    success: boolean;
}

export class ReasoningEngine implements Engine {
    name = "ReasoningEngine";

    initialize(): void {}
    health(): boolean { return true; }

    reason(problem: string): ReasoningResult {
        if (!problem || !problem.trim()) {
            return { problem, status: "invalid_problem", success: false };
        }
        const python = process.env.HOOSHYAR_PYTHON || "python";
        const script = [
            "import json, sys",
            "from Backend.AI_Runtime.reasoning.reasoning_engine import ReasoningEngine as PythonReasoningEngine",
            "result = PythonReasoningEngine().reason(sys.argv[1])",
            "print(json.dumps(result, ensure_ascii=False))",
        ].join("; ");
        try {
            const raw = execFileSync(python, ["-c", script, problem], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
            const result = JSON.parse(raw.trim()) as { problem: string; status: string };
            return { problem: result.problem, status: result.status, success: true };
        } catch {
            return { problem, status: "reasoning_failed", success: false };
        }
    }
}
'''
    test = '''import { ReasoningEngine } from "../Engines/ReasoningEngine";

describe("ReasoningEngine", () => {
    it("has canonical identity and health", () => {
        const engine = new ReasoningEngine();
        expect(engine.name).toBe("ReasoningEngine");
        expect(engine.health()).toBe(true);
    });

    it("rejects an empty reasoning problem", () => {
        const result = new ReasoningEngine().reason(" ");
        expect(result.success).toBe(false);
        expect(result.status).toBe("invalid_problem");
    });
});
'''
    return [("Backend/HBOS/Engines/ReasoningEngine.ts", engine), ("Backend/HBOS/test/ReasoningEngine.test.ts", test)]


def organizational_artifacts():
    engine = '''import { Engine } from "../Core/Engine";
import { MemoryEngine } from "./MemoryEngine";
import { KnowledgeEngine } from "./KnowledgeEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";

export interface OrganizationalInsight {
    scope: string;
    status: "READY";
    projectCount: number;
    healthy: boolean;
}

export class OrganizationalIntelligenceEngine implements Engine {
    name = "OrganizationalIntelligenceEngine";
    private readonly memory = new MemoryEngine();
    private readonly knowledge = new KnowledgeEngine();
    private readonly projects = new ProjectPilotEngine();

    initialize(): void {
        this.memory.initialize();
        this.knowledge.initialize();
        this.projects.initialize();
    }

    health(): boolean { return true; }

    assess(scope = "organization"): OrganizationalInsight {
        return { scope, status: "READY", projectCount: this.projects.getProjects().length, healthy: this.health() };
    }
}
'''
    test = '''import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";

describe("OrganizationalIntelligenceEngine", () => {
    it("owns the canonical organizational intelligence boundary", () => {
        const engine = new OrganizationalIntelligenceEngine();
        expect(engine.name).toBe("OrganizationalIntelligenceEngine");
        expect(engine.health()).toBe(true);
        expect(engine.assess().status).toBe("READY");
    });
});
'''
    return [("Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts", engine), ("Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts", test)]


def autonomous_operations_artifacts():
    engine = '''import { DecisionEngine } from "./DecisionEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";
import { GovernanceEngine } from "./GovernanceEngine";
import { Engine } from "../Core/Engine";

export interface OperationResult {
    operation: string;
    status: "READY" | "BLOCKED";
    projectCount: number;
}

export class AutonomousOperationsEngine implements Engine {
    name = "AutonomousOperationsEngine";
    private readonly decisions = new DecisionEngine();
    private readonly projects = new ProjectPilotEngine();
    private readonly governance = new GovernanceEngine();

    initialize(): void {
        this.decisions.initialize();
        this.projects.initialize();
        this.governance.initialize();
    }

    health(): boolean { return true; }

    execute(operation: string): OperationResult {
        if (!operation || !operation.trim()) return { operation, status: "BLOCKED", projectCount: this.projects.getProjects().length };
        return { operation, status: this.health() ? "READY" : "BLOCKED", projectCount: this.projects.getProjects().length };
    }
}
'''
    test = '''import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";

describe("AutonomousOperationsEngine", () => {
    it("owns the canonical autonomous operations boundary", () => {
        const engine = new AutonomousOperationsEngine();
        expect(engine.name).toBe("AutonomousOperationsEngine");
        expect(engine.health()).toBe(true);
        expect(engine.execute("continue mission").status).toBe("READY");
    });
    it("blocks an empty operation", () => {
        expect(new AutonomousOperationsEngine().execute(" ").status).toBe("BLOCKED");
    });
});
'''
    return [("Backend/HBOS/Engines/AutonomousOperationsEngine.ts", engine), ("Backend/HBOS/test/AutonomousOperationsEngine.test.ts", test)]


def reasoning_bridge_artifacts():
    adapter = '''import { ReasoningEngine } from "../../Engines/ReasoningEngine";
import { ReasoningProvider } from "./ReasoningProvider";

export interface PythonReasoningResult { provider: "python"; problem: string; status: string; success: boolean; }

export class PythonReasoningAdapter implements ReasoningProvider {
    private readonly engine = new ReasoningEngine();
    async reason(prompt: string): Promise<PythonReasoningResult> {
        const result = this.engine.reason(prompt);
        return { provider: "python", problem: result.problem, status: result.status, success: result.success };
    }
}
'''
    test = '''import { PythonReasoningAdapter } from "../Assistant/Autonomous/PythonReasoningAdapter";

test("PythonReasoningAdapter uses the repository-owned Python reasoning runtime", async () => {
    const result = await new PythonReasoningAdapter().reason("evaluate autonomous mission context");
    expect(result.provider).toBe("python");
    expect(result.problem).toBe("evaluate autonomous mission context");
    expect(result.status).toBe("reasoned");
    expect(result.success).toBe(true);
});
'''
    return [("Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts", adapter), ("Backend/HBOS/test/PythonReasoningAdapter.test.ts", test)]


CAPABILITIES = {
    **{key: platform_artifacts(key) for key in PLATFORM_CAPABILITIES},
    "engine.reasoning.canonical": reasoning_artifacts(),
    "engine.organizational.canonical": organizational_artifacts(),
    "engine.autonomous-operations.canonical": autonomous_operations_artifacts(),
    "runtime.reasoning.bridge": reasoning_bridge_artifacts(),
}

CAPABILITY_DEPENDENCIES = {
    "platform.user-management": [],
    "platform.organization-model": PLATFORM_DEPENDENCIES["platform.organization-model"],
    "platform.security-layer": PLATFORM_DEPENDENCIES["platform.security-layer"],
    "engine.reasoning.canonical": [],
    "engine.organizational.canonical": [],
    "engine.autonomous-operations.canonical": [],
    "runtime.reasoning.bridge": [
        "Backend/HBOS/Engines/ReasoningEngine.ts",
        "Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts",
        "Backend/HBOS/test/PythonReasoningAdapter.test.ts",
        "Backend/AI_Runtime/reasoning/reasoning_engine.py",
    ],
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--repair", action="store_true")
    parser.add_argument("--issue", default="")
    args = parser.parse_args()
    match = re.search(r"Capability ID:\s*([^\n]+)", args.prompt)
    capability_id = match.group(1).strip() if match else ""
    artifacts = CAPABILITIES.get(capability_id)

    # The explicit generators remain authoritative for frozen canonical work.
    # The generic path is the escape hatch that makes the worker capable of
    # constructing a new engine boundary without a new hard-coded branch.
    if artifacts is None:
        spec = spec_from_prompt(args.prompt)
        if spec is None:
            print("Invalid autonomous capability contract")
            return 2
        artifacts = generic_artifacts(spec)

    missing = []
    if capability_id in CAPABILITY_DEPENDENCIES:
        missing = [p for p in CAPABILITY_DEPENDENCIES[capability_id] if not (ROOT / p).exists()]
    if missing:
        print(f"Blocked by unmet dependencies for {capability_id}: {', '.join(missing)}")
        return 3

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
