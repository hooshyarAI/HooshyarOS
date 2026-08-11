import { SecurityLayerEngine } from "../Engines/SecurityLayerEngine";

describe("SecurityLayerEngine", () => {
    it("authorizes a valid subject", () => {
        expect(new SecurityLayerEngine().authorize("admin")).toEqual({ subject: "admin", status: "READY" });
    });

    it("blocks an empty subject", () => {
        expect(new SecurityLayerEngine().authorize(" ").status).toBe("BLOCKED");
    });
});
