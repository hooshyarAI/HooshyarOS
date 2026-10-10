import { randomBytes } from "node:crypto";
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

export interface CommercialRuntimeOptions {
    readonly databasePath?: string;
    readonly reasoning?: Pick<ReasoningEngine, "reason">;
}

const WEB_ROOT = resolve(process.cwd(), "web");
const MAX_BODY_BYTES = 1024 * 1024;

type Session = { token: string; tenantId: string; organization: string };
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

const send = (res: ServerResponse, status: number, contentType: string, body: string, headers: Record<string, string> = {}) => {
    res.statusCode = status;
    res.setHeader("Content-Type", contentType);
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
    const sessions = new Map<string, Session>();
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
            const path = req.url?.split("?")[0] ?? "/";
            if (req.method === "GET" && path === "/health") return json(res, 200, { status: "ok", service: "hooshyar-commercial-runtime" });
            if (req.method === "GET" && path === "/api/ready") return json(res, 200, { status: "READY", capabilities: ["financial-ingestion", "financial-statement-analysis", "tenant-scoped-persistence", "reasoning", "executive-intelligence-target-evaluation"] });
            if (req.method === "GET" && path === "/") return asset(res, "index.html", "text/html; charset=utf-8");
            if (req.method === "GET" && path === "/app.js") return asset(res, "app.js", "text/javascript; charset=utf-8");
            if (req.method === "GET" && path === "/styles.css") return asset(res, "styles.css", "text/css; charset=utf-8");
            if (req.method === "GET" && path === "/manifest.webmanifest") return asset(res, "manifest.webmanifest", "application/manifest+json; charset=utf-8");
            if (req.method === "GET" && path === "/sw.js") return asset(res, "sw.js", "text/javascript; charset=utf-8");

            const cookies = parseCookies(req.headers.cookie);
            const session = cookies.hooshyar_session ? sessions.get(cookies.hooshyar_session) : undefined;

            if (req.method === "POST" && path === "/api/session") {
                const body = await readJson(req);
                const username = String(body.username ?? "").trim();
                const organization = String(body.organization ?? "").trim();
                if (!username || !organization) return json(res, 400, { error: "SESSION_FIELDS_REQUIRED" });
                const token = randomBytes(24).toString("hex");
                const created: Session = { token, tenantId: `tenant:${token.slice(0, 16)}`, organization };
                sessions.set(token, created);
                return json(res, 201, { authenticated: true, organization: { name: organization }, tenantId: created.tenantId }, {
                    "Set-Cookie": `hooshyar_session=${token}; HttpOnly; SameSite=Lax; Path=/`,
                });
            }

            if (req.method === "GET" && path === "/api/session") {
                if (!session) return json(res, 401, { authenticated: false });
                return json(res, 200, { authenticated: true, organization: { name: session.organization }, tenantId: session.tenantId });
            }

            if (!session) return json(res, 401, { error: "AUTHENTICATION_REQUIRED" });

            if (req.method === "POST" && path === "/api/executive-targets") {
                const body = await readJson(req);
                if (!isExecutiveTargets(body.targets)) {
                    return json(res, 400, { error: "EXECUTIVE_TARGETS_INVALID" });
                }
                await persistence.write({ tenantId: session.tenantId }, executiveTargetsKey, body.targets);
                return json(res, 200, { saved: true, targets: body.targets });
            }

            if (req.method === "POST" && path === "/api/analyze") {
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
            const status = message === "request-body-too-large" ? 413 : 400;
            return json(res, status, { error: message });
        }
    });
    server.once("close", close);
    return server;
}
