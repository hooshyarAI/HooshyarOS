# HooshyarOS Commercial Product Completion Contract

**Status:** Canonical product-completion contract
**Authority:** Product scope only; Architecture Freeze V4, Master Charter, Governance Charter and Final Decisions Register remain authoritative for architecture and governance.

## Purpose

The autonomous platform builder must distinguish **canonical capability completion** from **real commercial product completion**.

`productComplete=true` MUST NOT be derived only from exhaustion of the canonical capability roadmap. It is valid only when repository evidence proves that the platform is an installable/launchable, usable product with the required commercial runtime surfaces, while preserving Architecture Freeze V4 and all governance, security, explainability and evidence rules.

External operations that cannot be proven from repository-native evidence (for example production cloud resources, DNS, payment-provider activation or third-party credentials) must be represented as explicit BLOCKED/EXTERNAL_DEPENDENCY evidence, never fabricated as completed.

## Non-negotiable governing sources

Before changing this contract or implementing a gap, inspect:

- `Docs/HOOSHYAROS_MASTER_CHARTER.md`
- `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md`
- `Docs/ARCHITECTURE.md`
- `Docs/HOOSHYAROS_FINAL_DECISIONS_REGISTER.md`
- `Docs/AUTONOMOUS_WEAVING_DOCTRINE.md`
- `Docs/Autonomous/ASSISTANT_PLATFORM_HANDOFF.md`
- `Assistant/SYSTEM_PROMPT.md`
- `AGENTS.md`
- `Backend/HBOS/Autonomous/Runtime/CanonicalCapabilityAudit.ts`
- `Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts`
- `Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json` when present

Do not create duplicate engines or redefine frozen business semantics.

## Commercial completion layers

The builder must audit these layers separately.

### 1. Product runtime

Evidence must exist for a coherent runtime path:

`Browser/Mobile Client → Web/PWA Surface → API Gateway → Authentication → Authorization/Tenant Context → HBOS → Engines → Persistence → Audit/Observability`

Required evidence includes a runnable application entrypoint, configuration contract, health/readiness contract, persistence boundary and documented local development/start procedure.

### 2. Identity, users and organizations

Required capabilities:

- user registration/onboarding where applicable
- authentication/session lifecycle
- logout/session invalidation
- password recovery and credential policy where applicable
- roles and permissions
- organization/tenant context
- tenant data isolation
- user-to-organization membership
- audit trail for security-sensitive identity events

The existence of `UserManagementEngine` alone is not sufficient evidence of commercial identity readiness.

### 3. Multi-tenancy and authorization

Every organization-owned resource must have an explicit ownership/scope rule.

The builder must verify:

- tenant isolation
- RBAC/permission enforcement
- privileged-operation checks
- cross-tenant access rejection tests
- auditability of authorization-sensitive operations

### 4. Data ingestion and canonical data

The product must accept data through the approved source families defined by the frozen product architecture, including where applicable:

- accounting/ERP integrations
- APIs
- database adapters
- CSV/Excel
- PDF/document ingestion
- structured financial reports
- manually uploaded evidence

The canonical path is:

`Source → Connector → Raw Evidence → Validation → Normalization → Canonical Model → Evidence Store → Intelligence`

Connectors must fail closed on malformed or ambiguous data and preserve source/evidence provenance.

### 5. Financial intelligence

Commercial evidence must cover the product's intended financial-analysis surfaces, including where applicable:

- financial statements
- ratios and trends
- profitability
- cash flow
- budget vs actual
- variance analysis
- financial anomalies/alerts
- explainable findings
- evidence/provenance

Existing Financial Intelligence capabilities must be reused rather than duplicated.

### 6. Executive and managerial intelligence

The product must expose usable executive/managerial surfaces for:

- KPI definition and monitoring
- target vs actual
- achievement/variance
- management status signals
- performance evaluation
- alerts
- drill-down from KPI to evidence
- explainable recommendations

### 7. Decision intelligence and Expert Choice

Decision workflows must support, where appropriate:

- scenario definition
- alternatives
- criteria/weights
- multi-criteria evaluation
- Expert Choice/AHP-style reasoning where defined by the product architecture
- risk/assumption visibility
- recommendation evidence
- human approval/governance before consequential execution

The system must expose why a recommendation was produced and what evidence/assumptions support it.

### 8. Organizational execution

Approved decisions must be capable of becoming governed work:

`Decision → Approval → Workflow → Assignment → Due Date → KPI/Outcome → Evidence → Feedback`

The product must support the frozen organizational-execution semantics without inventing a parallel workflow engine.

### 9. Dashboards and reports

The product must expose usable web surfaces for the canonical dashboard/report engines, including as applicable:

- executive dashboard
- financial dashboard
- KPI dashboard
- budget dashboard
- risk dashboard
- tax dashboard
- alerts
- decision center
- operational/performance views
- report generation
- export/download where defined

An HBOS engine test is not evidence that a usable browser UI exists. UI completion requires application-level rendering and interaction tests.

### 10. Web and mobile

**Web-first** is the default commercial delivery path.

The first commercial client surface must be responsive and usable on desktop and phone form factors. PWA/offline support must be implemented only according to the approved product architecture.

If native Android/iOS applications are part of the frozen product scope, they require explicit build/test evidence; otherwise do not invent native clients merely to satisfy this contract.

### 11. Offline/online behavior

Where offline operation is part of the approved product scope, the contract is:

`Online State → Local Workspace/Cache → Offline Work → Durable Local Evidence → Sync → Conflict Resolution → Server State`

Offline completion must include synchronization and conflict tests. Network loss must never silently discard accepted user work.

### 12. Security and privacy

Commercial readiness requires evidence for:

- encryption in transit
- secure secret/configuration handling
- tenant isolation
- RBAC
- secure file ingestion
- input validation
- API abuse/rate controls where applicable
- audit logging
- backup/recovery contract
- data export/deletion policies where required
- security audit/readiness

Never claim external infrastructure security without evidence from the external system.

### 13. Observability and operations

The product must provide repository-native contracts for:

- health
- readiness
- structured errors
- operational telemetry
- request/operation tracing where appropriate
- audit events
- performance signals
- failure/recovery evidence

The autonomous construction telemetry is not a substitute for product runtime observability.

### 14. Deployment and installation

Commercial readiness requires a reproducible local installation/start path and deployment contract.

At minimum the repository must define:

- runtime prerequisites
- dependency installation
- environment/configuration contract
- database/persistence setup
- build command
- test command
- start command
- health/readiness verification
- deployment packaging or deployment contract

Cloud deployment may remain externally blocked when credentials/resources are unavailable, but the repository must make the dependency explicit.

### 15. Subscription and commercial controls

If subscription/billing is part of the approved commercial scope, define and implement:

- plan model
- entitlement model
- tenant subscription state
- usage/limits
- trial/expiry behavior
- billing-provider integration boundary
- secure webhook/event handling
- entitlement enforcement

Payment-provider activation is an external dependency and must never be falsely reported as complete.

### 16. Customer onboarding

A commercial user must have a coherent path from first launch to useful value:

`Create/Join Organization → Configure Profile/Roles → Connect/Import Data → Validate Data → Configure Goals/KPIs → View Dashboard → Receive Insight → Make/Approve Decision → Execute → Measure Outcome`

The builder must prefer the smallest complete MVP path through this lifecycle.

## Scientific and reasoning principles that remain product invariants

The product must preserve the agreed interdisciplinary logic, including where applicable:

- accounting and financial analysis
- management accounting and budgeting
- decision analysis and multi-criteria decision making
- Expert Choice/AHP reasoning
- risk analysis and early warning
- KPI/performance management
- organizational execution
- economic/market scenario analysis when data is available
- evidence-based reasoning
- explainability and provenance
- fail-closed behavior under insufficient evidence
- feedback/learning loops

AI must not replace evidence, governance or domain constraints with unsupported guesses.

## Evidence model

Every commercial capability must be evaluated across four levels:

1. **Unit evidence** — focused implementation test.
2. **Integration evidence** — interaction with owning engines/contracts.
3. **Application evidence** — runnable product path/UI/API/persistence behavior.
4. **Acceptance evidence** — end-to-end user-value path using representative data.

Only level 1 or 2 evidence must never be promoted to commercial completion.

### Machine-generated commercial reality manifest

Before `productComplete=true`, the construction system MUST produce `Docs/Evidence/commercial-product-reality.json` with:

- `schemaVersion: 1`
- `status: "VERIFIED"`
- `generatorId: "HooshyarOS.RealityVerifier.v1"`
- `verificationMode: "BLACK_BOX_RUNTIME"`
- exact Git commit under test
- verification environment identity
- execution timestamp

The manifest MUST be generated by an executed verification process. It is an evidence record, not a permission slip. The audit MUST reject missing, malformed, stale, contradictory or commit-mismatched evidence.

Every recorded command MUST have `exitCode: 0` and `observedPostcondition: true`. A build exit code is not a runtime postcondition.

The evidence MUST cover actual:

- installer artifact production, including actual SHA-256 and non-zero size
- installation
- launch
- health/readiness
- dashboard/API behavior
- desktop/browser lifecycle without losing the required runtime
- uninstall and cleanup
- representative API/UI/application behavior
- persistence write and restart/readback
- authentication/authorization
- tenant isolation
- audit/observability
- end-to-end customer value path

The verifier MUST compare the recorded artifact hash and size against the actual artifact bytes.

A source file, unit test, mock, screenshot, build exit code, generated success message or narrative claim MUST NOT substitute for executed application/acceptance evidence.

### Anti-circular verification rule

The implementation author/generator MUST NOT be the sole authority that declares its own change verified. The acceptance oracle MUST be deterministic and independently executable. Changes to implementation and changes to the acceptance oracle are separate governance actions and must not be coupled merely to make a check pass.

If a required external dependency is unavailable, record it as `required: true, status: "BLOCKED"` with its exact name. A required blocked dependency prevents `productComplete=true`.

## Completion states

The audit must report these states independently:

- `assistantComplete`
- `canonicalPlatformConstructionComplete`
- `commercialProductRuntimeComplete`
- `externalProductionDependenciesComplete`
- `productComplete`

`productComplete` may be `true` only when all required in-repository commercial layers are verified and no required external dependency is falsely treated as satisfied.

If a required external dependency is unavailable, report `BLOCKED_EXTERNAL_DEPENDENCY` with exact evidence and continue all safe repository-native work.

## Autonomous construction rule

The Python-first autonomous builder must treat this document as a **commercial completion audit contract**, not as permission to redesign the architecture.

For every audit cycle:

`READ GOVERNING SOURCES → AUDIT COMMERCIAL LAYERS → DISCOVER REAL GAP → SELECT ONE KNOT → CHECK OWNER/DEPENDENCIES → IMPLEMENT → FOCUSED TEST → INTEGRATION TEST → APPLICATION/ACCEPTANCE TEST → EVIDENCE AUDIT → COMMIT → PUSH → RE-AUDIT`

Use the smallest complete change. Reuse existing engines, contracts and adapters. Do not create duplicate semantics.

## Priority order for reaching commercial MVP

When multiple commercial gaps are missing, prefer this order unless repository evidence proves a dependency requires another order:

1. runnable local web product shell
2. persistence/data model and tenant scope
3. authentication + RBAC + organization context
4. canonical data ingestion and representative financial dataset path
5. API integration across HBOS engines
6. executive/financial dashboards
7. reports/export
8. decision/Expert Choice workflow
9. organizational execution workflow
10. security hardening and audit evidence
11. deployment packaging/readiness
12. responsive/PWA/mobile experience
13. billing/subscription
14. production external integrations and external acceptance

This priority is an MVP throughput heuristic, not a change to Architecture Freeze V4.

## Human intervention boundary

The human should not be asked to manually implement any item that Python, the Assistant or Git/GitHub can safely construct, test or verify.

Human action is reserved for:

- external credentials/approvals
- production infrastructure access
- legal/compliance/business decisions requiring an owner
- acceptance of consequential external operations

All other safe work remains autonomous.
