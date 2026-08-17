import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CapabilityDiscovery } from "./CapabilityDiscovery";
import { AutonomousPlanningPipeline } from "./AutonomousPlanningPipeline";

describe("AutonomousPlanningPipeline", () => {
    it("connects repository discovery through evidence gate to an actionable plan without inventing behavioral evidence", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-autonomous-pipeline-"));
        await mkdir(join(root, "financial"), { recursive: true });
        await writeFile(join(root, "financial", "ingestion.ts"), "export {};", "utf8");

        const plans = new AutonomousPlanningPipeline(new CapabilityDiscovery(root)).plan(
            [
                { name: "financial-ingestion", requiredPaths: ["financial/ingestion.ts"], documented: true },
                { name: "backup", requiredPaths: ["ops/backup.ts"], documented: true },
            ],
            { "financial-ingestion": "P1", backup: "P0" },
        );

        expect(plans[0]).toEqual({
            capability: "backup",
            action: "CREATE_ARTIFACT",
            priority: "P0",
            targets: ["ops/backup.ts"],
            executionAllowed: true,
        });
        expect(plans[1]).toEqual({
            capability: "financial-ingestion",
            action: "RUN_BEHAVIORAL_VERIFICATION",
            priority: "P1",
            targets: [],
            executionAllowed: true,
        });

        await rm(root, { recursive: true, force: true });
    });

    it("refuses to invent a priority definition", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-autonomous-pipeline-"));
        const pipeline = new AutonomousPlanningPipeline(new CapabilityDiscovery(root));

        expect(() => pipeline.plan(
            [{ name: "backup", requiredPaths: ["ops/backup.ts"] }],
            {},
        )).toThrow("No priority definition supplied for capability: backup");

        await rm(root, { recursive: true, force: true });
    });
});
