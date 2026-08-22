# HooshyarOS Autonomous Execution Law

## Status

**Mandatory / platform-enforced**.

All construction, real commercialisation, standardisation, repair, rebuild, recovery, and repair of the Assistant itself must execute through the HooshyarOS platform-native autonomous control plane.

## Binding rules

1. **Platform-native only** — the platform may use only its own Assistant, Engines, reasoning/decision models, governed construction tools, recovery mechanisms, verification gates, and release controls for autonomous work.
2. **Assistant mediated** — autonomous work is initiated and orchestrated by the platform Assistant / Autonomous Operations Engine; an external coding agent is never a hidden implementation path.
3. **Architecture is constitutional** — Architecture Freeze V4, canonical capability boundaries, Governance rules, and the durable product roadmap are authoritative.
4. **One governed lifecycle** — `ARCHITECTURE -> PLAN -> GENERATE -> VERIFY -> REPAIR* -> FINALIZE` is the only construction lifecycle.
5. **No self-certification** — generation cannot declare itself correct. Finalization requires verification evidence from the governed verification toolchain.
6. **Repair is construction** — repair/rebuild/self-repair must return through the same governed construction engine, with rollback and re-verification.
7. **Artifact reality** — a named class, file, endpoint, installer, or test is not accepted as a capability unless its declared product artifact exists, executes, and passes the applicable verification gates.
8. **No external coding bypass** — setting `HOOSHYAR_EXTERNAL_CODING_AGENT` or routing a construction stage to an ungoverned coding tool is a hard block.
9. **Commercial claims require evidence** — “complete”, “production-ready”, or “commercial-ready” may only be emitted after canonical, commercial, runtime, and verification evidence agree.
10. **Human responsibility boundary remains explicit** — legal/regulatory acceptance, security sign-off for real customer data, and business ownership remain outside autonomous execution claims; the platform must report these as external dependencies rather than fabricate completion.

The executable implementation is `Backend/HBOS/Autonomous/Governance/AutonomousExecutionLaw.ts`. The construction control plane enforces it before every governed stage.
