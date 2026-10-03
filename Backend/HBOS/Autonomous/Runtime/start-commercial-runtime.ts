import { createCommercialRuntimeServer } from "./CommercialRuntimeServer";
import { RuntimeDependencyProbe } from "./RuntimeDependencyProbe";

const host = process.env.HOOSHYAR_HOST ?? "0.0.0.0";
const port = Number(process.env.HOOSHYAR_PORT ?? process.env.PORT ?? "4173");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid runtime port: ${process.env.HOOSHYAR_PORT ?? process.env.PORT ?? ""}`);
}

const server = createCommercialRuntimeServer();

// Report the real reasoning runtime dependency at startup. Reasoning is served
// in-process by default (node-native); an explicitly configured Python provider
// is reported truthfully and fails closed when it cannot be resolved.
const dependencies = new RuntimeDependencyProbe().report();

const shutdown = () => {
    server.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

server.listen(port, host, () => {
    console.log(JSON.stringify({
        type: "HOOSHYAR_COMMERCIAL_RUNTIME_STARTED",
        host,
        port,
        health: `http://${host}:${port}/health`,
        dependencies,
    }));
});
