import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * `npm install` rewrites `package-lock.json` whenever the committed lockfile is
 * not a fixed point of npm's lockfile writer. On the Windows factory runner that
 * turned the worktree dirty *after* a clean checkout, so
 * `FinalProductFactoryRunner.assertCleanRepo()` failed with
 * `FACTORY_WORKTREE_DIRTY: M package-lock.json` before the factory could run —
 * taking the `windows-product-factory` and `release-gate` jobs with it.
 *
 * The concrete drift was `better-sqlite3@13.0.3`: npm records
 * `"hasInstallScript": true` for every package that requires a build
 * (an `install`/`preinstall`/`postinstall` script or a `binding.gyp`), but the
 * committed lockfile was written by an older npm that omitted the field. This
 * guard fails loudly instead of relying on a red CI job to reveal the drift.
 */

const root = resolve(__dirname, "../../..");

interface LockEntry {
    version?: string;
    hasInstallScript?: boolean;
    link?: boolean;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

interface PackageManifest {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

const packageJson = readJson<PackageManifest>(join(root, "package.json"));
const packageLock = readJson<{ lockfileVersion?: number; packages?: Record<string, LockEntry> }>(
    join(root, "package-lock.json"),
);

describe("npm lockfile integrity", () => {
    it("keeps the root lockfile dependency blocks in sync with the package manifest", () => {
        expect(packageLock.lockfileVersion).toBe(3);
        const rootEntry = packageLock.packages?.[""];
        expect(rootEntry).toBeDefined();
        expect(rootEntry?.dependencies ?? {}).toEqual(packageJson.dependencies ?? {});
        expect(rootEntry?.devDependencies ?? {}).toEqual(packageJson.devDependencies ?? {});
    });

    it("marks every installed package that requires a build with hasInstallScript", () => {
        const missing: string[] = [];
        for (const [key, entry] of Object.entries(packageLock.packages ?? {})) {
            if (!key.startsWith("node_modules/") || entry.link === true) continue;
            const packageDir = join(root, key);
            const manifestPath = join(packageDir, "package.json");
            if (!existsSync(manifestPath)) continue;
            const manifest = readJson<PackageManifest>(manifestPath);
            const scripts = manifest.scripts ?? {};
            const requiresBuild =
                Boolean(scripts.preinstall || scripts.install || scripts.postinstall) ||
                existsSync(join(packageDir, "binding.gyp"));
            if (requiresBuild && entry.hasInstallScript !== true) missing.push(key);
        }
        expect(missing).toEqual([]);
    });
});
