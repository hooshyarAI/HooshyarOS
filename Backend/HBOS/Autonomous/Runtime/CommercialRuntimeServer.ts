import { createServer, IncomingMessage, ServerResponse } from "node:http";

const HTML = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="manifest" href="/manifest.webmanifest"><title>هوشیار.ai</title><link rel="stylesheet" href="/styles.css"></head><body><main><h1>هوشیار.ai</h1><p>Enterprise Intelligence Platform</p><section id="app"><p>در حال آماده‌سازی محیط هوشمند...</p></section></main><script src="/app.js"></script></body></html>`;
const APP = `async function load(){const session=await fetch('/api/session');const dashboard=await fetch('/api/dashboard');const app=document.getElementById('app');app.innerHTML='<h2>محیط محصول آماده است</h2><p>Session: '+session.status+'</p><p>Dashboard: '+dashboard.status+'</p>';}load().catch(()=>{});`;
const CSS = `:root{font-family:system-ui,sans-serif}body{margin:0;background:#f5f7fa;color:#18202a}main{max-width:960px;margin:8vh auto;padding:32px}section{padding:24px;background:white;border-radius:16px;box-shadow:0 8px 30px #0001}@media(max-width:700px){main{margin:2vh auto;padding:16px}}`;
const MANIFEST = JSON.stringify({ name: "هوشیار.ai", short_name: "هوشیار", start_url: "/", display: "standalone", lang: "fa", dir: "rtl" });

export function createCommercialRuntimeServer() {
    return createServer((req: IncomingMessage, res: ServerResponse) => {
        const path = req.url?.split("?")[0] ?? "/";
        const routes: Record<string, [string, string]> = {
            "/": ["text/html; charset=utf-8", HTML],
            "/app.js": ["text/javascript; charset=utf-8", APP],
            "/styles.css": ["text/css; charset=utf-8", CSS],
            "/manifest.webmanifest": ["application/manifest+json; charset=utf-8", MANIFEST],
            "/api/session": ["application/json; charset=utf-8", JSON.stringify({ authenticated: false, state: "anonymous" })],
            "/api/dashboard": ["application/json; charset=utf-8", JSON.stringify({ state: "ready", data: [] })]
        };
        const route = routes[path];
        if (!route) { res.statusCode = 404; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ error: "not_found" })); return; }
        res.statusCode = 200;
        res.setHeader("content-type", route[0]);
        res.end(route[1]);
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT ?? 3000);
    createCommercialRuntimeServer().listen(port, "0.0.0.0", () => console.log(`HooshyarOS commercial runtime listening on ${port}`));
}
