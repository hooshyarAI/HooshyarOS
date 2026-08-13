import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface CommercialArtifactQualityResult {
    complete: boolean;
    checked: string[];
    failures: string[];
}

interface RoadmapCapability {
    capabilityId?: string;
    implementationPath?: string;
    testPath?: string;
    documentationPath?: string;
}

export class CommercialArtifactQualityAudit {
    private readonly roadmapPath = "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json";

    audit(root: string): CommercialArtifactQualityResult {
        const roadmapFile = join(root, this.roadmapPath);
        if (!existsSync(roadmapFile)) {
            return { complete: false, checked: [], failures: ["commercial-roadmap-missing"] };
        }

        let capabilities: RoadmapCapability[];
        try {
            const parsed = JSON.parse(readFileSync(roadmapFile, "utf8")) as { capabilities?: RoadmapCapability[] };
            capabilities = parsed.capabilities ?? [];
        } catch {
            return { complete: false, checked: [], failures: ["commercial-roadmap-invalid"] };
        }

        const checked: string[] = [];
        const failures: string[] = [];
        for (const capability of capabilities) {
            const implementationPath = capability.implementationPath;
            const testPath = capability.testPath;
            if (!implementationPath || !testPath) continue;
            const implementationFile = join(root, implementationPath);
            const testFile = join(root, testPath);
            checked.push(capability.capabilityId ?? implementationPath);

            if (!existsSync(implementationFile)) {
                failures.push(`${capability.capabilityId ?? implementationPath}:implementation-missing`);
                continue;
            }
            if (!existsSync(testFile)) {
                failures.push(`${capability.capabilityId ?? implementationPath}:test-missing`);
                continue;
            }

            const source = this.readArtifactSource(implementationFile);
            const test = this.readArtifactSource(testFile);
            if (source === null) {
                failures.push(`${capability.capabilityId ?? implementationPath}:implementation-not-file`);
                continue;
            }
            if (test === null) {
                failures.push(`${capability.capabilityId ?? implementationPath}:test-not-file`);
                continue;
            }

            const normalized = source.replace(/\s+/g, " ").trim();
            const normalizedTest = test.replace(/\s+/g, " ").trim();

            if (this.isTrivialProductScaffold(normalized)) {
                failures.push(`${capability.capabilityId ?? implementationPath}:trivial-scaffold`);
            }
            if (this.isContractOnlyTest(normalizedTest)) {
                failures.push(`${capability.capabilityId ?? implementationPath}:contract-only-test`);
            }
        }

        return { complete: failures.length === 0, checked, failures };
    }

    auditCapability(root: string, capabilityId: string, implementationPath: string, testPath: string): CommercialArtifactQualityResult {
        const checked = [capabilityId];
        const failures: string[] = [];
        const implementationFile = join(root, implementationPath);
        const testFile = join(root, testPath);
        if (!existsSync(implementationFile)) failures.push(`${capabilityId}:implementation-missing`);
        if (!existsSync(testFile)) failures.push(`${capabilityId}:test-missing`);
        if (failures.length > 0) return { complete: false, checked, failures };

        const source = this.readArtifactSource(implementationFile);
        const test = this.readArtifactSource(testFile);
        if (source === null) failures.push(`${capabilityId}:implementation-not-file`);
        if (test === null) failures.push(`${capabilityId}:test-not-file`);
        if (failures.length > 0) return { complete: false, checked, failures };

        const normalized = source.replace(/\s+/g, " ").trim();
        const normalizedTest = test.replace(/\s+/g, " ").trim();
        if (this.isTrivialProductScaffold(normalized)) failures.push(`${capabilityId}:trivial-scaffold`);
        if (this.isContractOnlyTest(normalizedTest)) failures.push(`${capabilityId}:contract-only-test`);
        return { complete: failures.length === 0, checked, failures };
    }

    private readArtifactSource(path: string): string | null {
        try {
            const stats = statSync(path);

            if (stats.isFile()) {
                return readFileSync(path, "utf8");
            }

            if (stats.isDirectory()) {
                for (const name of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
                    const candidate = join(path, name);
                    if (existsSync(candidate) && statSync(candidate).isFile()) {
                        return readFileSync(candidate, "utf8");
                    }
                }
            }

            return null;
        } catch {
            return null;
        }
    }

    private isTrivialProductScaffold(source: string): boolean {
        const scaffoldSignals = [
            /ProductCapabilityResult\s*\{\s*status:\s*"READY"\s*\|\s*"BLOCKED"/,
            /execute\(input:\s*string\)\s*:\s*ProductCapabilityResult/,
            /return\s*\{\s*status:\s*input\s*&&\s*input\.trim\(\)\s*\?\s*"READY"\s*:\s*"BLOCKED"\s*\}/,
            /initialize\(\)\s*:\s*\{\s*status:\s*"READY"\s*\}/
        ];
        const signalCount = scaffoldSignals.filter(pattern => pattern.test(source)).length;
        const meaningfulOperations = ["map(", "reduce(", "filter(", "find(", "save(", "load(", "analyze(", "calculate(", "evaluate(", "assess(", "normalize(", "validate(", "persist(", "authorize(", "ingest(", "buildReport(", "generate(", "schedule(", "recommend("];
        const hasMeaningfulOperation = meaningfulOperations.some(marker => source.includes(marker));

        // A canonical product may retain the READY/BLOCKED shell while adding
        // real domain behavior. Treat the shell as trivial only when the
        // implementation contains no meaningful operation.
        if (signalCount >= 3 && !hasMeaningfulOperation) return true;
        return source.length < 280 && !hasMeaningfulOperation;
    }

    private isContractOnlyTest(test: string): boolean {
        const structuralAssertions = [
            /capabilityId\).*toBe\(/,
            /targetEngine\).*toBe\(/,
            /initialize\(\).*status.*READY/,
            /execute\("continue"\).*status.*READY/,
            /execute\(" "\).*status.*BLOCKED/
        ];
        const behavioralMarkers = [
            /map\(/, /reduce\(/, /expect\([^\n]+\)\.toEqual\(/, /expect\([^\n]+\)\.toBeCloseTo\(/,
            /TENANT_ISOLATION|FAIL|ERROR|VARIANCE|PROFIT|CASH|BUDGET|KPI|RISK|DECISION|EVIDENCE/i
        ];
        const structuralCount = structuralAssertions.filter(pattern => pattern.test(test)).length;
        const behavioralCount = behavioralMarkers.filter(pattern => pattern.test(test)).length;
        return structuralCount >= 3 && behavioralCount === 0;
    }
}
