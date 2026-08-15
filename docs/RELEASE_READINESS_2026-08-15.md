# HooshyarOS Release Readiness — 2026-08-15

## Objective
Move from CI-verified platform engineering to a genuinely installable, controlled test release for Windows and Android.

## Release gates
1. Core build + full test suite
2. Windows artifact build
3. Windows install/launch/uninstall verification
4. Android APK build
5. Android install/launch verification
6. Configurable runtime endpoint (no emulator-only localhost assumption)
7. Authentication/session enforcement
8. Tenant-scoped persistence
9. Representative product workflow
10. Offline/error/recovery behavior
11. Release checksum/evidence manifest

## Current evidence
- Autonomous Repair E2E: CI-verified.
- APRVL authorization boundary: CI-verified.
- Windows productization builder exists and can produce a real EXE when IExpress is available.
- Android productization builder exists and produces a debug APK after provisioning its governed toolchain.
- Commercial authorization boundary exists.
- Commercial persistence boundary is being established.

## Explicit blockers before calling the release installable
- A real Windows EXE must be produced and retained as a CI artifact.
- A real Android APK must be produced and retained as a CI artifact.
- Android must accept a real deployed/runtime endpoint; `10.0.2.2` is emulator-specific and is not sufficient for physical-device testing.
- Install/launch/smoke evidence must be recorded for both platforms.
- Commercial persistence and tenant isolation must be connected to the real runtime path.

## Policy
No "ready", "complete", or "commercial" claim may be emitted from source-code presence alone. The release gate requires actual artifacts plus execution evidence.
