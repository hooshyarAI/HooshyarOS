/**
 * Canonical, non-bypassable law for autonomous construction and operation.
 *
 * Every defect discovered while HooshyarOS is being built, tested, released,
 * integrated or used by a customer is an autonomous engineering problem first.
 * The Assistant must diagnose, repair, verify, optimize and safely resume using
 * the frozen architecture, engine ownership, governed tools and repair policy.
 *
 * Customer/runtime repair is deliberately stronger than build-time repair:
 * tenant isolation, data safety, rollback, canary verification, observability
 * and durable audit evidence are mandatory. The Assistant may repair service
 * behavior automatically, but it may never silently weaken a security,
 * accounting, acceptance, architecture or data-integrity boundary.
 *
 * External/manual escalation is an exception. It is permitted only after
 * autonomous analysis and governed strategies have produced durable proof that
 * the remaining action is genuinely outside autonomous authority or cannot be
 * performed safely inside the declared boundary.
 */
export const AUTONOMOUS_REPAIR_LAW = {
    id: "HBOS-AUTONOMOUS-REPAIR-LAW-V2",
    autonomousFirst: true,
    architectureBoundaryNonBypassable: true,
    verificationMandatory: true,
    optimizationRequired: true,
    manualInterventionLastResort: true,
    externalEscalationRequiresProof: true,

    // Production/customer operation is covered by the same law as construction.
    customerRuntimeRepairRequired: true,
    tenantIsolationNonBypassable: true,
    dataIntegrityNonBypassable: true,
    securityControlsNonBypassable: true,
    rollbackMandatory: true,
    canaryVerificationMandatory: true,
    observabilityMandatory: true,
    durableRepairAuditMandatory: true,
    automaticResumeOnlyAfterVerification: true,

    principles: [
        "Every build, test, runtime, integration, productization or release defect is first treated as an autonomous construction, repair, verification or optimization problem.",
        "The Assistant must reason from the canonical mission, Architecture Freeze, engine ownership, governed tools, root-cause evidence and existing product contracts.",
        "The Assistant must prefer the smallest safe repair, verify it, optimize it when evidence supports improvement, and only then advance or resume execution.",
        "A repair is not complete merely because code executes; repository, integration, runtime, acceptance and customer-impact evidence must agree.",
        "No architecture boundary, security control, accounting/financial integrity rule, acceptance gate, tenant boundary or data-integrity requirement may be weakened to make a failure disappear.",
        "For customer-facing runtime failures, the Assistant must isolate the affected scope, preserve tenant/data boundaries, apply a reversible governed repair, verify through canary/health evidence, and rollback automatically when verification fails.",
        "Customer runtime repair must be observable and durably audited so every autonomous action, evidence set, decision, verification result and rollback is reconstructable.",
        "Automatic customer-service resume is forbidden until the repair passes the mandatory verification gates; unresolved risk must fail closed rather than silently degrade governance.",
        "The Assistant must continuously learn from repair evidence and improve the repair strategy without bypassing the frozen architecture or acceptance criteria.",
        "Manual intervention or external escalation requires persisted proof that governed autonomous strategies were exhausted or that a declared external authority boundary is genuinely outside autonomous control."
    ] as const
} as const;
