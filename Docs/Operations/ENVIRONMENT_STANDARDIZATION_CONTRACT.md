# HooshyarOS Environment Standardization Contract

## Authority

This document is an operational conformance contract. It does not replace or modify Architecture Freeze V4, engine ownership, governance, security policy, or the autonomous repair law. Where a conflict exists, the frozen architecture and governing constitution remain authoritative.

## Objective

The development, test, web, dashboard, desktop, Android, installation, runtime, and integration environments must behave as one governed product system rather than as independent build surfaces.

A surface is not considered production-ready merely because it builds. It must be installable or deployable through its declared path, start correctly, expose governed health/readiness signals, communicate through approved interfaces, preserve security and tenant boundaries, and pass the same verification doctrine as the rest of the platform.

## Standardization layers

### 1. Source and toolchain

- Repository root is the only authoritative project root.
- Runtime versions, package-manager expectations, TypeScript/Jest configuration, Python runtime, Android/JDK/Gradle versions, and platform-specific prerequisites must be explicit and reproducible.
- Generated artifacts, caches, virtual environments, tests, fixtures, credentials, and development-only material must never enter customer release payloads.
- Dependency acquisition must use declared sources, validation, checksum verification where available, and bounded fallbacks.
- A fallback may repair an unavailable source; it may not silently substitute an incompatible component.

### 2. Core runtime and engines

- HBOS and its engines remain the canonical runtime authority.
- No parallel or duplicate engine hierarchy may be introduced to solve packaging or UI problems.
- Assistant, autonomous operations, memory, decision, governance, reasoning, executive/organizational intelligence, and supporting engines must retain their declared ownership boundaries.
- Runtime entrypoints must be explicit and independently health-checkable.

### 3. Web application

- The commercial web entrypoint is a first-class product surface, not a development preview.
- Startup, health, readiness, static assets, API connectivity, session lifecycle, tenant scope, authentication/authorization, and error handling must be verified as one path.
- Web assets must be deterministic for a release and must not depend on the developer workstation after packaging.
- A web runtime acceptance gate is required before a productization run can claim commercial readiness.

### 4. Dashboards and management surfaces

- Dashboards must consume governed platform contracts rather than duplicate business logic.
- Identity, tenant, role, permission, data scope, and audit context must propagate consistently from the authenticated session to every dashboard operation.
- KPI, alarm, decision, report, and executive views must distinguish authoritative data from derived intelligence and recommendations.
- Failure of a dashboard dependency must degrade safely and observably; it must not leak data or bypass governance.

### 5. Desktop / Windows application

- Installation must produce a deterministic customer payload containing only the required runtime closure.
- Installation must create a supported launch surface and perform a post-install health/readiness check.
- Payload validation is mandatory before an installer is considered successful.
- Development artifacts discovered in a customer payload are a release-blocking defect, not a warning.

### 6. Android application

- Android packaging must be reproducible from the governed toolchain definition.
- SDK, platform, build-tools, JDK, Gradle, and Android Gradle Plugin versions must be mutually compatible and explicitly pinned.
- SDK-manager failure may trigger a governed direct-package fallback, but the fallback must use valid current package coordinates and verify the resulting component before continuing.
- Network failure, 404, repository unavailability, or plugin-resolution failure must produce a diagnosable root cause; repeated blind retries are prohibited.

### 7. Communication and integration

Every integration must declare:

- caller and owner;
- protocol/interface;
- authentication and authorization boundary;
- timeout/retry policy;
- validation contract;
- failure and fallback behavior;
- observability/audit events;
- tenant/data isolation requirements;
- compatibility/version policy.

Internal engine calls, web-to-runtime calls, desktop-to-runtime calls, Android-to-runtime calls, and external AI-provider calls are subject to the same governance principle, with authority reduced as the boundary becomes more external.

External AI reviewers (including DeepSeek) remain advisory/adversarial. They may analyze and challenge decisions but cannot directly mutate the repository, execute privileged product operations, bypass governance, or weaken security controls.

### 8. Security

Security is a cross-layer invariant, not a release-stage add-on.

- Secrets are environment/configuration inputs and must never be committed or embedded in customer artifacts.
- Authentication, authorization, session lifecycle, tenant isolation, least privilege, secure transport, input validation, auditability, and safe failure must be verified at each externally reachable boundary.
- Build and repair automation must not broaden permissions merely to make a failing build pass.
- Productization must fail closed when a security boundary cannot be verified.

### 9. Observability and repair

Every significant lifecycle stage must expose enough evidence to answer: what failed, where, why, what was attempted, what changed, and whether the repaired state was verified.

The canonical repair lifecycle remains:

`DETECT -> ISOLATE -> DIAGNOSE -> PLAN -> REPAIR -> VERIFY -> CANARY -> RESUME -> LEARN/OPTIMIZE -> RE-AUDIT`

A repair is incomplete until verification succeeds. Repeated failure must improve durable memory rather than merely repeat the same strategy.

### 10. Productization acceptance

A productization run may claim `READY` only when all required surfaces pass their declared gates:

1. source/toolchain integrity;
2. TypeScript/build verification;
3. full automated tests;
4. web runtime acceptance;
5. Windows payload and installer validation when required;
6. Android artifact and toolchain validation when required;
7. security and tenant-boundary checks;
8. installation/startup/health verification;
9. integration and communication checks;
10. release-manifest and artifact integrity checks;
11. autonomous repair/reverification of resolvable defects;
12. adversarial architectural review where the governing process requires it.

A missing artifact, invalid dependency, unverified integration, development artifact in a release payload, or unresolved security/control boundary is a blocker.

## Current known conformance risks to resolve

The latest observed productization run demonstrated three concrete environment-standardization issues that must be treated as engineering defects:

- Windows payload validation correctly detected a development artifact (`backend/hbos/factory/test/testgenerator.ts`). This indicates the release-filtering contract and its coverage need to be verified against the actual payload tree, not only source-level assumptions.
- Android direct fallback attempted an invalid/unavailable build-tools package URL and received HTTP 404. Package coordinates must be validated before retry loops consume time.
- Gradle then failed to resolve `com.android.application:8.6.1`. Android Gradle Plugin resolution must be treated as a separate dependency-provisioning gate, with a deterministic cache/source strategy and compatibility validation rather than being conflated with SDK provisioning.

These defects must be repaired through the autonomous workflow, with root-cause evidence and regression tests, rather than bypassed by weakening release requirements.

## Completion criterion

The environment is standardized only when the same governed product contract can be applied to development, automated CI, local web runtime, Windows packaging/install, Android packaging, dashboard operation, and customer-facing runtime without undocumented workstation-specific assumptions.
