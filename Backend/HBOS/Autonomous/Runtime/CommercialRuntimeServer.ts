import { CommercialIdentityService } from "../../Product/CommercialIdentityService";
import type { CommercialRole, CommercialSession } from "../../Product/CommercialIdentityService";
import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FinancialIntelligenceEngine } from "../../Engines/FinancialIntelligenceEngine";
import { ReasoningEngine } from "../../Engines/ReasoningEngine";
import { FinancialDataIngestionAdapter } from "../../Product/FinancialDataIngestionAdapter";
import { FinancialStatementAnalysisService } from "../../Product/FinancialStatementAnalysisService";
import { SQLitePersistenceStore } from "../../Product/SQLitePersistenceStore";
import { ExecutiveIntelligenceEngine } from "../../Engines/ExecutiveIntelligenceEngine";
import { ExecutiveIntelligenceWorkbench } from "../../Product/ExecutiveIntelligenceWorkbench";
import { FinancialStandardsKnowledgeService } from "../../Product/FinancialStandardsKnowledgeService";
import { InterdisciplinaryDecisionKnowledgeService } from "../../Product/InterdisciplinaryDecisionKnowledgeService";

export interface CommercialRuntimeOptions {
    readonly databasePath?: string;
    readonly reasoning?: Pick<ReasoningEngine, "reason">;
}

const WEB_ROOT = resolve(process.cwd(), "web");
const MAX_BODY_BYTES = 1024 * 1024;

const EXECUTIVE_TARGET_KEYS = ["revenue", "profit", "profitMargin", "debtRatio"] as const;
type ExecutiveTargetKey = typeof EXECUTIVE_TARGET_KEYS[number];
type ExecutiveTargets = Readonly<Record<ExecutiveTargetKey, number>>;
const isExecutiveTargets = (value: unknown): value is ExecutiveTargets => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return EXECUTIVE_TARGET_KEYS.every((key) =>
        typeof candidate[key] === "number" &&
        Number.isFinite(candidate[key]) &&
        (candidate[key] as number) > 0
    );
};

const RESPONSE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const send = (res: ServerResponse, status: number, contentType: string, body: string, headers: Record<string, string> = {}) => {
    res.statusCode = status;
    res.setHeader("Content-Type", contentType);
    for (const [key, value] of Object.entries(RESPONSE_SECURITY_HEADERS)) res.setHeader(key, value);
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    res.end(body);
};

const json = (res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) =>
    send(res, status, "application/json; charset=utf-8", JSON.stringify(payload), headers);

const parseCookies = (header: string | undefined): Record<string, string> => Object.fromEntries(
    (header ?? "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, value.join("=")]),
);

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
    const executiveEngine = new ExecutiveIntelligenceEngine();
    executiveEngine.initialize();
    const executiveWorkbench = new ExecutiveIntelligenceWorkbench(executiveEngine);
    const financialStandardsKnowledge = new FinancialStandardsKnowledgeService();
    const interdisciplinaryKnowledge = new InterdisciplinaryDecisionKnowledgeService();
    const identity = new CommercialIdentityService(persistence);
    identity.initialize();
    const historyKey = "financial-analysis-history:v1";
    const executiveTargetsKey = "executive-kpi-targets:v1";
    type AnalysisResult = ReturnType<FinancialStatementAnalysisService["execute"]>;
    type HistoryEntry = { readonly analyzedAt: string; readonly result: AnalysisResult };
    const readHistory = async (tenantId: string): Promise<HistoryEntry[]> => {
        const record = await persistence.read({ tenantId }, historyKey);
        if (!Array.isArray(record?.value)) return [];
        return record.value.filter((entry): entry is HistoryEntry => Boolean(
            entry && typeof entry === "object" &&
            typeof (entry as HistoryEntry).analyzedAt === "string" &&
            (entry as HistoryEntry).result?.tenantId === tenantId
        ));
    };

    const close = () => persistence.close();
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        try {
            const requestUrl = new URL(req.url ?? "/", "http://hooshyaros.local");
            const path = requestUrl.pathname;
            if (req.method === "GET" && path === "/health") return json(res, 200, { status: "ok", service: "hooshyar-commercial-runtime" });
            if (req.method === "GET" && path === "/api/ready") return json(res, 200, { status: "READY", capabilities: ["account-authentication", "organization-membership", "role-based-authorization", "durable-tenant-identity", "financial-ingestion", "financial-statement-analysis", "tenant-scoped-persistence", "reasoning", "executive-intelligence-target-evaluation", "versioned-financial-standards-knowledge", "task-composed-interdisciplinary-decision-knowledge"] });
            if (req.method === "GET" && path === "/api/knowledge/interdisciplinary") {
                const task = requestUrl.searchParams.get("task") ?? "GENERAL";
                const objective = requestUrl.searchParams.get("objective") ?? undefined;
                const jurisdiction = requestUrl.searchParams.get("jurisdiction") ?? undefined;
                const entityType = requestUrl.searchParams.get("entityType") ?? undefined;
                const evidenceAvailable = requestUrl.searchParams.getAll("evidence");
                return json(res, 200, {
                    catalogue: interdisciplinaryKnowledge.getCatalogue(),
                    composition: interdisciplinaryKnowledge.composeForTask({
                        task, objective, jurisdiction, entityType, evidenceAvailable,
                    }),
                });
            }
            if (req.method === "GET" && path === "/api/knowledge/financial-standards") {
                const catalogue = financialStandardsKnowledge.getCatalogue();
                const jurisdiction = requestUrl.searchParams.get("jurisdiction");
                const entityType = requestUrl.searchParams.get("entityType");
                const fiscalYearStartJalali = requestUrl.searchParams.get("fiscalYearStartJalali");
                if (jurisdiction || entityType || fiscalYearStartJalali) {
                    return json(res, 200, {
                        catalogue,
                        applicability: financialStandardsKnowledge.assessIranianApplicability({
                            jurisdiction: jurisdiction ?? "",
                            entityType: entityType ?? "",
                            fiscalYearStartJalali: fiscalYearStartJalali ?? "",
                            isListed: requestUrl.searchParams.get("isListed") === "true",
                            isFinancialInstitution: requestUrl.searchParams.get("isFinancialInstitution") === "true",
                            publicInterestEntity: requestUrl.searchParams.get("publicInterestEntity") === "true",
                        }),
                    });
                }
                return json(res, 200, { catalogue });
            }
            if (req.method === "GET" && (path === "/" || path === "/index.html")) return asset(res, "index.html", "text/html; charset=utf-8");
            if (req.method === "GET" && path === "/executive-evaluation-view-model.js") return asset(res, "executive-evaluation-view-model.js", "text/javascript; charset=utf-8");
            if (req.method === "GET" && path === "/app.js") return asset(res, "app.js", "text/javascript; charset=utf-8");
            if (req.method === "GET" && path === "/styles.css") return asset(res, "styles.css", "text/css; charset=utf-8");
            if (req.method === "GET" && path === "/manifest.webmanifest") return asset(res, "manifest.webmanifest", "application/manifest+json; charset=utf-8");
            if (req.method === "GET" && path === "/sw.js") return asset(res, "sw.js", "text/javascript; charset=utf-8");

            const cookies = parseCookies(req.headers.cookie);
            const token = cookies.hooshyar_session;
            const session = identity.getSession(token ?? undefined);
            const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";

            if (req.method === "POST" && path === "/api/session") {
                const body = await readJson(req);
                const mode = String(body.mode ?? "");
                const username = String(body.username ?? "");
                const organization = String(body.organization ?? "");
                const password = String(body.password ?? "");
                let created: CommercialSession;
                if (mode === "register") {
                    created = await identity.registerOrganizationOwner(username, organization, password);
                } else if (mode === "join") {
                    created = await identity.joinOrganization(username, password, String(body.invitationCode ?? ""));
                } else if (mode === "login") {
                    created = await identity.login(username, organization, password);
                } else {
                    return json(res, 400, { error: "SESSION_MODE_INVALID" });
                }
                const status = mode === "login" ? 200 : 201;
                return json(res, status, {
                    authenticated: true,
                    username: created.username,
                    organization: { name: created.organization },
                    tenantId: created.tenantId,
                    role: created.role,
                    expiresAt: created.expiresAt,
                }, {
                    "Set-Cookie": `hooshyar_session=${created.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secureCookie}`,
                });
            }

            if (req.method === "POST" && path === "/api/logout") {
                if (token) await identity.logout(token);
                return json(res, 200, { loggedOut: true }, {
                    "Set-Cookie": `hooshyar_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie}`,
                });
            }

            if (req.method === "GET" && path === "/api/session") {
                if (!session) return json(res, 401, { authenticated: false });
                return json(res, 200, {
                    authenticated: true,
                    username: session.username,
                    organization: { name: session.organization },
                    tenantId: session.tenantId,
                    role: session.role,
                    expiresAt: session.expiresAt,
                });
            }

            if (!session) return json(res, 401, { error: "AUTHENTICATION_REQUIRED" });

            if (req.method === "POST" && path === "/api/invitations") {
                await identity.authorize(session.token, session.organization, "MANAGE_USERS");
                const body = await readJson(req);
                const role = String(body.role ?? "VIEWER") as Exclude<CommercialRole, "OWNER">;
                const invitation = await identity.createInvitation(session.token, role);
                return json(res, 201, invitation);
            }

            if (req.method === "POST" && path === "/api/executive-targets") {
                await identity.authorize(session.token, session.organization, "MANAGE_TARGETS");
                const body = await readJson(req);
                if (!isExecutiveTargets(body.targets)) {
                    return json(res, 400, { error: "EXECUTIVE_TARGETS_INVALID" });
                }
                await persistence.write({ tenantId: session.tenantId }, executiveTargetsKey, body.targets);
                return json(res, 200, { saved: true, targets: body.targets });
            }

            if (req.method === "POST" && path === "/api/analyze") {
                await identity.authorize(session.token, session.organization, "INGEST_DATA");
                const body = await readJson(req);
                const csv = String(body.csv ?? "");
                const sourceName = String(body.sourceName ?? "ledger.csv");
                const assets = Number(body.assets);
                const liabilities = Number(body.liabilities);
                if (!Number.isFinite(assets) || !Number.isFinite(liabilities)) return json(res, 400, { error: "BALANCE_SHEET_FIELDS_REQUIRED" });
                const ingested = await ingestion.ingestCsv(session.tenantId, sourceName, csv);
                const result = analysis.execute({ tenantId: session.tenantId, revenue: ingested.model.totals.credit, expenses: ingested.model.totals.debit, assets, liabilities, source: ingested.evidence });
                if (result.status !== "READY") return json(res, 422, result);
                const history = await readHistory(session.tenantId);
                const entry: HistoryEntry = { analyzedAt: new Date().toISOString(), result };
                await persistence.write({ tenantId: session.tenantId }, historyKey, [...history, entry].slice(-24));
                return json(res, 200, result);
            }

            if (req.method === "GET" && path === "/api/dashboard") {
                await identity.authorize(session.token, session.organization, "READ_DASHBOARD");
                const history = await readHistory(session.tenantId);
                const latest = history[history.length - 1];
                const targetRecord = await persistence.read({ tenantId: session.tenantId }, executiveTargetsKey);
                const targets = isExecutiveTargets(targetRecord?.value) ? targetRecord.value : null;
                if (!latest) {
                    return json(res, 200, {
                        status: "READY",
                        tenantId: session.tenantId,
                        metrics: { revenue: 0, profit: 0, risk: 0 },
                        analysisAvailable: false,
                        history: [],
                        targetsConfigured: targets !== null,
                        targets,
                        executiveEvaluation: null,
                    });
                }
                const result = latest.result;
                const executiveEvaluation = targets
                    ? executiveWorkbench.execute({ tenantId: session.tenantId, metrics: result.metrics, targets })
                    : null;
                return json(res, 200, {
                    status: result.status,
                    tenantId: result.tenantId,
                    analysisAvailable: true,
                    metrics: { revenue: result.metrics.revenue, profit: result.metrics.profit, risk: result.metrics.debtRatio * 100 },
                    observations: result.observations,
                    source: result.source,
                    analyzedAt: latest.analyzedAt,
                    history: history.map(({ analyzedAt, result: item }) => ({
                        analyzedAt,
                        metrics: { revenue: item.metrics.revenue, profit: item.metrics.profit, risk: item.metrics.debtRatio * 100 },
                        source: item.source,
                        observations: item.observations,
                    })),
                    targetsConfigured: targets !== null,
                    targets,
                    executiveEvaluation,
                });
            }

            return json(res, 404, { error: "NOT_FOUND" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "RUNTIME_ERROR";
            const statusByError: Record<string, number> = {
                "request-body-too-large": 413,
                "SESSION_FIELDS_REQUIRED": 400,
                "SESSION_MODE_INVALID": 400,
                "PASSWORD_POLICY_INVALID": 400,
                "ORGANIZATION_ALREADY_EXISTS": 409,
                "ACCOUNT_ALREADY_EXISTS": 409,
                "AUTHENTICATION_FAILED": 401,
                "AUTHENTICATION_RATE_LIMITED": 429,
                "AUTHENTICATION_REQUIRED": 401,
                "AUTHORIZATION_DENIED": 403,
                "INVITATION_INVALID": 400,
                "INVITATION_ROLE_NOT_ALLOWED": 403,
                "IDENTITY_REGISTRY_CORRUPT": 500,
            };
            const status = statusByError[message] ?? 400;
            const safeMessage = status >= 500 ? "INTERNAL_ERROR" : message;
            if (status >= 500) console.error("Commercial runtime request failed:", message);
            return json(res, status, { error: safeMessage });
        }
    });
    server.once("close", close);
    return server;
}
