import { AutonomousBuilderAgent } from "../Assistant/Autonomous/Production/AutonomousBuilderAgent";

describe("AutonomousBuilderAgent", () => {
    it("delegates non-empty construction to the Python-owned daemon", () => {
        const result = new AutonomousBuilderAgent().build("continue autonomous construction");

        expect(result).toEqual({
            request: "continue autonomous construction",
            provider: "python",
            status: "READY",
            delegated: true,
            owner: "AutonomousBuildDaemon"
        });
    });

    it("blocks an empty construction request", () => {
        const result = new AutonomousBuilderAgent().build(" ");

        expect(result.status).toBe("BLOCKED");
        expect(result.delegated).toBe(false);
        expect(result.provider).toBe("python");
    });
});
