import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { AutonomousCapabilityDiscovery } from "../Autonomous/Runtime/AutonomousCapabilityDiscovery";

describe("AutonomousCapabilityDiscovery", () => {
    it("discovers capability contracts from repository-owned engine documentation", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-discovery-"));
        mkdirSync(join(root, "Docs", "Engines"), { recursive: true });
        writeFileSync(
            join(root, "Docs", "Engines", "ExampleEngine.md"),
            "# Example\n\nCanonical autonomous capability: `platform.example`\n\nCapability: implement Example\n\nDependencies: HBOS Core, Governance Engine\n"
        );

        const [capability] = new AutonomousCapabilityDiscovery().discover(root);
        expect(capability.capabilityId).toBe("platform.example");
        expect(capability.targetEngine).toBe("ExampleEngine");
        expect(capability.dependencies).toEqual(["HBOS Core", "Governance Engine"]);
        expect(capability.requiredPaths).toEqual([
            join(root, "Backend", "HBOS", "Engines", "ExampleEngine.ts"),
            join(root, "Backend", "HBOS", "test", "ExampleEngine.test.ts"),
            join(root, "Docs", "Engines", "ExampleEngine.md")
        ]);
    });
});
