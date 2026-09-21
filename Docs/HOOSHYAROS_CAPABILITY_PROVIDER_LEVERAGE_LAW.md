# HooshyarOS Capability Provider Leverage Law

**Status:** PERMANENT / GOVERNING / ANTI-DRIFT
**Scope:** Product capability construction and external-dependency admission
**Permitted external software class:** free + open source + commercial use + self-hosted/offline
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

### 3.1 Permitted external software class — DEFAULT

For externally sourced software capabilities the default permitted class is:

```text
FREE + OPEN SOURCE + LICENSED FOR COMMERCIAL USE + SUITABLE FOR SELF-HOSTED/OFFLINE USE
```

Paid-only, proprietary, closed-source and mandatory-cloud dependencies must not be introduced under this law when a sufficiently capable free, open-source, self-hosted alternative is available and acceptable. Cloud or proprietary technologies must not silently become architectural owners of a core platform capability.

A technology is **not** admissible merely because it is free to download, offers a free tier, is popular or is easy to use. License and commercial-use rights must be verified from authoritative project/license evidence and recorded with that evidence. This is the first gate every candidate must pass; failing it is a rejection regardless of the candidate's other merits, and the status is `DEFERRED`.

### 3.2 Permitted-class rejection tests

A candidate is rejected (or `DEFERRED`) when any of the following cannot be established from authoritative evidence:

- the project/source is identifiable;
- the license is identified and grants commercial use;
- redistribution/attribution obligations are acceptable;
- the security posture is acceptable;
- maintenance/maturity is acceptable;
- self-hosted/offline behaviour is acceptable where HooshyarOS requires it;
- data-sovereignty compatibility is acceptable;
- the provider is replaceable behind an adapter boundary;
- the operational burden is acceptable.

Never guess a license, commercial-use right or project status. `DEFERRED` is the correct state for unverified candidates; silent admission of an apparently open dependency is prohibited.

### 3.3 No mandatory proprietary cloud dependency

Core platform functionality must not be made dependent on a proprietary paid cloud service when a sufficiently capable free, open-source or self-hosted alternative is available and acceptable. For core capabilities prefer self-hosted, offline-capable, replaceable, open, standard and auditable options. Any exception requires an approved architecture decision and recorded evidence, not convenience.

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

A `NATIVE_IMPLEMENTATION` is admissible only when `nativeFallbackCriteria` documents why no earlier tier could satisfy the capability. Native code is not a shortcut for avoiding a dependency review, and "we can code it ourselves" is not sufficient reason.

The recorded justification must identify at least one concrete unsuitability of every earlier tier: incompatible license; insufficient security; insufficient functionality; unacceptable maintenance state; unacceptable offline/self-hosted behaviour; unacceptable performance; unacceptable reliability; unacceptable operational complexity; unacceptable vendor lock-in; a genuinely missing required capability; or the capability being itself a core HooshyarOS differentiator. The reuse decision and its evidence belong to planning/inspection, before implementation.

## 10. Architecture Freeze and change control

This law does not mutate Architecture Freeze V4/V4.1. It introduces no parallel architecture and preserves the five canonical intelligence engines and all existing ownership boundaries. A genuine architectural contradiction must still be routed through the existing Architecture Change Control path and the governing repository memory.

## 11. Enforcement

Enforcement is executable, not documentary:

- `CapabilityProviderRegistry` is the canonical owner of dependency admission and provider selection.
- `selectProvider(category)` returns the preferred admitted, integrated provider by the canonical order and fails closed otherwise.
- `auditDeclaredDependencies(snapshot)` verifies that inventory metadata matches the repository's real declared dependencies and installed licences.
- The commercial ingestion composition service refuses a format whose external provider is not admitted, so no ungoverned dependency is used silently.
- A candidate that cannot pass the permitted-class gate in §3.1 is rejected or `DEFERRED`; it is never admitted by default because it appears free or open.
- Focused tests cover admission, selection, native-fallback, truthfulness and the live fail-closed boundary.

## 12. Reference implementation and current limitation

Text-native PDF ingestion is the reference implementation: a standard library extracts text while HooshyarOS owns the canonical model, original-byte SHA-256 provenance, validation and downstream intelligence.

Multi-format acquisition follows the same pattern and converges on the one canonical owner (`FinancialDataIngestionAdapter`):

- `document.pdf.rasterize` — `pdf-parse` page screenshots behind `Product/PdfPageRasterizer.ts` (INTEGRATED);
- `document.pdf.ocr` — `tesseract.js` (Apache-2.0) behind `Product/OcrAdapter.ts`, with language data from the declared `@tesseract.js-data/eng` and `@tesseract.js-data/fas` packages staged into a local directory (INTEGRATED, fully offline: no runtime CDN/network fetch);
- `document.docx.text` — `mammoth` text + tables behind `Product/DocxAcquisition.ts` (INTEGRATED);
- `document.html.text` / `document.xml.text` / `text.tsv.parse` — internal capabilities in `Product/MarkupTextExtraction.ts` and the canonical delimiter parser (INTEGRATED).

Scanned / image-only PDF is now supported end-to-end. `FinancialIngestionService` routes an image-only PDF through the admitted rasterizer → `ScannedPdfRouter` → `OcrAdapter` (`createCanonicalOcrAdapter`) → the same canonical ledger pipeline, preserving the ORIGINAL-byte SHA-256 and recording OCR engine/version/confidence provenance. When the OCR provider is not admitted the precise `ingestion-pdf-scanned-no-ocr-yet` limitation is preserved, and when OCR yields no text the request fails closed with `ingestion-ocr-empty`; no OCR result is ever faked. Long-tail formats (RTF, ODT, PPTX, EPUB, EML, MSG, DBF, YAML, TIFF, legacy XLS) and broad fallbacks (Apache Tika, LibreOffice headless) remain recorded as `DEFERRED` with their rejection reasons; none is claimed as supported.

## 13. Strategic renewal integration — PERMANENT

Provider selection and reuse decisions are not permanent truths. Any admitted standard, library, adapter, provider or native implementation may decay because of license change, abandonment, security posture, performance, cost, regulation, data sovereignty, scale or better available alternatives. Under the Strategic Renewal and Continuous Innovation Law (`Docs/HOOSHYAROS_MASTER_CHARTER.md` §6.4) this law must therefore support continuous renewal, not only initial admission.

- **Decay awareness.** An admitted provider must be periodically re-evaluated against its admission facts (§4). A provider whose license, maintenance, security or suitability can no longer be established is `DEFERRED` or replaced behind the same adapter boundary; its failure evidence is preserved, never masked.
- **Evidence-driven replacement or retirement.** A provider or native implementation is improved, scaled, adapted, replaced or retired only from measured evidence — never from preference or novelty.
- **Anti-legacy-bias.** Incumbency is not evidence of suitability. A retained provider must justify its continuation on current evidence; an existing native implementation may be replaced by a better earlier-tier capability when evidence supports it.
- **Future sensing.** Selection must consider plausible future license, maintenance, scale, security, regulatory and operational conditions, not only present suitability.
- **Epistemic discipline.** License/commercial-use facts are **FACT** only when verified from authoritative evidence. Unverified candidates are labelled **ASSUMPTION** or **HYPOTHESIS** and are `DEFERRED`; they are never admitted or claimed.

The combined decision model for any capability (new or under renewal) is:

```text
UNDERSTAND THE PROBLEM → OBSERVE THE CURRENT SYSTEM → CHALLENGE ASSUMPTIONS
→ SEARCH EXISTING SCIENCE / STANDARDS / FREE OPEN-SOURCE CAPABILITIES
→ INVENT ONLY WHERE NECESSARY → EXPERIMENT WHEN UNCERTAINTY IS MATERIAL
→ MEASURE → GOVERN → INTEGRATE → SCALE OR RETIRE
```

Renewal never weakens the permanent admission class of §3.1: externally sourced software remains admissible only when it is **free, open source, licensed for commercial use and suitable for self-hosted/offline operation** where required. An unverifiable license or commercial-use right remains `DEFERRED`, never assumed. This section introduces no new engine, registry, subsystem or parallel governance; `CapabilityProviderRegistry` remains the single canonical admission mechanism.
