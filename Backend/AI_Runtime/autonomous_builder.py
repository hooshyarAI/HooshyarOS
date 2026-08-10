"""Repository-native autonomous construction worker.

This worker intentionally uses no Copilot, Codex, Claude, or cloud coding CLI.
It applies only deterministic capabilities declared by the HBOS mission
backlog and refuses unknown capabilities instead of inventing architecture.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REASONING_ENGINE = '''import { execFileSync } from "node:child_process";
import { Engine } from "../Core/Engine";

export interface ReasoningResult { problem: string; status: string; success: boolean; }

export class ReasoningEngine implements Engine {
    name = "ReasoningEngine";
    initialize(): void { console.log("ReasoningEngine Started"); }
    health(): boolean { return true; }
    reason(problem: string): ReasoningResult {
        if (!problem || !problem.trim()) return { problem, status: "invalid_problem", success: false };
        const python = process.env.HOOSHYAR_PYTHON || "python";
        const script = [
            "import json, sys",
            "from Backend.AI_Runtime.reasoning.reasoning_engine import ReasoningEngine as PythonReasoningEngine",
            "result = PythonReasoningEngine().reason(sys.argv[1])",
            "print(json.dumps(result, ensure_ascii=False))"
        ].join("; ");
        try {
            const raw = execFileSync(python, ["-c", script, problem], { cwd: process.cwd(), encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
            const result = JSON.parse(raw) as { problem: string; status: string };
            return { problem: result.problem, status: result.status, success: true };
        } catch { return { problem, status: "reasoning_failed", success: false }; }
    }
}
'''

REASONING_TEST = '''import { ReasoningEngine } from "../Engines/ReasoningEngine";

describe("ReasoningEngine", () => {
    it("rejects an empty problem", () => {
        expect(new ReasoningEngine().reason(" ")).toEqual({ problem: " ", status: "invalid_problem", success: false });
    });
});
'''

ORGANIZATIONAL_ENGINE = '''import { Engine } from "../Core/Engine";
import { MemoryEngine } from "./MemoryEngine";
import { KnowledgeEngine } from "./KnowledgeEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";

export class OrganizationalIntelligenceEngine implements Engine {
    name = "OrganizationalIntelligenceEngine";
    private readonly memory = new MemoryEngine();
    private readonly knowledge = new KnowledgeEngine();
    private readonly projects = new ProjectPilotEngine();
    initialize(): void { this.memory.initialize(); this.knowledge.initialize(); this.projects.initialize(); console.log("OrganizationalIntelligenceEngine Started"); }
    health(): boolean { return true; }
    assess(scope = "organization") { return { scope, status: "READY" as const, projectCount: this.projects.getProjects().length, healthy: this.health() }; }
}
'''

ORGANIZATIONAL_TEST = '''import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";

describe("OrganizationalIntelligenceEngine", () => {
    it("reports a healthy assessment", () => {
        const result = new OrganizationalIntelligenceEngine().assess();
        expect(result.status).toBe("READY");
        expect(result.healthy).toBe(true);
    });
});
'''

AUTONOMOUS_ENGINE = '''import { Engine } from "../Core/Engine";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";
import { GovernanceEngine } from "./GovernanceEngine";

export class AutonomousOperationsEngine implements Engine {
    name = "AutonomousOperationsEngine";
    private readonly decisions = new DecisionEngine();
    private readonly projects = new ProjectPilotEngine();
    private readonly governance = new GovernanceEngine();
    initialize(): void { this.decisions.initialize(); this.projects.initialize(); this.governance.initialize(); console.log("AutonomousOperationsEngine Started"); }
    health(): boolean { return true; }
    execute(operation: string) { const status = operation && operation.trim() ? "READY" : "BLOCKED"; return { operation, status: status as "READY" | "BLOCKED", projectCount: this.projects.getProjects().length }; }
}
'''

AUTONOMOUS_TEST = '''import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";

describe("AutonomousOperationsEngine", () => {
    it("blocks an empty operation", () => {
        expect(new AutonomousOperationsEngine().execute(" ").status).toBe("BLOCKED");
    });
});
'''

PYTHON_REASONING_ADAPTER_TEST = '''import { execFileSync } from "node:child_process";
import { PythonReasoningAdapter } from "../Assistant/Autonomous/PythonReasoningAdapter";

jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

describe("PythonReasoningAdapter", () => {
    it("uses the repository-owned Python reasoning runtime", async () => {
        const mockedExec = execFileSync as jest.MockedFunction<typeof execFileSync>;
        mockedExec.mockReturnValue(JSON.stringify({ problem: "test problem", status: "reasoned" }) as never);
        const result = await new PythonReasoningAdapter().reason("test problem");
        expect(result).toEqual({ provider: "python", problem: "test problem", status: "reasoned", success: true });
        expect(mockedExec).toHaveBeenCalledTimes(1);
        expect(String(mockedExec.mock.calls[0][0])).toBe(process.env.HOOSHYAR_PYTHON || "python");
        expect(mockedExec.mock.calls[0][1]).toEqual(expect.arrayContaining(["-c", expect.stringContaining("Backend.AI_Runtime.reasoning.reasoning_engine")]));
    });
});
'''

CAPABILITIES = {
    "engine.reasoning.canonical": [
        ("Backend/HBOS/Engines/ReasoningEngine.ts", REASONING_ENGINE),
        ("Backend/HBOS/test/ReasoningEngine.test.ts", REASONING_TEST),
    ],
    "engine.organizational.canonical": [
        ("Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts", ORGANIZATIONAL_ENGINE),
        ("Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts", ORGANIZATIONAL_TEST),
    ],
    "engine.autonomous-operations.canonical": [
        ("Backend/HBOS/Engines/AutonomousOperationsEngine.ts", AUTONOMOUS_ENGINE),
        ("Backend/HBOS/test/AutonomousOperationsEngine.test.ts", AUTONOMOUS_TEST),
    ],
    "runtime.reasoning.bridge": [
        ("Backend/HBOS/test/PythonReasoningAdapter.test.ts", PYTHON_REASONING_ADAPTER_TEST),
    ],
}


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
