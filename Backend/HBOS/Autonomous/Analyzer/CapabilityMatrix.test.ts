import { CapabilityMatrix } from "./CapabilityMatrix";

describe("CapabilityMatrix", () => {
    it("classifies normalized gate evidence and exposes the first actionable blocker", () => {
        const matrix = new CapabilityMatrix();
        const snapshots = matrix.evaluate([
            {
                name: "financial-ingestion",
                evidence: [
                    { capability: "financial-ingestion", stage: "DOCUMENTED", evidence: ["repository-discovery"] },
                    { capability: "financial-ingestion", stage: "IMPLEMENTED", evidence: ["required-artifacts-present"] },
                    { capability: "financial-ingestion", stage: "BEHAVIORALLY_VERIFIED", evidence: ["focused-test"] },
                ],
            },
            {
                name: "backup-restore",
                evidence: [
                    { capability: "backup-restore", stage: "DOCUMENTED", evidence: ["repository-discovery"] },
                    { capability: "backup-restore", stage: "IMPLEMENTED", evidence: ["required-artifacts-present"] },
                ],
            },
        ]);

        expect(snapshots[0]).toMatchObject({ name: "financial-ingestion", stage: "BEHAVIORALLY_VERIFIED" });
        expect(snapshots[0].blockers).toEqual([]);
        expect(snapshots[1]).toMatchObject({ name: "backup-restore", stage: "IMPLEMENTED" });
        expect(snapshots[1].blockers).toEqual([]);
        expect(matrix.highestPriorityBlocker(snapshots)).toBeNull();
    });

    it("blocks a capability when no normalized evidence exists", () => {
        const matrix = new CapabilityMatrix();
        const snapshots = matrix.evaluate([{ name: "backup", evidence: [] }]);

        expect(snapshots[0]).toEqual({
            name: "backup",
            stage: "DOCUMENTED",
            blockers: ["No evidence supplied"],
        });
        expect(matrix.highestPriorityBlocker(snapshots)?.name).toBe("backup");
    });
});
