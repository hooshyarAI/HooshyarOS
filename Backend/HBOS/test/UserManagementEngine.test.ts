import { UserManagementEngine } from "../Engines/UserManagementEngine";

describe("UserManagementEngine", () => {
    it("registers a canonical user", () => {
        expect(new UserManagementEngine().registerUser("ali")).toEqual({ username: "ali", status: "READY" });
    });

    it("blocks an empty username", () => {
        expect(new UserManagementEngine().registerUser(" ").status).toBe("BLOCKED");
    });
});
