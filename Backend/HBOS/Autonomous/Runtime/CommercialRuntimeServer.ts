import { createHash, randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FinancialIntelligenceEngine } from "../../Engines/FinancialIntelligenceEngine";
import { ExecutiveIntelligenceEngine } from "../../Engines/ExecutiveIntelligenceEngine";
import { ReasoningEngine } from "../../Engines/ReasoningEngine";
import { ReportsEngine } from "../../Engines/ReportsEngine";
import { FinancialDataIngestionAdapter } from "../../Product/FinancialDataIngestionAdapter";
import { FinancialIngestionService, IngestionFormat, SUPPORTED_INGESTION_FORMATS } from "../../Product/FinancialIngestionService";
import { FinancialStatementAnalysisService } from "../../Product/FinancialStatementAnalysisService";
import { SecurityEventLogger } from "../../Entities/SecurityEventLogger";
import { ExecutiveIntelligenceWorkbench, ExecutiveIntelligenceWorkbenchInput, ExecutiveIntelligenceWorkbenchResult } from "../../Product/ExecutiveIntelligenceWorkbench";
import { SQLitePersistenceStore } from "../../Product/SQLitePersistenceStore";
import { CommercialIdentityService, CommercialPermission, CommercialSession } from "../../Product/CommercialIdentityService";
import { TokenBucketRateLimiter } from "../../Product/GenericApiConnector";
import { ResilienceAnalyticsService } from "../../Product/ResilienceAnalyticsService";
import { Scenario } from "../../Uncertainty/MonteCarloTypes";
import { ImpactMeasurementService } from "../../Product/ImpactMeasurementService";
import { ContinuousImprovementEngine } from "../../Assistant/Autonomous/ContinuousImprovementEngine";
import type { BaselineMetrics, PostInterventionMetrics } from "../../Product/ImpactMeasurementService";

export interface CommercialRuntimeOptions {
    readonly databasePath?: string;
    readonly reasoning?: Pick<ReasoningEngine, "reason">;
    readonly securityEventLogger?: SecurityEventLogger;
    readonly sessionTtlMs?: number;
    readonly now?: () => number;
    readonly corsOrigin?: string;
    readonly secureCookies?: boolean;
}

const WEB_ROOT = resolve(process.cwd(), "web");
const MAX_BODY_BYTES = 1024 * 1024;
const INGEST_BODY_BYTES = 8 * 1024 * 1024;
const LATEST_ANALYSIS_KEY = "financial-analysis:latest";
const LATEST_EXECUTIVE_WORKBENCH_KEY = "executive-intelligence-workbench:latest";
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";
const SESSION_COOKIE = "hooshyar_session";

const corsHeaders = (origin: string): Record<string, string> => ({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
});

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
    (header ?? "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, value.join("=")])
);

const readJson = async (req: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<Record<string, unknown>> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.from(chunk as Buffer);
        size += buffer.length;
        if (size > maxBytes) throw new Error("request-body-too-large");
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

const validateIngestBody = (body: Record<string, unknown>): string | null => {
    const sourceName = String(body.sourceName ?? "").trim();
    if (!sourceName) return "SOURCE_NAME_REQUIRED";
    const format = String(body.format ?? "").trim().toUpperCase();
    if (!SUPPORTED_INGESTION_FORMATS.includes(format as IngestionFormat)) return "INGEST_FORMAT_UNSUPPORTED";
    if (format === "XLSX") {
        if (typeof body.contentBase64 !== "string" || !body.contentBase64.trim()) return "CONTENT_BASE64_REQUIRED";
    } else if (typeof body.content !== "string" || !body.content.trim()) {
        return "CONTENT_REQUIRED";
    }
    return null;
};

const parseBaseline = (value: unknown, tenantId: string): BaselineMetrics | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const b = value as Record<string, unknown>;
    const fields = ["revenue", "profit", "profitMargin", "debtRatio", "cycleTime", "throughput", "errorRate", "capacity", "operatingCost", "decisionLatency", "riskScore"];
    for (const f of fields) {
        if (!Number.isFinite((b as any)[f])) return null;
    }
    return {
        tenantId,
        revenue: Number(b.revenue),
        profit: Number(b.profit),
        profitMargin: Number(b.profitMargin),
        debtRatio: Number(b.debtRatio),
        cycleTime: Number(b.cycleTime),
        throughput: Number(b.throughput),
        errorRate: Number(b.errorRate),
        capacity: Number(b.capacity),
        operatingCost: Number(b.operatingCost),
        decisionLatency: Number(b.decisionLatency),
        riskScore: Number(b.riskScore),
        recordedAt: String(b.recordedAt ?? "2026-01-01T00:00:00Z")
    };
};

const parsePost = (value: unknown, tenantId: string): PostInterventionMetrics | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const p = value as Record<string, unknown>;
    const fields = ["revenue", "profit", "profitMargin", "debtRatio", "cycleTime", "throughput", "errorRate", "capacity", "operatingCost", "decisionLatency", "riskScore"];
    for (const f of fields) {
        if (!Number.isFinite((p as any)[f])) return null;
    }
    return {
        tenantId,
        revenue: Number(p.revenue),
        profit: Number(p.profit),
        profitMargin: Number(p.profitMargin),
        debtRatio: Number(p.debtRatio),
        cycleTime: Number(p.cycleTime),
        throughput: Number(p.throughput),
        errorRate: Number(p.errorRate),
        capacity: Number(p.capacity),
        operatingCost: Number(p.operatingCost),
        decisionLatency: Number(p.decisionLatency),
        riskScore: Number(p.riskScore),
        recordedAt: String(p.recordedAt ?? "2026-01-01T00:00:00Z")
    };
};

const parseCurrentState = (value: unknown): { readonly revenue: number; readonly profit: number; readonly riskScore: number; readonly decisionLatency: number } | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const s = value as Record<string, unknown>;
    if (!Number.isFinite(s.revenue) || !Number.isFinite(s.profit) || !Number.isFinite(s.riskScore) || !Number.isFinite(s.decisionLatency)) return null;
    return {
        revenue: Number(s.revenue),
        profit: Number(s.profit),
        riskScore: Number(s.riskScore),
        decisionLatency: Number(s.decisionLatency)
    };
};

const parseActualImpact = (value: unknown): { readonly timeSaved: number; readonly operatingCostReduced: number; readonly actualFinancialValue: number; readonly actualROI: number; readonly sustainability: "NOT_SUSTAINABLE" | "SUSTAINABLE" | "PARTIAL" } | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const a = value as Record<string, unknown>;
    const required = ["timeSaved", "operatingCostReduced", "actualFinancialValue", "actualROI", "sustainability"];
    for (const f of required) {
        if (!(f in a)) return null;
    }
    return {
        timeSaved: Number(a.timeSaved),
        operatingCostReduced: Number(a.operatingCostReduced),
        actualFinancialValue: Number(a.actualFinancialValue),
        actualROI: Number(a.actualROI),
        sustainability: String(a.sustainability) as "NOT_SUSTAINABLE" | "SUSTAINABLE" | "PARTIAL"
    };
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
    const ingestionService = new FinancialIngestionService(persistence, ingestion);
    const reasoning = options.reasoning ?? new ReasoningEngine();
    const analysis = new FinancialStatementAnalysisService(new FinancialIntelligenceEngine(), reasoning);
    const executiveWorkbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    const reports = new ReportsEngine();
    const resilience = new ResilienceAnalyticsService();
    const impact = new ImpactMeasurementService();
    const improvement = new ContinuousImprovementEngine();
    const latestResults = new Map<string, StoredAnalysis>();
    const latestWorkbenchResults = new Map<string, ExecutiveIntelligenceWorkbenchResult>();
    const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    const rateLimiterMap = new Map<string, TokenBucketRateLimiter>();
    const RATE_LIMIT_CAPACITY = 5;
    const RATE_LIMIT_REFILL_PER_SECOND = 1;
    const now = options.now ?? (() => Date.now());
    const corsOrigin = options.corsOrigin ?? DEFAULT_CORS_ORIGIN;

    const identity = new CommercialIdentityService(persistence, sessionTtlMs);
    identity.setNowProvider(now);
    identity.initialize();

    const cookieAttributes = `HttpOnly; SameSite=Strict; Path=/${options.secureCookies ? "; Secure" : ""}`;
    const sessionCookie = (token: string) => `${SESSION_COOKIE}=${token}; ${cookieAttributes}`;
    const clearedCookie = () => `${SESSION_COOKIE}=; ${cookieAttributes}; Max-Age=0`;

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

    const sessionPayload = (session: CommercialSession) => ({
        authenticated: true,
        organization: { name: session.organization },
        tenantId: session.tenantId,
        username: session.username,
        role: session.role,
        expiresAt: session.expiresAt
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
            if (req.method === "GET" && path === "/health") return corsJson(200, { status: "ok", service: "hooshyar-commercial-runtime" });
            if (req.method === "GET" && path === "/api/ready") return corsJson(200, { status: "READY", capabilities: ["financial-ingestion", "multi-format-ingestion", "raw-source-evidence", "financial-statement-analysis", "tenant-scoped-persistence", "reasoning", "executive-intelligence-workbench", "reports", "assistant-context", "resilience-analytics", "impact-measurement", "continuous-improvement", "authentication", "rbac", "session-lifecycle"] });
            if (req.method === "GET" && path === "/") return asset(res, "index.html", "text/html; charset=utf-8");
            if (req.method === "GET" && path === "/app.js") return asset(res, "app.js", "text/javascript; charset=utf-8");
            if (req.method === "GET" && path === "/styles.css") return asset(res, "styles.css", "text/css; charset=utf-8");
            if (req.method === "GET" && path === "/manifest.webmanifest") return asset(res, "manifest.webmanifest", "application/manifest+json; charset=utf-8");
            if (req.method === "GET" && path === "/sw.js") return asset(res, "sw.js", "text/javascript; charset=utf-8");

            const cookies = parseCookies(req.headers.cookie);
            const cookieToken = cookies[SESSION_COOKIE];
            const session = cookieToken ? identity.getSession(cookieToken) : null;

            const logAuthFailure = (reason: string) => {
                const securityLogger = options.securityEventLogger;
                if (securityLogger) {
                    securityLogger.logAuthenticationFailure({
                        actorId: undefined,
                        target: req.url ?? "unknown",
                        reason,
                        metadata: { method: req.method, path: req.url }
                    });
                }
            };

            if (req.method === "POST" && path === "/api/auth/register") {
                const body = await readJson(req);
                const username = String(body.username ?? "").trim();
                const organization = String(body.organization ?? "").trim();
                const password = String(body.password ?? "");
                if (!username || !organization || !password) return corsJson(400, { error: "REGISTRATION_FIELDS_REQUIRED" });
                const result = identity.registerUser(username, password, organization);
                if (!result.success || !result.session) {
                    logAuthFailure(result.error ?? "REGISTRATION_FAILED");
                    const status = result.error === "USER_ALREADY_EXISTS" ? 409 : 400;
                    return corsJson(status, { error: result.error ?? "REGISTRATION_FAILED" });
                }
                return corsJson(201, sessionPayload(result.session), { "Set-Cookie": sessionCookie(result.session.token) });
            }

            if (req.method === "POST" && path === "/api/auth/login") {
                const body = await readJson(req);
                const username = String(body.username ?? "").trim();
                const organization = String(body.organization ?? "").trim();
                const password = String(body.password ?? "");
                if (!username || !organization || !password) return corsJson(400, { error: "CREDENTIALS_REQUIRED" });
                const result = identity.login(username, password, organization);
                if (!result.success || !result.session) {
                    logAuthFailure(result.error ?? "AUTHENTICATION_FAILED");
                    return corsJson(401, { error: "INVALID_CREDENTIALS" });
                }
                return corsJson(200, sessionPayload(result.session), { "Set-Cookie": sessionCookie(result.session.token) });
            }

            if (req.method === "POST" && path === "/api/auth/logout") {
                if (cookieToken) identity.logout(cookieToken);
                return corsJson(200, { authenticated: false }, { "Set-Cookie": clearedCookie() });
            }

            if (req.method === "POST" && path === "/api/auth/refresh") {
                if (!cookieToken) return corsJson(401, { authenticated: false });
                const refreshed = identity.refreshSession(cookieToken);
                if (!refreshed) return corsJson(401, { authenticated: false }, { "Set-Cookie": clearedCookie() });
                return corsJson(200, sessionPayload(refreshed), { "Set-Cookie": sessionCookie(refreshed.token) });
            }

            if (req.method === "POST" && path === "/api/session") {
                const body = await readJson(req);
                const username = String(body.username ?? "").trim();
                const organization = String(body.organization ?? "").trim();
                const password = body.password === undefined ? undefined : String(body.password);
                if (!username || !organization) return corsJson(400, { error: "SESSION_FIELDS_REQUIRED" });

                const created = password === undefined
                    ? { success: true as const, session: identity.createSession(username, organization, "OWNER") }
                    : identity.login(username, password, organization);
                if (!created.success || !created.session) {
                    logAuthFailure(created.error ?? "AUTHENTICATION_FAILED");
                    return corsJson(401, { error: "INVALID_CREDENTIALS" });
                }
                return corsJson(201, sessionPayload(created.session), { "Set-Cookie": sessionCookie(created.session.token) });
            }

            if (req.method === "GET" && path === "/api/session") {
                if (!session) return corsJson(401, { authenticated: false });
                return corsJson(200, sessionPayload(session));
            }

            if (!session) {
                logAuthFailure("AUTHENTICATION_REQUIRED");
                return corsJson(401, { error: "AUTHENTICATION_REQUIRED" });
            }

            const ensurePermission = (permission: CommercialPermission): boolean => {
                if (identity.hasPermission(session.token, session.organization, permission)) return true;
                const securityLogger = options.securityEventLogger;
                if (securityLogger) {
                    securityLogger.logAuthorizationDenial({
                        actorId: session.username,
                        tenantId: session.tenantId,
                        target: req.url ?? "unknown",
                        reason: "INSUFFICIENT_PERMISSIONS",
                        metadata: { permission, method: req.method, path: req.url }
                    });
                }
                return false;
            };

            if (req.method === "POST" && path === "/api/analyze") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const analyzeError = validateAnalyzeBody(body);
                if (analyzeError) return corsJson(400, { error: analyzeError });
                const csv = String(body.csv ?? "");
                const sourceName = String(body.sourceName ?? "ledger.csv");
                const assets = Number(body.assets);
                const liabilities = Number(body.liabilities);
                const ingested = await ingestion.ingestCsv(session.tenantId, sourceName, csv);
                const result = analysis.execute({ tenantId: session.tenantId, revenue: ingested.model.totals.credit, expenses: ingested.model.totals.debit, assets, liabilities, source: ingested.evidence });
                if (result.status !== "READY") return corsJson(422, result);
                await persistence.write({ tenantId: session.tenantId }, LATEST_ANALYSIS_KEY, result);
                latestResults.set(session.tenantId, result);
                return corsJson(200, result);
            }

            if (req.method === "POST" && path === "/api/ingest") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req, INGEST_BODY_BYTES);
                const ingestError = validateIngestBody(body);
                if (ingestError) return corsJson(400, { error: ingestError });
                try {
                    const outcome = await ingestionService.ingest(session.tenantId, {
                        sourceName: String(body.sourceName),
                        format: String(body.format).trim().toUpperCase() as IngestionFormat,
                        content: body.content === undefined ? undefined : String(body.content),
                        contentBase64: body.contentBase64 === undefined ? undefined : String(body.contentBase64)
                    });
                    return corsJson(201, {
                        status: "READY",
                        tenantId: session.tenantId,
                        format: outcome.requestedFormat,
                        evidence: outcome.result.evidence,
                        source: outcome.rawSourceRef,
                        transactionCount: outcome.result.model.transactions.length,
                        totals: outcome.result.model.totals
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : "INGESTION_FAILED";
                    return corsJson(422, { error: message });
                }
            }

            if (req.method === "GET" && path === "/api/sources") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const sources = await ingestionService.listSources(session.tenantId);
                return corsJson(200, { status: "READY", tenantId: session.tenantId, sources });
            }

            if (req.method === "GET" && path.startsWith("/api/sources/")) {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const sha = decodeURIComponent(path.slice("/api/sources/".length));
                const source = await ingestionService.readSource(session.tenantId, sha);
                if (!source) return corsJson(404, { error: "SOURCE_NOT_FOUND" });
                return corsJson(200, { status: "READY", tenantId: session.tenantId, source });
            }

            if (req.method === "POST" && path === "/api/executive/workbench") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("CREATE_DECISION")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const workbenchError = validateWorkbenchBody(body);
                if (workbenchError) return corsJson(400, { error: workbenchError });
                const targets = parseExecutiveTargets(body.targets);
                if (!targets) return corsJson(400, { error: "EXECUTIVE_TARGETS_REQUIRED" });
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson(422, { error: "EXECUTIVE_ANALYSIS_REQUIRED" });
                const workbenchResult = executiveWorkbench.execute({ tenantId: session.tenantId, metrics: result.metrics, targets });
                if (workbenchResult.status !== "READY") return corsJson(422, workbenchResult);
                await persistence.write({ tenantId: session.tenantId }, LATEST_EXECUTIVE_WORKBENCH_KEY, workbenchResult);
                latestWorkbenchResults.set(session.tenantId, workbenchResult);
                return corsJson(200, workbenchResult);
            }

            if (req.method === "GET" && path === "/api/report") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson(422, { error: "REPORT_ANALYSIS_REQUIRED" });
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
                return corsJson(report.status === "READY" ? 200 : 422, { ...report, tenantId: session.tenantId, source: result.source });
            }

            if (req.method === "POST" && path === "/api/assistant") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const assistantError = validateAssistantBody(body);
                if (assistantError) return corsJson(400, { error: assistantError });
                const question = String(body.question ?? "").trim();
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson(422, { error: "ASSISTANT_ANALYSIS_REQUIRED" });
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
                if (!answer.success) return corsJson(503, { error: "ASSISTANT_REASONING_UNAVAILABLE" });
                return corsJson(200, { status: "READY", tenantId: session.tenantId, question, answer: answer.answer ?? answer.status, evidence: { analysisSource: result.source, executiveWorkbench: Boolean(workbench) } });
            }

            if (req.method === "GET" && path === "/api/dashboard") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson(200, { status: "READY", tenantId: session.tenantId, metrics: { revenue: 0, profit: 0, risk: 0 }, analysisAvailable: false, executiveIntelligence: null });
                const workbench = await loadWorkbench(session.tenantId);
                return corsJson(200, dashboardPayload(result, workbench));
            }

            if (req.method === "POST" && path === "/api/resilience/stress-test") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const scenarios = Array.isArray(body.scenarios) ? body.scenarios.filter((s: unknown): s is Scenario => !!s && typeof s === "object" && typeof (s as any).name === "string" && typeof (s as any).shockPercent === "number") : [];
                const result = resilience.stressTest({
                    tenantId: session.tenantId,
                    metric: String(body.metric ?? "revenue"),
                    baseValue: Number(body.baseValue),
                    scenarios,
                    simulationCount: Number(body.simulationCount),
                    seed: Number(body.seed),
                    residuals: Array.isArray(body.residuals) ? body.residuals.filter((r: unknown): r is { readonly residual: number } => !!r && typeof r === "object" && typeof (r as any).residual === "number") : undefined
                });
                return corsJson(result.status === "READY" ? 200 : 422, result);
            }

            if (req.method === "POST" && path === "/api/resilience/sensitivity") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const shockRange = Array.isArray(body.shockRange) ? body.shockRange.filter((s: unknown): s is number => typeof s === "number" && Number.isFinite(s)) : [];
                const result = resilience.sensitivityAnalysis(session.tenantId, String(body.metric ?? "revenue"), Number(body.baseValue), shockRange);
                if ((result as any).status === "BLOCKED") return corsJson(422, result);
                return corsJson(200, result);
            }

            if (req.method === "POST" && path === "/api/resilience/optimize") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("CREATE_DECISION")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const bounds = Array.isArray(body.bounds) ? body.bounds.filter((b: unknown): b is { readonly variable: string; readonly lower: number; readonly upper: number } => !!b && typeof b === "object" && typeof (b as any).variable === "string" && typeof (b as any).lower === "number" && typeof (b as any).upper === "number") : [];
                const result = resilience.optimize({
                    tenantId: session.tenantId,
                    objective: String(body.objective ?? "maximize_profit") as any,
                    variableNames: Array.isArray(body.variableNames) ? body.variableNames.filter((v: unknown): v is string => typeof v === "string") : [],
                    initialGuess: Array.isArray(body.initialGuess) ? body.initialGuess.filter((v: unknown): v is number => typeof v === "number" && Number.isFinite(v)) : [],
                    bounds,
                    linearConstraints: Array.isArray(body.linearConstraints) ? body.linearConstraints.filter((lc: unknown) => !!lc && typeof lc === "object" && Array.isArray((lc as any).coefficients) && typeof (lc as any).bound === "number" && typeof (lc as any).inequality === "string") : undefined,
                    maxIterations: Number(body.maxIterations)
                });
                return corsJson(result.status === "READY" ? 200 : 422, result);
            }

            if (req.method === "POST" && path === "/api/impact/measure") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const baseline = parseBaseline(body.baseline, session.tenantId);
                const post = parsePost(body.post, session.tenantId);
                if (!baseline || !post) return corsJson(400, { error: "BASELINE_AND_POST_REQUIRED" });
                const result = impact.measure(baseline, post, body.expectedImpact as any);
                return corsJson(result.status === "READY" ? 200 : 422, result);
            }

            if (req.method === "POST" && path === "/api/improvement/improve") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("CREATE_DECISION")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const currentState = parseCurrentState(body.currentState);
                if (!currentState) return corsJson(400, { error: "CURRENT_STATE_REQUIRED" });
                const actualImpact = parseActualImpact(body.actualImpact);
                if (!actualImpact) return corsJson(400, { error: "ACTUAL_IMPACT_REQUIRED" });
                const result = improvement.improve({
                    tenantId: session.tenantId,
                    domain: String(body.domain ?? "financial") as any,
                    actualImpact,
                    expectedImpact: body.expectedImpact as any,
                    currentState
                });
                return corsJson(result.status === "READY" ? 200 : 422, result);
            }

            return corsJson(404, { error: "NOT_FOUND" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "RUNTIME_ERROR";
            const status = message === "request-body-too-large" ? 413 : 400;
            return corsJson(status, { error: message });
        }
    });
    server.once("close", close);
    return server;
}
