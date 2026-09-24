import { createHash, randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FinancialIntelligenceEngine } from "../../Engines/FinancialIntelligenceEngine";
import { ExecutiveIntelligenceEngine } from "../../Engines/ExecutiveIntelligenceEngine";
import { ReasoningEngine } from "../../Engines/ReasoningEngine";
import { ReportsEngine, SUPPORTED_REPORT_FORMATS, type ReportFormat, type ReportSection } from "../../Engines/ReportsEngine";
import { FinancialDataIngestionAdapter, type FinancialCanonicalModel, type FinancialSourceEvidence } from "../../Product/FinancialDataIngestionAdapter";
import {
    assessStatementAnalysisReadiness,
    deriveAnalysisInput,
    derivePriorStatement,
    summarizeFinancialDocument,
} from "../../Product/FinancialDocumentUnderstanding";
import {
    composeFinancialStatementInsight,
    type FinancialStatementInsight,
} from "../../Product/FinancialStatementInsight";
import { FinancialIngestionService, IngestionFormat, SUPPORTED_INGESTION_FORMATS } from "../../Product/FinancialIngestionService";
import { IngestionJobService } from "../../Product/IngestionJobService";
import { isTerminalIngestionStage } from "../../Product/IngestionProgress";
import { SyncStateStore } from "../../Product/SyncStateStore";
import { FinancialStatementAnalysisService } from "../../Product/FinancialStatementAnalysisService";
import { SecurityEventLogger } from "../../Entities/SecurityEventLogger";
import { ExecutiveIntelligenceWorkbench, ExecutiveIntelligenceWorkbenchInput, ExecutiveIntelligenceWorkbenchResult } from "../../Product/ExecutiveIntelligenceWorkbench";
import { DecisionWorkbench, DecisionWorkbenchInput, DecisionWorkbenchResult } from "../../Product/DecisionWorkbench";
import { FinancialAnalyticsService, FinancialAnalyticsResult, FinancialAnalyticsInput } from "../../Product/FinancialAnalyticsService";
import { ReportExportService } from "../../Product/ReportExportService";
import {
    OrganizationalExecutionCoordinator,
    WorkItemOperationResult,
    WorkItemPriority,
    WorkItemAssigneeType,
    KpiOutcomeInput,
    WorkItemEvidence,
    WorkItemFeedbackInput,
    CompleteWorkItemInput
} from "../../Product/OrganizationalExecutionCoordinator";
import { SecurityContext } from "../../Security/SecurityContext";
import { Principal } from "../../Security/Principals";
import { TenantIsolation } from "../../Security/TenantIsolation";
import { Authorization, AuthorizationResult } from "../../Security/Authorization";
import { SQLitePersistenceStore } from "../../Product/SQLitePersistenceStore";
import { CommercialIdentityService, CommercialPermission, CommercialSession } from "../../Product/CommercialIdentityService";
import { TokenBucketRateLimiter } from "../../Product/GenericApiConnector";
import { ResilienceAnalyticsService } from "../../Product/ResilienceAnalyticsService";
import { Scenario } from "../../Uncertainty/MonteCarloTypes";
import { ImpactMeasurementService } from "../../Product/ImpactMeasurementService";
import { ContinuousImprovementEngine } from "../../Assistant/Autonomous/ContinuousImprovementEngine";
import { RuntimeObservability } from "./RuntimeObservability";
import { RuntimeDependencyProbe, RuntimeDependencyReport } from "./RuntimeDependencyProbe";
import { parsePagination, toPageMeta } from "./QueryPagination";
import type { BaselineMetrics, PostInterventionMetrics } from "../../Product/ImpactMeasurementService";
import {
    OrganizationalProblemSolvingService,
    ProblemBlockCode,
    ProblemCase,
    ProblemCategory,
    ProblemResult,
    ProblemSeverity,
} from "../../Product/OrganizationalProblemSolvingService";

export interface CommercialRuntimeOptions {
    readonly databasePath?: string;
    readonly reasoning?: Pick<ReasoningEngine, "reason">;
    readonly securityEventLogger?: SecurityEventLogger;
    readonly sessionTtlMs?: number;
    readonly now?: () => number;
    readonly corsOrigin?: string;
    readonly secureCookies?: boolean;
    /**
     * Interval for the runtime's expired-session sweep. Defaults to
     * `DEFAULT_SESSION_SWEEP_INTERVAL_MS`; `0` disables the sweep (used by
     * tests that drive session lifecycle explicitly).
     */
    readonly sessionSweepIntervalMs?: number;
    /**
     * Override for the runtime dependency probe (reasoning provider boundary).
     * Defaults to the process-environment probe; injectable for deterministic
     * tests of the provider resolution paths.
     */
    readonly dependencyProbe?: RuntimeDependencyProbe;
}

const WEB_ROOT = resolve(process.cwd(), "web");
const MAX_BODY_BYTES = 1024 * 1024;
const INGEST_BODY_BYTES = 32 * 1024 * 1024; // Base64 JSON transport supports scanned PDFs up to ~24 MiB raw bytes.
const LATEST_ANALYSIS_KEY = "financial-analysis:latest";
const LATEST_EXECUTIVE_WORKBENCH_KEY = "executive-intelligence-workbench:latest";
const LATEST_DECISION_WORKBENCH_KEY = "decision-workbench:latest";
const LATEST_ANALYTICS_KEY = "financial-analytics:latest";
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const DEFAULT_SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";
const SESSION_COOKIE = "hooshyar_session";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;

/**
 * Persisted idempotency evidence. Stored through the canonical
 * `SQLitePersistenceStore` under the tenant scope, so replay state is durable,
 * tenant-isolated and survives restarts. `IN_PROGRESS` marks an atomically
 * claimed key whose side effect has not yet completed.
 */
interface IdempotencyRecord {
    readonly tenantId: string;
    readonly actorId: string;
    readonly scope: string;
    readonly requestHash: string;
    readonly status: "IN_PROGRESS" | "COMPLETED";
    readonly createdAt: string;
    readonly completedAt?: string;
    readonly responseStatus?: number;
    readonly responseBody?: unknown;
}

const corsHeaders = (origin: string): Record<string, string> => ({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
});

type StoredAnalysis = ReturnType<FinancialStatementAnalysisService["execute"]>;
type StoredAnalytics = FinancialAnalyticsResult & {
    readonly source?: FinancialSourceEvidence;
    readonly statementInsight?: FinancialStatementInsight;
};
type ExecutiveTargets = ExecutiveIntelligenceWorkbenchInput["targets"];

const send = (res: ServerResponse, status: number, contentType: string, body: string | Buffer, headers: Record<string, string> = {}) => {
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
    if (format === "XLSX" || format === "XLS" || format === "PDF" || format === "DOCX") {
        if (typeof body.contentBase64 !== "string" || !body.contentBase64.trim()) return "CONTENT_BASE64_REQUIRED";
    } else if (typeof body.content !== "string" || !body.content.trim()) {
        return "CONTENT_REQUIRED";
    }
    return null;
};

const validateDecisionBody = (body: Record<string, unknown>): string | null => {
    const problem = String(body.problem ?? "").trim();
    if (!problem) return "DECISION_PROBLEM_REQUIRED";
    const alternatives = body.alternatives;
    if (!Array.isArray(alternatives) || alternatives.length < 2 || alternatives.some((a) => !String(a ?? "").trim())) {
        return "DECISION_ALTERNATIVES_REQUIRED";
    }
    const criteria = body.criteria;
    if (!Array.isArray(criteria) || criteria.length < 1 || criteria.some((c) => {
        if (!c || typeof c !== "object" || Array.isArray(c)) return true;
        const criterion = c as Record<string, unknown>;
        return !String(criterion.name ?? "").trim()
            || !Number.isFinite(Number(criterion.weight))
            || Number(criterion.weight) <= 0
            || (criterion.direction !== "benefit" && criterion.direction !== "cost");
    })) {
        return "DECISION_CRITERIA_REQUIRED";
    }
    const scores = body.scores;
    if (!Array.isArray(scores) || scores.length !== alternatives.length
        || scores.some((row) => !Array.isArray(row) || row.length !== criteria.length || row.some((v) => !Number.isFinite(Number(v))))) {
        return "DECISION_SCORES_REQUIRED";
    }
    return null;
};

const validateFinancialAnalyzeBody = (body: Record<string, unknown>): string | null => {
    const sourceSha256 = String(body.sourceSha256 ?? "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sourceSha256)) return "SOURCE_SHA256_REQUIRED";
    // assets/liabilities may be omitted when the ingested source carries
    // canonical statement facts; they are then derived from real evidence.
    if (body.assets !== undefined && !Number.isFinite(Number(body.assets))) return "BALANCE_SHEET_FIELDS_REQUIRED";
    if (body.liabilities !== undefined && !Number.isFinite(Number(body.liabilities))) return "BALANCE_SHEET_FIELDS_REQUIRED";
    return null;
};

const validateAnalyticsBody = (body: Record<string, unknown>): string | null => {
    const hasInput = body.series !== undefined
        || body.statement !== undefined
        || body.breakEven !== undefined
        || body.sourceSha256 !== undefined;
    if (!hasInput) return "ANALYTICS_INPUT_REQUIRED";
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
    // Canonical tenant-scoped sync-cursor owner (Stage 08-GOV.3). Wired here so
    // every ingestion advances a durable per-(tenant, source) watermark that the
    // offline/online client path can reconcile against.
    const syncState = new SyncStateStore(persistence);
    const reasoning = options.reasoning ?? new ReasoningEngine();
    const analysis = new FinancialStatementAnalysisService(new FinancialIntelligenceEngine(), reasoning);
    const executiveWorkbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    const decisionWorkbench = new DecisionWorkbench();
    const financialAnalytics = new FinancialAnalyticsService();
    const organizationalExecution = new OrganizationalExecutionCoordinator(persistence);
    if (options.securityEventLogger) organizationalExecution.setSecurityLogger(options.securityEventLogger);
    const reports = new ReportsEngine();
    const reportExport = new ReportExportService(persistence, reports, options.now ?? (() => Date.now()));
    const resilience = new ResilienceAnalyticsService();
    const impact = new ImpactMeasurementService();
    const improvement = new ContinuousImprovementEngine();
    // Canonical owner for the persistent, cross-engine organizational
    // problem-solving lifecycle (product.organizational-problem-solving).
    const problemSolving = new OrganizationalProblemSolvingService(persistence);
    const latestResults = new Map<string, StoredAnalysis>();
    const latestWorkbenchResults = new Map<string, ExecutiveIntelligenceWorkbenchResult>();
    const latestDecisionResults = new Map<string, DecisionWorkbenchResult>();
    const latestAnalyticsResults = new Map<string, StoredAnalytics>();
    const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    const rateLimiterMap = new Map<string, TokenBucketRateLimiter>();
    const RATE_LIMIT_CAPACITY = 5;
    const RATE_LIMIT_REFILL_PER_SECOND = 1;
    const now = options.now ?? (() => Date.now());
    const observability = new RuntimeObservability({ now });
    const dependencyProbe = options.dependencyProbe ?? new RuntimeDependencyProbe();
    // Resolved lazily and cached: readiness must report the real reasoning
    // runtime, and probing must not slow down ordinary request handling.
    let dependencyReportCache: RuntimeDependencyReport | undefined;
    const runtimeDependencies = (): RuntimeDependencyReport => (dependencyReportCache ??= dependencyProbe.report());
    const corsOrigin = options.corsOrigin ?? DEFAULT_CORS_ORIGIN;

    // Durable, tenant-scoped ingestion job/status owner (Stage 15-ING.2). Wired
    // here so the web client can observe real stage/OCR page progress for
    // long-running scans without blocking the request or faking progress.
    const ingestionJobs = new IngestionJobService(persistence, {
        now,
        runner: (tenantId, request, observer) => ingestionService.ingest(tenantId, request, observer),
    });

    const identity = new CommercialIdentityService(persistence, sessionTtlMs);
    identity.setNowProvider(now);
    identity.initialize();

    // The canonical UserManagementEngine owns expired-session pruning, but the
    // runtime must actually schedule it: `getSession()` only removes a row whose
    // token is presented again, so without a sweep a long-running deployment
    // accumulates expired `sessions` rows without bound. The timer is unref'd so
    // it never holds the process open, and it is cleared when the server closes.
    const sessionSweepIntervalMs = options.sessionSweepIntervalMs ?? DEFAULT_SESSION_SWEEP_INTERVAL_MS;
    const sessionSweep = sessionSweepIntervalMs > 0
        ? setInterval(() => {
            try {
                identity.cleanupExpiredSessions();
            } catch {
                // Lifecycle maintenance must never take the runtime down.
            }
        }, sessionSweepIntervalMs)
        : null;
    if (sessionSweep && typeof sessionSweep.unref === "function") sessionSweep.unref();

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

    // Authentication entry points are unauthenticated by definition, so they
    // cannot be protected by the per-session limiter above. They are limited
    // per client (remote address) and per credential identity
    // (client + username + organization). `/api/auth/login` and the password
    // form of `/api/session` share the same per-identity bucket so switching
    // routes cannot bypass the limit.
    const AUTH_CLIENT_RATE_LIMIT_CAPACITY = 20;
    const AUTH_CLIENT_RATE_LIMIT_REFILL_PER_SECOND = 5;
    const AUTH_IDENTITY_RATE_LIMIT_CAPACITY = 5;
    const AUTH_IDENTITY_RATE_LIMIT_REFILL_PER_SECOND = 1;
    const authClientLimiters = new Map<string, TokenBucketRateLimiter>();
    const authIdentityLimiters = new Map<string, TokenBucketRateLimiter>();

    const getOrCreateAuthLimiter = (
        map: Map<string, TokenBucketRateLimiter>,
        key: string,
        capacity: number,
        refillPerSecond: number,
    ): TokenBucketRateLimiter => {
        let limiter = map.get(key);
        if (!limiter) {
            limiter = new TokenBucketRateLimiter({ capacity, refillPerSecond, now });
            map.set(key, limiter);
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

    const loadDecision = async (tenantId: string): Promise<DecisionWorkbenchResult | undefined> => {
        let result = latestDecisionResults.get(tenantId);
        if (!result) {
            const persisted = await persistence.read({ tenantId }, LATEST_DECISION_WORKBENCH_KEY);
            result = persisted?.value as DecisionWorkbenchResult | undefined;
            if (result?.tenantId === tenantId && result.status === "READY") latestDecisionResults.set(tenantId, result);
        }
        return result?.tenantId === tenantId && result.status === "READY" ? result : undefined;
    };

    const loadAnalytics = async (tenantId: string): Promise<StoredAnalytics | undefined> => {
        let result = latestAnalyticsResults.get(tenantId);
        if (!result) {
            const persisted = await persistence.read({ tenantId }, LATEST_ANALYTICS_KEY);
            result = persisted?.value as StoredAnalytics | undefined;
            if (result?.tenantId === tenantId && result.status === "READY") latestAnalyticsResults.set(tenantId, result);
        }
        return result?.tenantId === tenantId && result.status === "READY" ? result : undefined;
    };

    const loadIngestedModel = async (tenantId: string, sha256: string): Promise<FinancialCanonicalModel | undefined> => {
        const record = await persistence.read({ tenantId }, `financial-ingestion:${sha256}`);
        const model = record?.value as FinancialCanonicalModel | undefined;
        if (!model || model.tenantId !== tenantId || !Array.isArray(model.transactions)) return undefined;
        return model;
    };

    /**
     * Grounded statement insight for a tenant-scoped canonical source. Reuses
     * `deriveAnalysisInput`/`derivePriorStatement` (canonical facts) and the
     * existing ratio analytics so the report, assistant and insights endpoints
     * share one composition.
     *
     * The insight describes exactly ONE source: a persisted analytics result is
     * reused only when it was computed for this same `sha256`. A result for a
     * different source (or a manual result whose provenance is unknown) must
     * never be combined with these canonical facts, so it is recomputed
     * deterministically from this source's canonical statement instead. Nothing
     * is fabricated: the ratio owner still fails closed per section when evidence
     * is absent.
     */
    const loadStatementInsight = async (
        tenantId: string,
        sha256: string | undefined,
        analytics?: StoredAnalytics,
    ): Promise<FinancialStatementInsight | undefined> => {
        if (!sha256) return undefined;
        const model = await loadIngestedModel(tenantId, sha256);
        if (!model?.document) return undefined;
        const derived = deriveAnalysisInput(model.document);
        const prior = derivePriorStatement(model.document);
        const correlated = analytics && analytics.source?.sha256 === sha256 ? analytics : undefined;
        const sourceAnalytics = correlated ?? financialAnalytics.execute({
            tenantId,
            statement: derived.statement as FinancialAnalyticsInput["statement"],
            ...(Object.keys(prior).length > 0 ? { priorStatement: prior as FinancialAnalyticsInput["priorStatement"] } : {}),
        });
        return composeFinancialStatementInsight({
            document: model.document,
            derived,
            prior,
            analytics: sourceAnalytics,
        });
    };

    /**
     * Analytics correlated to one analyzed source. A persisted analytics result
     * belongs to a report/assistant context only when it is untagged (the manual
     * ledger path) or explicitly tagged with the same SHA-256. A result computed
     * for a different source is never mixed into this context.
     */
    const correlatedAnalyticsFor = async (tenantId: string, sha256: string): Promise<StoredAnalytics | undefined> => {
        const loaded = await loadAnalytics(tenantId);
        if (!loaded) return undefined;
        if (loaded.source && loaded.source.sha256 !== sha256) return undefined;
        return loaded;
    };

    const describeStatementContext = (insight: FinancialStatementInsight): string[] => {
        const lines: string[] = [
            "Verified statement context:",
            `DocumentStatus=${insight.documentStatus}`,
            `Currency=${insight.currency ?? "unavailable"}`,
            `Periods=${insight.periods.map((period) => period.label).join(" | ") || "unavailable"}`,
        ];
        const metricParts = Object.entries(insight.metrics)
            .filter(([, value]) => value !== null)
            .map(([key, value]) => `${key}=${value}[${insight.metricEvidence[key] ?? "UNAVAILABLE"}]`);
        lines.push(`FactsAndDerivedMetrics=${metricParts.join(", ") || "unavailable"}`);
        const ratioParts = Object.entries(insight.ratios)
            .filter(([key, value]) => key !== "unavailable" && key !== "notApplicable" && value !== null)
            .map(([key, value]) => `${key}=${value}`);
        lines.push(`Ratios=${ratioParts.join(", ") || "unavailable"}`);
        if (insight.unavailableRatios.length > 0) lines.push(`UnavailableRatios=${insight.unavailableRatios.join(", ")}`);
        if (insight.ratios.notApplicable.length > 0) lines.push(`NotApplicableRatios=${insight.ratios.notApplicable.join(", ")}`);
        if (insight.comparative.length > 0) {
            lines.push(`ComparativeChanges=${insight.comparative.map((entry) => {
                const change = entry.pctChange === null
                    ? `${entry.absoluteChange}(${entry.pctChangeUnavailableReason ?? "unavailable"})`
                    : `${entry.absoluteChange}(${entry.pctChange})`;
                return `${entry.line}:${change}`;
            }).join(", ")}`);
        }
        if (insight.integrity.length > 0) {
            lines.push(`IntegrityChecks=${insight.integrity.map((check) => `${check.id}:${check.status}${check.missing.length > 0 ? `(missing:${check.missing.join("+")})` : ""}`).join(", ")}`);
        }
        const cashFlowParts = [
            `operating=${insight.cashFlow.operating ?? "unavailable"}`,
            `investing=${insight.cashFlow.investing ?? "unavailable"}`,
            `financing=${insight.cashFlow.financing ?? "unavailable"}`,
            `net=${insight.cashFlow.net ?? "unavailable"}`,
            `priorOperating=${insight.cashFlow.priorOperating ?? "unavailable"}`,
            `qualityOfEarnings=${insight.cashFlow.qualityOfEarnings}`,
        ];
        lines.push(`CashFlow=${cashFlowParts.join(", ")}`);
        if (insight.derivedResidual) {
            lines.push(`DerivedResidualExpense=${insight.derivedResidual.value}[DERIVED_RESIDUAL, not an extracted total expense]`);
        }
        if (insight.strengths.length > 0) lines.push(`Strengths=${insight.strengths.map((item) => item.message).join(" | ")}`);
        if (insight.weaknesses.length > 0) lines.push(`Weaknesses=${insight.weaknesses.map((item) => item.message).join(" | ")}`);
        if (insight.risks.length > 0) lines.push(`Risks=${insight.risks.map((item) => item.message).join(" | ")}`);
        if (insight.opportunities.length > 0) lines.push(`Opportunities=${insight.opportunities.map((item) => item.message).join(" | ")}`);
        if (insight.managementActions.length > 0) lines.push(`ManagementActions=${insight.managementActions.map((item) => item.message).join(" | ")}`);
        if (insight.limitations.length > 0) lines.push(`Limitations=${insight.limitations.join(" | ")}`);
        return lines;
    };

    /**
     * Single source of truth for report content. The canonical `ReportsEngine`
     * remains the report owner; this composes the already-persisted, verified
     * tenant-scoped results into structured sections that both the JSON report
     * endpoint and the real file export path consume unchanged.
     */
    const buildReportSections = (
        session: CommercialSession,
        result: StoredAnalysis,
        workbench: ExecutiveIntelligenceWorkbenchResult | undefined,
        analytics: StoredAnalytics | undefined,
        insight?: FinancialStatementInsight,
    ): ReportSection[] => {
        const sections: ReportSection[] = [
            { heading: "Overview", lines: [`Tenant: ${session.tenantId}`, `Source: ${result.source.sourceName}`] },
            {
                heading: "Financial statement",
                lines: [
                    `Revenue: ${result.metrics.revenue}`,
                    `Profit: ${result.metrics.profit}`,
                    `Profit margin: ${result.metrics.profitMargin}`,
                    `Debt ratio: ${result.metrics.debtRatio}`,
                ],
            },
            { heading: "Observations", lines: [`Observations: ${result.observations.map((item) => item.message).join(" | ")}`] },
        ];
        if (insight) {
            const metricLines = Object.entries(insight.metrics)
                .filter(([, value]) => value !== null)
                .map(([key, value]) => `${key}: ${value}`);
            sections.push({
                heading: "Extracted statement facts",
                lines: [
                    `Document status: ${insight.documentStatus}`,
                    `Reporting periods: ${insight.periods.map((period) => period.label).join(" | ") || "unavailable"}`,
                    ...metricLines,
                ],
            });
            const ratioLines = Object.entries(insight.ratios)
                .filter(([key, value]) => key !== "unavailable" && key !== "notApplicable" && value !== null)
                .map(([key, value]) => `${key}: ${value}`);
            if (ratioLines.length > 0) sections.push({ heading: "Ratios", lines: ratioLines });
            if (insight.ratios.unavailable.length > 0) {
                sections.push({ heading: "Unavailable ratios", lines: insight.ratios.unavailable });
            }
            if (insight.ratios.notApplicable.length > 0) {
                sections.push({ heading: "Not applicable ratios", lines: insight.ratios.notApplicable });
            }
            if (insight.comparative.length > 0) {
                sections.push({
                    heading: "Comparative analysis",
                    lines: insight.comparative.map((entry) => {
                        const pct = entry.pctChange === null
                            ? `${entry.pctChangeUnavailableReason ?? "percentage unavailable"}`
                            : `${(entry.pctChange * 100).toFixed(2)}%`;
                        const reversal = entry.signReversal ? " (sign reversal)" : "";
                        return `${entry.line}: ${entry.prior} -> ${entry.current}; absolute change ${entry.absoluteChange}; ${pct}${reversal}`;
                    }),
                });
            }
            sections.push({
                heading: "Cash-flow interpretation",
                lines: [
                    `Operating: ${insight.cashFlow.operating ?? "unavailable"}`,
                    `Investing: ${insight.cashFlow.investing ?? "unavailable"}`,
                    `Financing: ${insight.cashFlow.financing ?? "unavailable"}`,
                    `Net change: ${insight.cashFlow.net ?? "unavailable"}`,
                    `Prior-period operating: ${insight.cashFlow.priorOperating ?? "unavailable"}`,
                    `Quality of earnings: ${insight.cashFlow.qualityOfEarnings}`,
                    ...(insight.cashFlow.reconciliation
                        ? [`Cash-flow reconciliation: ${insight.cashFlow.reconciliation.status}`]
                        : []),
                ],
            });
            if (insight.integrity.length > 0) {
                sections.push({
                    heading: "Integrity checks",
                    lines: insight.integrity.map((check) =>
                        check.status === "NOT_TESTABLE"
                            ? `${check.id}: NOT_TESTABLE (missing ${check.missing.join(", ") || "non-operating items"})`
                            : `${check.id}: ${check.status} (expected ${check.expected}, actual ${check.actual}, difference ${check.difference})`,
                    ),
                });
            }
            if (insight.derivedResidual) {
                sections.push({ heading: "Derived residual expense", lines: [insight.derivedResidual.note] });
            }
            const buildFindingLines = (label: string, findings: readonly { message: string }[]): void => {
                if (findings.length === 0) return;
                sections.push({ heading: label, lines: findings.map((finding) => finding.message) });
            };
            buildFindingLines("Interpretation", insight.interpretation);
            buildFindingLines("Strengths", insight.strengths);
            buildFindingLines("Weaknesses", insight.weaknesses);
            buildFindingLines("Risks", insight.risks);
            buildFindingLines("Financial growth readiness", insight.opportunities);
            buildFindingLines("Management actions", insight.managementActions);
            if (insight.limitations.length > 0) {
                sections.push({ heading: "Data limitations", lines: insight.limitations });
            }
        }
        if (workbench) {
            sections.push({ heading: "Recommendations", lines: [`Recommendations: ${workbench.recommendations.map((item) => item.action).join(" | ")}`] });
        }
        if (analytics) {
            const parts: string[] = [];
            if (analytics.ratios?.profitability?.status === "READY") parts.push(`Net margin: ${analytics.ratios.profitability.netMargin}`);
            if (analytics.ratios?.leverage?.status === "READY") parts.push(`Debt/equity: ${analytics.ratios.leverage.debtToEquity}`);
            if (analytics.breakEven?.status === "READY") parts.push(`Break-even units: ${analytics.breakEven.breakEvenUnits}`);
            if (analytics.forecast?.linearTrend.status === "READY") parts.push(`Cash-flow trend forecast: ${analytics.forecast.linearTrend.forecast}`);
            if (analytics.anomalies) {
                const alerts = [
                    ...analytics.anomalies.zscore.points,
                    ...analytics.anomalies.iqr.points,
                    ...analytics.anomalies.modifiedZ.points
                ].filter((point) => point.flag === "ALERT").length;
                parts.push(`Anomaly alerts: ${alerts}`);
            }
            if (parts.length) sections.push({ heading: "Financial analytics", lines: [`Financial analytics: ${parts.join(" | ")}`] });
        }
        return sections;
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

    /**
     * Build the real frozen SecurityContext for a commercial session. The role
     * -> Authorization grants come from the canonical identity owner; this is
     * what lets GovernanceEngine and AuthorizationGuard enforce the human
     * APPROVE/EXECUTE authority on the governed-execution boundary.
     */
    const executionContext = (session: CommercialSession): SecurityContext =>
        SecurityContext.forHumanUser(
            Principal.humanUser(session.userId, session.tenantId),
            identity.authorizationsFor(session.role),
            `session:${session.token}`
        );

    const executionErrorStatus = (code: WorkItemOperationResult["code"]): number => {
        switch (code) {
            case "VALIDATION": return 400;
            case "FORBIDDEN": return 403;
            case "NOT_FOUND": return 404;
            case "INVALID_TRANSITION": return 409;
            default: return 422;
        }
    };

    /**
     * Canonical HTTP outcome for a governed work-item operation, shared by the
     * direct response path and the idempotency path so both produce the exact
     * same status/payload.
     */
    const executionOutcome = (result: WorkItemOperationResult): { readonly status: number; readonly payload: unknown } =>
        result.status === "READY"
            ? { status: 200, payload: result.workItem }
            : { status: executionErrorStatus(result.code), payload: { error: result.code ?? "EXECUTION_BLOCKED", reason: result.reason } };

    const close = () => {
        if (sessionSweep) clearInterval(sessionSweep);
        persistence.close();
    };
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const requestId = observability.requestId(req.headers["x-request-id"]);
        res.setHeader("X-Request-Id", requestId);
        const requestStartedAtMs = now();
        res.once("finish", () => {
            observability.recordRequest(req.method ?? "GET", req.url ?? "/", res.statusCode, now() - requestStartedAtMs);
        });
        const corsJson = (status: number, payload: unknown, headers: Record<string, string> = {}) =>
            json(res, status, payload, { ...corsHeaders(corsOrigin), ...headers });
        const executionResponse = (result: WorkItemOperationResult) => {
            const outcome = executionOutcome(result);
            return corsJson(outcome.status, outcome.payload);
        };
        try {
            const path = req.url?.split("?")[0] ?? "/";
            const query = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
            if (req.method === "OPTIONS") {
                res.statusCode = 204;
                for (const [key, value] of Object.entries(corsHeaders(corsOrigin))) res.setHeader(key, value);
                return res.end();
            }
            if (req.method === "GET" && path === "/health") return corsJson(200, { status: "ok", service: "hooshyar-commercial-runtime" });
            if (req.method === "GET" && path === "/api/ready") return corsJson(200, { status: "READY", dependencies: runtimeDependencies(), capabilities: ["financial-ingestion", "multi-format-ingestion", "raw-source-evidence", "financial-statement-analysis", "financial-analytics", "ingested-source-analysis", "tenant-scoped-persistence", "offline-sync", "reasoning", "executive-intelligence-workbench", "decision-workbench", "expert-choice", "organizational-execution", "governed-approval", "work-item-lifecycle", "kpi-outcome", "reports", "reports-export", "report-artifact-download", "assistant-context", "resilience-analytics", "impact-measurement", "continuous-improvement", "authentication", "auth-rate-limiting", "rbac", "session-lifecycle", "request-observability", "bounded-pagination", "idempotency-keys", "organizational-problem-solving", "ingestion-job-status", "scanned-statement-normalization"] });
            if (req.method === "GET" && path === "/") return asset(res, "index.html", "text/html; charset=utf-8");
            if (req.method === "GET" && path === "/app.js") return asset(res, "app.js", "text/javascript; charset=utf-8");
            if (req.method === "GET" && path === "/offline-sync.js") return asset(res, "offline-sync.js", "text/javascript; charset=utf-8");
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

            const clientAddress = req.socket?.remoteAddress ?? "unknown";
            const enforceAuthClientLimit = (): boolean =>
                getOrCreateAuthLimiter(authClientLimiters, `client:${clientAddress}`, AUTH_CLIENT_RATE_LIMIT_CAPACITY, AUTH_CLIENT_RATE_LIMIT_REFILL_PER_SECOND).tryAcquire();
            const enforceAuthIdentityLimit = (username: string, organization: string): boolean =>
                getOrCreateAuthLimiter(
                    authIdentityLimiters,
                    `identity:${clientAddress}:${username.trim().toLowerCase()}:${organization.trim().toLowerCase()}`,
                    AUTH_IDENTITY_RATE_LIMIT_CAPACITY,
                    AUTH_IDENTITY_RATE_LIMIT_REFILL_PER_SECOND,
                ).tryAcquire();
            const rateLimited = () => {
                logAuthFailure("RATE_LIMIT_EXCEEDED");
                return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" }, { "Retry-After": "1" });
            };

            if (req.method === "POST" && path === "/api/auth/register") {
                if (!enforceAuthClientLimit()) return rateLimited();
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
                if (!enforceAuthClientLimit()) return rateLimited();
                const body = await readJson(req);
                const username = String(body.username ?? "").trim();
                const organization = String(body.organization ?? "").trim();
                const password = String(body.password ?? "");
                if (!username || !organization || !password) return corsJson(400, { error: "CREDENTIALS_REQUIRED" });
                if (!enforceAuthIdentityLimit(username, organization)) return rateLimited();
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
                if (!enforceAuthClientLimit()) return rateLimited();
                const body = await readJson(req);
                const username = String(body.username ?? "").trim();
                const organization = String(body.organization ?? "").trim();
                const password = body.password === undefined ? undefined : String(body.password);
                if (!username || !organization) return corsJson(400, { error: "SESSION_FIELDS_REQUIRED" });
                if (!enforceAuthIdentityLimit(username, organization)) return rateLimited();

                if (password === undefined) {
                    const decision = identity.passwordlessBootstrapDecision(username, organization);
                    if (!decision.allowed) {
                        logAuthFailure(decision.reason ?? "PASSWORDLESS_BOOTSTRAP_DENIED");
                        return corsJson(403, { error: decision.reason ?? "PASSWORDLESS_BOOTSTRAP_DENIED" });
                    }
                }

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

            /**
             * Defense-in-depth tenant boundary check at the HTTP layer using the
             * canonical TenantIsolation guard. Services already scope reads by
             * tenant; this re-verifies the returned object's tenant before it
             * leaves the boundary, so an object that ever escapes service scoping
             * is denied (and audited as a TENANT_VIOLATION) instead of leaked.
             */
            const enforceTenantBoundary = (resource: { readonly tenantId?: string }, action: Authorization): boolean => {
                const context = executionContext(session);
                const check = TenantIsolation.checkAccess(context, resource, action);
                if (check.result === AuthorizationResult.PERMITTED) return true;
                options.securityEventLogger?.logTenantViolation({
                    actorId: session.username,
                    actorType: context.actor?.type,
                    tenantId: session.tenantId,
                    requestedTenantId: resource.tenantId ?? "global",
                    target: req.url ?? "unknown",
                    reason: check.reason,
                    traceId: check.traceId,
                });
                return false;
            };

            /**
             * Object-level authorization for a work item. Privileged roles
             * (OWNER/ADMIN, i.e. holders of ADMINISTER authority) may read any
             * item in their tenant; everyone else may read only objects they
             * created, approved, or were assigned. Cross-tenant objects never
             * reach here (the service returns null).
             */
            const canAccessWorkItem = (item: {
                readonly createdBy: string;
                readonly approval?: { readonly approvedBy: string } | null;
                readonly assignment?: { readonly assigneeId: string } | null;
            }): boolean => {
                if (identity.authorizationsFor(session.role).includes(Authorization.ADMINISTER)) return true;
                const actors = [session.userId, session.username];
                if (actors.includes(item.createdBy)) return true;
                if (item.approval && actors.includes(item.approval.approvedBy)) return true;
                if (item.assignment && actors.includes(item.assignment.assigneeId)) return true;
                return false;
            };

            /**
             * Object-level authorization for a problem case: privileged roles
             * (ADMINISTER) may read any case in their tenant; everyone else may
             * read only cases they created. Cross-tenant cases never reach here.
             */
            const canAccessProblem = (problem: { readonly createdBy: string }): boolean => {
                if (identity.authorizationsFor(session.role).includes(Authorization.ADMINISTER)) return true;
                return [session.userId, session.username].includes(problem.createdBy);
            };

            /**
             * Idempotent execution for mutating POSTs that create real,
             * duplicate-prone side effects (new persisted work items, report
             * artifacts, raw sources).
             *
             * When the caller supplies an `Idempotency-Key` header:
             *   - the key is validated and scoped to the authenticated
             *     tenant + actor + route, so it can never replay or collide
             *     across tenants or users;
             *   - the key is atomically claimed through the canonical
             *     persistence store (`writeIfAbsent`), so concurrent duplicate
             *     submissions cannot both execute;
             *   - a completed key replays the exact stored response with
             *     `Idempotency-Replayed: true`;
             *   - a key reused with a different request body fails closed
             *     (`409 IDEMPOTENCY_KEY_CONFLICT`);
             *   - a key claimed but not yet completed fails closed
             *     (`409 IDEMPOTENCY_IN_PROGRESS`) without a second side effect;
             *   - failed/error outcomes release the claim so a legitimate retry
             *     can proceed.
             *
             * Without the header the endpoint keeps its original contract.
             */
            const runIdempotent = async (
                scope: string,
                body: Record<string, unknown>,
                execute: () => Promise<{ readonly status: number; readonly payload: unknown }>,
            ): Promise<void> => {
                const rawHeader = req.headers["idempotency-key"];
                const rawKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
                if (rawKey === undefined) {
                    const outcome = await execute();
                    return corsJson(outcome.status, outcome.payload);
                }
                const key = rawKey.trim();
                if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
                    return corsJson(400, { error: "IDEMPOTENCY_KEY_INVALID" });
                }

                const recordKey = `idempotency:${scope}:${session.userId}:${key}`;
                const requestHash = createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
                const claim: IdempotencyRecord = {
                    tenantId: session.tenantId,
                    actorId: session.userId,
                    scope,
                    requestHash,
                    status: "IN_PROGRESS",
                    createdAt: new Date(now()).toISOString(),
                };

                const claimed = await persistence.writeIfAbsent({ tenantId: session.tenantId }, recordKey, claim);
                if (!claimed.created) {
                    const existing = claimed.record.value as IdempotencyRecord | undefined;
                    if (!existing || existing.tenantId !== session.tenantId || existing.requestHash !== requestHash) {
                        return corsJson(409, { error: "IDEMPOTENCY_KEY_CONFLICT" });
                    }
                    if (existing.status === "COMPLETED" && typeof existing.responseStatus === "number") {
                        return corsJson(existing.responseStatus, existing.responseBody, { "Idempotency-Replayed": "true" });
                    }
                    return corsJson(409, { error: "IDEMPOTENCY_IN_PROGRESS" });
                }

                try {
                    const outcome = await execute();
                    if (outcome.status >= 200 && outcome.status < 300) {
                        const completed: IdempotencyRecord = {
                            ...claim,
                            status: "COMPLETED",
                            completedAt: new Date(now()).toISOString(),
                            responseStatus: outcome.status,
                            responseBody: outcome.payload,
                        };
                        await persistence.write({ tenantId: session.tenantId }, recordKey, completed);
                    } else {
                        await persistence.delete({ tenantId: session.tenantId }, recordKey);
                    }
                    return corsJson(outcome.status, outcome.payload);
                } catch (error) {
                    await persistence.delete({ tenantId: session.tenantId }, recordKey);
                    throw error;
                }
            };

            if (req.method === "GET" && path === "/api/diagnostics/metrics") {
                if (!ensurePermission("MANAGE_USERS")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                return corsJson(200, { status: "READY", ...observability.snapshot() });
            }

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
                const ingested = await ingestionService.ingest(session.tenantId, { sourceName, format: "CSV", content: csv });
                await syncState.recordSuccess(session.tenantId, ingested.result.evidence.sourceName, ingested.rawSourceRef.sha256);
                const result = analysis.execute({ tenantId: session.tenantId, revenue: ingested.result.model.totals.credit, expenses: ingested.result.model.totals.debit, assets, liabilities, source: ingested.result.evidence });
                if (result.status !== "READY") return corsJson(422, result);
                await persistence.write({ tenantId: session.tenantId }, LATEST_ANALYSIS_KEY, result);
                latestResults.set(session.tenantId, result);
                return corsJson(200, result);
            }

            if (req.method === "POST" && path === "/api/financial/analyze") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const analyzeError = validateFinancialAnalyzeBody(body);
                if (analyzeError) return corsJson(400, { error: analyzeError });
                const sourceSha256 = String(body.sourceSha256).trim().toLowerCase();
                const model = await loadIngestedModel(session.tenantId, sourceSha256);
                if (!model) return corsJson(422, { error: "INGESTED_SOURCE_REQUIRED" });
                const derived = model.document ? deriveAnalysisInput(model.document) : null;
                const readiness = model.document ? assessStatementAnalysisReadiness(model.document) : null;
                const ingestedSourceSummary = {
                    sha256: sourceSha256,
                    sourceName: model.source.sourceName,
                    sourceType: model.source.sourceType,
                    transactionCount: model.transactions.length,
                    ...(model.document ? { document: summarizeFinancialDocument(model.document) } : {}),
                };
                if (readiness && !readiness.ready) {
                    // A partial/insufficient statement must not be analyzed as if
                    // complete: refuse with the precise canonical code instead of
                    // returning READY over absent (zero) metrics.
                    return corsJson(422, {
                        status: "BLOCKED",
                        error: readiness.code ?? "financial-report-insufficient-evidence",
                        reason: readiness.reason,
                        tenantId: session.tenantId,
                        missingMeasures: readiness.missingMeasures,
                        incompleteSections: readiness.incompleteSections,
                        ingestedSource: ingestedSourceSummary,
                    });
                }
                const suppliedAssets = body.assets === undefined ? undefined : Number(body.assets);
                const suppliedLiabilities = body.liabilities === undefined ? undefined : Number(body.liabilities);
                // Canonical document facts are authoritative. A manually supplied
                // balance-sheet value is only an explicit fallback for a source
                // whose evidence is genuinely absent (for example a real ledger).
                const documentAssets = derived && typeof derived.statement.totalAssets === "number"
                    ? derived.statement.totalAssets
                    : undefined;
                const documentLiabilities = derived && typeof derived.statement.totalLiabilities === "number"
                    ? derived.statement.totalLiabilities
                    : undefined;
                const documentRevenue = derived && typeof derived.statement.revenue === "number"
                    ? derived.statement.revenue
                    : undefined;
                const documentExpenses = derived
                    ? (derived.analysisExpenses !== null
                        ? derived.analysisExpenses
                        : (!derived.missingMeasures.includes("EXPENSES") ? derived.expenses : undefined))
                    : undefined;
                const assets = documentAssets !== undefined ? documentAssets : suppliedAssets;
                const liabilities = documentLiabilities !== undefined ? documentLiabilities : suppliedLiabilities;
                if (assets === undefined || liabilities === undefined) {
                    return corsJson(400, { error: "BALANCE_SHEET_FIELDS_REQUIRED" });
                }
                const result = analysis.execute({
                    tenantId: session.tenantId,
                    revenue: documentRevenue !== undefined ? documentRevenue : model.totals.credit,
                    expenses: documentExpenses !== undefined ? documentExpenses : model.totals.debit,
                    assets,
                    liabilities,
                    source: model.source,
                    ...(readiness ? { documentEvidence: readiness } : {}),
                });
                if (result.status !== "READY") {
                    return corsJson(422, {
                        error: result.failureCode ?? "financial-analysis-blocked",
                        reason: result.reason,
                        ...result,
                        ingestedSource: ingestedSourceSummary,
                    });
                }
                await persistence.write({ tenantId: session.tenantId }, LATEST_ANALYSIS_KEY, result);
                latestResults.set(session.tenantId, result);
                return corsJson(200, {
                    ...result,
                    ingestedSource: ingestedSourceSummary,
                    inputProvenance: {
                        revenue: documentRevenue !== undefined ? "DOCUMENT" : "LEDGER",
                        expenses: documentExpenses !== undefined ? "DOCUMENT" : "LEDGER",
                        assets: documentAssets !== undefined ? "DOCUMENT" : "MANUAL",
                        liabilities: documentLiabilities !== undefined ? "DOCUMENT" : "MANUAL",
                    },
                    ...(derived
                        ? {
                            statement: derived.statement,
                            missingMeasures: derived.missingMeasures,
                            // The analysis contract needs one total-expense input so that
                            // profit equals the statement's verified net profit. Disclose
                            // whether that input is a derived residual or an extracted
                            // expense, so no caller mistakes the residual for a fact.
                            analysisExpenseBasis: derived.analysisExpensesSource
                                ?? (documentExpenses === undefined
                                    ? "LEDGER"
                                    : derived.missingMeasures.includes("EXPENSES")
                                        ? "EXTRACTED_OPERATING_EXPENSES_FALLBACK"
                                        : "EXTRACTED_TOTAL_EXPENSES"),
                            ...(derived.analysisExpenses !== null ? { derivedResidualExpense: derived.analysisExpenses } : {}),
                        }
                        : {}),
                });
            }

            if (req.method === "POST" && path === "/api/ingest") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req, INGEST_BODY_BYTES);
                const ingestError = validateIngestBody(body);
                if (ingestError) return corsJson(400, { error: ingestError });
                return runIdempotent("ingest", body, async () => {
                    const sourceKey = String(body.sourceName).trim();
                    try {
                        const outcome = await ingestionService.ingest(session.tenantId, {
                            sourceName: String(body.sourceName),
                            format: String(body.format).trim().toUpperCase() as IngestionFormat,
                            content: body.content === undefined ? undefined : String(body.content),
                            contentBase64: body.contentBase64 === undefined ? undefined : String(body.contentBase64)
                        });
                        await syncState.recordSuccess(session.tenantId, sourceKey, outcome.rawSourceRef.sha256);
                        return {
                            status: 201,
                            payload: {
                                status: "READY",
                                tenantId: session.tenantId,
                                format: outcome.requestedFormat,
                                evidence: outcome.result.evidence,
                                source: outcome.rawSourceRef,
                                transactionCount: outcome.result.model.transactions.length,
                                totals: outcome.result.model.totals,
                                ...(outcome.result.model.document
                                    ? { document: summarizeFinancialDocument(outcome.result.model.document) }
                                    : {}),
                            }
                        };
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "INGESTION_FAILED";
                        if (sourceKey) {
                            try { await syncState.recordError(session.tenantId, sourceKey, message); } catch { /* cursor is evidence, never the ingestion result */ }
                        }
                        return { status: 422, payload: { error: message } };
                    }
                });
            }

            /**
             * Long-running ingestion job creation (Stage 15-ING.2). Returns
             * immediately with a durable job id; the canonical ingestion runs
             * in the background and reports REAL stage/OCR progress through
             * `GET /api/ingest/jobs/:jobId`. A duplicate submission with the
             * same `Idempotency-Key` resolves to the SAME job (never a second
             * side effect) and carries `IDEMPOTENCY_IN_PROGRESS` in diagnostics
             * while it is still running.
             */
            if (req.method === "POST" && path === "/api/ingest/jobs") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req, INGEST_BODY_BYTES);
                const ingestError = validateIngestBody(body);
                if (ingestError) return corsJson(400, { error: ingestError });
                const rawHeader = req.headers["idempotency-key"];
                const rawKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
                if (rawKey !== undefined && !IDEMPOTENCY_KEY_PATTERN.test(rawKey.trim())) {
                    return corsJson(400, { error: "IDEMPOTENCY_KEY_INVALID" });
                }
                const { job, replayed } = await ingestionJobs.start(
                    session.tenantId,
                    session.userId,
                    {
                        sourceName: String(body.sourceName),
                        format: String(body.format).trim().toUpperCase() as IngestionFormat,
                        content: body.content === undefined ? undefined : String(body.content),
                        contentBase64: body.contentBase64 === undefined ? undefined : String(body.contentBase64),
                    },
                    rawKey?.trim(),
                );
                const inProgress = !isTerminalIngestionStage(job.stage);
                return corsJson(202, {
                    status: job.status === "COMPLETED" ? "READY" : inProgress ? "IN_PROGRESS" : "FAILED",
                    jobId: job.jobId,
                    replayed,
                    job,
                    diagnostics: {
                        ...(job.code ? { code: job.code } : {}),
                        ...(replayed ? { idempotency: inProgress ? "IDEMPOTENCY_IN_PROGRESS" : "IDEMPOTENCY_REPLAYED" } : {}),
                    },
                });
            }

            if (req.method === "GET" && path === "/api/ingest/jobs") {
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const pagination = parsePagination(query);
                if (pagination.ok === false) return corsJson(400, { error: pagination.error });
                const page = await ingestionJobs.list(session.tenantId, pagination.page.limit, pagination.page.offset);
                return corsJson(200, { status: "READY", tenantId: session.tenantId, jobs: page.items, pagination: toPageMeta(pagination.page, page) });
            }

            if (req.method === "GET" && path.startsWith("/api/ingest/jobs/")) {
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const jobId = decodeURIComponent(path.slice("/api/ingest/jobs/".length));
                const job = await ingestionJobs.get(session.tenantId, jobId);
                if (!job) return corsJson(404, { error: "INGESTION_JOB_NOT_FOUND" });
                const inProgress = !isTerminalIngestionStage(job.stage);
                return corsJson(200, {
                    status: job.status === "COMPLETED" ? "READY" : inProgress ? "IN_PROGRESS" : "FAILED",
                    job,
                    diagnostics: { ...(job.code ? { code: job.code } : {}) },
                });
            }

            /**
             * Tenant-scoped read of the canonical sync cursors owned by
             * `SyncStateStore`. The offline client uses this to reconcile its
             * queued work against the server-authoritative watermark. Without a
             * `source` query the whole tenant cursor set is returned; with a
             * `source` query a single cursor (or null) is returned.
             */
            if (req.method === "GET" && path === "/api/sync/state") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const sourceFilter = query.get("source");
                if (sourceFilter !== null) {
                    const sourceKey = sourceFilter.trim();
                    if (!sourceKey) return corsJson(400, { error: "SYNC_SOURCE_REQUIRED" });
                    const cursor = await syncState.get(session.tenantId, sourceKey);
                    return corsJson(200, { status: "READY", tenantId: session.tenantId, sourceKey, cursor });
                }
                const cursors = await syncState.list(session.tenantId);
                return corsJson(200, { status: "READY", tenantId: session.tenantId, cursors });
            }

            if (req.method === "GET" && path === "/api/sources") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const pagination = parsePagination(query);
                if (pagination.ok === false) return corsJson(400, { error: pagination.error });
                const page = await ingestionService.listSourcesPage(session.tenantId, pagination.page.limit, pagination.page.offset);
                return corsJson(200, { status: "READY", tenantId: session.tenantId, sources: page.items, pagination: toPageMeta(pagination.page, page) });
            }

            if (req.method === "GET" && path.startsWith("/api/sources/")) {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const sha = decodeURIComponent(path.slice("/api/sources/".length));
                const source = await ingestionService.readSource(session.tenantId, sha);
                if (!source) return corsJson(404, { error: "SOURCE_NOT_FOUND" });
                if (!enforceTenantBoundary(source, Authorization.READ)) return corsJson(404, { error: "SOURCE_NOT_FOUND" });
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

            if (req.method === "POST" && path === "/api/decision/workbench") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("CREATE_DECISION")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const decisionError = validateDecisionBody(body);
                if (decisionError) return corsJson(400, { error: decisionError });
                const result = decisionWorkbench.execute({
                    tenantId: session.tenantId,
                    problem: String(body.problem),
                    alternatives: (body.alternatives as unknown[]).map((value) => String(value)),
                    criteria: body.criteria as DecisionWorkbenchInput["criteria"],
                    scores: (body.scores as unknown[]).map((row) => (row as unknown[]).map((value) => Number(value))),
                    pairwiseMatrix: Array.isArray(body.pairwiseMatrix) ? (body.pairwiseMatrix as number[][]) : undefined,
                });
                if (result.status !== "READY") return corsJson(422, result);
                await persistence.write({ tenantId: session.tenantId }, LATEST_DECISION_WORKBENCH_KEY, result);
                latestDecisionResults.set(session.tenantId, result);
                return corsJson(200, result);
            }

            if (req.method === "GET" && path === "/api/decision/latest") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const result = await loadDecision(session.tenantId);
                if (!result) return corsJson(404, { error: "DECISION_NOT_FOUND" });
                return corsJson(200, result);
            }

            if (req.method === "POST" && path === "/api/financial/insights") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("INGEST_DATA")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const analyticsError = validateAnalyticsBody(body);
                if (analyticsError) return corsJson(400, { error: analyticsError });

                let sourceEvidence: FinancialSourceEvidence | undefined;
                let ingestedSource: { sha256: string; sourceName: string; sourceType: string; transactionCount: number; document?: ReturnType<typeof summarizeFinancialDocument> } | undefined;
                let series = Array.isArray(body.series) ? (body.series as number[]) : undefined;
                let statement = body.statement as FinancialAnalyticsInput["statement"];
                let priorStatement = body.priorStatement as FinancialAnalyticsInput["priorStatement"];
                let documentInsight: FinancialStatementInsight | undefined;
                let documentModel: FinancialCanonicalModel | undefined;

                if (body.sourceSha256 !== undefined) {
                    const sourceSha256 = String(body.sourceSha256).trim().toLowerCase();
                    if (!/^[a-f0-9]{64}$/.test(sourceSha256)) return corsJson(400, { error: "SOURCE_SHA256_INVALID" });
                    const model = await loadIngestedModel(session.tenantId, sourceSha256);
                    if (!model) return corsJson(422, { error: "INGESTED_SOURCE_REQUIRED" });
                    documentModel = model;
                    sourceEvidence = model.source;
                    ingestedSource = {
                        sha256: sourceSha256,
                        sourceName: model.source.sourceName,
                        sourceType: model.source.sourceType,
                        transactionCount: model.transactions.length,
                        ...(model.document ? { document: summarizeFinancialDocument(model.document) } : {})
                    };
                    if (model.document) {
                        // Canonical document facts are authoritative. Client-supplied
                        // `statement`/`priorStatement`/`series` must never override a
                        // verified statement source (this mirrors the precedence rule
                        // already enforced by `/api/financial/analyze`). Otherwise the
                        // persisted statement insight would mix verified facts with
                        // unverified client figures and later reach the report and
                        // assistant as if it were one verified context. Absent measures
                        // stay absent and the ratio owner fails closed per section
                        // instead of being silently filled with zeros.
                        const derived = deriveAnalysisInput(model.document);
                        statement = derived.statement as FinancialAnalyticsInput["statement"];
                        const prior = derivePriorStatement(model.document);
                        priorStatement = Object.keys(prior).length > 0
                            ? prior as FinancialAnalyticsInput["priorStatement"]
                            : undefined;
                        // A document source carries no ledger transaction series; use
                        // the canonical (empty) series so forecast/anomaly sections
                        // fail closed rather than consuming client-supplied numbers.
                        series = model.transactions.map((transaction) => transaction.credit - transaction.debit);
                    } else if (!series) {
                        series = model.transactions.map((transaction) => transaction.credit - transaction.debit);
                    }
                }

                const result = financialAnalytics.execute({
                    tenantId: session.tenantId,
                    series,
                    statement,
                    priorStatement,
                    breakEven: body.breakEven as FinancialAnalyticsInput["breakEven"],
                    movingAverageWindow: body.movingAverageWindow === undefined ? undefined : Number(body.movingAverageWindow)
                });

                // A canonical statement source is analyzable even when some
                // optional ratios lack evidence: the per-section statuses and the
                // `unavailable` lists carry the truth instead of a blanket 422.
                if (documentModel?.document) {
                    documentInsight = composeFinancialStatementInsight({
                        document: documentModel.document,
                        derived: deriveAnalysisInput(documentModel.document),
                        prior: derivePriorStatement(documentModel.document),
                        analytics: result,
                    });
                }
                if (result.status !== "READY" && !documentInsight) return corsJson(422, result);

                const record: StoredAnalytics = {
                    ...result,
                    ...(sourceEvidence ? { source: sourceEvidence } : {}),
                    ...(documentInsight ? { statementInsight: documentInsight } : {}),
                };
                await persistence.write({ tenantId: session.tenantId }, LATEST_ANALYTICS_KEY, record);
                latestAnalyticsResults.set(session.tenantId, record);
                return corsJson(200, ingestedSource ? { ...record, ingestedSource } : record);
            }

            if (req.method === "GET" && path === "/api/financial/insights/latest") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const result = await loadAnalytics(session.tenantId);
                if (!result) return corsJson(404, { error: "ANALYTICS_NOT_FOUND" });
                return corsJson(200, result);
            }

            if (path === "/api/execution/work-items" && req.method === "POST") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("CREATE_DECISION")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const title = String(body.title ?? "").trim();
                if (!title) return corsJson(400, { error: "WORK_ITEM_TITLE_REQUIRED" });
                return runIdempotent("work-items:propose", body, async () => {
                    const result = await organizationalExecution.propose(executionContext(session), {
                        title,
                        description: body.description === undefined ? undefined : String(body.description),
                        priority: body.priority === undefined ? undefined : String(body.priority) as WorkItemPriority,
                        decisionArtifactKey: body.decisionArtifactKey === undefined ? undefined : String(body.decisionArtifactKey)
                    });
                    return executionOutcome(result);
                });
            }

            if (path === "/api/execution/work-items" && req.method === "GET") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const pagination = parsePagination(query);
                if (pagination.ok === false) return corsJson(400, { error: pagination.error });
                const page = await organizationalExecution.listWorkItemsPage(executionContext(session), pagination.page.limit, pagination.page.offset);
                return corsJson(200, { status: "READY", tenantId: session.tenantId, workItems: page.items, pagination: toPageMeta(pagination.page, page) });
            }

            if (path.startsWith("/api/execution/work-items/")) {
                const parts = path.slice("/api/execution/work-items/".length).split("/").filter(Boolean);
                const workItemId = parts[0] ? decodeURIComponent(parts[0]) : "";
                const action = parts[1];
                const context = executionContext(session);

                if (req.method === "GET" && !action) {
                    if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                    const workItem = await organizationalExecution.getWorkItem(context, workItemId);
                    if (!workItem) return corsJson(404, { error: "WORK_ITEM_NOT_FOUND" });
                    // Defense-in-depth tenant boundary + explicit object-level
                    // owner/admin check (beyond tenant scope alone).
                    if (!enforceTenantBoundary(workItem, Authorization.READ)) return corsJson(404, { error: "WORK_ITEM_NOT_FOUND" });
                    if (!canAccessWorkItem(workItem)) {
                        options.securityEventLogger?.logAuthorizationDenial({
                            actorId: session.username,
                            tenantId: session.tenantId,
                            target: req.url ?? "unknown",
                            reason: "WORK_ITEM_OBJECT_FORBIDDEN",
                            metadata: { workItemId, method: req.method, path: req.url }
                        });
                        return corsJson(403, { error: "WORK_ITEM_FORBIDDEN" });
                    }
                    return corsJson(200, workItem);
                }

                if (req.method === "POST" && action) {
                    if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                    const approvalAction = action === "approve" || action === "reject";
                    if (!ensurePermission(approvalAction ? "APPROVE_DECISION" : "CREATE_DECISION")) {
                        return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                    }
                    const body = action === "start" ? {} : await readJson(req);
                    let result: WorkItemOperationResult;
                    switch (action) {
                        case "approve":
                            result = await organizationalExecution.approve(context, workItemId, {
                                comments: body.comments === undefined ? undefined : String(body.comments),
                                requiredApprovals: Array.isArray(body.requiredApprovals) ? body.requiredApprovals.map((value) => String(value)) : undefined,
                                maxDurationMs: body.maxDurationMs === undefined ? undefined : Number(body.maxDurationMs),
                                maxBudget: body.maxBudget === undefined ? undefined : Number(body.maxBudget)
                            });
                            break;
                        case "reject":
                            result = await organizationalExecution.reject(context, workItemId, { reason: String(body.reason ?? "") });
                            break;
                        case "assign":
                            result = await organizationalExecution.assign(context, workItemId, {
                                assigneeId: String(body.assigneeId ?? ""),
                                assigneeType: body.assigneeType === undefined ? undefined : String(body.assigneeType) as WorkItemAssigneeType,
                                dueDate: body.dueDate === undefined ? undefined : String(body.dueDate)
                            });
                            break;
                        case "start":
                            result = await organizationalExecution.start(context, workItemId);
                            break;
                        case "block":
                            result = await organizationalExecution.block(context, workItemId, { reason: String(body.reason ?? "") });
                            break;
                        case "complete":
                            result = await organizationalExecution.complete(context, workItemId, {
                                kpi: body.kpi as KpiOutcomeInput | undefined,
                                evidence: Array.isArray(body.evidence) ? body.evidence as WorkItemEvidence[] : undefined,
                                feedback: body.feedback as WorkItemFeedbackInput | undefined,
                                metrics: body.metrics as CompleteWorkItemInput["metrics"]
                            });
                            break;
                        case "cancel":
                            result = await organizationalExecution.cancel(context, workItemId, { reason: body.reason === undefined ? undefined : String(body.reason) });
                            break;
                        default:
                            return corsJson(404, { error: "NOT_FOUND" });
                    }
                    return executionResponse(result);
                }
            }

            const problemErrorStatus = (code: ProblemBlockCode): number => {
                switch (code) {
                    case "problem-not-found": return 404;
                    case "problem-governance-denied": return 403;
                    case "problem-governance-approval-required": return 409;
                    default: return 422;
                }
            };
            const problemResponse = (result: ProblemResult<ProblemCase>) =>
                result.status === "READY"
                    ? corsJson(200, result.value)
                    : corsJson(problemErrorStatus(result.code), { error: result.code, reason: result.reason });

            if (path === "/api/problems" && req.method === "POST") {
                if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                if (!ensurePermission("CREATE_DECISION")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const title = String(body.title ?? "").trim();
                if (!title) return corsJson(400, { error: "PROBLEM_TITLE_REQUIRED" });
                return runIdempotent("problems:open", body, async () => {
                    const result = await problemSolving.openCase({
                        tenantId: session.tenantId,
                        title,
                        scope: body.scope === undefined ? undefined : String(body.scope),
                        category: body.category === undefined ? undefined : String(body.category).toUpperCase() as ProblemCategory,
                        severity: body.severity === undefined ? undefined : String(body.severity).toUpperCase() as ProblemSeverity,
                        description: body.description === undefined ? undefined : String(body.description),
                        createdBy: session.userId
                    });
                    if (result.status !== "READY") return { status: 422, payload: { error: result.code, reason: result.reason } };
                    return { status: 201, payload: result.value };
                });
            }

            if (req.method === "GET" && path === "/api/problems") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const pagination = parsePagination(query);
                if (pagination.ok === false) return corsJson(400, { error: pagination.error });
                const page = await problemSolving.listCases(session.tenantId, pagination.page.limit, pagination.page.offset);
                return corsJson(200, { status: "READY", tenantId: session.tenantId, problems: page.cases, pagination: toPageMeta(pagination.page, { items: page.cases, total: page.total }) });
            }

            if (path.startsWith("/api/problems/")) {
                const problemParts = path.slice("/api/problems/".length).split("/").filter(Boolean);
                const problemId = problemParts[0] ? decodeURIComponent(problemParts[0]) : "";
                const problemAction = problemParts[1];

                if (req.method === "GET" && !problemAction) {
                    if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                    const problem = await problemSolving.getCase(session.tenantId, problemId);
                    if (!problem) return corsJson(404, { error: "PROBLEM_NOT_FOUND" });
                    if (!enforceTenantBoundary(problem, Authorization.READ)) return corsJson(404, { error: "PROBLEM_NOT_FOUND" });
                    if (!canAccessProblem(problem)) {
                        options.securityEventLogger?.logAuthorizationDenial({
                            actorId: session.username,
                            tenantId: session.tenantId,
                            target: req.url ?? "unknown",
                            reason: "PROBLEM_OBJECT_FORBIDDEN",
                            metadata: { problemId, method: req.method, path: req.url }
                        });
                        return corsJson(403, { error: "PROBLEM_FORBIDDEN" });
                    }
                    const metrics = await problemSolving.getMetrics(session.tenantId, problemId);
                    return corsJson(200, { ...problem, metrics });
                }

                if (req.method === "POST" && problemAction === "advance") {
                    if (!getOrCreateRateLimiter(session.token).tryAcquire()) return corsJson(429, { error: "RATE_LIMIT_EXCEEDED" });
                    const body = await readJson(req);
                    const stage = String(body.stage ?? "").trim().toUpperCase();
                    const isDecision = stage === "DECIDE";
                    if (!ensurePermission(isDecision ? "APPROVE_DECISION" : "CREATE_DECISION")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                    const existing = await problemSolving.getCase(session.tenantId, problemId);
                    if (!existing) return corsJson(404, { error: "PROBLEM_NOT_FOUND" });
                    if (!enforceTenantBoundary(existing, Authorization.WRITE)) return corsJson(404, { error: "PROBLEM_NOT_FOUND" });
                    if (!canAccessProblem(existing)) {
                        options.securityEventLogger?.logAuthorizationDenial({
                            actorId: session.username,
                            tenantId: session.tenantId,
                            target: req.url ?? "unknown",
                            reason: "PROBLEM_OBJECT_FORBIDDEN",
                            metadata: { problemId, stage, method: req.method, path: req.url }
                        });
                        return corsJson(403, { error: "PROBLEM_FORBIDDEN" });
                    }

                    let result: ProblemResult<ProblemCase>;
                    switch (stage) {
                        case "DEFINE":
                            result = await problemSolving.defineProblem(session.tenantId, problemId, session.userId, {
                                statement: String(body.statement ?? ""),
                                scope: body.scope === undefined ? undefined : String(body.scope),
                                impactedProcesses: Array.isArray(body.impactedProcesses) ? body.impactedProcesses.map((value) => String(value)) : undefined,
                                ownerId: body.ownerId === undefined ? undefined : String(body.ownerId),
                                successCriteria: Array.isArray(body.successCriteria) ? body.successCriteria.map((value) => String(value)) : undefined
                            });
                            break;
                        case "EVIDENCE":
                            result = await problemSolving.addEvidence(session.tenantId, problemId, session.userId,
                                Array.isArray(body.evidence) ? body.evidence as { category: never; summary: string; source: string; observedAt?: string }[] : []);
                            break;
                        case "HYPOTHESES":
                            result = await problemSolving.formHypotheses(session.tenantId, problemId, session.userId);
                            break;
                        case "ROOT_CAUSE":
                            result = await problemSolving.analyzeRootCause(session.tenantId, problemId, session.userId);
                            break;
                        case "OPTIONS":
                            result = await problemSolving.evaluateOptions(
                                session.tenantId,
                                problemId,
                                session.userId,
                                Array.isArray(body.options) ? body.options as never : [],
                                body.evaluation === undefined ? undefined : body.evaluation as never
                            );
                            break;
                        case "DECIDE":
                            result = await problemSolving.decide(session.tenantId, problemId, session.userId, {
                                selectedOptionId: String(body.selectedOptionId ?? ""),
                                rationale: String(body.rationale ?? ""),
                                humanApprovalRef: body.humanApprovalRef === undefined ? undefined : String(body.humanApprovalRef)
                            }, executionContext(session));
                            break;
                        case "PLAN":
                            result = await problemSolving.planActions(session.tenantId, problemId, session.userId, {
                                objective: String(body.objective ?? ""),
                                steps: Array.isArray(body.steps) ? body.steps.map((value) => String(value)) : [],
                                requiredApprovals: Array.isArray(body.requiredApprovals) ? body.requiredApprovals.map((value) => String(value)) : [],
                                maxDuration: body.maxDuration === undefined ? undefined : Number(body.maxDuration),
                                maxBudget: body.maxBudget === undefined ? undefined : Number(body.maxBudget)
                            });
                            break;
                        case "EXECUTE":
                            result = await problemSolving.executeActions(session.tenantId, problemId, session.userId, executionContext(session));
                            break;
                        case "OUTCOME":
                            result = await problemSolving.measureOutcome(session.tenantId, problemId, session.userId, {
                                baseline: body.baseline as BaselineMetrics,
                                post: body.post as PostInterventionMetrics,
                                expected: body.expected === undefined ? undefined : body.expected as never
                            });
                            break;
                        case "LEARN":
                            result = await problemSolving.captureLearning(session.tenantId, problemId, session.userId);
                            break;
                        default:
                            return corsJson(400, { error: "PROBLEM_STAGE_UNKNOWN" });
                    }
                    return problemResponse(result);
                }
            }

            if (req.method === "GET" && path === "/api/report") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const result = await loadAnalysis(session.tenantId);
                if (!result) return corsJson(422, { error: "REPORT_ANALYSIS_REQUIRED" });
                const workbench = await loadWorkbench(session.tenantId);
                const analytics = await correlatedAnalyticsFor(session.tenantId, result.source.sha256);
                const insight = analytics?.statementInsight
                    ?? await loadStatementInsight(session.tenantId, result.source.sha256, analytics);
                const flatSections = buildReportSections(session, result, workbench, analytics, insight).flatMap((section) => section.lines);
                const report = reports.build("HooshyarOS Financial and Executive Report", flatSections);
                return corsJson(report.status === "READY" ? 200 : 422, { ...report, tenantId: session.tenantId, source: result.source });
            }

            if (req.method === "POST" && path === "/api/report/export") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const body = await readJson(req);
                const format = String(body.format ?? "TXT").trim().toUpperCase();
                if (!SUPPORTED_REPORT_FORMATS.includes(format as ReportFormat)) {
                    return corsJson(400, { error: "REPORT_FORMAT_UNSUPPORTED" });
                }
                return runIdempotent("report:export", body, async () => {
                    const result = await loadAnalysis(session.tenantId);
                    if (!result) return { status: 422, payload: { error: "REPORT_ANALYSIS_REQUIRED" } };
                    const workbench = await loadWorkbench(session.tenantId);
                    const analytics = await correlatedAnalyticsFor(session.tenantId, result.source.sha256);
                    const insight = analytics?.statementInsight
                        ?? await loadStatementInsight(session.tenantId, result.source.sha256, analytics);
                    const exported = await reportExport.generate({
                        tenantId: session.tenantId,
                        title: "HooshyarOS Financial and Executive Report",
                        sections: buildReportSections(session, result, workbench, analytics, insight),
                        format: format as ReportFormat,
                        metadata: {
                            "Source": result.source.sourceName,
                            "Source type": result.source.sourceType,
                            "Source SHA-256": result.source.sha256,
                            "Generated by": "ReportsEngine"
                        },
                        sourceRef: `financial-ingestion:${result.source.sha256}`
                    });
                    if (exported.status !== "READY") return { status: 422, payload: { status: "BLOCKED", error: exported.reason } };
                    return {
                        status: 201,
                        payload: {
                            status: "READY",
                            tenantId: session.tenantId,
                            capabilityId: reportExport.capabilityId,
                            targetEngine: reportExport.targetEngine,
                            artifact: exported.artifact,
                            downloadUrl: exported.downloadPath
                        }
                    };
                });
            }

            if (req.method === "GET" && path === "/api/report/artifacts") {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const pagination = parsePagination(query);
                if (pagination.ok === false) return corsJson(400, { error: pagination.error });
                const page = await reportExport.listPage(session.tenantId, pagination.page.limit, pagination.page.offset);
                return corsJson(200, { status: "READY", tenantId: session.tenantId, artifacts: page.items, pagination: toPageMeta(pagination.page, page) });
            }

            if (req.method === "GET" && path.startsWith("/api/report/artifacts/") && path.endsWith("/download")) {
                if (!ensurePermission("READ_DASHBOARD")) return corsJson(403, { error: "INSUFFICIENT_PERMISSIONS" });
                const artifactId = decodeURIComponent(path.slice("/api/report/artifacts/".length, path.length - "/download".length));
                const artifact = await reportExport.read(session.tenantId, artifactId);
                if (!artifact) return corsJson(404, { error: "REPORT_ARTIFACT_NOT_FOUND" });
                if (!enforceTenantBoundary(artifact.metadata, Authorization.READ)) return corsJson(404, { error: "REPORT_ARTIFACT_NOT_FOUND" });
                send(res, 200, artifact.metadata.contentType, artifact.content, {
                    ...corsHeaders(corsOrigin),
                    "Content-Disposition": `attachment; filename="${artifact.metadata.fileName}"`,
                    "Content-Length": String(artifact.metadata.byteLength),
                    "Cache-Control": "no-store",
                    "X-Artifact-SHA256": artifact.metadata.sha256
                });
                return;
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
                const analytics = await correlatedAnalyticsFor(session.tenantId, result.source.sha256);
                const insight = analytics?.statementInsight
                    ?? await loadStatementInsight(session.tenantId, result.source.sha256, analytics);
                const statementContext = insight ? describeStatementContext(insight) : [];
                const context = [
                    `Answer using only verified persisted context for tenant ${session.tenantId}.`,
                    "Separate extracted facts, derived metrics, interpretation and management recommendations.",
                    "Never contradict the deterministic calculations; a ratio reported as unavailable or not-applicable must be described as such.",
                    "Do not infer market demand, competitive position or future sales from statement-only evidence.",
                    "If a value or period is absent from the context, say the evidence is unavailable; never invent it.",
                    `Question: ${question}`,
                    `SourceSha256=${result.source.sha256}`,
                    `Revenue=${result.metrics.revenue}`,
                    `Profit=${result.metrics.profit}`,
                    `ProfitMargin=${result.metrics.profitMargin}`,
                    `DebtRatio=${result.metrics.debtRatio}`,
                    `Observations=${result.observations.map((item) => item.message).join(" | ")}`,
                    workbench ? `Recommendations=${workbench.recommendations.map((item) => item.action).join(" | ")}` : "No executive workbench result is available yet.",
                    ...statementContext,
                ].join(" | ");
                const answer = reasoning.reason(context);
                if (!answer.success) return corsJson(503, { error: "ASSISTANT_REASONING_UNAVAILABLE" });
                return corsJson(200, {
                    status: "READY",
                    tenantId: session.tenantId,
                    question,
                    answer: answer.answer ?? answer.status,
                    evidence: {
                        analysisSource: result.source,
                        executiveWorkbench: Boolean(workbench),
                        statementContext: Boolean(insight),
                        ...(insight
                            ? {
                                documentStatus: insight.documentStatus,
                                periods: insight.periods,
                                integrity: insight.integrity.map((check) => ({ id: check.id, status: check.status })),
                                cashFlowQuality: insight.cashFlow.qualityOfEarnings,
                                notApplicableRatios: insight.ratios.notApplicable,
                                limitations: insight.limitations,
                            }
                            : {}),
                    },
                });
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

            return corsJson(404, { error: "NOT_FOUND", requestId });
        } catch (error) {
            const message = error instanceof Error ? error.message : "RUNTIME_ERROR";
            const status = message === "request-body-too-large" ? 413 : 400;
            return corsJson(status, { error: message, requestId });
        }
    });
    server.once("close", close);
    return server;
}
