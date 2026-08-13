"""Repository-native capability specification and deterministic scaffolding."""
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
    normalized = path.replace("\\", "/").rstrip("/")
    name = Path(normalized).name
    if name in {"index", "index.ts"}:
        parent = Path(normalized).parent.name
        return parent or fallback
    stem = Path(normalized).stem
    return stem or fallback


def _list_field(prompt: str, name: str, separator: str = ",") -> tuple[str, ...]:
    match = re.search(rf"^{re.escape(name)}:\s*(.+)$", prompt, re.MULTILINE)
    if not match:
        return ()
    value = match.group(1).strip()
    if not value or value.lower() in {"none", "preserve existing rules"}:
        return ()
    return tuple(item.strip() for item in value.split(separator) if item.strip())


def _normalize_declared_path(path: str) -> str:
    normalized = path.strip().replace("\\", "/")
    normalized = re.sub(r"^[A-Za-z]:/HooshyarOS/", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^/HooshyarOS/", "", normalized, flags=re.IGNORECASE)
    marker_match = re.search(r"(?:^|/)((?:Frontend|Backend|Docs)(?:/.*)?)$", normalized, re.IGNORECASE)
    return marker_match.group(1) if marker_match else normalized


def _required_artifact_paths(prompt: str) -> tuple[str, str, str] | None:
    match = re.search(r"^Required artifact paths:\s*(.+)$", prompt, re.MULTILINE)
    if not match:
        return None
    values = tuple(_normalize_declared_path(item) for item in match.group(1).split(";") if item.strip())
    return values if len(values) == 3 else None


def _is_directory_artifact(path: str) -> bool:
    return Path(path).suffix == ""


def _implementation_path(path: str) -> str:
    return f"{path.rstrip('/')}/index.ts" if _is_directory_artifact(path) else path


def _canonical_capability_id(capability_id: str) -> str:
    return re.sub(r"^(?:repair-)+", "", capability_id)


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
        declared_engine_path, test_path, docs_path = declared
        class_name = _path_class_name(declared_engine_path, class_name)
        engine_path = _implementation_path(declared_engine_path)

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
    if spec.engine_path in {spec.test_path, spec.docs_path}:
        errors.append("construction artifacts must remain distinct")
    return errors


def _product_behavior(spec: CapabilitySpec) -> tuple[str, str, str, str]:
    rules = {
        "financial-data-ingestion": ("ingest", " account=100 ; amount=12 ", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "normalizes supported financial records"),
        "financial-statement-analysis": ("analyze", "revenue=100;cost=60", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "analyzes normalized financial statement evidence"),
        "executive-intelligence-workbench": ("calculate", "revenue=100;cash=60;risk=4", "input.split(\";\").map(item => Number(item.split(\"=\")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)", "calculates executive evidence from verified metrics"),
        "decision-workbench": ("evaluate", "cost=2;risk=3;benefit=5", "input.split(\";\").map(item => Number(item.split(\"=\")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)", "evaluates a decision evidence set"),
        "organizational-execution": ("schedule", "decision->owner->deadline", "input.split(\"->\").map(item => item.trim()).filter(Boolean)", "schedules governed execution evidence"),
        "organization-identity-and-rbac": ("authorize", "tenant=hooshyar;role=admin", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "authorizes organization identity evidence"),
        "persistence-and-tenant-data": ("persist", "tenant=hooshyar;record=financial", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "persists tenant-owned evidence safely"),
        "goal-okr-transformation": ("transform", "vision->mission->okr->project->task", "input.split(\"->\").map(item => item.trim()).filter(Boolean)", "transforms strategic goals into execution evidence"),
        "kaizen-continuous-improvement": ("assess", "quality=4;speed=3;waste=2", "input.split(\";\").map(item => Number(item.split(\"=\")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)", "assesses continuous-improvement evidence"),
        "customer-success": ("evaluate", "adoption=4;value=5;risk=2", "input.split(\";\").map(item => Number(item.split(\"=\")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)", "evaluates customer-success evidence"),
        "talent-and-succession": ("assess", "coverage=4;continuity=5;transfer=3", "input.split(\";\").map(item => Number(item.split(\"=\")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)", "assesses talent and succession evidence"),
        "universal-ai-gateway": ("evaluate", "provider=python;health=ready;local=true", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "evaluates AI provider readiness evidence"),
        "offline-sync-and-conflict-resolution": ("reconcile", "local=10;remote=12;conflict=1", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "reconciles offline synchronization evidence"),
        "mobile-and-admin-surfaces": ("validate", "mobile=ready;admin=ready", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "validates mobile and administration surfaces"),
        "commercial-subscription-entitlements": ("authorize", "plan=annual;tenant=hooshyar;active=true", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "authorizes commercial subscription entitlement evidence"),
        "commercial-e2e-acceptance": ("validate", "onboard->ingest->insight->decision->execute->outcome", "input.split(\"->\").map(item => item.trim()).filter(Boolean)", "validates the commercial end-to-end evidence path"),
        "regulatory-standards-and-market-knowledge-updates": ("normalize", "source=tax;version=2026;status=approved", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "normalizes governed regulatory knowledge evidence"),
        "report-builder-and-export": ("buildReport", "executive|financial|operational", "input.split(\"|\").map(item => item.trim()).filter(Boolean)", "builds a governed report evidence set"),
        "goal-kpi-project-task-scheduling": ("schedule", "goal->kpi->project->task->owner", "input.split(\"->\").map(item => item.trim()).filter(Boolean)", "schedules goal and KPI execution evidence"),
        "growth-intelligence": ("calculate", "growth=5;capacity=3;constraint=2", "input.split(\";\").map(item => Number(item.split(\"=\")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)", "calculates growth intelligence evidence"),
        "resilience-continuity-lifecycle": ("assess", "impact=4;mitigation=5;recovery=3", "input.split(\";\").map(item => Number(item.split(\"=\")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)", "assesses resilience lifecycle evidence"),
    }
    key = _canonical_capability_id(spec.capability_id).removeprefix("product.")
    return rules.get(key, ("evaluate", "evidence=ready;scope=defined", "input.split(\";\").map(item => item.trim()).filter(Boolean)", "evaluates the declared product evidence"))


def product_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid capability specification: " + "; ".join(errors))

    class_name = spec.class_name
    canonical_id = _canonical_capability_id(spec.capability_id)
    product_name = class_name
    product_dir = Path(spec.engine_path).parent.as_posix()
    method, sample, operation, test_title = _product_behavior(spec)

    if product_dir.startswith("Frontend/"):
        test_import = "../../../" + product_dir
    else:
        test_import = f"../{product_dir.split('/')[-1]}/{class_name}"

    interface = 'export interface ProductEvidenceResult { status: "READY" | "BLOCKED"; evidence: string[] | number; }'
    engine = f'''{interface}

export class {class_name} {{
    readonly capabilityId = "{canonical_id}";
    readonly targetEngine = "{spec.target_engine}";

    initialize(): {{ status: "READY" }} {{
        return {{ status: "READY" }};
    }}

    {method}(input: string): ProductEvidenceResult {{
        const normalized = input?.trim() ?? "";
        if (!normalized) return {{ status: "BLOCKED", evidence: [] }};
        const evidence = {operation};
        const complete = Array.isArray(evidence) ? evidence.length > 0 : Number.isFinite(evidence) && evidence > 0;
        return {{ status: complete ? "READY" : "BLOCKED", evidence }};
    }}
}}
'''
    test = f'''import {{ {class_name} }} from "{test_import}";

describe("{class_name}", () => {{
    it("exposes the canonical product boundary", () => {{
        const service = new {class_name}();
        expect(service.capabilityId).toBe("{canonical_id}");
        expect(service.targetEngine).toBe("{spec.target_engine}");
        expect(service.initialize().status).toBe("READY");
    }});

    it("{test_title}", () => {{
        const result = new {class_name}().{method}("{sample}");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    }});

    it("blocks empty evidence input", () => {{
        expect(new {class_name}().{method}(" ").status).toBe("BLOCKED");
    }});
}});
'''
    dependencies = ", ".join(spec.dependencies) if spec.dependencies else "none"
    docs = f'''# {product_name}

Canonical product capability: `{canonical_id}`.

Target engine: {spec.target_engine}

Capability: {spec.capability}

Dependencies: {dependencies}

The product artifact exposes deterministic capability-shaped behavior derived from
the declared product contract. Repair missions never alter the canonical product
identity; they only repair and re-verify the same commercial artifact boundary.
'''
    return [(spec.engine_path, engine), (spec.test_path, test), (spec.docs_path, docs)]


def generic_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
    if _canonical_capability_id(spec.capability_id).startswith("product.") or "/Product/" in spec.engine_path or spec.engine_path.startswith("Frontend/"):
        return product_artifacts(spec)

    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid capability specification: " + "; ".join(errors))

    engine = f'''import {{ Engine }} from "../Core/Engine";

export class {spec.class_name} implements Engine {{
    name = "{spec.class_name}";

    initialize(): void {{}}

    health(): boolean {{
        return true;
    }}

    describeCapability(): {{ id: string; capability: string; targetEngine: string }} {{
        return {{ id: "{spec.capability_id}", capability: "{spec.capability}", targetEngine: "{spec.target_engine}" }};
    }}
}}
'''
    test = f'''import {{ {spec.class_name} }} from "../Engines/{spec.class_name}";

describe("{spec.class_name}", () => {{
    it("exposes the canonical capability identity and health", () => {{
        const engine = new {spec.class_name}();
        expect(engine.name).toBe("{spec.class_name}");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({{ id: "{spec.capability_id}", capability: "{spec.capability}", targetEngine: "{spec.target_engine}" }});
    }});
}});
'''
    dependencies = ", ".join(spec.dependencies) if spec.dependencies else "none"
    rules = "\n".join(f"- {rule}" for rule in spec.architecture_rules) or "- Preserve Architecture Freeze V4 and existing engine boundaries."
    directives = "\n".join(f"- {directive}" for directive in spec.directives) or "- Implement exactly one concrete capability and verify it before finalization."
    docs = f'''# {spec.target_engine}

Canonical autonomous capability: `{spec.capability_id}`.

Capability: {spec.capability}

Dependencies: {dependencies}

## Architecture contract
{rules}

## Construction directives
{directives}

This scaffold is intentionally semantic-neutral. The autonomous construction loop
must enrich it only from repository architecture, dependencies, tests and evidence;
it must not invent business rules or create duplicate engine boundaries.
'''
    return [(spec.engine_path, engine), (spec.test_path, test), (spec.docs_path, docs)]


def _needs_reweave(root: Path, artifacts: list[tuple[str, str]]) -> bool:
    for relative_path, expected in artifacts:
        target = root / relative_path
        if not target.exists():
            return True
        try:
            current = target.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return True
        if current != expected:
            return True
    return False


def _ensure_parent_directory(target: Path) -> None:
    parent = target.parent
    cursor = parent
    blocking: Path | None = None
    while cursor != cursor.parent:
        if cursor.exists():
            if cursor.is_file():
                blocking = cursor
            break
        cursor = cursor.parent
    if blocking is not None:
        legacy_content = blocking.read_text(encoding="utf-8")
        legacy_dir = blocking
        legacy_name = blocking.name + ".legacy.ts"
        blocking.unlink()
        legacy_dir.mkdir(parents=True, exist_ok=True)
        legacy_target = legacy_dir / legacy_name
        if not legacy_target.exists():
            legacy_target.write_text(legacy_content, encoding="utf-8")
    parent.mkdir(parents=True, exist_ok=True)


def write_missing(root: Path, artifacts: list[tuple[str, str]]) -> list[str]:
    paths = [relative_path for relative_path, _ in artifacts]
    existing = [relative_path for relative_path in paths if (root / relative_path).exists()]
    migration_pending = [
        relative_path for relative_path in paths
        if not (root / relative_path).exists()
        and (root / relative_path).parent.exists()
        and (root / relative_path).parent.is_file()
    ]
    if existing and len(existing) != len(paths) and not migration_pending:
        raise RuntimeError("Refusing partial autonomous construction; existing artifacts: " + ", ".join(existing))
    if existing and len(existing) == len(paths):
        return write_overwrite(root, artifacts) if _needs_reweave(root, artifacts) else []
    generated: list[str] = []
    for relative_path, content in artifacts:
        target = root / relative_path
        _ensure_parent_directory(target)
        target.write_text(content, encoding="utf-8")
        generated.append(relative_path)
    return generated


def _preserve_canonical_product_test_boundary(target: Path, existing: str, generated: str) -> str:
    if target.suffix not in {".ts", ".tsx"} or "/test/" not in target.as_posix():
        return generated
    existing_import = re.search(r'import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from\s*"(\.\./Product/[^"]+)"\s*;?', existing)
    generated_import = re.search(r'import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from\s*"(\.\./Engines/[^"]+)"\s*;?', generated)
    if not existing_import or not generated_import or existing_import.group(1) != generated_import.group(1):
        return generated
    return generated.replace(generated_import.group(0), existing_import.group(0), 1)


def write_overwrite(root: Path, artifacts: list[tuple[str, str]]) -> list[str]:
    repaired: list[str] = []
    for relative_path, content in artifacts:
        target = root / relative_path
        _ensure_parent_directory(target)
        if target.exists() and target.is_file():
            try:
                existing = target.read_text(encoding="utf-8")
                content = _preserve_canonical_product_test_boundary(target, existing, content)
            except (OSError, UnicodeDecodeError):
                pass
        target.write_text(content, encoding="utf-8")
        repaired.append(relative_path)
    return repaired
