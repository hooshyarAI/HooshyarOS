import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { AutonomousPlatformContinuation } from "../Autonomous/Runtime/AutonomousPlatformContinuation";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

function seedFiles(root: string, files: string[]): void {
    files.forEach(file => {
        const path = join(root, file);
        mkdirSync(join(path, ".."), { recursive: true });
        require("node:fs").writeFileSync(path, "ok", "utf8");
    });
}

const performanceFiles = [
    "Backend/HBOS/Engines/PerformanceTestingEngine.ts",
    "Backend/HBOS/test/PerformanceTestingEngine.test.ts",
    "Docs/Engines/PerformanceTestingEngine.md"
];

const customerFiles = [
    "Backend/HBOS/Engines/CustomerTestingEngine.ts",
    "Backend/HBOS/test/CustomerTestingEngine.test.ts",
    "Docs/Engines/CustomerTestingEngine.md"
];

const deploymentReadinessFiles = [
    "Backend/HBOS/Engines/DeploymentReadinessEngine.ts",
    "Backend/HBOS/test/DeploymentReadinessEngine.test.ts",
    "Docs/Engines/DeploymentReadinessEngine.md"
];

describe("AutonomousPlatformContinuation", () => {
    it("creates the canonical post-Assistant platform continuation mission", () => {
        const mission = new AutonomousPlatformContinuation().createMission();

        expect(mission.capabilityId).toBe("platform.continuation");
        expect(mission.source).toBe("assistant.completion.gate");
        expect(mission.instruction).toContain("AUDIT");
        expect(mission.instruction).toContain("IMPLEMENT");
        expect(mission.instruction).toContain("VERIFY");
        expect(mission.instruction).toContain("PUSH");
    });

    it("delegates continuation selection to the canonical platform backlog", () => {
        const projectMission = new AutonomousProjectMission(process.cwd());
        const continuation = new AutonomousPlatformContinuation();
        const selected = continuation.selectNextCapability(projectMission);

        expect(selected === null || selected.capabilityId).toBeTruthy();
        expect(selected?.capabilityId).not.toBe("platform.continuation");
    });

    it("selects customer testing after performance testing is complete", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-customer-continuation-"));
        try {
            seedFiles(root, performanceFiles);
            const projectMission = {
                nextPlatformMission: () => null,
                snapshot: () => ({ root })
            } as unknown as AutonomousProjectMission;
            const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);

            expect(selected?.capabilityId).toBe("platform.customer-testing");
            expect(selected?.targetEngine).toBe("Customer Testing Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("selects performance testing when the production extension chain is missing", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-performance-continuation-"));
        try {
            const projectMission = {
                nextPlatformMission: () => null,
                snapshot: () => ({ root })
            } as unknown as AutonomousProjectMission;
            const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);

            expect(selected?.capabilityId).toBe("platform.performance-testing");
            expect(selected?.targetEngine).toBe("Performance Testing Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("selects deployment readiness after customer testing is complete", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-deployment-readiness-continuation-"));
        try {
            seedFiles(root, [...performanceFiles, ...customerFiles]);
            const projectMission = {
                nextPlatformMission: () => null,
                snapshot: () => ({ root })
            } as unknown as AutonomousProjectMission;
            const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);

            expect(selected?.capabilityId).toBe("platform.deployment-readiness");
            expect(selected?.targetEngine).toBe("Deployment Readiness Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("returns null when the production extension chain is exhausted", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-production-complete-"));
        try {
            seedFiles(root, [...performanceFiles, ...customerFiles, ...deploymentReadinessFiles]);
            const projectMission = {
                nextPlatformMission: () => null,
                snapshot: () => ({ root })
            } as unknown as AutonomousProjectMission;

            expect(new AutonomousPlatformContinuation().selectNextCapability(projectMission)).toBeNull();
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
