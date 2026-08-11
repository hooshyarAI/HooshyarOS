"""Repository-native capability specification and generic scaffolding.

This module deliberately stays deterministic: it turns the canonical mission
contract into a small, testable construction specification without inventing
business semantics. Domain-specific implementations remain the responsibility
of the architecture-aware mission and its evidence contracts.
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
    class_name: str
    engine_path: str
    test_path: str
    docs_path: str


def _class_name(target_engine: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", target_engine)
    return "".join(word[:1].upper() + word[1:] for word in words) or "AutonomousCapabilityEngine"


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
        class_name=class_name,
        engine_path=f"Backend/HBOS/Engines/{class_name}.ts",
        test_path=f"Backend/HBOS/test/{class_name}.test.ts",
        docs_path=f"Docs/Engines/{class_name}.md",
    )


def generic_artifacts(spec: CapabilitySpec) -> list[tuple[str, str]]:
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
    docs = f'''# {spec.target_engine}

Canonical autonomous capability: `{spec.capability_id}`.

Capability: {spec.capability}

This scaffold is intentionally semantic-neutral. The autonomous construction loop
must enrich it only from repository architecture, dependencies, tests and evidence;
it must not invent business rules.
'''
    return [(spec.engine_path, engine), (spec.test_path, test), (spec.docs_path, docs)]


def write_missing(root: Path, artifacts: list[tuple[str, str]]) -> list[str]:
    generated: list[str] = []
    for relative_path, content in artifacts:
        target = root / relative_path
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        generated.append(relative_path)
    return generated
