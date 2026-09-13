import { createWorkspaceRepairMission } from "../Autonomous/Runtime/AutonomousBuildDaemon";
import { Mission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousBuildDaemon workspace recovery", () => {
    it("turns a dirty assistant handoff into a repair mission before platform continuation", () => {
        const selected: Mission = {
            capabilityId: "assistant.completion.gate",
            capability: "HooshyarOS Autonomous Assistant completion gate",
            targetEngine: "Autonomous Operations Engine",
            evidence: {
                root: "D:/HooshyarOS",
                commit: "0fdd4c84",
                clean: false,
                architectureFiles: [],
                engineCount: 5,
                runtimeFileCount: 10,
                latestCommits: []
            },
            directives: [],
            dependencies: [],
            architectureRules: []
        };

        const repair = createWorkspaceRepairMission(selected);

        expect(repair.capabilityId).toBe("repair-0fdd4c84");
        expect(repair.targetEngine).toBe("Autonomous Operations Engine");
        expect(repair.dependencies).toEqual([]);
        expect(repair.capability).toContain("before continuing assistant.completion.gate");
        expect(repair.evidence.clean).toBe(false);
    });

    it("preserves the checkpoint commit used to identify the dirty workspace", () => {
        const selected: Mission = {
            capabilityId: "product.financial-data-ingestion",
            capability: "implement governed financial ingestion",
            targetEngine: "Financial Data Ingestion Adapter",
            evidence: {
                root: "D:/HooshyarOS",
                commit: "abcdef12",
                clean: false,
                architectureFiles: [],
                engineCount: 5,
                runtimeFileCount: 10,
                latestCommits: []
            },
            directives: [],
            dependencies: ["Commercial Persistence Boundary"],
            architectureRules: []
        };

        const repair = createWorkspaceRepairMission(selected);

        expect(repair.capabilityId).toBe("repair-abcdef12");
        expect(repair.capability).toContain("product.financial-data-ingestion");
    });
});
