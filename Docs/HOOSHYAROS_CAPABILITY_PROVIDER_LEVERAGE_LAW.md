# HooshyarOS Capability Provider Leverage Law

**Status:** PERMANENT / GOVERNING / ANTI-DRIFT
**Scope:** Product capability construction and external-dependency admission
**Canonical mechanism:** `Backend/HBOS/Product/CapabilityProviderRegistry.ts`
**Focused tests:** `Backend/HBOS/test/CapabilityProviderRegistry.test.ts`, `Backend/HBOS/test/FinancialIngestionProviderGovernance.test.ts`

## 1. Purpose

HooshyarOS must not rebuild mature capabilities that already exist as reliable, standard, open-source or commercially compatible components.

Whenever a mature standard, library, tool, protocol or provider can safely perform a supporting capability, HooshyarOS prefers:

```text
STANDARD -> EXISTING TOOL -> ADAPTER / PROVIDER -> CANONICAL HOOSHYAROS CORE
```

over rebuilding everything natively. The objective is faster commercialization, higher standardization and lower maintenance burden without weakening architecture, security, governance, provenance, correctness or evidence integrity.

## 2. Canonical evaluation order

For every new capability, evaluate in this order and choose the earliest tier that can satisfy the requirement:

1. `INDUSTRY_STANDARD` — a standard, protocol or platform built-in.
2. `MATURE_LIBRARY` — an existing maintained library / open-source tool.
3. `INTERNAL_CAPABILITY` — an existing canonical HooshyarOS owner.
4. `ADAPTER_PROVIDER` — integration with an external system through an adapter.
5. `NATIVE_IMPLEMENTATION` — build it ourselves, only when no earlier tier is suitable.

A later tier is admissible only when the earlier tiers are demonstrated to be unavailable, unsuitable, unsafe or non-compliant.

## 3. Decision factors

Selection must weigh, at minimum: maturity; active maintenance; security posture; license compatibility with commercial HooshyarOS; offline/self-hosted capability; data sovereignty; privacy; performance; reliability; replaceability; vendor lock-in risk; Windows/Linux/Android compatibility where relevant; operational complexity; and long-term maintainability.

A dependency is never selected merely because it is free. It must be commercially and architecturally acceptable.

## 4. Dependency admission criteria

A provider is admitted only when every mandatory fact below is recorded; a missing fact is a rejection, never a default (fail closed):

- license, with the exact source used to verify it;
- commercial-use compatibility confirmed;
- self-hosted / offline behaviour declared;
- maintenance / maturity evidence with an as-of date;
- security considerations;
- the HooshyarOS adapter boundary that keeps it replaceable;
- provenance, testing, upgrade and deprecation responsibilities;
- for an integrated library, the declared `package.json` dependency;
- for a native implementation, the documented reason earlier tiers were unusable.

Facts (license, version, project status) must come from authoritative/current sources and be recorded with their evidence. Engineering judgment must be labelled as judgment, never presented as a fetched fact.

## 5. Ownership separation

Providers are capability providers, **not architecture owners**. HooshyarOS always retains ownership and control of:

canonical domain/data models; tenant boundaries; identity; security policy; provenance; audit and governance; validation; business rules; financial, organizational and executive intelligence; reasoning; autonomous operations; decision logic; and orchestration.

A provider may never own a canonical model, tenant boundary, identity decision, security policy, provenance contract or business rule.

## 6. Provider ownership and replaceability

Every external capability has exactly one canonical HooshyarOS owner (Engine or supporting service). The provider sits behind that owner's explicit adapter boundary recorded in `replaceableVia`. Replacing a provider must not require changing canonical intelligence or business logic.

Do not create a duplicate parser, connector, registry or adapter when a canonical owner already covers the requirement. When an existing abstraction is insufficient, improve the canonical owner instead of adding a competing subsystem.

## 7. Vendor lock-in protection

- No provider may be a mandatory runtime for canonical capability.
- Provider identity, version and licence are recorded; upgrades are deliberate, not silent.
- The adapter boundary is the contract; concrete providers remain replaceable.
- No external project may become an architectural authority or hidden construction dependency.

## 8. Responsibilities

- **Provenance / security:** HooshyarOS owns provenance and security policy; the provider only performs the delegated technical capability.
- **Testing:** HooshyarOS owns focused behavioural tests for the capability and for the adapter boundary.
- **Upgrade:** HooshyarOS pins provider versions and re-runs the focused tests on upgrade.
- **Deprecation:** a retired/unsuitable provider is replaced behind the same boundary; its failure evidence is preserved, never masked.

## 9. Native implementation criteria

A `NATIVE_IMPLEMENTATION` is admissible only when `nativeFallbackCriteria` documents why no earlier tier could satisfy the capability. Native code is not a shortcut for avoiding a dependency review.

## 10. Architecture Freeze and change control

This law does not mutate Architecture Freeze V4/V4.1. It introduces no parallel architecture and preserves the five canonical intelligence engines and all existing ownership boundaries. A genuine architectural contradiction must still be routed through the existing Architecture Change Control path and the governing repository memory.

## 11. Enforcement

Enforcement is executable, not documentary:

- `CapabilityProviderRegistry` is the canonical owner of dependency admission and provider selection.
- `selectProvider(category)` returns the preferred admitted, integrated provider by the canonical order and fails closed otherwise.
- `auditDeclaredDependencies(snapshot)` verifies that inventory metadata matches the repository's real declared dependencies and installed licences.
- The commercial ingestion composition service refuses a format whose external provider is not admitted, so no ungoverned dependency is used silently.
- Focused tests cover admission, selection, native-fallback, truthfulness and the live fail-closed boundary.

## 12. Reference implementation and current limitation

Text-native PDF ingestion is the reference implementation: a standard library extracts text while HooshyarOS owns the canonical model, original-byte SHA-256 provenance, validation and downstream intelligence.

Scanned / image-only PDF is the honest remaining limitation. OCR is recorded as `DEFERRED` with explicit unmet conditions; no OCR provider is installed or claimed until it satisfies this law.
