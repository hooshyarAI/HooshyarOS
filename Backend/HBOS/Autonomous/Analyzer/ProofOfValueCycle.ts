import { TrialValueMeasurement, TrialValueReport, evaluateTrialValue } from "./TrialValueMeasurement";

export type ProofOfValueOutcome = "VALUE_PROVEN" | "VALUE_NOT_PROVEN";

export interface ProofOfValueCycleResult {
    measurement: TrialValueMeasurement;
    report: TrialValueReport;
    outcome: ProofOfValueOutcome;
}

export function evaluateProofOfValueCycle(
    measurement: TrialValueMeasurement,
): ProofOfValueCycleResult {
    const report = evaluateTrialValue(measurement);

    return {
        measurement,
        report,
        outcome: report.valueProven ? "VALUE_PROVEN" : "VALUE_NOT_PROVEN",
    };
}
