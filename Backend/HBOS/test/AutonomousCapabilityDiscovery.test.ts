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

    it("discovers product capabilities from the durable product roadmap", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-product-discovery-"));
        mkdirSync(join(root, "Docs", "Product"), { recursive: true });
        writeFileSync(
            join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json"),
            JSON.stringify({
                capabilities: [{
                    capabilityId: "product.example",
                    capability: "implement product example",
                    targetEngine: "Example Engine",
                    dependencies: ["Reasoning Engine"],
                    implementationPath: "Backend/HBOS/Product/Example.ts",
                    testPath: "Backend/HBOS/test/Example.test.ts",
                    documentationPath: "Docs/Product/Example.md"
                }]
            })
        );

        const capabilities = new AutonomousCapabilityDiscovery().discover(root);
        const capability = capabilities.find(item => item.capabilityId === "product.example");
        expect(capability).toEqual({
            capabilityId: "product.example",
            capability: "implement product example",
            targetEngine: "Example Engine",
            dependencies: ["Reasoning Engine"],
            requiredPaths: [
                join(root, "Backend/HBOS/Product/Example.ts"),
                join(root, "Backend/HBOS/test/Example.test.ts"),
                join(root, "Docs/Product/Example.md")
            ]
        });
    });
});
