import fs from "node:fs";
import path from "node:path";

/**
 * `installer/HooshyarOS.iss` `[Run]` activated `launch-hooshyar.vbs` without a
 * silent guard, so an unattended install (`/VERYSILENT`, used by the release
 * workflow and by every acceptance harness) started the runtime and a browser.
 * Those descendants inherited the CI step's stdio handles, so the
 * `release-artifacts.yml` `windows-installer` job never finished its health
 * check and was cancelled at its 45-minute timeout — with orphan `node` and
 * `msedge` processes left behind. It was systemic: cancelled at both 5963e4b5
 * and 0f7cea39.
 *
 * The installed-product acceptance harness had already learned this the hard
 * way (a silent install raced its own launch with `database is locked`), but it
 * only patched its own isolated copy of the installer, which hid the canonical
 * defect. These tests pin the canonical contract so neither can regress
 * silently again.
 */

const root = path.resolve(__dirname, "..", "..", "..");
const issPath = path.join(root, "installer", "HooshyarOS.iss");
const iss = fs.readFileSync(issPath, "utf8");
const harnessPath = path.join(root, "scripts", "installed-product-acceptance.cjs");
const harness = fs.readFileSync(harnessPath, "utf8");

function entryFlags(entry: string): string[] {
    const match = /Flags:\s*([^;]*)/.exec(entry);
    return (match?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
}

describe("installer silent-install contract", () => {
    it("skips the post-install product launch in silent/unattended mode", () => {
        const runEntries = iss.split(/\r?\n/).filter((line) => line.trim().startsWith("Filename:"));
        expect(runEntries.length).toBeGreaterThan(0);

        const launchEntries = runEntries.filter((line) => line.includes("launch-hooshyar"));
        expect(launchEntries.length).toBeGreaterThan(0);

        for (const entry of launchEntries) {
            expect(entryFlags(entry)).toContain("skipifsilent");
        }
    });

    it("keeps the interactive launch and the real installed shortcut target", () => {
        const runEntries = iss.split(/\r?\n/).filter((line) => line.trim().startsWith("Filename:"));
        for (const entry of runEntries.filter((line) => line.includes("launch-hooshyar"))) {
            const flags = entryFlags(entry);
            expect(flags).toContain("nowait");
            expect(entry).toContain("wscript.exe");
            expect(entry).toContain("{app}\\launch-hooshyar.vbs");
        }
        expect(iss).toContain('Name: "{autodesktop}\\HooshyarOS"');
        expect(iss).toContain('Name: "{autoprograms}\\HooshyarOS\\HooshyarOS"');
    });

    it("makes the acceptance harness fail closed instead of patching its own installer copy", () => {
        expect(harness).toContain("skipifsilent");
        expect(harness).toContain("/skipifsilent/.test(canonical)");
        expect(harness).not.toMatch(
            /replace\(\/Flags: runhidden nowait\/, 'Flags: runhidden nowait skipifsilent'\)/,
        );
    });
});
