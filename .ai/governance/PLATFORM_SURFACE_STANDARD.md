# HooshyarOS Platform Surface & Environment Standard V1

## Purpose

This standard defines the common operating contract for the HooshyarOS web runtime, dashboards, Windows product, Android application, installation/update paths, and cross-layer communication. It is subordinate to the governing architecture, security policy, DeepSeek adversarial review, and acceptance gates.

## Non-negotiable architecture

`Web / Dashboard / Windows / Android -> Auth & API boundary -> API Gateway -> governed HBOS services/engines`

Client surfaces must not directly invoke internal engines, internal memory, repair components, databases, or privileged filesystem/process APIs.

## Environment standard

Every deployable surface is classified as `DEV`, `TEST`, `STAGING`, or `PRODUCTION`. Production artifacts must be reproducible from a known commit, have explicit version/build metadata, and pass the applicable acceptance gates before release.

Environment-specific configuration is externalized. Secrets, credentials, customer data, private keys, and tokens must never be committed to source or embedded in distributable client artifacts.

## Surface standard

All supported surfaces must expose the same product identity, API contract version, authentication model, authorization model, error semantics, telemetry correlation identifier, and compatibility policy.

- **Web runtime:** browser-safe client; no privileged local operations; communicates only through the public API boundary.
- **Dashboards:** presentation and decision surfaces; business rules remain governed by backend services; permissions are enforced server-side.
- **Windows:** packaged product with an isolated install/runtime root, explicit installer/uninstaller/update behavior, least-privilege execution, and release artifact verification.
- **Android:** packaged application with the same API/security boundary as web and Windows; no embedded backend credentials or unrestricted privileged access.

## Communication standard

Every request across a trust boundary must have an authenticated identity where required, authorization at the receiving boundary, a correlation/request identifier, bounded timeouts, explicit failure semantics, and safe logging. Internal implementation details must not leak through client-facing errors.

The client must never be treated as a security boundary. Authorization is always re-evaluated server-side.

## Security standard

Security is part of correctness, not a post-release feature. The release gate must reject artifacts that contain secrets, development-only payloads, test fixtures, raw customer data, debug endpoints, or unintended privileged tooling.

Repair and autonomous construction components may modify product surfaces only through governed paths and must not weaken authentication, authorization, isolation, auditability, or acceptance gates in order to make a build pass.

## Installation and update standard

Installation, update, rollback, and repair are separate lifecycle operations. An update must preserve compatible user data and configuration, validate the new artifact before activation, and retain a recoverable previous version when the platform supports rollback. A failed update must fail closed rather than silently activating a partially updated product.

## Verification standard

A surface is not considered ready because its unit tests are green. Readiness requires the applicable set of:

1. static/build verification;
2. unit and integration verification;
3. security boundary verification;
4. environment/configuration verification;
5. artifact/package verification;
6. cross-surface API compatibility verification;
7. release/acceptance evidence.

For material architecture, security, productization, performance, reliability, or repair changes, the DeepSeek adversarial review gate remains mandatory.

## Autonomous construction rule

The assistant and its tools must use this standard as a checklist and machine-checkable contract. A failed check creates a repair task with root-cause evidence. Repeating a failed strategy without new evidence is prohibited. Memory may supply lessons, but governance and acceptance rules remain authoritative.
