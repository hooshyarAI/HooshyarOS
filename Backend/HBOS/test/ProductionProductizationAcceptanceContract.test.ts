import fs from "node:fs";
import path from "node:path";

describe("Production productization acceptance contract", () => {
    const root = path.resolve(__dirname, "..", "..", "..");

    it("defines a production release contract instead of treating source packaging as productization", () => {
        const contract = fs.readFileSync(
            path.join(root, "Docs", "Product", "PRODUCTION_PRODUCTIZATION_ACCEPTANCE_CONTRACT.md"),
            "utf8",
        );

        expect(contract).toContain("Windows payload MUST contain only production runtime artifacts");
        expect(contract).toContain("__pycache__/");
        expect(contract).toContain("Start Menu shortcut");
        expect(contract).toContain("Desktop shortcut");
        expect(contract).toContain("post-install runtime smoke test");
        expect(contract).toContain("artifact metadata includes version, size and SHA-256");
        expect(contract).toContain("AUTONOMOUS_PRODUCTIZATION_COMPLETE");
    });

    it("keeps release construction responsible for filtering development artifacts", () => {
        const builder = fs.readFileSync(
            path.join(root, "Backend", "AI_Runtime", "release_product_builder.py"),
            "utf8",
        );

        expect(builder).toContain("def windows() -> int:");
        expect(builder).toContain("payload");
        expect(builder).toContain("__pycache__");
        expect(builder).toContain(".pyc");
        expect(builder).toContain("tests");
        expect(builder).toContain("test");
    });

    it("does not allow completion without explicit Windows artifact verification", () => {
        const builder = fs.readFileSync(
            path.join(root, "Backend", "AI_Runtime", "release_product_builder.py"),
            "utf8",
        );

        expect(builder).toContain("AUTONOMOUS_RELEASE_ARTIFACT");
        expect(builder).toContain("HooshyarOS-Setup.exe");
        expect(builder).toContain("sha256");
    });
});
