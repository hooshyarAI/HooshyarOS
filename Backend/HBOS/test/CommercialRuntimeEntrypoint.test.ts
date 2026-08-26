import fs from "node:fs";
import path from "node:path";

describe("Commercial runtime executable entrypoint", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
        scripts?: Record<string, string>;
    };
    const entrypoint = fs.readFileSync(
        path.join(root, "Backend", "HBOS", "Autonomous", "Runtime", "start-commercial-runtime.ts"),
        "utf8",
    );
    const builder = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "release_product_builder.py"),
        "utf8",
    );

    it("exposes a real start command and listens on the configured host/port", () => {
        expect(packageJson.scripts?.["start:commercial"]).toContain("start-commercial-runtime.ts");
        expect(entrypoint).toContain("createCommercialRuntimeServer");
        expect(entrypoint).toContain("server.listen(port, host");
        expect(entrypoint).toContain("HOOSHYAR_HOST");
        expect(entrypoint).toContain("HOOSHYAR_PORT");
    });

    it("makes the Windows payload self-contained", () => {
        expect(builder).toContain("shutil.which(\"node\")");
        expect(builder).toContain("node-runtime");
        expect(builder).toContain("node.exe");
        expect(builder).toContain("start-commercial-runtime.ts");
        expect(builder).toContain("tsx\\dist\\cli.mjs");
        expect(builder).toContain("127.0.0.1:4173/health");
    });
});
