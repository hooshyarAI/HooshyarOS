import { existsSync, readFileSync } from "node:fs";

describe("CommercialWebUXContract", () => {
    it("preserves the final commercial application surface and responsive design contract", () => {
        expect(existsSync("web/index.html")).toBe(true);
        expect(existsSync("web/app.js")).toBe(true);
        expect(existsSync("web/styles.css")).toBe(true);

        const html = readFileSync("web/index.html", "utf8");
        const app = readFileSync("web/app.js", "utf8");
        const css = readFileSync("web/styles.css", "utf8");

        expect(html).toContain("مرکز فرمان مدیر");
        expect(html).toContain("چرخه ارزش");
        expect(html).toContain("دستیار سازمانی");
        expect(html).toContain("مرکز تصمیم");
        expect(html).toContain("هشدار و سلامت");
        expect(app).toContain("/api/dashboard");
        expect(app).toContain("/api/ingest");
        expect(app).toContain("/api/decision");
        expect(css).toContain("grid-template-columns:235px");
        expect(css).toContain("@media(max-width:760px)");
        expect(css).toContain("@media(max-width:430px)");
    });
});
