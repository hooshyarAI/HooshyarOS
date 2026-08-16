# HooshyarOS Release Readiness — Canonical Gate

## Objective
Move from CI-verified engineering to a genuinely installable, controlled test release for Windows and Android.

## Canonical gates
1. Full test suite + release contracts.
2. Real Windows EXE build and SHA-256 evidence.
3. Windows install evidence.
4. Windows launch/health evidence.
5. Windows uninstall/cleanup evidence.
6. Android APK build and SHA-256 evidence.
7. Physical-device endpoint validation (separate from emulator artifact build).
8. Authentication/session enforcement.
9. Tenant-scoped persistence.
10. Representative product workflow.
11. Offline/error/recovery behavior.
12. Final evidence manifest.

## Architecture policy
- `Backend/AI_Runtime/productization_builder.py` is the canonical productization builder.
- Release readiness is evaluated by one canonical workflow: `.github/workflows/release-artifacts.yml`.
- The physical Android workflow is intentionally separate because it requires a reachable deployed endpoint.
- Auxiliary wrappers must not become independent productization paths.

## Evidence policy
Source-code presence is never release evidence. A platform is considered installable only after artifact integrity plus execution evidence is recorded.

## Current known boundary
Windows and Android artifact generation has previously been CI-verified. Windows install/launch/uninstall and physical-device Android execution remain the decisive execution gates. Commercial persistence, tenant isolation, authentication/session enforcement, and a representative end-to-end business workflow remain product-use gates.
