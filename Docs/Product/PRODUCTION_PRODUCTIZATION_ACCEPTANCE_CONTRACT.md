# HooshyarOS Production Productization Acceptance Contract

## Purpose

A successful TypeScript build and passing unit tests are not sufficient evidence of a production-ready HooshyarOS release. Productization must produce a clean, installable, launchable, verifiable customer artifact.

## Windows release boundary

The Windows payload MUST contain only production runtime artifacts and required runtime dependencies. It MUST exclude development and repository artifacts, including:

- `__pycache__/`
- `*.pyc`
- Python test suites and `tests/` directories
- HBOS/TypeScript test suites and `test/` directories
- repository documentation and development-only build artifacts
- `.git/`, `.github/`, local tool caches, coverage and temporary files
- prior `dist/`, staging and installer-source directories
- generated backup files and editor metadata

The release builder MUST NOT copy the repository tree blindly. Runtime inclusion must be allowlisted or policy-filtered and verified after packaging.

## Runtime dependency boundary

Production packaging MUST distinguish runtime dependencies from development dependencies. The release artifact MUST NOT ship the full development dependency graph solely because it exists in `node_modules`.

## Installer contract

The Windows installer MUST:

1. install into a deterministic per-machine or per-user application directory;
2. create an application launcher;
3. create a Start Menu shortcut;
4. create a Desktop shortcut unless policy explicitly disables it;
5. register a proper uninstaller;
6. preserve application data independently from upgrade/uninstall when policy requires it;
7. verify installation completion;
8. run a post-install runtime smoke test;
9. report failure as `PRODUCTIZATION_BLOCKED`, never as completion.

## Runtime launch contract

The installed product MUST expose one canonical launch path. The launcher MUST start the commercial runtime, perform a health/readiness check, and surface a usable local web runtime to the user.

The installer MUST NOT claim success merely because files were copied.

## Artifact quality gates

Before `AUTONOMOUS_PRODUCTIZATION_COMPLETE`, the assistant must verify:

- Windows installer exists and is structurally valid;
- payload contains no forbidden development artifacts;
- payload contains the required runtime entrypoint;
- installation succeeds in a clean environment or isolated test target;
- launcher exists and executes;
- Start Menu/Desktop integration is present;
- runtime health/readiness succeeds;
- uninstall path exists and works;
- artifact metadata includes version, size and SHA-256;
- release signing is applied when signing credentials/policy are available, otherwise release remains explicitly unsigned and non-final according to governance policy.

## Android release boundary

Android packaging must use verified toolchain sources and verified package checksums. A corrupt, HTML, stale or mismatched archive MUST be rejected. When an SDK repository is unavailable, autonomous fallback may use alternate authoritative package sources, but checksum and artifact validation remain mandatory.

An Android release is complete only when the APK/AAB is built, structurally verified, and the expected artifact exists at the declared release path.

## Autonomous repair law

Any violation of this contract is a repairable productization failure. The Autonomous Operations Engine must classify the failure, select a proportional repair strategy, execute the repair through repository-native tooling, re-run the narrow verification, then run the affected product acceptance suite before resuming the mission.

The human operator must not be required to manually diagnose or patch routine packaging, installation, launch, cleanup, or verification failures.

## Completion rule

`AUTONOMOUS_PRODUCTIZATION_COMPLETE` is legal only after Windows, Android and required web runtime acceptance gates all pass.
