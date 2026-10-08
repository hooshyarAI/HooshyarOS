import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * CI workflows and qualification/harness scripts name the focused test files
 * they gate on. When a test is relocated those references silently rot: Jest
 * ignores a pattern that matches nothing, so a stale path means a named gate
 * quietly stops running (and the aggregate qualification runner reports
 * BLOCK_INTERNAL forever because a "required" test can never be found).
 *
 * This guard makes that class of drift fail loudly instead of silently.
 */

const root = resolve(__dirname, "../../..");

/** Matches repository-relative `*.test.*` paths used by executable artifacts. */
const TEST_PATH_PATTERN = /(?:Backend|scripts|qa|android|Frontend)\/[A-Za-z0-9_./-]*\.test\.[A-Za-z]+/g;
const SCANNED_EXTENSIONS = /\.(ya?ml|cjs|js|mjs|ts|json|sh|ps1)$/i;

function scannedFiles(): string[] {
    const files = [join(root, "package.json")];
    for (const dir of [".github/workflows", "scripts"]) {
        for (const entry of readdirSync(join(root, dir))) {
            const file = join(root, dir, entry);
            if (SCANNED_EXTENSIONS.test(file)) files.push(file);
        }
    }
    return files;
}

function referencedTestPaths(): Map<string, string[]> {
    const references = new Map<string, string[]>();
    for (const file of scannedFiles()) {
        const content = readFileSync(file, "utf8");
        for (const match of content.matchAll(TEST_PATH_PATTERN)) {
            const referenced = match[0];
            const sources = references.get(referenced) ?? [];
            sources.push(file.slice(root.length + 1));
            references.set(referenced, sources);
        }
    }
    return references;
}

describe("Test reference integrity", () => {
    it("every test path referenced by CI, package scripts or harnesses exists", () => {
        const references = referencedTestPaths();
        expect(references.size).toBeGreaterThan(0);
        const missing = [...references.entries()]
            .filter(([referenced]) => !existsSync(join(root, referenced)))
            .map(([referenced, sources]) => `${referenced} (referenced by ${[...new Set(sources)].join(", ")})`);
        expect(missing).toEqual([]);
    });

    it("the aggregate final-product qualification gates are all present on disk", () => {
        const runner = readFileSync(join(root, "scripts", "final-product-qualification.cjs"), "utf8");
        const gateTests = [...runner.matchAll(TEST_PATH_PATTERN)].map((match) => match[0]);
        expect(gateTests.length).toBeGreaterThanOrEqual(20);
        expect(gateTests.filter((file) => !existsSync(join(root, file)))).toEqual([]);
    });
});
