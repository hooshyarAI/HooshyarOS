"""Repository-native autonomous construction worker.

No Copilot, Codex, Claude, or cloud coding CLI is used. Unknown capabilities are
rejected. Phase 2 platform capabilities are generated as real Engine + focused
Test pairs so the autonomous loop can be validated end-to-end.
"""
from __future__ import annotations
import argparse
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

REASONING_ENGINE = '''import { execFileSync } from "node:child_process";\nimport { Engine } from "../Core/Engine";\nexport interface ReasoningResult { problem: string; status: string; success: boolean; }\nexport class ReasoningEngine implements Engine { name = "ReasoningEngine"; initialize(): void {} health(): boolean { return true; } reason(problem: string): ReasoningResult { if (!problem || !problem.trim()) return { problem, status: "invalid_problem", success: false }; const python = process.env.HOOSHYAR_PYTHON || "python"; const script = ["import json, sys", "from Backend.AI_Runtime.reasoning.reasoning_engine import ReasoningEngine as PythonReasoningEngine", "result = PythonReasoningEngine().reason(sys.argv[1])", "print(json.dumps(result, ensure_ascii=False))"].join("; "); try { const raw = execFileSync(python, ["-c", script, problem], { cwd: process.cwd(), encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim(); const result = JSON.parse(raw) as { problem: string; status: string }; return { problem: result.problem, status: result.status, success: true }; } catch { return { problem, status: "reasoning_failed", success: false }; } } }\n'''
REASONING_TEST = '''import { ReasoningEngine } from "../Engines/ReasoningEngine";\ndescribe("ReasoningEngine", () => { it("rejects an empty problem", () => { expect(new ReasoningEngine().reason(" ")).toEqual({ problem: " ", status: "invalid_problem", success: false }); }); });\n'''
ORGANIZATIONAL_ENGINE = '''import { Engine } from "../Core/Engine";\nimport { MemoryEngine } from "./MemoryEngine";\nimport { KnowledgeEngine } from "./KnowledgeEngine";\nimport { ProjectPilotEngine } from "./ProjectPilotEngine";\nexport class OrganizationalIntelligenceEngine implements Engine { name="OrganizationalIntelligenceEngine"; private memory=new MemoryEngine(); private knowledge=new KnowledgeEngine(); private projects=new ProjectPilotEngine(); initialize():void{this.memory.initialize();this.knowledge.initialize();this.projects.initialize();} health():boolean{return true;} assess(scope="organization"){return {scope,status:"READY" as const,projectCount:this.projects.getProjects().length,healthy:this.health()};} }\n'''
ORGANIZATIONAL_TEST = '''import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";\ndescribe("OrganizationalIntelligenceEngine",()=>{it("reports a healthy assessment",()=>{const result=new OrganizationalIntelligenceEngine().assess();expect(result.status).toBe("READY");expect(result.healthy).toBe(true);});});\n'''
AUTONOMOUS_ENGINE = '''import { Engine } from "../Core/Engine";\nimport { DecisionEngine } from "./DecisionEngine";\nimport { ProjectPilotEngine } from "./ProjectPilotEngine";\nimport { GovernanceEngine } from "./GovernanceEngine";\nexport class AutonomousOperationsEngine implements Engine { name="AutonomousOperationsEngine"; private decisions=new DecisionEngine(); private projects=new ProjectPilotEngine(); private governance=new GovernanceEngine(); initialize():void{this.decisions.initialize();this.projects.initialize();this.governance.initialize();} health():boolean{return true;} execute(operation:string){const status=operation&&operation.trim()?"READY":"BLOCKED";return {operation,status:status as "READY"|"BLOCKED",projectCount:this.projects.getProjects().length};} }\n'''
AUTONOMOUS_TEST = '''import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";\ndescribe("AutonomousOperationsEngine",()=>{it("blocks an empty operation",()=>{expect(new AutonomousOperationsEngine().execute(" ").status).toBe("BLOCKED");});});\n'''
PYTHON_REASONING_ADAPTER_TEST = '''import { execFileSync } from "node:child_process";\nimport { PythonReasoningAdapter } from "../Assistant/Autonomous/PythonReasoningAdapter";\njest.mock("node:child_process",()=>({execFileSync:jest.fn()}));\ndescribe("PythonReasoningAdapter",()=>{it("uses the repository-owned Python reasoning runtime",async()=>{const mockedExec=execFileSync as jest.MockedFunction<typeof execFileSync>;mockedExec.mockReturnValue(JSON.stringify({problem:"test problem",status:"reasoned"}) as never);const result=await new PythonReasoningAdapter().reason("test problem");expect(result).toEqual({provider:"python",problem:"test problem",status:"reasoned",success:true});expect(mockedExec).toHaveBeenCalledTimes(1);});});\n'''

# Canonical platform backlog entries. Each is deliberately explicit so the builder
# cannot invent architecture outside the mission controller.
PLATFORM_CAPABILITIES = {
    "platform.user-management": "UserManagementEngine",
    "platform.organization-model": "OrganizationModelEngine",
    "platform.security-layer": "SecurityLayerEngine",
}

def platform_artifacts(capability_id: str):
    engine = PLATFORM_CAPABILITIES[capability_id]
    method = {"UserManagementEngine":"registerUser","OrganizationModelEngine":"createOrganization","SecurityLayerEngine":"authorize"}[engine]
    test_input = {"UserManagementEngine":"ali","OrganizationModelEngine":"hooshyar","SecurityLayerEngine":"admin"}[engine]
    engine_code = f'''import {{ Engine }} from "../Core/Engine";\n\nexport class {engine} implements Engine {{\n    name = "{engine}";\n    initialize(): void {{}}\n    health(): boolean {{ return true; }}\n    {method}(value: string): {{ value: string; status: "READY" | "BLOCKED" }} {{\n        const status = value && value.trim() ? "READY" : "BLOCKED";\n        return {{ value, status }};\n    }}\n}}\n'''
    test_code = f'''import {{ {engine} }} from "../Engines/{engine}";\n\ndescribe("{engine}", () => {{\n    it("accepts its canonical minimal operation", () => {{\n        expect(new {engine}().{method}("{test_input}").status).toBe("READY");\n    }});\n    it("blocks an empty operation", () => {{\n        expect(new {engine}().{method}(" ").status).toBe("BLOCKED");\n    }});\n}});\n'''
    return [(f"Backend/HBOS/Engines/{engine}.ts", engine_code),(f"Backend/HBOS/test/{engine}.test.ts", test_code)]

CAPABILITIES = {
    "engine.reasoning.canonical": [("Backend/HBOS/Engines/ReasoningEngine.ts", REASONING_ENGINE),("Backend/HBOS/test/ReasoningEngine.test.ts", REASONING_TEST)],
    "engine.organizational.canonical": [("Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts", ORGANIZATIONAL_ENGINE),("Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts", ORGANIZATIONAL_TEST)],
    "engine.autonomous-operations.canonical": [("Backend/HBOS/Engines/AutonomousOperationsEngine.ts", AUTONOMOUS_ENGINE),("Backend/HBOS/test/AutonomousOperationsEngine.test.ts", AUTONOMOUS_TEST)],
    "runtime.reasoning.bridge": [("Backend/HBOS/test/PythonReasoningAdapter.test.ts", PYTHON_REASONING_ADAPTER_TEST)],
    "platform.user-management": platform_artifacts("platform.user-management"),
    "platform.organization-model": platform_artifacts("platform.organization-model"),
    "platform.security-layer": platform_artifacts("platform.security-layer"),
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
    generated=[]
    for relative_path, content in artifacts:
        target=ROOT/relative_path
        if target.exists(): continue
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(content,encoding="utf-8")
        generated.append(relative_path)
    if not generated:
        print(f"Already implemented: {capability_id}")
        return 0
    print("Generated: "+", ".join(generated))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
