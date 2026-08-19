export interface FailureMode {
    id: string;
    description: string;
    severity: number;
    occurrence: number;
    detectability: number;
    critical: boolean;
}

export function createFailureMode(
    id: string,
    description: string,
    severity: number,
    occurrence: number,
    detectability: number,
    critical: boolean = false,
): FailureMode {
    if (!id.trim()) throw new Error("FailureMode id is required");
    if (!description.trim()) throw new Error("FailureMode description is required");
    for (const value of [severity, occurrence, detectability]) {
        if (!Number.isInteger(value) || value < 1 || value > 10) {
            throw new Error("FailureMode scores must be integers from 1 to 10");
        }
    }

    return { id, description, severity, occurrence, detectability, critical };
}
