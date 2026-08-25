import { createCommercialRuntimeServer } from "./CommercialRuntimeServer";

const port = Number(process.env.HOOSHYAR_PORT ?? 4173);
const host = process.env.HOOSHYAR_HOST ?? "127.0.0.1";

const server = createCommercialRuntimeServer();
server.listen(port, host, () => {
    console.log(`HooshyarOS commercial runtime listening on http://${host}:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
