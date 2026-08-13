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


def _required_artifact_paths(prompt: str) -> tuple[str, str, str] | None:
    match = re.search(r"^Required artifact paths:\s*(.+)$", prompt, re.MULTILINE)
    if not match:
        return None
    values = tuple(item.strip() for item in match.group(1).split(";") if item.strip())
    if len(values) != 3:
        return None
    return values[0], values[1], values[2]


def _is_directory_artifact(path: str) -> bool:
    return Path(path).suffix == ""


def _implementation_path(path: str) -> str:
    return f"{path.rstrip('/')}/index.ts" if _is_directory_artifact(path) else path


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
    if spec.engine_path == spec.test_path or spec.engine_path == spec.docs_path:
        errors.append("construction artifacts must remain distinct")
    return errors


def product_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid capability specification: " + "; ".join(errors))

    class_name = spec.class_name
    product_name = class_name
    product_dir = Path(spec.engine_path).parent.as_posix()

    if product_dir.startswith("Frontend/"):
        test_import = "../../../" + product_dir
        test_import = test_import.replace("\\", "/")
    else:
        relative_product_import = "../" + product_dir.split("/")[-1]
        test_import = f"{relative_product_import}/{class_name}"

    if class_name == "FinancialDataIngestionAdapter":
        method = "ingest"
        interface = "export interface NormalizedFinancialRecord { [key: string]: unknown; }"
        method_body = "        return records.map((record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key.trim(), value])));"
        argument = "records: Record<string, unknown>[]"
        result_type = "NormalizedFinancialRecord[]"
    else:
        method = "execute"
        interface = "export interface ProductCapabilityResult { status: \"READY\" | \"BLOCKED\"; }"
        method_body = "        return { status: input && input.trim() ? \"READY\" : \"BLOCKED\" };"
        argument = "input: string"
        result_type = "ProductCapabilityResult"

    engine = f'''{interface}

export class {class_name} {{
    readonly capabilityId = "{spec.capability_id}";
    readonly targetEngine = "{spec.target_engine}";

    initialize(): {{ status: "READY" }} {{
        return {{ status: "READY" }};
    }}

    {method}({argument}): {result_type} {{
{method_body}
    }}
}}
'''

    if class_name == "FinancialDataIngestionAdapter":
        test = f'''import {{ {class_name} }} from "{test_import}";

describe("{class_name}", () => {{
    it("exposes the canonical product boundary", () => {{
        const adapter = new {class_name}();
        expect(adapter.capabilityId).toBe("{spec.capability_id}");
        expect(adapter.targetEngine).toBe("{spec.target_engine}");
        expect(adapter.initialize().status).toBe("READY");
    }});

    it("normalizes repository-supported record keys without inventing domain semantics", () => {{
        const result = new {class_name}().ingest([{{ " account ": "100", amount: 12 }}]);
        expect(result).toEqual([{{ account: "100", amount: 12 }}]);
    }});
}});
'''
    else:
        test = f'''import {{ {class_name} }} from "{test_import}";

describe("{class_name}", () => {{
    it("exposes the canonical product boundary", () => {{
        const service = new {class_name}();
        expect(service.capabilityId).toBe("{spec.capability_id}");
        expect(service.targetEngine).toBe("{spec.target_engine}");
        expect(service.initialize().status).toBe("READY");
    }});

    it("keeps its deterministic minimal contract", () => {{
        expect(new {class_name}().execute("continue").status).toBe("READY");
        expect(new {class_name}().execute(" ").status).toBe("BLOCKED");
    }});
}});
'''

    dependencies = ", ".join(spec.dependencies) if spec.dependencies else "none"
    docs = f'''# {product_name}

Canonical product capability: `{spec.capability_id}`.

Target engine: {spec.target_engine}

Capability: {spec.capability}

Dependencies: {dependencies}

The product artifact is intentionally kept outside the engine implementation boundary.
The autonomous worker may enrich this contract only from repository architecture,
tests, dependencies and durable product evidence.
'''
    return [(spec.engine_path, engine), (spec.test_path, test), (spec.docs_path, docs)]


def generic_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
    if spec.capability_id.startswith("product.") or "/Product/" in spec.engine_path or spec.engine_path.startswith("Frontend/"):
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
        return {{
            id: "{spec.capability_id}",
            capability: "{spec.capability}",
            targetEngine: "{spec.target_engine}"
        }};
    }}
}}
'''
    test = f'''import {{ {spec.class_name} }} from "../Engines/{spec.class_name}";

describe("{spec.class_name}", () => {{
    it("exposes the canonical capability identity and health", () => {{
        const engine = new {spec.class_name}();
        expect(engine.name).toBe("{spec.class_name}");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({{
            id: "{spec.capability_id}",
            capability: "{spec.capability}",
            targetEngine: "{spec.target_engine}"
        }});
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
        if _needs_reweave(root, artifacts):
            return write_overwrite(root, artifacts)
        return []

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
    existing_import = re.search(
        r'import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from\s*"(\.\./Product/[^"]+)"\s*;?',
        existing,
    )
    generated_import = re.search(
        r'import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from\s*"(\.\./Engines/[^"]+)"\s*;?',
        generated,
    )
    if not existing_import or not generated_import:
        return generated
    if existing_import.group(1) != generated_import.group(1):
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
