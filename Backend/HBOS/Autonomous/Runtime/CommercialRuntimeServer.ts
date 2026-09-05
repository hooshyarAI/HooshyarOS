import { createHash, randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FinancialIntelligenceEngine } from "../../Engines/FinancialIntelligenceEngine";
import { ExecutiveIntelligenceEngine } from "../../Engines/ExecutiveIntelligenceEngine";
import { ReasoningEngine } from "../../Engines/ReasoningEngine";
import { ReportsEngine } from "../../Engines/ReportsEngine";
import { FinancialDataIngestionAdapter } from "../../Product/FinancialDataIngestionAdapter";
import { FinancialStatementAnalysisService } from "../../Product/FinancialStatementAnalysisService";
import { SecurityEventLogger } from "../../Entities/SecurityEventLogger";
import { ExecutiveIntelligenceWorkbench, ExecutiveIntelligenceWorkbenchInput, ExecutiveIntelligenceWorkbenchResult } from "../../Product/ExecutiveIntelligenceWorkbench";
import { SQLitePersistenceStore } from "../../Product/SQLitePersistenceStore";
import { TokenBucketRateLimiter } from "../../Product/GenericApiConnector";

export interface CommercialRuntimeOptions {
    readonly databasePath?: string;
    readonly reasoning?: Pick<ReasoningEngine, "reason">;
    readonly securityEventLogger?: SecurityEventLogger;
    readonly sessionTtlMs?: number;
    readonly now?: () => number;
    readonly corsOrigin?: string;
}

const WEB_ROOT = resolve(process.cwd(), "web");
const MAX_BODY_BYTES = 1024 * 1024;
const LATEST_ANALYSIS_KEY = "financial-analysis:latest";
const LATEST_EXECUTIVE_WORKBENCH_KEY = "executive-intelligence-workbench:latest";
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

const corsHeaders = (origin: string): Record<string, string> => ({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
});

type Session = { token: string; tenantId: string; organization: string; createdAt: number; expiresAt: number };
type StoredAnalysis = ReturnType<FinancialStatementAnalysisService["execute"]>;
type ExecutiveTargets = ExecutiveIntelligenceWorkbenchInput["targets"];

const send = (res: ServerResponse, status: number, contentType: string, body: string, headers: Record<string, string> = {}) => {
    res.statusCode = status;
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    res.end(body);
};

const json = (res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) =>
    send(res, status, "application/json; charset=utf-8", JSON.stringify(payload), headers);

const parseCookies = (header: string | undefined): Record<string, string> => Object.fromEntries(
    (header ?? "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, value.join("=")]),
);

const stableTenantId = (username: string, organization: string): string => {
    const identity = `${username.trim().normalize("NFKC")}\u0000${organization.trim().normalize("NFKC")}`;
    return `tenant:${createHash("sha256").update(identity, "utf8").digest("hex").slice(0, 16)}`;
};

const readJson = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.from(chunk as Buffer);
        size += buffer.length;
        if (size > MAX_BODY_BYTES) throw new Error("request-body-too-large");
        chunks.push(buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request-json-invalid");
    return parsed as Record<string, unknown>;
};

const parseExecutiveTargets = (value: unknown): ExecutiveTargets | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const targets = value as Record<string, unknown>;
    const result = {
        revenue: Number(targets.revenue),
        profit: Number(targets.profit),
        profitMargin: Number(targets.profitMargin),
        debtRatio: Number(targets.debtRatio),
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
};

const validateAnalyzeBody = (body: Record<string, unknown>): string | null => {
    const csv = String(body.csv ?? "");
    if (!csv.trim()) return "CSV_REQUIRED";
    const sourceName = String(body.sourceName ?? "ledger.csv");
    if (!sourceName.trim()) return "SOURCE_NAME_REQUIRED";
    const assets = Number(body.assets);
    const liabilities = Number(body.liabilities);
    if (!Number.isFinite(assets) || !Number.isFinite(liabilities)) return "BALANCE_SHEET_FIELDS_REQUIRED";
    return null;
};

const validateWorkbenchBody = (body: Record<string, unknown>): string | null => {
    if (!body.targets || typeof body.targets !== "object" || Array.isArray(body.targets)) return "EXECUTIVE_TARGETS_REQUIRED";
    const targets = body.targets as Record<string, unknown>;
    const revenue = Number(targets.revenue);
    const profit = Number(targets.profit);
    const profitMargin = Number(targets.profitMargin);
    const debtRatio = Number(targets.debtRatio);
    if (![revenue, profit, profitMargin, debtRatio].every(Number.isFinite)) return "EXECUTIVE_TARGETS_REQUIRED";
    return null;
};

const validateAssistantBody = (body: Record<string, unknown>): string | null => {
    const question = String(body.question ?? "").trim();
    if (!question) return "ASSISTANT_QUESTION_REQUIRED";
    return null;
};

const asset = async (res: ServerResponse, name: string, contentType: string) => {
    try {
        const body = await readFile(resolve(WEB_ROOT, name), "utf8");
        send(res, 200, contentType, body);
    } catch {
        json(res, 404, { error: "ASSET_NOT_FOUND" });
    }
};

export function createCommercialRuntimeServer(options: CommercialRuntimeOptions = {}): Server {
    const persistence = new SQLitePersistenceStore({ databasePath: options.databasePath ?? process.env.HOOSHYAR_DB_PATH ?? "data/hooshyar.sqlite" });
    const ingestion = new FinancialDataIngestionAdapter(persistence);
    const reasoning = options.reasoning ?? new ReasoningEngine();
    const analysis = new FinancialStatementAnalysisService(new FinancialIntelligenceEngine(), reasoning);
    const executiveWorkbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    const reports = new ReportsEngine();
    const sessions = new Map<string, Session>();
    const latestResults = new Map<string, StoredAnalysis>();
    const latestWorkbenchResults = new Map<string, ExecutiveIntelligenceWorkbenchResult>();
    const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    const rateLimiterMap = new Map<string, TokenBucketRateLimiter>();
    const RATE_LIMIT_CAPACITY = 5;
    const RATE_LIMIT_REFILL_PER_SECOND = 1;
    const now = options.now ?? (() => Date.now());
    const corsOrigin = options.corsOrigin ?? DEFAULT_CORS_ORIGIN;

    const getOrCreateRateLimiter = (token: string): TokenBucketRateLimiter => {
        let limiter = rateLimiterMap.get(token);
        if (!limiter) {
            limiter = new TokenBucketRateLimiter({ capacity: RATE_LIMIT_CAPACITY, refillPerSecond: RATE_LIMIT_REFILL_PER_SECOND, now });
            rateLimiterMap.set(token, limiter);
        }
        return limiter;
    };

    const loadAnalysis = async (tenantId: string): Promise<StoredAnalysis | undefined> => {
        let result = latestResults.get(tenantId);
        if (!result) {
            const persisted = await persistence.read({ tenantId }, LATEST_ANALYSIS_KEY);
            result = persisted?.value as StoredAnalysis | undefined;
            if (result?.tenantId === tenantId && result.status === "READY") latestResults.set(tenantId, result);
        }
        return result?.tenantId === tenantId && result.status === "READY" ? result : undefined;
    };

    const loadWorkbench = async (tenantId: string): Promise<ExecutiveIntelligenceWorkbenchResult | undefined> => {
        let workbench = latestWorkbenchResults.get(tenantId);
        if (!workbench) {
            const persisted = await persistence.read({ tenantId }, LATEST_EXECUTIVE_WORKBENCH_KEY);
            workbench = persisted?.value as ExecutiveIntelligenceWorkbenchResult | undefined;
            if (workbench?.tenantId === tenantId && workbench.status === "READY") latestWorkbenchResults.set(tenantId, workbench);
        }
        return workbench?.tenantId === tenantId && workbench.status === "READY" ? workbench : undefined;
    };

    const dashboardPayload = (result: StoredAnalysis, workbench?: ExecutiveIntelligenceWorkbenchResult) => ({
        status: result.status,
        tenantId: result.tenantId,
        analysisAvailable: true,
        metrics: { revenue: result.metrics.revenue, profit: result.metrics.profit, risk: result.metrics.debtRatio * 100 },
        observations: result.observations,
        source: result.source,
        executiveIntelligence: workbench ?? null,
    });

    const close = () => persistence.close();
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const corsJson = (status: number, payload: unknown, headers: Record<string, string> = {}) =>
            json(res, status, payload, { ...corsHeaders(corsOrigin), ...headers });
        try {
            const path = req.url?.split("?")[0] ?? "/";
            if (req.method === "OPTIONS") {
                res.statusCode = 204;
                for (const [key, value] of Object.entries(corsHeaders(corsOrigin))) res.setHeader(key, value);
                return res.end();
            }
            if (req.method === "GET" && path === "/health") return corsJson( 200, { status: "ok", service: "hooshyar-commercial-runtime" });
            if (req.method === "GET" && path === "/api/ready") return corsJson( 200, { status: "READY", capabilities: ["financial-ingestion", "financial-statement-analysis", "tenant-scoped-persistence", "reasoning", "executive-intelligence-workbench", "reports", "assistant-context"] });
            if (req.method === "GET" && path === "/") return asset(res, "index.html", "text/html; charset=utf-8");
            if (req.method === "GET" && path === "/app.js") return asset(res, "app.js", "text/javascript; charset=utf-8");
            if (req.method === "GET" && path === "/styles.css") return asset(res, "styles.css", "text/css; charset=utf-8");
            if (req.method === "GET" && path === "/manifest.webmanifest") return asset(res, "manifest.webmanifest", "application/manifest+json; charset=utf-8");
            if (req.method === "GET" && path === "/sw.js") return asset(res, "sw.js", "text/javascript; charset=utf-8");

            const cookies = parseCookies(req.headers.cookie);
            const cookieToken = cookies.hooshyar_session;
            let session = cookieToken ? sessions.get(cookieToken) : undefined;
            if (session && session.expiresAt <= now()) {
                sessions.delete(session.token);
                session = undefined;
            }

            if (req.method === "POST" && path === "/api/session") {
                const body = await readJson(req);
                const username = String(body.username ?? "").trim();
                const organization = String(body.organization ?? "").trim();
                if (!username || !organization) return corsJson( 400, { error: "SESSION_FIELDS_REQUIRED" });
                const token = randomBytes(24).toString("hex");
                const createdAt = now();
                const created: Session = { token, tenantId: stableTenantId(username, organization), organization, createdAt, expiresAt: createdAt + sessionTtlMs };
                sessions.set(token, created);
                return corsJson( 201, { authenticated: true, organization: { name: organization }, tenantId: created.tenantId, expiresAt: new Date(created.expiresAt).toISOString() }, {
                    "Set-Cookie": `hooshyar_session=${token}; HttpOnly; SameSite=Lax; Path=/`,
                });
            }

            if (req.method === "GET" && path === "/api/session") {
                if (!session) return corsJson( 401, { authenticated: false });
                return corsJson( 200, { authenticated: true, organization: { name: session.organization }, tenantId: session.tenantId, expiresAt: new Date(session.expiresAt).toISOString() });
            }

            if (!session) {
                const securityLogger = options.securityEventLogger;
                if (securityLogger) {
                    securityLogger.logAuthenticationFailure({
                        actorId: undefined,
                        target: req.url ?? "unknown",
                        reason: "AUTHENTICATION_REQUIRED",
                        metadata: { method: req.method, path: req.url }
                    });
                }
                return corsJson( 401, { error: "AUTHENTICATION_REQUIRED" });
            }

            if (req.method === "POST" && path === "/api/analyze") {
                if (!session.token || !getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson( 429, { error: "RATE_LIMIT_EXCEEDED" });
                const body = await readJson(req);
                const analyzeError = validateAnalyzeBody(body);
                if (analyzeError) return corsJson( 400, { error: analyzeError });
                const csv = String(body.csv ?? "");
                const sourceName = String(body.sourceName ?? "ledger.csv");
                const assets = Number(body.assets);
                const liabilities = Number(body.liabilities);
                const ingested = await ingestion.ingestCsv(session.tenantId, sourceName, csv);
                const result = analysis.execute({ tenantId: session.tenantId, revenue: ingested.model.totals.credit, expenses: ingested.model.totals.debit, assets, liabilities, source: ingested.evidence });
                if (result.status !== "READY") return corsJson( 422, result);
                await persistence.write({ tenantId: session.tenantId }, LATEST_ANALYSIS_KEY, result);
                latestResults.set(session.tenantId, result);
                return corsJson( 200, result);
            }

            if (req.method === "POST" && path === "/api/executive/workbench") {
                if (!session.token || !getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson( 429, { error: "RATE_LIMIT_EXCEEDED" });
                const body = await readJson(req);
                const workbenchError = validateWorkbenchBody(body);
                if (workbenchError) return corsJson( 400, { error: workbenchError });
                const targets = parseExecutiveTargets(body.targets);
                if (!targets) return corsJson( 400, { error: "EXECUTIVE_TARGETS_REQUIRED" });
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson( 422, { error: "EXECUTIVE_ANALYSIS_REQUIRED" });
                const workbenchResult = executiveWorkbench.execute({ tenantId: session.tenantId, metrics: result.metrics, targets });
                if (workbenchResult.status !== "READY") return corsJson( 422, workbenchResult);
                await persistence.write({ tenantId: session.tenantId }, LATEST_EXECUTIVE_WORKBENCH_KEY, workbenchResult);
                latestWorkbenchResults.set(session.tenantId, workbenchResult);
                return corsJson( 200, workbenchResult);
            }

            if (req.method === "GET" && path === "/api/report") {
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson( 422, { error: "REPORT_ANALYSIS_REQUIRED" });
                const workbench = await loadWorkbench(session.tenantId);
                const sections = [
                    `Tenant: ${session.tenantId}`,
                    `Source: ${result.source.sourceName}`,
                    `Revenue: ${result.metrics.revenue}`,
                    `Profit: ${result.metrics.profit}`,
                    `Profit margin: ${result.metrics.profitMargin}`,
                    `Debt ratio: ${result.metrics.debtRatio}`,
                    `Observations: ${result.observations.map((item) => item.message).join(" | ")}`,
                ];
                if (workbench) sections.push(`Recommendations: ${workbench.recommendations.map((item) => item.action).join(" | ")}`);
                const report = reports.build("HooshyarOS Financial and Executive Report", sections);
                return corsJson( report.status === "READY" ? 200 : 422, { ...report, tenantId: session.tenantId, source: result.source });
            }

            if (req.method === "POST" && path === "/api/assistant") {
                if (!session.token || !getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson( 429, { error: "RATE_LIMIT_EXCEEDED" });
                const body = await readJson(req);
                const assistantError = validateAssistantBody(body);
                if (assistantError) return corsJson( 400, { error: assistantError });
                const question = String(body.question ?? "").trim();
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson( 422, { error: "ASSISTANT_ANALYSIS_REQUIRED" });
                const workbench = await loadWorkbench(session.tenantId);
                const context = [
                    `Answer using only verified persisted context for tenant ${session.tenantId}.`,
                    `Question: ${question}`,
                    `Revenue=${result.metrics.revenue}`,
                    `Profit=${result.metrics.profit}`,
                    `ProfitMargin=${result.metrics.profitMargin}`,
                    `DebtRatio=${result.metrics.debtRatio}`,
                    `Observations=${result.observations.map((item) => item.message).join(" | ")}`,
                    workbench ? `Recommendations=${workbench.recommendations.map((item) => item.action).join(" | ")}` : "No executive workbench result is available yet.",
                ].join(" | ");
                const answer = reasoning.reason(context);
                if (!answer.success) return corsJson( 503, { error: "ASSISTANT_REASONING_UNAVAILABLE" });
                return corsJson( 200, { status: "READY", tenantId: session.tenantId, question, answer: answer.answer ?? answer.status, evidence: { analysisSource: result.source, executiveWorkbench: Boolean(workbench) } });
            }

            if (req.method === "GET" && path === "/api/dashboard") {
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson( 200, { status: "READY", tenantId: session.tenantId, metrics: { revenue: 0, profit: 0, risk: 0 }, analysisAvailable: false, executiveIntelligence: null });
                const workbench = await loadWorkbench(session.tenantId);
                return corsJson( 200, dashboardPayload(result, workbench));
            }

            return corsJson( 404, { error: "NOT_FOUND" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "RUNTIME_ERROR";
            const status = message === "request-body-too-large" ? 413 : 400;
            return corsJson( status, { error: message });
        }
    });
    server.once("close", close);
    return server;
}
