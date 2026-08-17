import { CapabilityMatrix } from "./CapabilityMatrix";

describe("CapabilityMatrix", () => {
    it("classifies capabilities and exposes the first actionable blocker", () => {
        const matrix = new CapabilityMatrix();
        const snapshots = matrix.evaluate([
            {
                name: "financial-ingestion",
                evidence: [
                    { stage: "DOCUMENTED", verified: true },
                    { stage: "IMPLEMENTED", verified: true },
                    { stage: "BEHAVIORALLY_VERIFIED", verified: true },
                ],
            },
            {
                name: "backup-restore",
                evidence: [
                    { stage: "DOCUMENTED", verified: true },
                    { stage: "IMPLEMENTED", verified: true },
                ],
            },
        ]);

        expect(snapshots[0].name).toBe("financial-ingestion");
        expect(snapshots[0].blockers.length).toBeGreaterThan(0);
        expect(snapshots[1].name).toBe("backup-restore");
        expect(matrix.highestPriorityBlocker(snapshots)?.name).toBe("financial-ingestion");
    });
});
