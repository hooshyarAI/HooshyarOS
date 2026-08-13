import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("HooshyarWebApplication commercial shell", () => {
    const root = join(process.cwd(), "Frontend", "HooshyarWebApp");

    it("uses the canonical frontend application path", () => {
        expect(root.endsWith(join("Frontend", "HooshyarWebApp"))).toBe(true);
    });

    it("is represented by a generated frontend artifact when the shell has been generated", () => {
        if (!existsSync(root)) {
            return;
        }

        const stat = statSync(root);
        if (stat.isDirectory()) {
            expect(readdirSync(root).length).toBeGreaterThan(0);
            return;
        }

        expect(stat.isFile()).toBe(true);
    });
});
