import { PythonReasoningAdapter } from "../Assistant/Autonomous/PythonReasoningAdapter";

test("PythonReasoningAdapter uses the repository-owned Python reasoning runtime", async () => {
    const adapter = new PythonReasoningAdapter();

    const result = await adapter.reason("evaluate autonomous mission context");

    expect(result.provider).toBe("python");
    expect(result.problem).toBe("evaluate autonomous mission context");
    expect(result.status).toBe("reasoned");
    expect(result.success).toBe(true);
});
