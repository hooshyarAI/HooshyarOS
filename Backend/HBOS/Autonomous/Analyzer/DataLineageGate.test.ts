import { lineageComplete } from "./DataLineageGate";
describe("Data lineage gate", () => {
    it("blocks incomplete provenance", () => {
        expect(lineageComplete({ source: "input", transformations: [], destination: "db" })).toBe(false);
    });
    it("accepts complete provenance", () => {
        expect(lineageComplete({ source: "input", transformations: ["ocr", "normalize"], destination: "db" })).toBe(true);
    });
});
