import fs from "node:fs";
import path from "node:path";

const ENGINES_DIR = path.resolve(__dirname, "..", "Engines");
const HBOS_ROOT = path.resolve(__dirname, "..");

const CANONICAL_ENGINES: readonly string[] = [
    "ReasoningEngine",
    "GovernanceEngine",
    "ExecutiveIntelligenceEngine",
    "OrganizationalIntelligenceEngine",
    "AutonomousOperationsEngine"
];

function readClassNames(file: string): string[] {
    const src = fs.readFileSync(file, "utf8");
    const names: string[] = [];
    for (const m of src.matchAll(/\bclass\s+([A-Za-z0-9_]+)/g)) {
        names.push(m[1]);
    }
    return names;
}

function collectNonTestTsFiles(root: string): string[] {
    const out: string[] = [];
    if (!fs.existsSync(root)) return out;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "Engines") continue;
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectNonTestTsFiles(full));
        } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
            out.push(full);
        }
    }
    return out;
}

describe("Engine uniqueness (G6 governance verification)", () => {
    it("has exactly one active canonical owner per canonical engine in Backend/HBOS/Engines", () => {
        expect(fs.existsSync(ENGINES_DIR)).toBe(true);
        const files = fs.readdirSync(ENGINES_DIR).filter(f => f.endsWith(".ts"));
        for (const engine of CANONICAL_ENGINES) {
            const owner = files.filter(f => f === `${engine}.ts`);
            expect(owner).toHaveLength(1);
        }
    });

    it("has no duplicate active owner for any canonical engine in Backend/HBOS/Engines", () => {
        const files = fs.readdirSync(ENGINES_DIR).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"));
        for (const engine of CANONICAL_ENGINES) {
            const related = files.filter(f => f.includes(engine));
            expect(related).toEqual([`${engine}.ts`]);
        }
    });

    it("has no shadow active implementation of a canonical engine outside Backend/HBOS/Engines", () => {
        const elsewhere = collectNonTestTsFiles(HBOS_ROOT);
        for (const engine of CANONICAL_ENGINES) {
            const shadows: string[] = [];
            for (const file of elsewhere) {
                if (readClassNames(file).includes(engine)) {
                    shadows.push(file);
                }
            }
            expect({ engine, shadows }).toEqual({ engine, shadows: [] });
        }
    });
});
