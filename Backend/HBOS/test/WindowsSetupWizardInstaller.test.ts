import fs from "node:fs";
import path from "node:path";

/**
 * Contract for the user-facing Inno Setup Windows installer.
 *
 * The productization layer used to build an IExpress bootstrap whose install.ps1
 * expanded a sibling payload directory. It could not present a Setup Wizard and
 * its installation depended on script extraction. The canonical installer is now
 * the Inno Setup definition (`installer/HooshyarOS.iss`) compiled by
 * `productization_builder.py`, with the complete, behaviorally validated runtime
 * payload embedded in the Setup EXE.
 */
describe("Windows Setup Wizard installer", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const builder = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "productization_builder.py"),
        "utf8",
    );
    const worker = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "productization_worker.py"),
        "utf8",
    );
    const iss = fs.readFileSync(path.join(root, "installer", "HooshyarOS.iss"), "utf8");

    it("compiles the canonical Inno Setup wizard instead of an IExpress bootstrap", () => {
        expect(builder).toContain("WINDOWS_INSTALLER_SCRIPT");
        expect(builder).toContain("def discover_inno_setup");
        expect(builder).toContain("def provision_inno_setup");
        expect(builder).toContain('"JRSoftware.InnoSetup.7"');
        expect(builder).not.toContain("AppLaunched=install.cmd");
        expect(builder).not.toContain("_write_windows_installer_scripts");
        expect(builder).not.toContain("Expand-Archive");
    });

    it("embeds the validated payload and validates the produced Setup EXE", () => {
        expect(iss).toContain('Source: "..\\dist\\productization\\windows\\payload\\*"');
        expect(builder).toContain("WINDOWS_BOOTSTRAP_REQUIRED_MEMBERS");
        expect(builder).toContain("def _validate_windows_setup_exe");
        expect(builder).toContain("def windows_setup_output");
        expect(builder).toContain("release_product_builder.py");
    });

    it("presents a standard wizard with welcome, install location, shortcuts and completion launch", () => {
        expect(iss).toContain("WizardStyle=modern");
        expect(iss).toContain("DisableWelcomePage=no");
        expect(iss).toContain("DefaultDirName={localappdata}\\Programs\\HooshyarOS");
        expect(iss).toContain('Name: "{autoprograms}\\HooshyarOS\\HooshyarOS"');
        expect(iss).toContain('Name: "{autodesktop}\\HooshyarOS"');
        expect(iss).toContain("postinstall");
        expect(iss).toContain("skipifsilent");
    });

    it("registers the product for uninstall and never depends on repository paths at install time", () => {
        expect(iss).toContain("UninstallDisplayName={#AppName}");
        expect(iss).toContain("UninstallDisplayIcon={app}\\hooshyaros.ico");
        expect(iss).toContain("[UninstallDelete]");
        expect(builder).not.toContain("D:\\HooshyarOS");
        expect(iss).not.toContain("D:\\HooshyarOS");
    });

    it("consumes the versioned Setup EXE from the canonical installer directory", () => {
        expect(worker).toContain("def windows_setup_exe");
        expect(worker).toContain("HooshyarOS-Setup-*.exe");
        expect(worker).toContain("windows-real-exe-not-produced");
        expect(worker).toContain("windows-release-artifact-not-produced");
    });
});
