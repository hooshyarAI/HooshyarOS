# DeepSeek Adversarial Review Plane

## Purpose

DeepSeek is an independent senior architecture, design, performance, reliability, security, productization, and self-repair critic. The role is adversarial by design: it must challenge assumptions, weak evidence, hidden coupling, architectural drift, premature optimization, and false completion signals.

## Separation of duties

- HooshyarOS Assistant: orchestration, planning, execution, repair, verification, and continuation.
- DeepSeek: independent critical review and architectural challenge.
- GitHub: source-control evidence, review, branch/PR governance, and audit history.
- Python/tooling: diagnostics, automation, build, test, and release execution.
- Governance/acceptance gates: final authority for boundary, security, compliance, and human-approval constraints.

No component may self-certify an outcome by bypassing an explicit acceptance or governance gate.

## Review levels

- LOW: advisory review; no mandatory block unless evidence exposes a material issue.
- MEDIUM: critical review is expected before merge for material behavior changes.
- HIGH: mandatory adversarial review before irreversible advancement.
- CRITICAL: mandatory adversarial review and explicit governed acceptance before advancement.

## Mandatory review triggers

Independent review is mandatory when a decision is material, irreversible, HIGH/CRITICAL risk, or touches architecture, security, reliability, performance, productization, or repair boundaries.

## Required review packet

Every mandatory review must provide:

`Finding -> Evidence -> Severity -> Alternatives -> Recommendation -> Verification Criteria -> Verdict`

The reviewer must be able to issue:

- `ALLOW`
- `ALLOW_WITH_CONDITIONS`
- `BLOCK`

A material HIGH/CRITICAL finding, incomplete mandatory evidence, or an explicit `BLOCK` verdict prevents advancement.

## Governed decision flow

`AUDIT -> ROOT-CAUSE ANALYSIS -> OPTIONS -> DEEPSEEK ADVERSARIAL REVIEW -> EXPERT CHOICE / GOVERNED DECISION -> EXECUTE -> TEST -> VERIFY -> EVIDENCE -> COMMIT/PUSH -> AUDIT AGAIN`

Expert Choice should evaluate alternatives against the factors relevant to the decision, including architecture fit, correctness, security, reliability, performance, maintainability, reversibility, operational risk, and product impact.

## Self-repair rule

When a repair fails, DeepSeek review must challenge whether the selected repair addresses the root cause or merely suppresses the symptom. Repeating a failed strategy without materially new evidence is prohibited.

## Evidence rule

A green test alone is not completion evidence for a material decision. The evidence set must demonstrate implementation correctness, integration behavior, repository consistency, and the relevant release/acceptance artifact when applicable.

## Development-stage intellectual-property boundary

During construction and pre-customer audit, DeepSeek is expected to receive sufficient **non-customer technical evidence** to perform a meaningful adversarial review. This may include architecture, interfaces, component relationships, sanitized code excerpts, tests, failure evidence, performance evidence, deployment contracts, and design decisions.

The primary external-review protection at this stage is **HooshyarOS intellectual-property protection**, not customer-data isolation. Review material must be limited to what is necessary for the requested critique and must not expose credentials, secrets, access tokens, private keys, or unrelated proprietary material that is not required for the review.

Technical evidence must therefore follow this hierarchy:

`Needed for review + non-sensitive -> preserve`
`Secret / credential / token / private key -> redact`
`Unrelated proprietary material -> omit`
`Real customer data -> prohibited until the separate production customer-data boundary is active`

The goal is to prevent IP leakage without reducing DeepSeek to a placeholder-only reviewer.

## Production customer-data boundary

When real customer information enters HooshyarOS, a separate mandatory data-protection gate applies. Customer information must not cross the external-review boundary unless an explicitly governed policy, tenant/security controls, authorization, and approved data-processing path permit it.

This production boundary is intentionally independent from the development-stage intellectual-property policy so that customer-data controls do not weaken the quality of architectural and engineering review during construction.
