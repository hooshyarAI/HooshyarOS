import { LLMProviderRouter } from "../Assistant/Autonomous/Production/LLMProviderRouter";

describe("Assistant construction provider policy", () => {
    it("always selects the repository-native Python worker", () => {
        const router = new LLMProviderRouter();

        expect(router.route()).toEqual({ provider: "python" });
        expect(router.route("local")).toEqual({ provider: "python" });
        expect(router.route("cloud")).toEqual({ provider: "python" });
        expect(router.route("copilot")).toEqual({ provider: "python" });
        expect(router.route("claude")).toEqual({ provider: "python" });
        expect(router.route("codex")).toEqual({ provider: "python" });
    });
});
