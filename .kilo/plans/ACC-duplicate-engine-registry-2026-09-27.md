# ACC ITEM — DUPLICATE `EngineRegistry` IMPLEMENTATIONS

Status: **REQUIRES_ARCHITECTURE_CHANGE_CONTROL**
Date: 2026-09-27
Branch: `fix/autonomous-product-factory`
HEAD: `90b90959`
Model: `deepseek/deepseek-flash`
Author: Kilo (bounded execution layer) — no code change made for this item

## CURRENT STATE
Two distinct classes both named `EngineRegistry` coexist in the frozen tree:

| File | Shape | Semantics |
| --- | --- | --- |
| `Backend/HBOS/Core/EngineRegistry.ts` | `private engines: Engine[]`; methods `register`, `initializeAll`, `healthReport`, `getEngine` | **Non-singleton**; instantiated per `HBOS`; no duplicate detection; no unregister; no health timestamps |
| `Backend/HBOS/Engines/EngineRegistry.ts` | `Map<string, Engine>`; private constructor + `getInstance`/`resetInstance`; `register` (throws on duplicate), `unregister`, `getEngine`, `getAllEngines`, `healthCheckAll` | **Process singleton**; used by lifecycle/health/orchestration |

## CONFLICTING IMPLEMENTATIONS / CONSUMERS
- `Backend/HBOS/Core/HBOS.ts:1,48` constructs `new EngineRegistry()` (Core) and registers all canonical engines; `boot()` calls `this.registry.initializeAll()`; `health()` calls `this.registry.healthReport()`.
- `Backend/HBOS/Engines/LifecycleManager.ts:2,59`, `Engines/HealthMonitorEngine.ts:3,25-72`, and `Engines/AutonomousOperationsEngine.ts:8,151` use the **Engines singleton** (`getInstance()`, `healthCheckAll`, `getAllEngines`).
- `Backend/HBOS/test/CanonicalIntelligenceEngines.test.ts:13` explicitly asserts "HBOS uses the canonical Core/EngineRegistry".
- `Backend/HBOS/test/EngineRegistry.phase-11-1.2.test.ts` and `Phase11-HostileQC.test.ts` exercise the **Engines singleton** contract extensively.

Consequence: at runtime the same engine can be registered in the Core array (by `HBOS`) **and** self-register in the Engines singleton (e.g. `AutonomousOperationsEngine.initialize()`), so there is no single source of truth for "what engines exist / are healthy". This is a lifecycle/ownership ambiguity, not merely cosmetic duplication.

## ARCHITECTURAL IMPACT
- No single canonical engine inventory or health authority.
- Two incompatible registration contracts (throw-on-duplicate vs. silent push) mean the same defect can be masked in one registry and surfaced in the other.
- `Core/HBOS.ts` and the `Engines` lifecycle/orchestration layer could disagree about engine membership and health.

## PROPOSED TARGET (for governance decision — not executed)
Pick one canonical owner and one contract, then make the other a thin, source-compatible adapter:
1. **Preferred:** promote the richer singleton (`Engines/EngineRegistry`) to canonical ownership and have `Core/EngineRegistry` re-export/delegate to it (or be removed after migrating `Core/HBOS.ts`), preserving `initializeAll`/`healthReport` semantics as a compatibility surface.
2. Alternative: make `Core/EngineRegistry` canonical and extend it with the singleton, duplicate detection, `unregister`, `getAllEngines` and health timestamps the Engines consumers require.

## MIGRATION RISK
- Medium: touches `Core/HBOS.ts`, `Engines/LifecycleManager.ts`, `Engines/HealthMonitorEngine.ts`, `Engines/AutonomousOperationsEngine.ts`, and at least four test suites that assert each concrete contract.
- Must not change engine names, `Engine` interface, or boot ordering (Architecture Freeze V4/V4.1).

## TESTS REQUIRED BEFORE ACCEPTANCE
- `CanonicalIntelligenceEngines.test.ts` (HBOS registration + health) still green.
- `EngineRegistry.phase-11-1.2.test.ts` and `Phase11-HostileQC.test.ts` reconfirmed against the unified contract.
- New test: registering the same engine twice is either idempotent or fails closed consistently (no silent divergence between the two call paths).

## REASON ACC IS REQUIRED
This is a change to a **frozen architectural boundary** (engine lifecycle/ownership) affecting the construction core and multiple verified contracts. It must not be silently consolidated by the execution operator.

## DECISION
No consolidation performed. Item preserved for Architecture Change Control. Construction continues with safe non-ACC work.
