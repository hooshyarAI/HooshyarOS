import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousProjectMission", () => {
    it("selects the first genuinely missing canonical platform capability", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-mission-"));
        try {
            const mission = new AutonomousProjectMission(root);
            const next = mission.nextPlatformMission();

            expect(next?.capabilityId).toBe("platform.user-management");
            expect(next?.targetEngine).toBe("User Management Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("does not treat an implementation file alone as a completed capability", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-evidence-"));
        try {
            mkdirSync(join(root, "Backend", "HBOS", "Engines"), { recursive: true });
            writeFileSync(join(root, "Backend", "HBOS", "Engines", "UserManagementEngine.ts"), "export class UserManagementEngine {}\n");

            const mission = new AutonomousProjectMission(root);
            const next = mission.nextPlatformMission();

            expect(next?.capabilityId).toBe("platform.user-management");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("does not treat identity-only test and documentation as completed behavioral evidence", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-evidence-incomplete-"));
        try {
            mkdirSync(join(root, "Backend", "HBOS", "Engines"), { recursive: true });
            mkdirSync(join(root, "Backend", "HBOS", "test"), { recursive: true });
            mkdirSync(join(root, "Docs", "Engines"), { recursive: true });
            writeFileSync(join(root, "Backend", "HBOS", "Engines", "UserManagementEngine.ts"), "export class UserManagementEngine { registerUser(value: string) { return value; } }\n");
            writeFileSync(join(root, "Backend", "HBOS", "test", "UserManagementEngine.test.ts"), "describe('UserManagementEngine', () => { expect(true).toBe(true); });\n");
            writeFileSync(join(root, "Docs", "Engines", "UserManagementEngine.md"), "# User Management Engine\n");

            const mission = new AutonomousProjectMission(root);
            const next = mission.nextPlatformMission();

            expect(next?.capabilityId).toBe("platform.user-management");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("recognizes a capability only after behavioral implementation and focused verification evidence exist", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-evidence-complete-"));
        try {
            mkdirSync(join(root, "Backend", "HBOS", "Engines"), { recursive: true });
            mkdirSync(join(root, "Backend", "HBOS", "test"), { recursive: true });
            mkdirSync(join(root, "Docs", "Engines"), { recursive: true });
            writeFileSync(join(root, "Backend", "HBOS", "Engines", "UserManagementEngine.ts"), "export class UserManagementEngine { registerUser(value: string) { return value; } }\n");
            writeFileSync(join(root, "Backend", "HBOS", "test", "UserManagementEngine.test.ts"), "describe('UserManagementEngine', () => { test('registers', () => { expect(new UserManagementEngine().registerUser('ali')).toBe('ali'); }); });\n");
            writeFileSync(join(root, "Docs", "Engines", "UserManagementEngine.md"), "# User Management Engine\n");

            const mission = new AutonomousProjectMission(root);
            const next = mission.nextPlatformMission();

            expect(next?.capabilityId).toBe("platform.organization-model");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("keeps the completion gate separate from real platform capabilities", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextMission();

        expect(next.capabilityId).not.toBe("platform.continuation");
    });
});
