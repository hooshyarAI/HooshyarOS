"""Repository-native autonomous construction worker.

This worker intentionally uses no Copilot, Codex, Claude, or cloud coding CLI.
It applies only the deterministic capabilities declared by the HBOS mission
backlog and refuses unknown capabilities instead of inventing architecture.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

REASONING_ENGINE = '''import { execFileSync } from "node:child_process";
import { Engine } from "../Core/Engine";

export interface ReasoningResult {
    problem: string;
    status: string;
    success: boolean;
}

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
        } catch {
            return { problem, status: "reasoning_failed", success: false };
        }
    }
}
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

    initialize(): void {
        this.memory.initialize();
        this.knowledge.initialize();
        this.projects.initialize();
        console.log("OrganizationalIntelligenceEngine Started");
    }

    health(): boolean { return true; }

    assess(scope = "organization") {
        return { scope, status: "READY" as const, projectCount: this.projects.getProjects().length, healthy: this.health() };
    }
}
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

    initialize(): void {
        this.decisions.initialize();
        this.projects.initialize();
        this.governance.initialize();
        console.log("AutonomousOperationsEngine Started");
    }

    health(): boolean { return true; }

    execute(operation: string) {
        const status = operation && operation.trim() ? "READY" : "BLOCKED";
        return { operation, status: status as "READY" | "BLOCKED", projectCount: this.projects.getProjects().length };
    }
}
'''

CAPABILITIES = {
    "engine.reasoning.canonical": ("Backend/HBOS/Engines/ReasoningEngine.ts", REASONING_ENGINE),
    "engine.organizational.canonical": ("Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts", ORGANIZATIONAL_ENGINE),
    "engine.autonomous-operations.canonical": ("Backend/HBOS/Engines/AutonomousOperationsEngine.ts", AUTONOMOUS_ENGINE),
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    args = parser.parse_args()

    match = re.search(r"Capability ID:\s*([^\n]+)", args.prompt)
    capability_id = match.group(1).strip() if match else ""
    capability = CAPABILITIES.get(capability_id)
    if capability is None:
        print(f"Unsupported deterministic capability: {capability_id}")
        return 2

    relative_path, content = capability
    target = ROOT / relative_path
    if target.exists():
        print(f"Already implemented: {relative_path}")
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"Generated: {relative_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
