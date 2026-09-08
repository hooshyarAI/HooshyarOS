import { ReasoningEngine } from "../Engines/ReasoningEngine";

describe("ReasoningEngine Phase 11-1.7", () => {
    let engine: ReasoningEngine;
    const originalPython = process.env.HOOSHYAR_PYTHON;

    beforeEach(() => {
        engine = new ReasoningEngine();
        engine.initialize();
        if (originalPython === undefined) {
            delete process.env.HOOSHYAR_PYTHON;
        } else {
            process.env.HOOSHYAR_PYTHON = originalPython;
        }
    });

    afterEach(() => {
        if (originalPython === undefined) {
            delete process.env.HOOSHYAR_PYTHON;
        } else {
            process.env.HOOSHYAR_PYTHON = originalPython;
        }
    });

    describe("Engine interface", () => {
        test("name is ReasoningEngine", () => {
            expect(engine.name).toBe("ReasoningEngine");
        });

        test("initialize starts without error", () => {
            expect(() => engine.initialize()).not.toThrow();
        });

        test("health returns true", () => {
            expect(engine.health()).toBe(true);
        });
    });

    describe("invalid problem path", () => {
        test("rejects empty string", () => {
            const result = engine.reason("");
            expect(result.success).toBe(false);
            expect(result.status).toBe("invalid_problem");
            expect(result.provenance?.verificationStatus).toBe("PENDING");
        });

        test("rejects whitespace-only input", () => {
            const result = engine.reason("   ");
            expect(result.success).toBe(false);
            expect(result.status).toBe("invalid_problem");
        });
    });

    describe("valid reasoning path", () => {
        test("returns success with provenance for valid problem", () => {
            const result = engine.reason("test problem");
            expect(result.success).toBe(true);
            expect(result.status).toBe("reasoned");
            expect(result.provenance).toBeDefined();
        });

        test("provenance contains required fields", () => {
            const result = engine.reason("test problem");
            const p = result.provenance!;
            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.timestamp).toBeDefined();
            expect(p.verificationStatus).toBe("VERIFIED");
            expect(p.sourceRef).toBe("unavailable");
            expect(p.transformationRef).toBe("python-ai-runtime");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
            expect(p.reasoningSteps.length).toBeGreaterThan(0);
        });

        test("explainability is present when output exists", () => {
            const result = engine.reason("test problem");
            expect(result.provenance?.explainability).toBeDefined();
            expect(result.provenance!.explainability!.inputSummary).toContain("test problem");
            expect(result.provenance!.explainability!.decisionBasis).toContain("AI runtime");
            expect(Array.isArray(result.provenance!.explainability!.limitations)).toBe(true);
        });

        test("inputHash is deterministic for same input", () => {
            const r1 = engine.reason("stable input");
            const r2 = engine.reason("stable input");
            expect(r1.provenance?.inputHash).toBe(r2.provenance?.inputHash);
        });

        test("different inputs produce different inputHashes", () => {
            const r1 = engine.reason("input A");
            const r2 = engine.reason("input B");
            expect(r1.provenance?.inputHash).not.toBe(r2.provenance?.inputHash);
        });

        test("outputHash matches actual output", () => {
            const result = engine.reason("test problem");
            const expectedHash = require("../Core/ProvenanceTrace").ProvenanceTrace.hashInput(result.answer!);
            expect(result.provenance?.outputHash).toBe(expectedHash);
        });
    });

    describe("runtime failure path", () => {
        test("returns reasoning_failed when Python runtime is unavailable", () => {
            process.env.HOOSHYAR_PYTHON = "nonexistent-python-binary";
            const result = engine.reason("test problem");
            expect(result.success).toBe(false);
            expect(result.status).toBe("reasoning_failed");
            expect(result.provenance?.verificationStatus).toBe("PENDING");
            expect(result.provenance?.outputHash).toBeUndefined();
        });

        test("provenance is present even on runtime failure", () => {
            process.env.HOOSHYAR_PYTHON = "nonexistent-python-binary";
            const result = engine.reason("test problem");
            expect(result.provenance).toBeDefined();
            expect(result.provenance!.traceId).toMatch(/^TRACE-/);
            expect(result.provenance!.inputHash).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe("confidence honesty", () => {
        test("does not fabricate confidence when runtime does not provide it", () => {
            const result = engine.reason("test problem");
            const explainability = result.provenance!.explainability!;
            if (explainability.confidence === undefined) {
                expect(explainability.limitations).toContain("Confidence score not available from runtime");
            } else {
                expect(typeof explainability.confidence).toBe("number");
                expect(explainability.confidence).toBeGreaterThanOrEqual(0);
                expect(explainability.confidence).toBeLessThanOrEqual(1);
            }
        });
    });

    describe("limitations disclosure", () => {
        test("discloses AI reasoning limitations", () => {
            const result = engine.reason("test problem");
            const limitations = result.provenance!.explainability!.limitations!;
            expect(limitations).toContain("AI reasoning confidence bounded by training data");
        });

        test("explainability is undefined when runtime provides no output", () => {
            process.env.HOOSHYAR_PYTHON = "nonexistent-python-binary";
            const result = engine.reason("test problem");
            expect(result.provenance?.explainability).toBeUndefined();
        });
    });
});
