# Current Productization Defects Captured From Release Evidence

This document records defects observed in the Windows release artifact and Android packaging attempt. These are engineering defects, not operator responsibilities.

## Windows

Observed release payload contained development repository material including Python `__pycache__` directories, `.pyc` files, Python tests, HBOS TypeScript tests, and broad source-tree content.

Required repair:

- Replace blind `copytree` payload construction with an explicit production inclusion/exclusion policy.
- Remove tests, caches, generated artifacts, repository metadata and other development-only material.
- Separate runtime dependencies from development dependencies.
- Create deterministic application launcher integration.
- Create Start Menu and Desktop shortcuts.
- Add uninstall and upgrade semantics.
- Execute post-install runtime health verification.
- Verify payload contents before generating the installer.
- Verify the installed application after generation.
- Emit artifact metadata including version and SHA-256.

## Android

The Android build was blocked because the SDK repository manifest was unavailable and direct package download fallback encountered invalid/stale package sources and checksum rejection.

Required repair:

- Maintain authoritative versioned package sources.
- Resolve alternate authoritative sources before attempting a corrupt artifact.
- Validate ZIP structure before extraction.
- Validate checksum using the correct algorithm and authoritative digest.
- Never reuse a corrupt cached archive.
- Continue autonomous repair until the declared Android artifact is produced or the governed external boundary is genuinely reached.

## Autonomy requirement

The operator must not manually diagnose these routine productization failures. The Autonomous Operations Engine must consume the evidence, classify the failure, choose a proportional repair strategy, implement the repair, re-run affected verification, and resume the productization mission.
