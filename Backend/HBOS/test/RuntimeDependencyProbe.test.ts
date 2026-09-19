import { Server } from "node:http";
import { RuntimeDependencyProbe } from "../Autonomous/Runtime/RuntimeDependencyProbe";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const listen = (server: Server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

describe("RuntimeDependencyProbe", () => {
    test("reports unresolved when the configured interpreter is absent", () => {
        const probe = new RuntimeDependencyProbe({ env: { HOOSHYAR_PYTHON: "definitely-missing-python" }, probe: () => false });
        expect(probe.report().reasoningRuntime).toEqual({
            id: "python-reasoning-runtime",
            available: false,
            source: "HOOSHYAR_PYTHON",
            detail: "unresolved",
        });
    });

    test("uses HOOSHYAR_PYTHON as the authoritative source when it resolves", () => {
        const probe = new RuntimeDependencyProbe({ env: { HOOSHYAR_PYTHON: "py-custom" }, probe: (command) => command === "py-custom" });
        expect(probe.reasoningRuntime()).toMatchObject({ available: true, source: "HOOSHYAR_PYTHON", detail: "resolved" });
    });

    test("falls back to PATH python when no override is configured", () => {
        const probe = new RuntimeDependencyProbe({ env: {}, probe: (command) => command === "python" });
        expect(probe.reasoningRuntime()).toMatchObject({ available: true, source: "PATH", detail: "resolved" });
    });

    test("never throws and reports unresolved when the probe itself fails", () => {
        const probe = new RuntimeDependencyProbe({ env: {}, probe: () => { throw new Error("probe-failure"); } });
        expect(() => probe.report()).not.toThrow();
        expect(probe.reasoningRuntime().available).toBe(false);
    });

    test("readiness reports the real dependency without leaking the interpreter path", async () => {
        const server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            dependencyProbe: new RuntimeDependencyProbe({ env: { HOOSHYAR_PYTHON: "C:/secret/location/python.exe" }, probe: () => false }),
        });
        await listen(server);
        try {
            const address = server.address();
            if (!address || typeof address === "string") throw new Error("server-not-listening");
            const response = await fetch(`http://127.0.0.1:${address.port}/api/ready`);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.dependencies.reasoningRuntime).toEqual({
                id: "python-reasoning-runtime",
                available: false,
                source: "HOOSHYAR_PYTHON",
                detail: "unresolved",
            });
            expect(JSON.stringify(body)).not.toContain("secret/location");
        } finally {
            await close(server);
        }
    }, 30000);
});
