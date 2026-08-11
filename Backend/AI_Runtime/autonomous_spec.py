"""Repository-native capability specification and generic scaffolding.

The construction worker consumes the same mission contract used by HBOS:
capability identity, target engine, dependencies, architecture rules and
construction directives.  It never invents domain semantics; it only turns a
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


def _list_field(prompt: str, name: str, separator: str = ",") -> tuple[str, ...]:
    match = re.search(rf"^{re.escape(name)}:\s*(.+)$", prompt, re.MULTILINE)
    if not match:
        return ()
    value = match.group(1).strip()
    if not value or value.lower() in {"none", "preserve existing rules"}:
        return ()
    return tuple(item.strip() for item in value.split(separator) if item.strip())


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
    return CapabilitySpec(
        capability_id=capability_id,
        capability=capability,
        target_engine=target_engine,
        dependencies=_list_field(prompt, "Dependencies"),
        architecture_rules=_list_field(prompt, "Architecture rules", separator=";"),
        directives=_list_field(prompt, "Directives", separator=";"),
        class_name=class_name,
        engine_path=f"Backend/HBOS/Engines/{class_name}.ts",
        test_path=f"Backend/HBOS/test/{class_name}.test.ts",
        docs_path=f"Docs/Engines/{class_name}.md",
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


def generic_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
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


def write_missing(root: Path, artifacts: list[tuple[str, str]]) -> list[str]:
    paths = [relative_path for relative_path, _ in artifacts]
    existing = [relative_path for relative_path in paths if (root / relative_path).exists()]
    if existing and len(existing) != len(paths):
        raise RuntimeError("Refusing partial autonomous construction; existing artifacts: " + ", ".join(existing))
    if existing:
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
