# APRVL — Autonomous Python Repair & Verification Layer

APRVL is the governed Python execution substrate under the HooshyarOS Assistant.
It is **not** a decision engine and cannot bypass governance, quality gates, or verification.

## Operating contract

`Input → Detect → Analyze → Plan → Authorized Repair → Verify → Evidence → Platform Decision → Learn`

## Capabilities

- CI/failure-log analysis
- repository and static-boundary scanning
- dependency and lockfile inspection
- canonical cross-platform path handling
- artifact comparison and SHA-256 integrity evidence
- product/contract verification
- controlled repair action boundary
- deterministic evidence generation
- readonly build/environment command execution
- dedicated CI verification

## Governance

Python may detect, analyze, propose and execute explicitly authorized narrow actions.
HooshyarOS Governance/Reasoning/Decision layers retain policy authority. APRVL must
never manufacture success, weaken a gate, mutate tests merely to obtain a pass, or
perform an unauthorized mutation.

## Production rule

A capability is considered operational only after implementation, unit/integration
coverage, CI verification, and platform-level acceptance evidence all pass.
