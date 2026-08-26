import fs from "node:fs";
import path from "node:path";

describe("Windows product installer contract", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const builder = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "release_product_builder.py"),
        "utf8",
    );

    it("filters development artifacts from the customer payload", () => {
        expect(builder).toContain("def _should_skip_file");
        expect(builder).toContain("def _validate_windows_payload");
        expect(builder).toContain("__pycache__");
        expect(builder).toContain(".pyc");
        expect(builder).toContain(".test");
        expect(builder).toContain(".spec");
        expect(builder).not.toContain('shutil.copytree(src, payload / name, dirs_exist_ok=True)');
    });

    it("copies the runtime dependency closure", () => {
        expect(builder).toContain("def _runtime_dependency_names");
        expect(builder).toContain("def _copy_node_dependency");
        expect(builder).toContain("def _copy_runtime_node_modules");
        expect(builder).toContain("tsx");
        expect(builder).toContain("typescript");
    });

    it("bundles an executable Node runtime and an observable launch surface", () => {
        expect(builder).toContain('shutil.which("node")');
        expect(builder).toContain("node-runtime");
        expect(builder).toContain("node.exe");
        expect(builder).toContain("start-commercial-runtime.ts");
        expect(builder).toContain("launch-hooshyar.cmd");
        expect(builder).toContain("launch-hooshyar.vbs");
        expect(builder).toContain("127.0.0.1:4173/health");
        expect(builder).toContain("HooshyarOS installed and health-checked");
    });

    it("uses the runtime entrypoint rather than the development assistant", () => {
        expect(builder).toContain("tsx\\dist\\cli.mjs");
        expect(builder).not.toContain("hooshyar_build.py assistant");
    });

    it("requires the commercial runtime and web entrypoint in the payload", () => {
        expect(builder).toContain("CommercialRuntimeServer.ts");
        expect(builder).toContain("start-commercial-runtime.ts");
        expect(builder).toContain("Frontend/HooshyarWebApp/index.ts");
        expect(builder).toContain("product-manifest.json");
        expect(builder).toContain('web = payload / "web"');
        expect(builder).toContain('index = web / "index.html"');
    });
});
