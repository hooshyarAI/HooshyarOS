import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { DashboardEngine } from "../../Engines/DashboardEngine";
import { ReportsEngine } from "../../Engines/ReportsEngine";
import { BillingEngine } from "../../Engines/BillingEngine";

const dashboard = new DashboardEngine();
const reports = new ReportsEngine();
const billing = new BillingEngine();

function json(response: ServerResponse, status: number, payload: unknown): void {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(payload));
}

function html(response: ServerResponse): void {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Hooshyar.ai</title></head><body><main><h1>Hooshyar.ai</h1><p>Financial and management intelligence runtime.</p><p id=\"status\">Loading…</p><script>fetch('/api/ready').then(r=>r.json()).then(x=>document.getElementById('status').textContent=x.status+': '+x.product).catch(()=>document.getElementById('status').textContent='Runtime unavailable')</script></main></body></html>");
}

export function createCommercialRuntimeServer() {
    return createServer((request: IncomingMessage, response: ServerResponse) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (request.method !== "GET") return json(response, 405, { error: "method_not_allowed" });
        if (url.pathname === "/" || url.pathname === "/index.html") return html(response);
        if (url.pathname === "/health") return json(response, 200, { status: "ok", service: "hooshyaros" });
        if (url.pathname === "/api/ready") return json(response, 200, { status: "READY", product: "commercial-runtime", dashboard: dashboard.health(), reports: reports.health() });
        if (url.pathname === "/api/dashboard") return json(response, 200, dashboard.snapshot({ organizations: 0, alerts: 0, decisions: 0 }));
        if (url.pathname === "/api/plans") return json(response, 200, { plans: billing.plans });
        if (url.pathname === "/api/report") return json(response, 200, reports.build("Executive report", ["Financial summary", "KPI status", "Decision alerts"]));
        return json(response, 404, { error: "not_found" });
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT ?? 3000);
    createCommercialRuntimeServer().listen(port, "0.0.0.0", () => console.log(`HooshyarOS commercial runtime listening on ${port}`));
}
