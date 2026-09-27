import fs from "node:fs";
import path from "node:path";

/**
 * Contract for the self-contained IExpress Windows installer.
 *
 * The broken artifact shipped installer scripts plus a bootstrap ZIP, while the
 * generated install.ps1 copied a sibling `payload` directory that does not exist
 * after IExpress extraction, so installation always failed. These assertions lock
 * the repaired packaging boundary: the EXE must carry the canonical, validated
 * payload ZIP and install.ps1 must expand that ZIP from its own extracted files.
 */
describe("Windows self-contained IExpress installer", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const builder = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "productization_builder.py"),
        "utf8",
    );

    it("expands its own bundled payload instead of a sibling payload directory", () => {
        expect(builder).toContain("def _write_windows_installer_scripts");
        expect(builder).toContain("Expand-Archive");
        expect(builder).toContain("WINDOWS_BOOTSTRAP_NAME");
        expect(builder).toContain('"HooshyarOS-Windows-Bootstrap.zip"');
        expect(builder).not.toContain('Join-Path $Root "payload');
        expect(builder).not.toContain("payload\\*");
    });

    it("installs to ProgramData with correct self-elevation", () => {
        expect(builder).toContain("WindowsBuiltInRole]::Administrator");
        expect(builder).toContain("-Verb RunAs");
        expect(builder).toContain('Join-Path $env:ProgramData "HooshyarOS"');
    });

    it("creates the runtime, data directory, launcher and uninstall entry", () => {
        expect(builder).toContain("Start HooshyarOS.cmd");
        expect(builder).toContain("Uninstall HooshyarOS.cmd");
        expect(builder).toContain("launch-hooshyar.vbs");
        expect(builder).toContain("Remove-Item -LiteralPath $InstallRoot -Recurse -Force");
    });

    it("bundles the canonical validated payload and an uninstallable IExpress package", () => {
        expect(builder).toContain("release_product_builder.py");
        expect(builder).toContain("def _validate_windows_bootstrap");
        expect(builder).toContain("WINDOWS_BOOTSTRAP_REQUIRED_MEMBERS");
        expect(builder).toContain("AppLaunched=install.cmd");
        expect(builder).toContain("FILE3=");
        expect(builder).toContain('TargetName={exe}');
        expect(builder).toContain('exe = WINDOWS_ROOT / "HooshyarOS-Setup.exe"');
    });
});
