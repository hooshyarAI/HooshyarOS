import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CapabilityDiscovery } from "./CapabilityDiscovery";

describe("CapabilityDiscovery", () => {
    it("discovers implemented and missing capabilities from repository evidence", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-capability-discovery-"));
        await mkdir(join(root, "financial"), { recursive: true });
        await writeFile(join(root, "financial", "ingestion.ts"), "export {};", "utf8");

        const result = new CapabilityDiscovery(root).discover([
            { name: "financial-ingestion", requiredPaths: ["financial/ingestion.ts"], documented: true },
            { name: "backup", requiredPaths: ["ops/backup.ts"], documented: true },
        ]);

        expect(result[0].evidence[1]).toEqual({ stage: "IMPLEMENTED", verified: true });
        expect(result[0].missingPaths).toEqual([]);
        expect(result[1].evidence[1]).toEqual({ stage: "IMPLEMENTED", verified: false });
        expect(result[1].missingPaths).toEqual(["ops/backup.ts"]);
        await rm(root, { recursive: true, force: true });
    });
});
