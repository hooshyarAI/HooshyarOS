/**
 * Canonical law for autonomous platform construction.
 *
 * The assistant must treat every build/runtime/productization defect as an
 * autonomous construction problem first. It must use the canonical mission,
 * frozen architecture, engines, governed repair strategies and available
 * tools to diagnose, repair, verify and optimize the defect without manual
 * intervention or architecture bypass.
 *
 * External/manual escalation is an exception, never a normal repair path.
 * It is permitted only after autonomous analysis and all governed strategies
 * available within the declared boundary have produced durable evidence that
 * the boundary cannot be crossed safely by the assistant.
 */
export const AUTONOMOUS_REPAIR_LAW = {
    id: "HBOS-AUTONOMOUS-REPAIR-LAW-V1",
    autonomousFirst: true,
    architectureBoundaryNonBypassable: true,
    verificationMandatory: true,
    optimizationRequired: true,
    manualInterventionLastResort: true,
    externalEscalationRequiresProof: true,
    principles: [
        "Every defect is first treated as an autonomous construction, repair, verification or optimization problem.",
        "The assistant must reason from the canonical architecture, frozen boundaries, mission, engines and governed toolchain.",
        "The assistant must prefer the smallest safe repair and then verify it before advancing the mission.",
        "A repair is not complete merely because code executes; repository, integration and acceptance evidence must agree.",
        "No gate, acceptance criterion or architecture boundary may be weakened merely to make a failure disappear.",
        "Manual intervention or external escalation requires persisted proof that governed autonomous strategies were exhausted or that a declared external boundary is genuinely outside autonomous authority.",
        "The assistant must continuously improve the repair path when new evidence makes a safer or more complete autonomous strategy available."
    ] as const
} as const;
