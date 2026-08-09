import { AutonomousProjectConductor } from "../Builder/Autonomous/AutonomousProjectConductor";

describe("AutonomousProjectConductor", () => {
    it("inspects the repository and produces an ordered roadmap", () => {
        const conductor = new AutonomousProjectConductor(process.cwd());
        const roadmap = conductor.inspect({
            engines: ["Autonomous Operations Engine"],
            requiredCapabilities: ["autonomous construction"],
            architectureRules: ["Architecture Freeze V4"]
        });

        expect(roadmap.inventory.files.length).toBeGreaterThan(0);
        expect(roadmap.inventory.builders.length).toBeGreaterThan(0);
        expect(roadmap.inventory.tools.length).toBeGreaterThan(0);
        expect(Array.isArray(roadmap.gaps)).toBe(true);
        if (roadmap.gaps.length > 1) {
            expect(roadmap.gaps[0].priority).toBeGreaterThanOrEqual(roadmap.gaps[1].priority);
        }
    });
});
