const { failureMission } = require("./autonomous-ci-repair-loop.cjs");

describe("autonomous CI feedback repair mission", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("converts a failed workflow job into an ASSISTANT_REPAIR_MISSION", async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jobs: [{
                        id: 123,
                        name: "android-product-acceptance",
                        html_url: "https://github.com/hooshyarAI/HooshyarOS/actions/runs/1/job/123",
                        conclusion: "failure",
                        steps: [{ name: "Install and launch Android application", number: 9, conclusion: "failure" }]
                    }]
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => "ERROR: emulator action failed"
            });

        try {
            const mission = await failureMission(
                { id: 1, html_url: "https://github.com/hooshyarAI/HooshyarOS/actions/runs/1", conclusion: "failure" },
                "abc123"
            );

            expect(mission.type).toBe("ASSISTANT_REPAIR_MISSION");
            expect(mission.version).toBe(1);
            expect(mission.commit).toBe("abc123");
            expect(mission.failure.firstFailedJob).toBe("android-product-acceptance");
            expect(mission.failure.failedSteps).toContain("android-product-acceptance:Install and launch Android application");
            expect(mission.rules.requiredRegressionTest).toBe(true);
            expect(mission.rules.pushOnlyToCurrentBranch).toBe(true);
            expect(mission.nextActions).toContain("Poll CI again and replan from the new evidence.");
        } finally {
            global.fetch = originalFetch;
        }
    });
});
