import fs from "node:fs";
import path from "node:path";

describe("Windows product installer contract", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const builder = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "release_product_builder.py"),
        "utf8",
    );
    const finalInstallerBuilder = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "final_windows_installer_builder.py"),
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

    it("copies only the runtime dependency closure", () => {
        expect(builder).toContain("def _runtime_dependency_names");
        expect(builder).toContain("def _copy_node_dependency");
        expect(builder).toContain("def _copy_runtime_node_modules");
        expect(builder).toContain('roots.add("tsx")');
    });

    it("makes installation observable and creates a launch surface", () => {
        expect(builder).toContain("/health");
        expect(builder).toContain("HooshyarOS.lnk");
        expect(builder).toContain("Microsoft/Windows/Start Menu/Programs/HooshyarOS");
        expect(builder).toContain("HooshyarOS installed and health-checked");
        expect(builder).toContain("launch-hooshyar.cmd");
        expect(builder).toContain("launch-hooshyar.vbs");
    });

    it("uses valid PowerShell quoting instead of backslash-escaped PowerShell strings", () => {
        expect(builder).toContain('$zip = Join-Path $here "HooshyarOS-Windows-Bootstrap.zip"');
        expect(builder).not.toContain('$zip=Join-Path $here \\"HooshyarOS-Windows-Bootstrap.zip\\"');
        expect(builder).toContain('Expand-Archive -Path $zip -DestinationPath $stage -Force');
    });

    it("requires the commercial runtime and web entrypoint in the payload", () => {
        expect(builder).toContain("CommercialRuntimeServer.ts");
        expect(builder).toContain("Frontend/HooshyarWebApp/index.ts");
        expect(builder).toContain("product-manifest.json");
        expect(builder).toContain("web/index.html");
    });

    it("starts the packaged Node runtime independently from the desktop shell", () => {
        expect(finalInstallerBuilder).toContain("WaitUntilReadyAsync");
        expect(finalInstallerBuilder).toContain("/api/dashboard");
        expect(finalInstallerBuilder).toContain("FileName = Node");
        expect(finalInstallerBuilder).toContain("UseShellExecute = false");
        expect(finalInstallerBuilder).toContain("CreateNoWindow = true");
        expect(finalInstallerBuilder).toContain("runtime started pid=");
        expect(finalInstallerBuilder).not.toContain("runtimeProcess.Kill(true)");
        expect(finalInstallerBuilder).not.toContain("browser.WaitForExit();");
    });
});
