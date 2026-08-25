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

    it("packages the runtime executable and entrypoint", () => {
        expect(builder).toContain('shutil.which("node")');
        expect(builder).toContain('payload / "node.exe"');
        expect(builder).toContain("CommercialRuntimeEntrypoint.ts");
        expect(builder).toContain("--experimental-strip-types");
    });

    it("makes installation observable and creates a launch surface", () => {
        expect(builder).toContain("/health");
        expect(builder).toContain("HooshyarOS.lnk");
        expect(builder).toContain("Microsoft\\Windows\\Start Menu\\Programs\\HooshyarOS");
        expect(builder).toContain("HooshyarOS installed and health-checked");
        expect(builder).toContain("launch-hooshyar.cmd");
        expect(builder).toContain("launch-hooshyar.vbs");
        expect(builder).toContain("Install-HooshyarOS.ps1");
        expect(builder).toContain('$installRoot = Join-Path $env:LOCALAPPDATA "HooshyarOS"');
    });

    it("creates a reproducible bootstrap archive without fake PowerShell extraction", () => {
        expect(builder).toContain("HooshyarOS-Windows-Bootstrap.zip");
        expect(builder).toContain("zipfile.ZipFile");
        expect(builder).toContain("zipfile.ZIP_DEFLATED");
        expect(builder).not.toContain("Expand-Archive -Path $zip -DestinationPath $stage -Force");
    });

    it("requires the commercial runtime and web entrypoint in the payload", () => {
        expect(builder).toContain("CommercialRuntimeEntrypoint.ts");
        expect(builder).toContain("Frontend/HooshyarWebApp/index.ts");
        expect(builder).toContain("product-manifest.json");
        expect(builder).toContain('web = payload / "web"');
        expect(builder).toContain('"index.html"');
    });
});
