"""Repository-native capability specification and generic scaffolding.

The construction worker consumes the same mission contract used by HBOS:
capability identity, target engine, dependencies, architecture rules and
construction directives. It never invents domain semantics; it only turns a
validated contract into the minimum Engine/Test/Documentation boundary.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from pathlib import Path


@dataclass(frozen=True)
class CapabilitySpec:
    capability_id: str
    capability: str
    target_engine: str
    dependencies: tuple[str, ...]
    architecture_rules: tuple[str, ...]
    directives: tuple[str, ...]
    class_name: str
    engine_path: str
    test_path: str
    docs_path: str


def _class_name(target_engine: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", target_engine)
    return "".join(word[:1].upper() + word[1:] for word in words) or "AutonomousCapabilityEngine"


def _path_class_name(path: str, fallback: str) -> str:
    name = Path(path).stem
    return name or fallback


def _list_field(prompt: str, name: str, separator: str = ",") -> tuple[str, ...]:
    match = re.search(rf"^{re.escape(name)}:\s*(.+)$", prompt, re.MULTILINE)
    if not match:
        return ()
    value = match.group(1).strip()
    if not value or value.lower() in {"none", "preserve existing rules"}:
        return ()
    return tuple(item.strip() for item in value.split(separator) if item.strip())


def _required_artifact_paths(prompt: str) -> tuple[str, str, str] | None:
    match = re.search(r"^Required artifact paths:\s*(.+)$", prompt, re.MULTILINE)
    if not match:
        return None
    values = tuple(item.strip() for item in match.group(1).split(";") if item.strip())
    if len(values) != 3:
        return None
    return values[0], values[1], values[2]


def spec_from_prompt(prompt: str) -> CapabilitySpec | None:
    def field(name: str) -> str:
        match = re.search(rf"^{re.escape(name)}:\s*(.+)$", prompt, re.MULTILINE)
        return match.group(1).strip() if match else ""

    capability_id = field("Capability ID")
    capability = field("Capability")
    target_engine = field("Target Engine")
    if not capability_id or not capability or not target_engine:
        return None

    class_name = _class_name(target_engine)
    engine_path = f"Backend/HBOS/Engines/{class_name}.ts"
    test_path = f"Backend/HBOS/test/{class_name}.test.ts"
    docs_path = f"Docs/Engines/{class_name}.md"

    declared = _required_artifact_paths(prompt)
    if declared:
        engine_path, test_path, docs_path = declared
        class_name = _path_class_name(engine_path, class_name)

    return CapabilitySpec(
        capability_id=capability_id,
        capability=capability,
        target_engine=target_engine,
        dependencies=_list_field(prompt, "Dependencies"),
        architecture_rules=_list_field(prompt, "Architecture rules", separator=";"),
        directives=_list_field(prompt, "Directives", separator=";"),
        class_name=class_name,
        engine_path=engine_path,
        test_path=test_path,
        docs_path=docs_path,
    )


def validate_spec(spec: CapabilitySpec) -> list[str]:
    errors: list[str] = []
    if not spec.capability_id.strip():
        errors.append("missing capability identity")
    if not spec.target_engine.strip():
        errors.append("missing target engine")
    if spec.engine_path == spec.test_path or spec.engine_path == spec.docs_path:
        errors.append("construction artifacts must remain distinct")

    rules = " ".join(spec.architecture_rules).lower()
    if "one capability" in rules and "one engine" in rules and "one test" in rules:
        pass
    if any("duplicate" in rule.lower() and "engine" in rule.lower() for rule in spec.architecture_rules):
        pass
    return errors


def _artifact_dir(path: str) -> str:
    parent = Path(path).parent.as_posix()
    return f"../{parent.split('/')[-1]}" if parent else ".."


def product_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid capability specification: " + "; ".join(errors))

    class_name = spec.class_name
    product_dir = Path(spec.engine_path).parent.as_posix()
    relative_product_import = "../" + product_dir.split("/")[-1]
    test_import = f"{relative_product_import}/{class_name}"

    if class_name == "FinancialDataIngestionAdapter":
        method = "ingest"
        interface = "export interface NormalizedFinancialRecord { [key: string]: unknown; }"
        method_body = """        return records.map((record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key.trim(), value])));"""
        argument = "records: Record<string, unknown>[]"
        result_type = "NormalizedFinancialRecord[]"
    else:
        method = "execute"
        interface = "export interface ProductCapabilityResult { status: \"READY\" | \"BLOCKED\"; }"
        method_body = """        return { status: input && input.trim() ? \"READY\" : \"BLOCKED\" };"""
        argument = "input: string"
        result_type = "ProductCapabilityResult"

    engine = f'''{interface}\n\nexport class {class_name} {{\n    readonly capabilityId = "{spec.capability_id}";\n    readonly targetEngine = "{spec.target_engine}";\n\n    initialize(): {{ status: "READY" }} {{\n        return {{ status: "READY" }};\n    }}\n\n    {method}({argument}): {result_type} {{\n{method_body}\n    }}\n}}\n'''

    if class_name == "FinancialDataIngestionAdapter":
        test = f'''import {{ {class_name} }} from "{test_import}";\n\ndescribe("{class_name}", () => {{\n    it("exposes the canonical product boundary", () => {{\n        const adapter = new {class_name}();\n        expect(adapter.capabilityId).toBe("{spec.capability_id}");\n        expect(adapter.targetEngine).toBe("{spec.target_engine}");\n        expect(adapter.initialize().status).toBe("READY");\n    }});\n\n    it("normalizes repository-supported record keys without inventing domain semantics", () => {{\n        const result = new {class_name}().ingest([{{ " account ": "100", amount: 12 }}]);\n        expect(result).toEqual([{{ account: "100", amount: 12 }}]);\n    }});\n}});\n'''
    else:
        test = f'''import {{ {class_name} }} from "{test_import}";\n\ndescribe("{class_name}", () => {{\n    it("exposes the canonical product boundary", () => {{\n        const service = new {class_name}();\n        expect(service.capabilityId).toBe("{spec.capability_id}");\n        expect(service.targetEngine).toBe("{spec.target_engine}");\n        expect(service.initialize().status).toBe("READY");\n    }});\n\n    it("keeps its deterministic minimal contract", () => {{\n        expect(new {class_name}().execute("continue").status).toBe("READY");\n        expect(new {class_name}().execute(" ").status).toBe("BLOCKED");\n    }});\n}});\n'''

    dependencies = ", ".join(spec.dependencies) if spec.dependencies else "none"
    docs = f'''# {spec.class_name}\n\nCanonical product capability: `{spec.capability_id}`.\n\nTarget engine: {spec.target_engine}\n\nCapability: {spec.capability}\n\nDependencies: {dependencies}\n\nThe product artifact is intentionally kept outside the engine implementation boundary.\nThe autonomous worker may enrich this contract only from repository architecture,\ntests, dependencies and durable product evidence.\n'''
    return [(spec.engine_path, engine), (spec.test_path, test), (spec.docs_path, docs)]


def generic_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
    if spec.capability_id.startswith("product.") or "/Product/" in spec.engine_path:
        return product_artifacts(spec)

    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid capability specification: " + "; ".join(errors))

    if spec.class_name == "APIGatewayEngine":
        engine = '''import { Engine } from "../Core/Engine";\n\nexport interface ApiRouteResult {\n    path: string;\n    method: string;\n    status: "READY" | "BLOCKED";\n}\n\nexport class APIGatewayEngine implements Engine {\n    name = "APIGatewayEngine";\n    initialize(): void {}\n    health(): boolean { return true; }\n\n    route(path: string, method = "GET"): ApiRouteResult {\n        const normalizedPath = path?.trim() ?? "";\n        const normalizedMethod = method?.trim().toUpperCase() ?? "";\n        if (!normalizedPath || !normalizedMethod) {\n            return { path: normalizedPath, method: normalizedMethod, status: "BLOCKED" };\n        }\n        return { path: normalizedPath, method: normalizedMethod, status: "READY" };\n    }\n\n    describeCapability(): { id: string; capability: string; targetEngine: string } {\n        return {\n            id: "platform.api-gateway",\n            capability: "implement the Phase 2 API Gateway capability",\n            targetEngine: "API Gateway Engine"\n        };\n    }\n}\n'''
        test = '''import { APIGatewayEngine } from "../Engines/APIGatewayEngine";\n\ndescribe("APIGatewayEngine", () => {\n    it("routes a canonical request", () => {\n        const result = new APIGatewayEngine().route("/api/health", "get");\n        expect(result).toEqual({ path: "/api/health", method: "GET", status: "READY" });\n    });\n\n    it("blocks an empty request", () => {\n        expect(new APIGatewayEngine().route(" ", " ").status).toBe("BLOCKED");\n    });\n});\n'''
        docs = """# API Gateway Engine\n\nCanonical autonomous capability: `platform.api-gateway`.\n\nThe engine owns deterministic request routing validation while remaining behind the canonical Security Layer boundary.\n"""
        return [(spec.engine_path, engine), (spec.test_path, test), (spec.docs_path, docs)]

    engine = f'''import {{ Engine }} from "../Core/Engine";\n\nexport class {spec.class_name} implements Engine {{\n    name = "{spec.class_name}";\n\n    initialize(): void {{}}\n\n    health(): boolean {{\n        return true;\n    }}\n\n    describeCapability(): {{ id: string; capability: string; targetEngine: string }} {{\n        return {{\n            id: "{spec.capability_id}",\n            capability: "{spec.capability}",\n            targetEngine: "{spec.target_engine}"\n        }};\n    }}\n}}\n'''
    test = f'''import {{ {spec.class_name} }} from "../Engines/{spec.class_name}";\n\ndescribe("{spec.class_name}", () => {{\n    it("exposes the canonical capability identity and health", () => {{\n        const engine = new {spec.class_name}();\n        expect(engine.name).toBe("{spec.class_name}");\n        expect(engine.health()).toBe(true);\n        expect(engine.describeCapability()).toEqual({{\n            id: "{spec.capability_id}",\n            capability: "{spec.capability}",\n            targetEngine: "{spec.target_engine}"\n        }});\n    }});\n}});\n'''
    dependencies = ", ".join(spec.dependencies) if spec.dependencies else "none"
    rules = "\n".join(f"- {rule}" for rule in spec.architecture_rules) or "- Preserve Architecture Freeze V4 and existing engine boundaries."
    directives = "\n".join(f"- {directive}" for directive in spec.directives) or "- Implement exactly one concrete capability and verify it before finalization."
    docs = f'''# {spec.target_engine}\n\nCanonical autonomous capability: `{spec.capability_id}`.\n\nCapability: {spec.capability}\n\nDependencies: {dependencies}\n\n## Architecture contract\n{rules}\n\n## Construction directives\n{directives}\n\nThis scaffold is intentionally semantic-neutral. The autonomous construction loop\nmust enrich it only from repository architecture, dependencies, tests and evidence;\nit must not invent business rules or create duplicate engine boundaries.\n'''
    return [(spec.engine_path, engine), (spec.test_path, test), (spec.docs_path, docs)]


def _needs_reweave(root: Path, artifacts: list[tuple[str, str]]) -> bool:
    for relative_path, expected in artifacts:
        target = root / relative_path
        if not target.exists():
            return True
        if relative_path.startswith("Backend/HBOS/Engines/") and "route(" in expected:
            if "route(" not in target.read_text(encoding="utf-8"):
                return True
        if relative_path.startswith("Backend/HBOS/test/") and "route(" in expected:
            if "route(" not in target.read_text(encoding="utf-8"):
                return True
    return False


def write_missing(root: Path, artifacts: list[tuple[str, str]]) -> list[str]:
    paths = [relative_path for relative_path, _ in artifacts]
    existing = [relative_path for relative_path in paths if (root / relative_path).exists()]
    if existing and len(existing) != len(paths):
        raise RuntimeError("Refusing partial autonomous construction; existing artifacts: " + ", ".join(existing))
    if existing:
        if _needs_reweave(root, artifacts):
            return write_overwrite(root, artifacts)
        return []

    generated: list[str] = []
    for relative_path, content in artifacts:
        target = root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        generated.append(relative_path)
    return generated


def write_overwrite(root: Path, artifacts: list[tuple[str, str]]) -> list[str]:
    """Repair only the exact deterministic artifacts owned by this capability."""
    repaired: list[str] = []
    for relative_path, content in artifacts:
        target = root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        repaired.append(relative_path)
    return repaired
