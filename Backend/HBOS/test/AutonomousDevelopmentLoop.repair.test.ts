import { AutonomousDevelopmentLoop } from "../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { ConstructionTool } from "../Builder/Autonomous/AutonomousConstructionEngine";

describe("AutonomousDevelopmentLoop repair identity", () => {
    it("preserves the repair- capability id through planning and generation", () => {
        const observed: string[] = [];
        const tools: ConstructionTool[] = [
            {
                name: "architecture",
                execute: () => ({ ok: true })
            },
            {
                name: "python",
                execute: (stage, context) => {
                    if (stage === "GENERATE") {
                        observed.push(context.plan.capabilityId);
                    }
                    return { ok: true };
                }
            },
            {
                name: "git",
                execute: () => ({ ok: true })
            }
        ];

        const result = new AutonomousDevelopmentLoop(tools).execute({
            capabilityId: "repair-product.financial-data-ingestion",
            capability: "repair and re-verify product.financial-data-ingestion",
            targetEngine: "Financial Intelligence Engine"
        });

        expect(result.status).toBe("completed");
        expect(observed).toEqual(["repair-product.financial-data-ingestion"]);
    });
});
