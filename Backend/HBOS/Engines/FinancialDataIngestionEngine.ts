import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FinancialIntelligenceEngine, FinancialAnalysisResult } from "./FinancialIntelligenceEngine";
import { FinancialEvidenceStore } from "./FinancialEvidenceStore";

export interface FinancialEvidenceRecord {
    metric: string;
    period: string;
    value: number;
    unit: string;
}

export interface FinancialSource {
    sourceId: string;
    sourceUri: string;
    rawPath: string;
    entity: string;
}

export interface CanonicalFinancialModel {
    sourceId: string;
    entity: string;
    period: string;
    currency: string;
    scale: number;
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
}

export interface FinancialIngestionResult {
    source: FinancialSource;
    evidencePath: string;
    canonicalPath: string;
    evidenceHash: string;
    model: CanonicalFinancialModel;
    intelligence: FinancialAnalysisResult;
    status: "READY" | "BLOCKED";
}

const REQUIRED_COLUMNS = ["metric", "period", "value", "unit"] as const;

export class FinancialDataIngestionEngine {
    name = "FinancialDataIngestionEngine";

    constructor(
        private readonly intelligence = new FinancialIntelligenceEngine(),
        private readonly evidenceStore?: FinancialEvidenceStore
    ) {}

    async ingest(source: FinancialSource, evidenceRoot: string): Promise<FinancialIngestionResult> {
        if (!source.entity.trim()) throw new Error("Financial source entity is required");
        const raw = await readFile(resolve(source.rawPath), "utf8");
        const records = this.parseCsv(raw);
        this.validate(records);
        const model = this.normalize(source, records);
        const evidenceHash = createHash("sha256").update(raw, "utf8").digest("hex");

        const evidencePath = resolve(evidenceRoot, `${source.sourceId}.raw.json`);
        const canonicalPath = resolve(evidenceRoot, `${source.sourceId}.canonical.json`);
        await mkdir(dirname(evidencePath), { recursive: true });
        await writeFile(evidencePath, JSON.stringify({ source, evidenceHash, records }, null, 2), "utf8");
        await writeFile(canonicalPath, JSON.stringify({ model, evidenceHash }, null, 2), "utf8");

        this.evidenceStore?.save({ source, evidenceHash, records, model });

        const intelligence = this.intelligence.analyze({
            revenue: model.revenue,
            expenses: model.expenses,
            assets: model.assets,
            liabilities: model.liabilities
        });

        return {
            source,
            evidencePath,
            canonicalPath,
            evidenceHash,
            model,
            intelligence,
            status: intelligence.status
        };
    }

    private parseCsv(raw: string): FinancialEvidenceRecord[] {
        const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith("#"));
        if (lines.length < 2) throw new Error("Financial source is empty or missing data rows");
        const columns = lines[0].split(",").map((column) => column.trim());
        if (columns.length !== REQUIRED_COLUMNS.length || columns.some((column, index) => column !== REQUIRED_COLUMNS[index])) {
            throw new Error("Financial source schema is invalid");
        }

        return lines.slice(1).map((line, index) => {
            const values = line.split(",").map((value) => value.trim());
            if (values.length !== columns.length) throw new Error(`Financial source row ${index + 2} is malformed`);
            return {
                metric: values[0],
                period: values[1],
                value: Number(values[2]),
                unit: values[3]
            };
        });
    }

    private validate(records: FinancialEvidenceRecord[]): void {
        for (const record of records) {
            if (!record.metric || !/^\d{4}-\d{2}-\d{2}$/.test(record.period) || !Number.isFinite(record.value) || !record.unit) {
                throw new Error("Financial source contains invalid evidence");
            }
        }
        const required = ["total_net_sales", "total_cost_of_sales", "total_operating_expenses", "total_assets", "total_liabilities"];
        for (const metric of required) {
            if (!records.some((record) => record.metric === metric)) throw new Error(`Missing required financial metric: ${metric}`);
        }
        if (new Set(records.map((record) => record.period)).size !== 1) throw new Error("Financial source contains mixed periods");
        if (new Set(records.map((record) => record.unit)).size !== 1) throw new Error("Financial source uses mixed units");
    }

    private normalize(source: FinancialSource, records: FinancialEvidenceRecord[]): CanonicalFinancialModel {
        const value = (metric: string): number => records.find((record) => record.metric === metric)!.value;
        const unit = records[0].unit;
        const [currency, scaleName] = unit.split("_");
        const scale = scaleName === "MILLIONS" ? 1_000_000 : scaleName === "THOUSANDS" ? 1_000 : 1;

        return {
            sourceId: source.sourceId,
            entity: source.entity,
            period: records[0].period,
            currency,
            scale,
            revenue: value("total_net_sales"),
            expenses: value("total_cost_of_sales") + value("total_operating_expenses"),
            assets: value("total_assets"),
            liabilities: value("total_liabilities")
        };
    }
}
