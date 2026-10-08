import { AssistantOrchestrator } from "./AssistantOrchestrator";

const goal = process.env.HOOSHYAR_AUTONOMOUS_GOAL
    || "Continue autonomous construction, commercialization, standardization, verification and release-readiness of HooshyarOS using the canonical Assistant and platform orchestration.";

async function main(): Promise<number> {
    try {
        const result = await new AssistantOrchestrator().start(goal);
        console.log(JSON.stringify({
            type: "AUTONOMOUS_ASSISTANT_ORCHESTRATION_RESULT",
            status: result.status,
            assistant: result.assistant,
            platformStatus: result.platform?.status ?? null
        }));

        return result.status === "PLATFORM_COMPLETED" ? 0 : 1;
    } catch (error) {
        console.error(JSON.stringify({
            type: "AUTONOMOUS_ASSISTANT_ORCHESTRATION_FAILED",
            error: error instanceof Error ? error.message : String(error)
        }));
        return 2;
    }
}

void main().then(code => process.exit(code));
