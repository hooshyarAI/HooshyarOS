import { Knowledge } from '../Entities/Knowledge';
import { KnowledgeRule } from '../Entities/KnowledgeRule';
import { MemoryEvent } from '../Entities/MemoryEvent';
import { EventListener } from '../Interfaces/EventListener';
import { KnowledgeItem } from '../Core/IntelligenceContract';

export type ScienceReadiness = 'EXECUTABLE' | 'PARTIAL' | 'REGISTERED_ONLY';

export type ScienceSignal =
    | 'financial-performance'
    | 'capital-allocation'
    | 'investment-evaluation'
    | 'historical-analysis'
    | 'data-quality'
    | 'data-analysis'
    | 'forecasting'
    | 'risk-assessment'
    | 'uncertainty-analysis'
    | 'multi-criteria-decision'
    | 'strategic-planning'
    | 'long-term-planning'
    | 'resource-optimization'
    | 'resource-allocation'
    | 'process-improvement'
    | 'workflow-redesign'
    | 'causal-diagnosis'
    | 'root-cause-analysis'
    | 'compliance-review'
    | 'data-governance'
    | 'platform-quality'
    | 'performance-improvement'
    | 'cash-flow'
    | 'valuation'
    | 'scenario-analysis'
    | 'budget-planning'
    | 'liquidity'
    | 'scheduling'
    | 'organizational-change'
    | 'automation-design';

export interface ScienceDomainDefinition {
    readonly id: string;
    readonly name: string;
    readonly purpose: string;
    readonly owner: string;
    readonly readiness: ScienceReadiness;
    readonly signals: readonly ScienceSignal[];
    readonly availableOperations: readonly string[];
    readonly limitations: readonly string[];
    readonly crossCutting?: boolean;
}

export interface ScienceSelectionInput {
    /** Explicit, machine-readable signals. Free-text guesses are intentionally avoided. */
    readonly signals: readonly ScienceSignal[];
    /** Include data quality, provenance and analytics-governance checks by default. */
    readonly includeCrossCuttingGuardrails?: boolean;
}

export interface ScienceSelectionItem {
    readonly domainId: string;
    readonly name: string;
    readonly role: 'PRIMARY' | 'SUPPORTING' | 'GUARDRAIL';
    readonly readiness: ScienceReadiness;
    readonly owner: string;
    readonly matchingSignals: readonly ScienceSignal[];
    readonly availableOperations: readonly string[];
    readonly limitations: readonly string[];
    readonly reason: string;
}

export interface ScienceSelectionPlan {
    readonly status: 'READY' | 'PARTIAL' | 'BLOCKED';
    readonly requestedSignals: readonly ScienceSignal[];
    readonly selected: readonly ScienceSelectionItem[];
    readonly unresolvedSignals: readonly string[];
    readonly requiresReview: boolean;
    readonly note: string;
}

/**
 * Version-controlled science register. "PARTIAL" means that the named
 * owner has verified operations, not that the whole discipline is complete.
 * "REGISTERED_ONLY" is deliberately non-executable until real methods and
 * tests are audited and mapped here.
 */
const SCIENCE_DOMAINS: readonly ScienceDomainDefinition[] = [
    {
        id: 'statistics-probability',
        name: 'آمار و احتمال',
        purpose: 'تحلیل توصیفی، پراکندگی، صدک‌ها، خط مبنا و سنجش کفایت داده؛ بدون ادعای استنباط احتمالاتیِ تأییدنشده.',
        owner: 'Backend/HBOS/Temporal/DescriptiveStatistics.ts; Backend/HBOS/Temporal/StatisticalBaselineEngine.ts',
        readiness: 'PARTIAL',
        signals: ['historical-analysis', 'data-quality', 'forecasting', 'risk-assessment', 'uncertainty-analysis', 'financial-performance', 'investment-evaluation'],
        availableOperations: [
            'DescriptiveStatistics.mean',
            'DescriptiveStatistics.median',
            'DescriptiveStatistics.sampleVariance',
            'DescriptiveStatistics.sampleStandardDeviation',
            'DescriptiveStatistics.percentile',
            'DescriptiveStatistics.createSummary',
            'DescriptiveStatistics.verifySummary',
            'StatisticalBaselineEngine.createBaseline',
            'StatisticalBaselineEngine.verifyBaseline'
        ],
        limitations: [
            'آمار توصیفی و خط مبنا موجود است؛ آزمون‌های استنباطی و کالیبراسیون توزیع احتمال در این ثبت، اجراییِ تأییدشده محسوب نمی‌شوند.'
        ]
    },
    {
        id: 'data-analysis',
        name: 'تحلیل داده و علم داده',
        purpose: 'ارزیابی کیفیت داده، آماده‌سازی سری زمانی و انتخاب مدل بر مبنای شواهد و پس‌آزمایی.',
        owner: 'Backend/HBOS/Temporal/DataQualityProfiler.ts; Backend/HBOS/Forecasting/ModelSelector.ts; Backend/HBOS/Forecasting/BaselineForecastEngine.ts',
        readiness: 'PARTIAL',
        signals: ['data-analysis', 'data-quality', 'historical-analysis', 'forecasting', 'financial-performance', 'strategic-planning', 'resource-optimization'],
        availableOperations: [
            'DataQualityProfiler.profile',
            'DataQualityProfiler.isQualitySufficient',
            'ModelSelector.select',
            'ModelSelector.selectFromSeries',
            'BaselineForecastEngine.forecast',
            'BaselineForecastEngine.forecastFromSeries'
        ],
        limitations: [
            'دامنه مدل‌ها و داده‌های قابل تحلیل تابع قراردادهای موجود است؛ وجود این ثبت به معنی پشتیبانی از هر نوع فایل، مدل یا منبع داده نیست.'
        ]
    },
    {
        id: 'data-analytics-management',
        name: 'مدیریت چرخه تحلیل داده',
        purpose: 'کنترل کیفیت، منشأ داده، قابلیت بازتولید، محدوده مستأجر و قابلیت پیگیری خروجی تحلیل.',
        owner: 'Backend/HBOS/Temporal/DataQualityProfiler.ts; Backend/HBOS/Temporal/TimeSeriesStore.ts; Backend/HBOS/Core/ProvenanceTrace.ts',
        readiness: 'PARTIAL',
        signals: ['data-analysis', 'data-quality', 'historical-analysis', 'forecasting', 'financial-performance', 'risk-assessment', 'data-governance', 'platform-quality'],
        availableOperations: [
            'DataQualityProfiler.profile',
            'DataQualityProfiler.getQualityFlags',
            'ProvenanceTrace.hashInput'
        ],
        limitations: [
            'عملیات کیفیت و منشأ داده به‌صورت محدود موجود است؛ تکمیل مدیریت جامع چرخه عمر تحلیل، مالکیت داده و سیاست‌های سازمانی باید جداگانه راستی‌آزمایی شود.'
        ],
        crossCutting: true
    },
    {
        id: 'financial-management',
        name: 'مدیریت مالی',
        purpose: 'تحلیل عملکرد و نسبت‌های مالی، نقدینگی، سرمایه در گردش و سنجش بازده.',
        owner: 'Backend/HBOS/Engines/FinancialIntelligenceEngine.ts; Backend/HBOS/Product/FinancialAnalyticsService.ts; Backend/HBOS/Product/FinancialStatementAnalysisService.ts',
        readiness: 'PARTIAL',
        signals: ['financial-performance', 'cash-flow', 'liquidity', 'budget-planning', 'capital-allocation', 'historical-analysis'],
        availableOperations: [
            'FinancialIntelligenceEngine.analyze',
            'FinancialIntelligenceEngine.workingCapital',
            'FinancialIntelligenceEngine.liquidityRatios',
            'FinancialIntelligenceEngine.roic',
            'FinancialIntelligenceEngine.eva',
            'FinancialIntelligenceEngine.wacc'
        ],
        limitations: [
            'دامنه تحلیل به داده ورودی و قراردادهای مالی موجود محدود است؛ نتیجه نهایی باید همراه با کنترل کیفیت و تطبیق دوره‌ها تفسیر شود.'
        ]
    },
    {
        id: 'financial-engineering',
        name: 'مهندسی مالی',
        purpose: 'ارزیابی اقتصادی جریان نقدی، ارزش زمانی پول، نرخ بازده و دوره بازگشت سرمایه.',
        owner: 'Backend/HBOS/Engines/FinancialIntelligenceEngine.ts',
        readiness: 'PARTIAL',
        signals: ['capital-allocation', 'investment-evaluation', 'cash-flow', 'valuation', 'scenario-analysis', 'risk-assessment', 'budget-planning'],
        availableOperations: [
            'FinancialIntelligenceEngine.npv',
            'FinancialIntelligenceEngine.irr',
            'FinancialIntelligenceEngine.payback',
            'FinancialIntelligenceEngine.wacc'
        ],
        limitations: [
            'این ثبت، محاسبات مشخص جریان نقدی و هزینه سرمایه را پوشش می‌دهد؛ قیمت‌گذاری مشتقات، بهینه‌سازی پرتفوی و سایر روش‌های پیشرفته تا زمان آزمون و ثبت مالک اجرایی، تأییدشده نیستند.'
        ]
    },
    {
        id: 'decision-science',
        name: 'علم تصمیم‌گیری',
        purpose: 'مقایسه گزینه‌ها، وزن‌دهی معیارها و ارزیابی پیامدهای احتمالاتی با داده و فرض‌های صریح.',
        owner: 'Backend/HBOS/Engines/DecisionIntelligenceEngine.ts; Backend/HBOS/Product/DecisionWorkbench.ts',
        readiness: 'PARTIAL',
        signals: ['multi-criteria-decision', 'capital-allocation', 'strategic-planning', 'resource-optimization', 'risk-assessment', 'process-improvement', 'investment-evaluation'],
        availableOperations: [
            'DecisionIntelligenceEngine.ahp',
            'DecisionIntelligenceEngine.topsis',
            'DecisionIntelligenceEngine.decisionTree',
            'DecisionWorkbench.execute (Expert Choice)'
        ],
        limitations: [
            'AHP، TOPSIS، Expert Choice و ارزش مورد انتظار درخت تصمیم در قراردادهای مشخص موجودند؛ Expert Choice نیازمند امتیازهای صریح گزینه‌ها و معیارهاست و به‌تنهایی مجوز اجرای تصمیم نیست.'
        ]
    },
    {
        id: 'strategic-management',
        name: 'مدیریت استراتژیک',
        purpose: 'هدف‌گذاری بلندمدت، انتخاب راهبرد، اولویت‌بندی ابتکارها و تبدیل راهبرد به اقدام قابل سنجش.',
        owner: 'Backend/AI_Runtime/strategic/strategic_engine.py; Backend/AI_Runtime/executive_memory/strategic_analysis.py',
        readiness: 'REGISTERED_ONLY',
        signals: ['strategic-planning', 'long-term-planning', 'resource-allocation', 'performance-improvement', 'budget-planning'],
        availableOperations: [],
        limitations: [
            'ماژول‌های فعلیِ بررسی‌شده خروجی عمومی برمی‌گردانند و شواهد کافی برای تحلیل واقعی رقبا، گزینه‌های راهبردی و اجرای چرخه استراتژی ندارند؛ در نتیجه این حوزه ثبت شده اما اجرایی اعلام نمی‌شود.'
        ]
    },
    {
        id: 'operations-research-optimization',
        name: 'تحقیق در عملیات و بهینه‌سازی',
        purpose: 'اولویت‌بندی چندمعیاره و مقایسه گزینه‌ها؛ گسترش به تخصیص منابع و زمان‌بندی فقط پس از تأیید حل‌گر و قیود.',
        owner: 'Backend/HBOS/Engines/DecisionIntelligenceEngine.ts; Backend/AI_Runtime/optimization/optimization_engine.py',
        readiness: 'PARTIAL',
        signals: ['resource-optimization', 'resource-allocation', 'scheduling', 'process-improvement', 'capital-allocation', 'multi-criteria-decision'],
        availableOperations: [
            'DecisionIntelligenceEngine.ahp',
            'DecisionIntelligenceEngine.topsis'
        ],
        limitations: [
            'رتبه‌بندی چندمعیاره موجود است؛ حل‌گر عمومی قیود، زمان‌بندی و بهینه‌سازی منابع هنوز در این ثبت، اجراییِ تأییدشده نیست.'
        ]
    },
    {
        id: 'forecasting-scenario-analysis',
        name: 'پیش‌بینی و تحلیل سناریو',
        purpose: 'پیش‌بینی سری زمانی با روش‌های پایه، پس‌آزمایی و مقایسه روش‌ها؛ تحلیل سناریو با قراردادهای موجود.',
        owner: 'Backend/HBOS/Forecasting/ModelSelector.ts; Backend/HBOS/Forecasting/BaselineForecastEngine.ts; Backend/HBOS/Forecasting/BacktestEngine.ts; Backend/HBOS/Engines/RiskIntelligenceEngine.ts',
        readiness: 'PARTIAL',
        signals: ['forecasting', 'scenario-analysis', 'cash-flow', 'strategic-planning', 'budget-planning', 'historical-analysis', 'uncertainty-analysis'],
        availableOperations: [
            'ModelSelector.select',
            'BaselineForecastEngine.forecast',
            'RiskIntelligenceEngine.scenario'
        ],
        limitations: [
            'انتخاب مدل بر اساس پس‌آزمایی و روش‌های پایه پیش‌بینی موجودند؛ پیش‌بینیِ بدون داده کافی یا بدون بیان محدودیت‌ها مجاز نیست.'
        ]
    },
    {
        id: 'risk-uncertainty-analysis',
        name: 'مدیریت ریسک و عدم‌قطعیت',
        purpose: 'ارزیابی احتمال و اثر، تحلیل حساسیت، سناریو، شبیه‌سازی و سنجش ریسک کمی در محدوده روش‌های موجود.',
        owner: 'Backend/HBOS/Engines/RiskIntelligenceEngine.ts',
        readiness: 'PARTIAL',
        signals: ['risk-assessment', 'uncertainty-analysis', 'scenario-analysis', 'investment-evaluation', 'forecasting', 'capital-allocation', 'financial-performance'],
        availableOperations: [
            'RiskIntelligenceEngine.assess',
            'RiskIntelligenceEngine.sensitivity',
            'RiskIntelligenceEngine.tornado',
            'RiskIntelligenceEngine.scenario',
            'RiskIntelligenceEngine.monteCarlo',
            'RiskIntelligenceEngine.valueAtRisk'
        ],
        limitations: [
            'خروجی تابع داده، مفروضات و تنظیمات ورودی است؛ هیچ سطح اطمینان یا احتمال موفقیتی بدون محاسبه و شواهد معتبر ساخته نمی‌شود.'
        ]
    },
    {
        id: 'causal-reasoning',
        name: 'استدلال علّی و تحلیل ریشه‌ای',
        purpose: 'تفکیک همبستگی از علیت، بررسی مفروضات شناسایی و تحلیل عوامل مؤثر بر پیامد.',
        owner: 'Backend/AI_Runtime/causal_reasoning/causal_reasoning.py; Backend/HBOS/Uncertainty/CausalTypes.ts',
        readiness: 'REGISTERED_ONLY',
        signals: ['causal-diagnosis', 'root-cause-analysis', 'process-improvement', 'financial-performance', 'risk-assessment'],
        availableOperations: [],
        limitations: [
            'ماژول ساده فعلی به‌تنهایی برآورد علّی معتبر تولید نمی‌کند؛ تا زمان وجود الگوریتم و آزمون‌های رفتاری، نتیجه آن نباید به‌عنوان رابطه علّی گزارش شود.'
        ]
    },
    {
        id: 'organizational-process-design',
        name: 'طراحی فرایند و معماری سازمان',
        purpose: 'تحلیل جریان کار، بازطراحی فرایند، هماهنگی مسئولیت‌ها و سنجش اثر تغییرات سازمانی.',
        owner: 'Organizational Intelligence Engine; Autonomous Operations Engine',
        readiness: 'REGISTERED_ONLY',
        signals: ['process-improvement', 'workflow-redesign', 'organizational-change', 'resource-allocation', 'performance-improvement', 'automation-design'],
        availableOperations: [],
        limitations: [
            'مالکیت معماری موجود است، اما الگوریتم بازطراحی فرایند و چرخه اجرایی آن در این ثبت به روش و آزمون مشخصی متصل نشده است.'
        ]
    },
    {
        id: 'governance-compliance',
        name: 'حاکمیت، انطباق و کنترل',
        purpose: 'اعمال سیاست‌ها، کنترل مجوز، ممیزی، مدیریت محدودیت‌ها و کنترل ریسک تصمیم.',
        owner: 'Governance Engine; Security and Authorization boundaries',
        readiness: 'PARTIAL',
        signals: ['compliance-review', 'data-governance', 'risk-assessment', 'platform-quality', 'automation-design'],
        availableOperations: [],
        limitations: [
            'مالکیت‌های حاکمیت و امنیت در معماری وجود دارند؛ تطبیق هر مقرره خاص با روش اجرایی و آزمون مربوط باید پیش از اعلام انطباق تأیید شود.'
        ]
    },
    {
        id: 'systems-engineering-reliability',
        name: 'مهندسی سیستم، کیفیت و قابلیت اطمینان',
        purpose: 'بهبود قابلیت آزمون، مشاهده‌پذیری، پایداری، کارایی و کنترل وابستگی‌های پلتفرم.',
        owner: 'Architecture Freeze V4; Health Monitor Engine; Autonomous Operations Engine',
        readiness: 'PARTIAL',
        signals: ['platform-quality', 'performance-improvement', 'automation-design', 'data-governance'],
        availableOperations: [],
        limitations: [
            'این حوزه راهنمای انتخاب رویکرد و مالک معماری است؛ وجود آن جایگزین آزمون‌های واقعی کارایی، امنیت، پایداری یا پذیرش محصول نیست.'
        ],
        crossCutting: true
    }
];

const KNOWN_SCIENCE_SIGNALS: ReadonlySet<string> = new Set(
    SCIENCE_DOMAINS.flatMap(domain => domain.signals)
);

function copyScienceDomain(domain: ScienceDomainDefinition): ScienceDomainDefinition {
    return {
        ...domain,
        signals: [...domain.signals],
        availableOperations: [...domain.availableOperations],
        limitations: [...domain.limitations]
    };
}

export class KnowledgeEngine implements EventListener {

    name: string = 'KnowledgeEngine';

    private knowledge: Knowledge[] = [];

    private rules: KnowledgeRule[] = [];

    initialize(): void {

        console.log(
            'Knowledge Engine Started'
        );

    }

    health(): boolean {

        return true;

    }

    onEvent(
        event: MemoryEvent
    ): void {

        this.learn(
            event
        );

    }

    addRule(
        rule: KnowledgeRule
    ): void {

        this.rules.push(
            rule
        );

    }

    getRules(): KnowledgeRule[] {

        return this.rules;

    }

    learn(
        event: MemoryEvent,
        tenantId?: string
    ): Knowledge {


        const resolvedTenantId = tenantId !== undefined ? tenantId : event.tenantId;

        const knowledge =
            new Knowledge(
                event.type,
                event.source + ': ' + event.data,
                undefined,
                event.source,
                resolvedTenantId
            );




        this.knowledge.push(
            knowledge
        );




        return knowledge;

    }

    getKnowledge(tenantId?: string): Knowledge[] {

        if (tenantId === undefined) {

            return this.knowledge;

        }

        return this.knowledge.filter(k => k.tenantId === tenantId);

    }

    toKnowledgeItems(): KnowledgeItem[] {

        return this.knowledge.map(k => ({
            id: k.id,
            title: k.title,
            description: k.description,
            confidence: k.confidence,
            source: k.source,
            createdAt: k.createdAt.toISOString(),
            tenantId: k.tenantId
        }));

    }

    /** Return the version-controlled science catalogue without mutable references. */
    getScienceDomains(): ScienceDomainDefinition[] {
        return SCIENCE_DOMAINS.map(copyScienceDomain);
    }

    /** Retrieve one registered science by stable identifier. */
    getScienceDomain(id: string): ScienceDomainDefinition | undefined {
        const domain = SCIENCE_DOMAINS.find(item => item.id === id);
        return domain ? copyScienceDomain(domain) : undefined;
    }

    /**
     * Deterministically select science domains from explicit, machine-readable
     * signals. It does not infer intent from free text or execute missing
     * algorithms. Every selection carries owner, callable operations and limits.
     */
    planScienceSelection(input: ScienceSelectionInput): ScienceSelectionPlan {
        if (!input || !Array.isArray(input.signals) || input.signals.length === 0) {
            return {
                status: 'BLOCKED',
                requestedSignals: [],
                selected: [],
                unresolvedSignals: [],
                requiresReview: true,
                note: 'حداقل یک نشانه ساختاریافته برای مسئله لازم است؛ انتخاب علمی از متن مبهم حدس زده نمی‌شود.'
            };
        }

        const rawSignals = input.signals as readonly string[];
        const requestedSignals = Array.from(new Set(
            rawSignals.filter((signal): signal is ScienceSignal => KNOWN_SCIENCE_SIGNALS.has(signal))
        ));
        const unresolvedSignals = Array.from(new Set(
            rawSignals.filter(signal => !KNOWN_SCIENCE_SIGNALS.has(signal))
        ));

        if (requestedSignals.length === 0) {
            return {
                status: 'BLOCKED',
                requestedSignals: [],
                selected: [],
                unresolvedSignals,
                requiresReview: true,
                note: 'هیچ نشانه شناخته‌شده‌ای دریافت نشد؛ اجرای روش علمی متوقف شد.'
            };
        }

        const matches = SCIENCE_DOMAINS
            .map((domain, index) => ({
                domain,
                index,
                matchingSignals: requestedSignals.filter(signal => domain.signals.includes(signal))
            }))
            .filter(item => item.matchingSignals.length > 0)
            .sort((left, right) => {
                const leftFirst = requestedSignals.indexOf(left.matchingSignals[0]);
                const rightFirst = requestedSignals.indexOf(right.matchingSignals[0]);
                if (leftFirst !== rightFirst) return leftFirst - rightFirst;
                if (left.matchingSignals.length !== right.matchingSignals.length) {
                    return right.matchingSignals.length - left.matchingSignals.length;
                }
                return left.index - right.index;
            });

        const selected: ScienceSelectionItem[] = matches.map((item, index) => ({
            domainId: item.domain.id,
            name: item.domain.name,
            role: index === 0 ? 'PRIMARY' : 'SUPPORTING',
            readiness: item.domain.readiness,
            owner: item.domain.owner,
            matchingSignals: [...item.matchingSignals],
            availableOperations: [...item.domain.availableOperations],
            limitations: [...item.domain.limitations],
            reason: 'انتخاب بر اساس نشانه‌های صریح مسئله: ' + item.matchingSignals.join(', ')
        }));

        const includeGuardrails = input.includeCrossCuttingGuardrails !== false;
        if (includeGuardrails) {
            const guardrails = SCIENCE_DOMAINS.filter(domain =>
                domain.crossCutting &&
                !selected.some(item => item.domainId === domain.id)
            );
            for (const domain of guardrails) {
                selected.push({
                    domainId: domain.id,
                    name: domain.name,
                    role: 'GUARDRAIL',
                    readiness: domain.readiness,
                    owner: domain.owner,
                    matchingSignals: [],
                    availableOperations: [...domain.availableOperations],
                    limitations: [...domain.limitations],
                    reason: 'کنترل میان‌رشته‌ای برای کیفیت داده، منشأ نتایج، قابلیت اطمینان و بازبینی لازم است.'
                });
            }
        }

        const requiresReview =
            unresolvedSignals.length > 0 ||
            selected.some(item => item.readiness !== 'EXECUTABLE');

        const status = selected.length === 0
            ? 'BLOCKED'
            : requiresReview
                ? 'PARTIAL'
                : 'READY';

        return {
            status,
            requestedSignals,
            selected,
            unresolvedSignals,
            requiresReview,
            note: status === 'READY'
                ? 'روش‌های انتخاب‌شده دارای عملیات اجرایی ثبت‌شده‌اند؛ ورودی‌ها و خروجی‌ها همچنان باید اعتبارسنجی شوند.'
                : 'برنامه انتخاب ساخته شد، اما برخی حوزه‌ها محدود یا صرفاً ثبت‌شده‌اند. اجرای آن‌ها بدون عملیات تأییدشده مجاز نیست.'
        };
    }

    count(): number {

        return this.knowledge.length;

    }

}
