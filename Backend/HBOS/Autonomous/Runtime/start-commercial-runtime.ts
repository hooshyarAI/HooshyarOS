import { createCommercialRuntimeServer } from "./CommercialRuntimeServer";
import { RuntimeDependencyProbe } from "./RuntimeDependencyProbe";

const host = process.env.HOOSHYAR_HOST ?? "127.0.0.1";
const port = Number(process.env.HOOSHYAR_PORT ?? "4173");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid HOOSHYAR_PORT: ${process.env.HOOSHYAR_PORT ?? ""}`);
}

const server = createCommercialRuntimeServer();

// Report the real reasoning runtime dependency at startup so an installed
// product never silently degrades when the Python runtime is unavailable.
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
