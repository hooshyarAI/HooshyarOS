export const hooshyarWebEntrypoint = {
    name: "Hooshyar.ai",
    runtime: "CommercialRuntimeServer",
    health: "/health",
    session: "/api/session",
    dashboard: "/api/dashboard"
} as const;
