import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutonomousFailureAnalyzer } from "../Autonomous/Analyzer/AutonomousFailureAnalyzer";

/**
 * Behavioral coverage for the canonical construction-plane failure analyzer.
 * The fixtures are the real output shapes emitted by tsc, Jest and the Windows
 * launcher path; the analyzer must derive its diagnosis from that evidence and
 * must fail closed when no real failure signal is present.
 */
describe("AutonomousFailureAnalyzer", () => {
    it("derives a compile failure chain, file/line and a high-confidence root cause from real tsc output", () => {
        const output = [
            "Backend/HBOS/Engines/WidgetEngine.ts(10,5): error TS2339: Property 'risk' does not exist on type 'WidgetEngine'.",
            "Found 1 error in the same file."
        ].join("\n");

        const diagnosis = new AutonomousFailureAnalyzer().diagnose({ output });

        expect(diagnosis.type).toBe("COMPILE_FAILURE");
        expect(diagnosis.evidencePresent).toBe(true);
        expect(diagnosis.primaryFile).toBe("Backend/HBOS/Engines/WidgetEngine.ts");
        expect(diagnosis.chain[0]).toEqual(expect.objectContaining({
            order: 1,
            kind: "compile",
            file: "Backend/HBOS/Engines/WidgetEngine.ts",
            line: 10
        }));
        expect(diagnosis.chain[0].message).toContain("TS2339");
        expect(diagnosis.rootCauses[0].confidence).toBe("HIGH");
        expect(diagnosis.rootCauses[0].cause).toContain("Backend/HBOS/Engines/WidgetEngine.ts");
        expect(diagnosis.chain[0].kind).not.toBe("unknown");
    });

    it("classifies a real Jest assertion failure as a behavioral test failure", () => {
        const output = [
            "FAIL Backend/HBOS/test/WidgetEngine.test.ts",
            "  ● WidgetEngine › computes risk",
            "    expect(received).toBe(expected)",
            "    Expected: 2",
            "    Received: 1"
        ].join("\n");

        const diagnosis = new AutonomousFailureAnalyzer().diagnose({ output });

        expect(diagnosis.type).toBe("TEST_FAILURE");
        expect(diagnosis.primaryFile).toBe("Backend/HBOS/test/WidgetEngine.test.ts");
        expect(diagnosis.chain.map(step => step.kind)).toEqual(expect.arrayContaining(["test", "assertion"]));
        expect(diagnosis.rootCauses.some(cause => cause.cause.includes("assertion"))).toBe(true);
    });

    it("classifies an exceeded Jest budget as a timeout failure", () => {
        const diagnosis = new AutonomousFailureAnalyzer().diagnose({
            output: "Exceeded timeout of 5000 ms for a test while waiting for async work."
        });

        expect(diagnosis.type).toBe("TIMEOUT_FAILURE");
        expect(diagnosis.chain[0].kind).toBe("timeout");
        expect(diagnosis.rootCauses[0].cause).toContain("time budget");
    });

    it("classifies an unresolvable dependency as a module resolution failure", () => {
        const diagnosis = new AutonomousFailureAnalyzer().diagnose({
            output: "Error: Cannot find module 'tesseract.js' from 'Backend/HBOS/Product/OcrAdapter.ts'"
        });

        expect(diagnosis.type).toBe("MODULE_RESOLUTION_FAILURE");
        expect(diagnosis.chain.some(step => step.kind === "module")).toBe(true);
        expect(diagnosis.rootCauses[0].evidence.join(" ")).toContain("tesseract.js");
    });

    it("classifies a shell-free Windows launcher defect as a launcher failure", () => {
        const diagnosis = new AutonomousFailureAnalyzer().diagnose({
            output: "spawnSync npm.cmd EINVAL: the process could not be started"
        });

        expect(diagnosis.type).toBe("LAUNCHER_FAILURE");
        expect(diagnosis.rootCauses[0].cause).toContain("Process launcher misuse");
        expect(diagnosis.rootCauses[0].confidence).toBe("HIGH");
    });

    it("fails closed with no root cause when the evidence carries no real failure signal", () => {
        const diagnosis = new AutonomousFailureAnalyzer().diagnose({ output: "   " });

        expect(diagnosis.type).toBe("UNKNOWN");
        expect(diagnosis.evidencePresent).toBe(false);
        expect(diagnosis.primaryFile).toBe("unknown");
        expect(diagnosis.chain).toEqual([]);
        expect(diagnosis.rootCauses).toEqual([]);
        expect(diagnosis.blastRadius.directFiles).toEqual([]);
        expect(diagnosis.blastRadius.bounded).toBe(true);
    });

    it("records construction gate issues as low-confidence evidence without inventing a file", () => {
        const diagnosis = new AutonomousFailureAnalyzer().diagnose({
            output: "construction blocked",
            issues: ["QUALITY_BEHAVIOR_UNVERIFIED", "QUALITY_INTEGRATION_UNVERIFIED"]
        });

        expect(diagnosis.evidencePresent).toBe(true);
        expect(diagnosis.primaryFile).toBe("unknown");
        expect(diagnosis.chain.map(step => step.message)).toEqual(expect.arrayContaining([
            "QUALITY_BEHAVIOR_UNVERIFIED",
            "QUALITY_INTEGRATION_UNVERIFIED"
        ]));
        expect(diagnosis.rootCauses.some(cause => cause.confidence === "LOW")).toBe(true);
    });

    it("computes a bounded blast radius from real reverse imports in a repository root", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-failure-analyzer-"));
        try {
            const engine = join(root, "Backend", "HBOS", "Engines", "WidgetEngine.ts");
            const consumer = join(root, "Backend", "HBOS", "Autonomous", "WidgetConsumer.ts");
            mkdirSync(join(root, "Backend", "HBOS", "Engines"), { recursive: true });
            mkdirSync(join(root, "Backend", "HBOS", "Autonomous"), { recursive: true });
            writeFileSync(engine, "export class WidgetEngine {}\n", "utf8");
            writeFileSync(
                consumer,
                'import { WidgetEngine } from "../Engines/WidgetEngine";\nexport const use = () => new WidgetEngine();\n',
                "utf8"
            );

            const diagnosis = new AutonomousFailureAnalyzer({ root }).diagnose({
                output: "Backend/HBOS/Engines/WidgetEngine.ts(4,1): error TS2304: Cannot find name 'missing'.",
                capabilityId: "platform.widget",
                targetEngine: "WidgetEngine",
                dependencies: ["HBOS Core"]
            });

            expect(diagnosis.blastRadius.directFiles).toContain("Backend/HBOS/Engines/WidgetEngine.ts");
            expect(diagnosis.blastRadius.owners).toEqual(expect.arrayContaining(["WidgetEngine"]));
            expect(diagnosis.blastRadius.dependents).toContain("Backend/HBOS/Autonomous/WidgetConsumer.ts");
            expect(diagnosis.blastRadius.capabilities).toEqual(expect.arrayContaining(["platform.widget", "HBOS Core"]));
            expect(diagnosis.blastRadius.bounded).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("issues a canonical provenance trace id per diagnosis so the lineage is durable", () => {
        const analyzer = new AutonomousFailureAnalyzer();
        const first = analyzer.diagnose({ output: "FAIL Backend/HBOS/test/A.test.ts" });
        const second = analyzer.diagnose({ output: "FAIL Backend/HBOS/test/A.test.ts" });

        expect(first.traceId).toMatch(/^TRACE-/);
        expect(second.traceId).toMatch(/^TRACE-/);
        expect(first.traceId).not.toBe(second.traceId);
    });

    it("preserves the compact FailureReport contract consumed by the heal orchestrator", () => {
        const analyzer = new AutonomousFailureAnalyzer();
        const report = analyzer.analyze("Backend/HBOS/test/B.test.ts\nFAIL something in the suite");

        expect(report.type).toBe("TEST_FAILURE");
        expect(report.file).toBe("Backend/HBOS/test/B.test.ts");
        expect(typeof report.message).toBe("string");
        expect(report.message.length).toBeGreaterThan(0);
    });
});
