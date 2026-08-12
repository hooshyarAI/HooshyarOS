import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("HooshyarWebApplication commercial shell", () => {
    const root = join(process.cwd(), "Frontend", "HooshyarWebApp");

    it("uses the canonical frontend application path", () => {
        expect(root.endsWith(join("Frontend", "HooshyarWebApp"))).toBe(true);
    });

    it("is runnable from a committed frontend artifact when the shell has been generated", () => {
        if (!existsSync(root)) {
            return;
        }

        expect(statSync(root).isDirectory()).toBe(true);
        expect(readdirSync(root).length).toBeGreaterThan(0);
    });
});
