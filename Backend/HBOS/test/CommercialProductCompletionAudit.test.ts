import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());
        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("does not claim commercial completion when a deterministic behavioral quality failure exists", () => {
        const root = mkdtempSync(join(process.cwd(), ".tmp-commercial-quality-audit-"));
        try {
            const contractSource = resolve(process.cwd(), "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md");
            mkdirSync(join(root, "Docs/Product"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Infrastructure"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Auth"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Engines"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Product"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/test"), { recursive: true });

            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), readFileSync(contractSource, "utf8"), "utf8");
            writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } }), "utf8");
            for (const artifact of ["APIGatewayEngine.ts", "UserManagementEngine.ts", "OrganizationModelEngine.ts", "DashboardEngine.ts", "ReportsEngine.ts", "DeploymentContractEngine.ts"]) {
                writeFileSync(join(root, "Backend/HBOS/Engines", artifact), "", "utf8");
            }

            writeFileSync(join(root, "Backend/HBOS/Product/SyntheticQualityProbe.ts"), `export interface ProductCapabilityResult { status: "READY" | "BLOCKED"; }\n\nexport class SyntheticQualityProbe {\n    readonly capabilityId = "product.synthetic-quality-probe";\n    readonly targetEngine = "Executive Intelligence Engine";\n    initialize(): { status: "READY" } { return { status: "READY" }; }\n    execute(input: string): ProductCapabilityResult { return { status: input && input.trim() ? "READY" : "BLOCKED" }; }\n}\n`, "utf8");
            writeFileSync(join(root, "Backend/HBOS/test/SyntheticQualityProbe.test.ts"), `import { SyntheticQualityProbe } from "../Product/SyntheticQualityProbe";\n\ndescribe("SyntheticQualityProbe", () => {\n    it("exposes the canonical product boundary", () => { const service = new SyntheticQualityProbe(); expect(service.capabilityId).toBe("product.synthetic-quality-probe"); expect(service.targetEngine).toBe("Executive Intelligence Engine"); expect(service.initialize().status).toBe("READY"); });\n    it("accepts continue", () => { expect(new SyntheticQualityProbe().execute("continue").status).toBe("READY"); });\n    it("blocks blank input", () => { expect(new SyntheticQualityProbe().execute(" ").status).toBe("BLOCKED"); });\n});\n`, "utf8");
            writeFileSync(join(root, "Docs/Product/SyntheticQualityProbe.md"), "# SyntheticQualityProbe\n", "utf8");
            writeFileSync(join(root, "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json"), JSON.stringify({ capabilities: [{ capabilityId: "product.synthetic-quality-probe", implementationPath: "Backend/HBOS/Product/SyntheticQualityProbe.ts", testPath: "Backend/HBOS/test/SyntheticQualityProbe.test.ts", documentationPath: "Docs/Product/SyntheticQualityProbe.md" }] }), "utf8");

            const result = new CommercialProductCompletionAudit().audit(root);
            expect(result.complete).toBe(false);
            expect(result.missingLayers.some(layer => layer === "quality:product.synthetic-quality-probe:trivial-scaffold")).toBe(true);
            expect(result.missingLayers.some(layer => layer === "quality:product.synthetic-quality-probe:contract-only-test")).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("reports a missing commercial roadmap artifact instead of claiming completion", () => {
        const root = mkdtempSync(join(process.cwd(), ".tmp-commercial-audit-"));
        try {
            const contractSource = resolve(process.cwd(), "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md");
            mkdirSync(join(root, "Docs/Product"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Infrastructure"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Auth"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Engines"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), readFileSync(contractSource, "utf8"), "utf8");
            writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } }), "utf8");
            for (const artifact of ["APIGatewayEngine.ts", "UserManagementEngine.ts", "OrganizationModelEngine.ts", "DashboardEngine.ts", "ReportsEngine.ts", "DeploymentContractEngine.ts"]) writeFileSync(join(root, "Backend/HBOS/Engines", artifact), "", "utf8");
            writeFileSync(join(root, "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json"), JSON.stringify({ capabilities: [{ capabilityId: "product.synthetic-missing-artifact", implementationPath: "Backend/HBOS/Product/MissingService.ts", testPath: "Backend/HBOS/test/MissingService.test.ts", documentationPath: "Docs/Product/MissingService.md" }] }), "utf8");
            const result = new CommercialProductCompletionAudit().audit(root);
            expect(result.complete).toBe(false);
            expect(result.missingLayers).toContain("roadmap:product.synthetic-missing-artifact:Backend/HBOS/Product/MissingService.ts,Backend/HBOS/test/MissingService.test.ts,Docs/Product/MissingService.md");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
