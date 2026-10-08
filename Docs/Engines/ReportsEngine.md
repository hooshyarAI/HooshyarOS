# Reports Engine

Canonical autonomous capability: `platform.reports`.

Capability: implement Reports capability

Dependencies: Dashboard Engine

## Architecture contract
- Architecture Freeze V4
- One Capability = One Engine
- Engine must be observable
- Engine must be testable
- Engine must be recoverable
- No duplicate capability owner

## Capability

`ReportsEngine` is the single canonical report owner. It owns report
construction (validation + section model) and report serialization into real
file bytes. It does not own persistence, provenance, authentication or tenant
isolation; those are composed by `ReportExportService` and the runtime.

- `build(title, sections)` — validates and returns a structured `ReportResult`
  (`READY`/`BLOCKED`). Preserved for backward compatibility.
- `render(document, format)` — deterministically renders a `ReportDocument` into
  a real `ReportArtifact` (bytes + content type + file name + SHA-256).
- `supportedFormats()` — `TXT`, `CSV`, `JSON`, `XLSX`.

Formats are limited to those the frozen dependency set can genuinely serialize.
PDF/DOCX are read-only acquisition formats in this repository and are therefore
not export formats.

## Construction directives
- Implement exactly one concrete capability from the canonical mission.
- Create or update the focused implementation, focused test and documentation required by the architecture.
- Run focused verification followed by the full Jest suite.
- Repair verification failures before finalization.
- Do not redesign Architecture Freeze V4.

This scaffold is intentionally semantic-neutral. The autonomous construction loop
must enrich it only from repository architecture, dependencies, tests and evidence;
it must not invent business rules or create duplicate engine boundaries.
