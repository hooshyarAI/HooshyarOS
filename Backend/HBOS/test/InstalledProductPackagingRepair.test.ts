import fs from "node:fs";
import path from "node:path";

describe("Installed product packaging repair", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const builder = fs.readFileSync(
        path.join(root, "Backend", "AI_Runtime", "release_product_builder.py"),
        "utf8",
    );
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8")) as {
        packages?: Record<string, unknown>;
    };
    const installer = fs.readFileSync(path.join(root, "installer", "HooshyarOS.iss"), "utf8");

    const requiredRuntimePackages = ["exceljs-hardened", "mammoth", "pdf-parse"];

    it("packages every declared production dependency required by the commercial runtime", () => {
        for (const name of requiredRuntimePackages) {
            expect(packageJson.dependencies?.[name]).toBeDefined();
            expect(packageLock.packages?.[`node_modules/${name}`]).toBeDefined();
            expect(builder).toContain(name);
        }
        expect(packageJson.dependencies?.["better-sqlite3"]).toBeDefined();
        expect(packageJson.devDependencies?.["tsx"]).toBeDefined();
        expect(builder).toContain("RUNTIME_DEPENDENCY_ROOTS = (\"tsx\",)");
    });

    it("places the runtime dependency closure where Node resolution from Backend/HBOS finds it", () => {
        expect(builder).toContain("_copy_runtime_node_modules(ROOT, payload)");
        expect(builder).toContain('payload / "node_modules" / "tsx" / "dist" / "cli.mjs"');
        expect(builder).toContain("def _resolve_package_dir");
        expect(builder).toContain("relative.as_posix()");
    });

    it("validates the packaged runtime behaviorally, not by file existence", () => {
        expect(builder).toContain("def _validate_packaged_runtime");
        expect(builder).toContain("require.resolve");
        expect(builder).toContain('payload / "Backend" / "HBOS"');
        expect(builder).toContain("/health");
        expect(builder).toContain("_terminate_process_tree");
        expect(builder).toContain("_validate_packaged_runtime(payload)");
    });

    it("fails packaging validation when a required runtime dependency is missing", () => {
        expect(builder).toContain("REQUIRED_RUNTIME_PACKAGES");
        expect(builder).toContain("cannot resolve required npm dependencies");
        expect(builder).toContain("customer payload incomplete");
        expect(builder).toContain("packaged commercial runtime did not become healthy");
    });

    it("waits for a real health success before opening the browser", () => {
        const launcher = builder.slice(builder.indexOf("def _write_launch_surface"));
        expect(launcher).toContain("Invoke-RestMethod -Uri $healthUrl");
        expect(launcher).toContain("$response.status -eq 'ok'");
        expect(launcher).toContain("$deadline = (Get-Date).AddSeconds(60)");
        const healthIndex = launcher.indexOf("$response.status -eq 'ok'");
        const browserIndex = launcher.indexOf("Start-Process $url");
        expect(healthIndex).toBeGreaterThan(-1);
        expect(browserIndex).toBeGreaterThan(healthIndex);
    });

    it("does not use a fixed delay to open the browser", () => {
        expect(builder).not.toContain("WScript.Sleep 2500");
        expect(builder).not.toContain("Start-Sleep -Seconds 2");
    });

    it("reports startup failure with an actionable message and leaves no orphan runtime", () => {
        const launcher = builder.slice(builder.indexOf("def _write_launch_surface"));
        expect(launcher).toContain("WScript.Shell");
        expect(launcher).toContain("taskkill /PID $process.Id /T /F");
        expect(launcher).toContain("HooshyarOS startup failed");
        expect(launcher).toContain("exit 1");
        expect(launcher).toContain("launch-hooshyar.ps1");
    });

    it("wires the HooshyarOS icon into the installer shortcuts", () => {
        expect(installer).toContain("IconFilename: \"{app}\\hooshyaros.ico\"");
        expect(installer).not.toContain("imageres.dll");
        const icon = path.join(root, "installer", "hooshyaros.ico");
        expect(fs.existsSync(icon)).toBe(true);
        const header = fs.readFileSync(icon).subarray(0, 4);
        expect(header[0]).toBe(0);
        expect(header[1]).toBe(0);
        expect(header[2]).toBe(1);
        expect(header[3]).toBe(0);
        expect(builder).toContain("ICON_ASSET");
    });
});
