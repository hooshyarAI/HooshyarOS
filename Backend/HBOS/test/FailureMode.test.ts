import { createFailureMode } from "../Core/FailureMode";

test("FailureMode enforces bounded risk scores and preserves criticality", () => {
    const mode = createFailureMode("runtime-start", "Commercial runtime fails to start", 9, 3, 2, true);

    expect(mode).toEqual({
        id: "runtime-start",
        description: "Commercial runtime fails to start",
        severity: 9,
        occurrence: 3,
        detectability: 2,
        critical: true,
    });

    expect(() => createFailureMode("bad", "invalid", 11, 1, 1)).toThrow();
});
