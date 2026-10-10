export type DecisionTask =
  | "FINANCIAL_STATEMENT_ANALYSIS" | "EXECUTIVE_DECISION" | "FINANCIAL_MANAGEMENT" | "FINANCIAL_ENGINEERING"
  | "ECONOMIC_FORECAST" | "RISK_ASSESSMENT" | "PORTFOLIO_OPTIMIZATION"
  | "PROCESS_REDESIGN" | "HR_ANALYTICS" | "DIGITAL_FINANCIAL_PRODUCT" | "GENERAL";

export type KnowledgePriority = "FOUNDATIONAL" | "CONDITIONAL" | "SPECIALIZED" | "EXPERIMENTAL";

export interface InterdisciplinaryKnowledgeDomain {
  readonly id: string;
  readonly title: string;
  readonly priority: KnowledgePriority;
  readonly appliesWhen: readonly string[];
  readonly concepts: readonly string[];
  readonly candidateMethods: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly qualityGates: readonly string[];
  readonly guardrails: readonly string[];
  readonly outcomeMetrics: readonly string[];
}
export interface DecisionKnowledgeRequest {
  readonly task?: string;
  readonly objective?: string;
  readonly jurisdiction?: string;
  readonly entityType?: string;
  readonly evidenceAvailable?: readonly string[];
}

const VERSION = "interdisciplinary-decision-knowledge-2026-10-10.v2";
const DOMAINS: readonly InterdisciplinaryKnowledgeDomain[] = [
  {
    id: "accounting-financial-reporting", title: "حسابداری و گزارشگری مالی", priority: "FOUNDATIONAL",
    appliesWhen: ["دفتر حساب، صورت مالی، سود و زیان، بودجه، نسبت و افشا"],
    concepts: ["طبقه‌بندی حساب", "مبنای شناخت و اندازه‌گیری", "هم‌مبنایی دوره و ارز", "ردیابی شاخص تا منبع"],
    candidateMethods: ["نگاشت مستند حساب به سرفصل", "تطبیق جمع‌ها", "تحلیل افقی/عمودی و نسبت پس از اعتبارسنجی"],
    requiredEvidence: ["نام/کد یا نگاشت حساب", "دوره و ارز", "منبع و مبنای اندازه‌گیری"],
    qualityGates: ["جمع بدهکار/بستانکار کل، درآمد/هزینه نیست", "حساب طبقه‌بندی‌نشده باید آشکار بماند", "دوره‌ها و ارزها باید هم‌مبنا باشند"],
    guardrails: ["بدون نگاشت معتبر سود یا انطباق استانداردی را قطعی اعلام نکن", "تحلیل مدیریتی جایگزین نظر حسابرس مستقل نیست"],
    outcomeMetrics: ["درصد حساب طبقه‌بندی‌شده", "تطبیق با صورت مالی مرجع", "ردیابی محاسبه تا منبع"]
  },
  {
    id: "financial-management-and-corporate-finance", title: "مدیریت مالی و مالی شرکتی", priority: "FOUNDATIONAL",
    appliesWhen: ["برنامه‌ریزی مالی، بودجه، سرمایه در گردش، نقدینگی، تأمین مالی و ارزش‌گذاری"],
    concepts: ["پیش‌بینی جریان نقد", "ساختار سرمایه و هزینه سرمایه", "سرمایه در گردش", "بودجه و کنترل انحراف", "ارزش اقتصادی و ارزش‌گذاری"],
    candidateMethods: ["بودجه و rolling forecast", "NPV/IRR و جریان نقدی تنزیل‌شده", "تحلیل سرمایه در گردش", "سناریو و حساسیت", "تحلیل نقطه سربه‌سر"],
    requiredEvidence: ["داده چنددوره‌ای هم‌مبنا", "شرایط تأمین مالی و نرخ‌ها", "فرض‌ها و محدودیت نقدینگی"],
    qualityGates: ["مقایسه پیش‌بینی با خط مبنا", "ثبت مفروضات و سناریوی نامطلوب", "تفکیک سود حسابداری از جریان نقد"],
    guardrails: ["فرض نرخ/هزینه بدون منبع نساز", "NPV/IRR جایگزین تحلیل ریسک و قیود تأمین مالی نیست"],
    outcomeMetrics: ["خطای پیش‌بینی جریان نقد", "چرخه نقدینگی", "هزینه سرمایه/تأمین مالی", "تحقق بودجه"]
  },
  {
    id: "quantitative-finance-and-financial-engineering", title: "مالی کمی و مهندسی مالی", priority: "CONDITIONAL",
    appliesWhen: ["پرتفوی، ابزار مشتقه، قیمت‌گذاری، پوشش ریسک یا مسائل کمی با داده مناسب"],
    concepts: ["احتمال و آمار", "سری زمانی و فرآیند تصادفی", "ارزش زمانی پول", "ریسک مدل", "قیود واقعی پرتفوی"],
    candidateMethods: ["VaR/CVaR و آزمون تنش", "بهینه‌سازی پرتفوی مقید", "مونت‌کارلو", "مدل‌های مشتقه فقط با ورودی معتبر", "حساسیت/سناریو و backtesting"],
    requiredEvidence: ["داده بازار معتبر و زمان‌دار", "تعریف ابزار/قرارداد و فرض‌ها", "هزینه تراکنش و محدودیت نقدشوندگی"],
    qualityGates: ["backtest و سناریوی تنش", "مقایسه با روش پایه", "افشای عدم‌قطعیت و ریسک مدل"],
    guardrails: ["حساب تصادفی، Black–Scholes، تفاضل محدود یا تبدیل فوریه روش پیش‌فرض همه مسائل نیستند", "پیش‌بینی بازده تضمین نیست"],
    outcomeMetrics: ["خطای قیمت/ریسک", "پوشش و تمرکز", "هزینه اجرا", "پایداری حساسیت"]
  },
  {
    id: "economics-and-econometrics", title: "اقتصاد خرد/کلان و اقتصادسنجی", priority: "CONDITIONAL",
    appliesWhen: ["تقاضا، تورم، ارز، نرخ بهره، بازار، سناریو و اثر سیاست"],
    concepts: ["انگیزه و ساختار بازار", "چرخه و شوک", "شکست ساختاری", "همبستگی در برابر علیت"],
    candidateMethods: ["تحلیل سناریو", "ARIMA/GARCH با داده کافی", "مدل علّی در صورت طراحی معتبر"],
    requiredEvidence: ["سری زمانی با تعریف ثابت", "منبع و بسامد مشخص", "تغییر رژیم و رویدادهای مؤثر"],
    qualityGates: ["آزمون روی بازه زمانی آینده", "مقایسه با خط مبنا", "بررسی شکست ساختاری"],
    guardrails: ["از همبستگی، علیت نتیجه نگیر", "الگوی تاریخی را بی‌هشدار به آینده تعمیم نده"],
    outcomeMetrics: ["خطای پیش‌بینی در افق‌های مختلف", "پایداری سناریو", "کیفیت شناسایی علّی"]
  },
  {
    id: "data-analytics-science", title: "علوم تحلیل داده", priority: "FOUNDATIONAL",
    appliesWhen: ["تبدیل داده خام به گزارش، علت‌یابی، شاخص، پیش‌بینی یا پیشنهاد اقدام"],
    concepts: ["تحلیل توصیفی/تشخیصی/پیش‌بینانه/تجویزی", "آمار استنباطی و طراحی سنجه", "کاوش داده و مصورسازی", "تحلیل علّی با طراحی معتبر"],
    candidateMethods: ["پروفایل‌سازی و کنترل کیفیت داده", "تحلیل روند/بخش‌بندی/همبستگی", "تحلیل علت ریشه‌ای با شواهد", "داشبورد و مصورسازی", "آزمون فرض و پیش‌بینی با اعتبارسنجی مناسب"],
    requiredEvidence: ["تعریف دقیق سؤال و KPI", "داده با معناشناسی/واحد/زمان مشخص", "منبع و پوشش داده", "خط مبنا برای مقایسه"],
    qualityGates: ["تعریف شاخص و محاسبه بازتولیدپذیر باشد", "داده مفقود از صفر تفکیک شود", "همبستگی با علیت اشتباه نشود", "نمودار و خلاصه، دامنه و محدودیت داده را نشان دهند"],
    guardrails: ["بدون تعریف صورت و مخرج، نسبت نساز", "نمایش همبستگی به‌عنوان علت ممنوع", "نمونه کوچک یا داده سوگیر، نتیجه قطعی نمی‌دهد"],
    outcomeMetrics: ["دقت/پایداری تحلیل", "زمان رسیدن به بینش", "قابلیت بازتولید", "اثر تصمیم بر KPI"]
  },
  {
    id: "data-analytics-management-and-governance", title: "مدیریت تحلیل داده و حاکمیت داده", priority: "FOUNDATIONAL",
    appliesWhen: ["مالکیت داده، مدیریت KPI، چرخه تحلیل، کیفیت گزارش، داده مرجع و مقیاس‌پذیری تحلیل"],
    concepts: ["مالک/متولی داده", "فرهنگ‌نامه و کاتالوگ داده", "تبارشناسی و منشأ داده", "کیفیت و قرارداد داده", "چرخه عمر/دسترسی/نگهداری", "تعریف واحد و نسخه KPI"],
    candidateMethods: ["Data Quality Rules و scorecard", "Data lineage و ثبت provenance", "فرهنگ‌نامه مشترک KPI", "کنترل تغییر schema و قرارداد داده", "طبقه‌بندی حساسیت و حداقل‌سازی دسترسی", "مدیریت backlog تحلیلی بر اساس ارزش و ریسک"],
    requiredEvidence: ["مالک داده و منبع رسمی", "تعریف فیلد و KPI", "قواعد کیفیت و حد آستانه", "مجوز استفاده و دوره نگهداری"],
    qualityGates: ["هر KPI تعریف، مالک، واحد، دوره و منبع داشته باشد", "کیفیت و تازگی داده در دسترس مصرف‌کننده باشد", "تغییر schema/KPI versioned و قابل ممیزی باشد", "داده حساس کمینه و دسترسی محدود شود"],
    guardrails: ["بدون مالک یا منشأ معتبر، داده مرجع تلقی نشود", "تغییر تعریف KPI بین دوره‌ها باید افشا شود", "بازاستفاده از داده نباید هدف یا مجوز جدید را دور بزند"],
    outcomeMetrics: ["نرخ نقص/تازگی داده", "درصد KPI با تعریف و مالک", "زمان کشف تا رفع خطا", "کاهش ناسازگاری گزارش"]
  },
  {
    id: "data-science-ai-and-model-risk", title: "علوم داده، هوش مصنوعی و ریسک مدل", priority: "FOUNDATIONAL",
    appliesWhen: ["پیش‌بینی، طبقه‌بندی، کشف ناهنجاری، پردازش متن و انتخاب مدل"],
    concepts: ["کیفیت و نمایندگی داده", "خط مبنا", "اعتبارسنجی خارج از نمونه", "تبیین‌پذیری و رانش"],
    candidateMethods: ["قاعده و آمار قبل از ML", "یادگیری نظارت‌شده/بدون‌نظارت در صورت تناسب", "NLP برای اسناد", "پایش drift"],
    requiredEvidence: ["هدف قابل سنجش", "داده مجاز و نماینده", "تقسیم داده بدون نشت", "معیار انتشار مصوب"],
    qualityGates: ["مقایسه با خط مبنا", "اعتبارسنجی زمانی در سری زمانی", "نسخه‌بندی، پایش و برنامه بازگشت"],
    guardrails: ["بدون بهبود سنجیده مدل پیچیده اضافه نکن", "مدل رانش‌یافته مبنای تصمیم قطعی نشود"],
    outcomeMetrics: ["خطای داده آینده", "کالیبراسیون", "کیفیت داده و رانش", "زمان پاسخ و هزینه"]
  },
  {
    id: "operations-research-and-optimization", title: "تحقیق در عملیات و بهینه‌سازی", priority: "CONDITIONAL",
    appliesWhen: ["تخصیص منابع، تولید، زمان‌بندی، بودجه و زنجیره تأمین"],
    concepts: ["متغیر تصمیم و تابع هدف", "قید و امکان‌پذیری", "تبادل اهداف", "عدم‌قطعیت"],
    candidateMethods: ["LP/MILP", "بهینه‌سازی مقاوم/تصادفی", "چندهدفه", "شبیه‌سازی در صورت نیاز"],
    requiredEvidence: ["هدف و قیود قابل سنجش", "ظرفیت و منابع واقعی", "هزینه و عدم‌قطعیت"],
    qualityGates: ["امکان‌پذیری جواب", "مقایسه با خط مبنا", "تحلیل حساسیت"],
    guardrails: ["فراابتکاری و یادگیری تقویتی فقط پس از benchmark", "جواب ریاضی بدون قیود اجرایی توصیه نشود"],
    outcomeMetrics: ["هزینه/زمان/خدمت", "شکاف نسبت به خط مبنا", "تاب‌آوری جواب"]
  },
  {
    id: "strategy-enterprise-performance-and-process", title: "راهبرد، مدیریت عملکرد و مهندسی فرایند", priority: "FOUNDATIONAL",
    appliesWhen: ["اهداف و KPI، بودجه، گلوگاه، بازطراحی فرایند و اجرا"],
    concepts: ["هم‌راستایی راهبرد و عملیات", "KPI پیشرو/پسرو", "گلوگاه و ظرفیت", "مالک و بازخورد"],
    candidateMethods: ["درخت هدف/KPI", "نقشه فرایند و تحلیل علت ریشه‌ای", "بودجه سناریویی", "اولویت‌بندی با وزن روشن"],
    requiredEvidence: ["هدف و خط مبنا", "مالک و محدودیت منابع", "مسئول و موعد اجرا"],
    qualityGates: ["پیشنهاد به مالک و موعد وصل شود", "پیامد جانبی KPI بررسی شود", "نتیجه بعداً سنجیده شود"],
    guardrails: ["از یک نسبت علت سازمانی را قطعی نتیجه نگیر", "بازطراحی نیازمند شواهد و مشارکت ذی‌نفع است"],
    outcomeMetrics: ["زمان چرخه، کیفیت و هزینه", "تحقق هدف", "پایداری بهبود"]
  },
  {
    id: "behavioral-science-and-human-centered-design", title: "علوم رفتاری و طراحی انسان‌محور", priority: "CONDITIONAL",
    appliesWhen: ["تجربه کاربر، هشدار، تصمیم مالی حساس، اعتماد و پذیرش فناوری"],
    concepts: ["لنگراندازی و اعتماد بیش‌ازحد", "زیان‌گریزی و بار شناختی", "قاب‌بندی و ریسک ادراک‌شده"],
    candidateMethods: ["نمایش فرض و عدم‌قطعیت", "نقطه بازبینی تصمیم پرمخاطره", "آزمون کاربردپذیری", "TAM/UTAUT به‌عنوان چارچوب پژوهش"],
    requiredEvidence: ["هدف تجربه و معیار فهم", "رضایت و داده حداقلی", "کاربران متنوع"],
    qualityGates: ["درک و پیامد اندازه‌گیری شود", "آزمایش کنترل‌شده و تفسیر محتاطانه"],
    guardrails: ["الگوی تاریک یا تشویق معامله/ریسک غیرضروری ممنوع", "برچسب روان‌شناختی بی‌پشتوانه نزن"],
    outcomeMetrics: ["درک ریسک", "خطا و شکایت", "تکمیل موفق و رفاه کاربر"]
  },
  {
    id: "organizational-and-people-analytics", title: "رفتار سازمانی و HR Analytics", priority: "CONDITIONAL",
    appliesWhen: ["برنامه‌ریزی نیرو، شکاف مهارت، بارکاری، آموزش و تحول"],
    concepts: ["شایستگی", "ظرفیت و بارکاری", "تغییر سازمانی", "عدالت و حریم خصوصی"],
    candidateMethods: ["ماتریس مهارت", "تحلیل تجمیعی بارکاری", "سنجش آموزش", "تحلیل نقش و فرایند"],
    requiredEvidence: ["هدف مجاز", "داده معتبر و حداقلی", "مقایسه منصفانه"],
    qualityGates: ["سوگیری بررسی شود", "امکان اعتراض و نظارت انسانی"],
    guardrails: ["روان‌سنجی حساس یا استخدام/اخراج خودکار بدون اعتبارسنجی و نظارت انسانی ممنوع"],
    outcomeMetrics: ["شکاف مهارت", "ظرفیت فرایند", "عدالت و حفظ حریم خصوصی"]
  },
  {
    id: "risk-governance-and-regulatory-applicability", title: "ریسک، حاکمیت و شمول تنظیم‌گری", priority: "FOUNDATIONAL",
    appliesWhen: ["تصمیم مهم، محصول مالی، کنترل، گزارشگری و اقدام خودکار"],
    concepts: ["ریسک ذاتی و باقیمانده", "تحمل ریسک", "کنترل و شواهد", "صلاحیت حوزه قضایی"],
    candidateMethods: ["ثبت ریسک و کنترل", "آزمون تنش", "ردیابی قاعده تا شاهد", "بازبینی انسانی"],
    requiredEvidence: ["حوزه قضایی و نوع نهاد", "مالک ریسک و معیار مصوب", "منبع و دامنه"],
    qualityGates: ["قانون محلی از راهنمای داوطلبانه جدا", "نسخه و تاریخ اثر ثبت", "ریسک مهم ارجاع شود"],
    guardrails: ["Basel در زمینه بانکی؛ DORA/SFTR/ICAAP/ICARA فقط پس از احراز شمول", "خروجی جایگزین نظر حقوقی/حسابرسی نیست"],
    outcomeMetrics: ["پوشش کنترل", "زمان کشف/حل", "ردیابی تصمیم و رخداد"]
  },
  {
    id: "reliable-data-and-platform-engineering", title: "ریاضیات کاربردی، داده و مهندسی سامانه", priority: "FOUNDATIONAL",
    appliesWhen: ["داده، محاسبه، ادغام، عملیات خودکار و runtime"],
    concepts: ["پایداری عددی", "صحت و منشأ داده", "تراکنش و idempotency", "مشاهده‌پذیری"],
    candidateMethods: ["تطبیق و invariant", "تراکنش اتمی", "نسخه‌بندی و آزمون بازتولید", "پایش خطا و زمان پاسخ"],
    requiredEvidence: ["قرارداد ورودی/خروجی", "منبع و نسخه", "حدود دسترسی"],
    qualityGates: ["آزمون واحد/یکپارچه‌سازی/پذیرش", "خطا fail-closed", "benchmark واقعی"],
    guardrails: ["رمزنگاری و بلاکچین راه‌حل پیش‌فرض همه مسائل نیست", "داده حساس در prompt/log عمومی درج نشود"],
    outcomeMetrics: ["زمان پاسخ و نرخ شکست", "بازتولیدپذیری", "هزینه و خطای داده"]
  }
];

const TASK_DOMAINS: Readonly<Record<DecisionTask, readonly string[]>> = {
  EXECUTIVE_DECISION:["strategy-enterprise-performance-and-process","operations-research-and-optimization","economics-and-econometrics","risk-governance-and-regulatory-applicability","behavioral-science-and-human-centered-design"],
  FINANCIAL_STATEMENT_ANALYSIS:["accounting-financial-reporting","financial-management-and-corporate-finance","data-analytics-science","data-analytics-management-and-governance","data-science-ai-and-model-risk","risk-governance-and-regulatory-applicability","reliable-data-and-platform-engineering"],
  FINANCIAL_MANAGEMENT:["financial-management-and-corporate-finance","accounting-financial-reporting","data-analytics-science","data-analytics-management-and-governance","economics-and-econometrics","operations-research-and-optimization","risk-governance-and-regulatory-applicability"],
  FINANCIAL_ENGINEERING:["quantitative-finance-and-financial-engineering","data-analytics-science","data-analytics-management-and-governance","operations-research-and-optimization","economics-and-econometrics","data-science-ai-and-model-risk","risk-governance-and-regulatory-applicability"],
  ECONOMIC_FORECAST:["economics-and-econometrics","data-analytics-science","data-analytics-management-and-governance","data-science-ai-and-model-risk","financial-management-and-corporate-finance","risk-governance-and-regulatory-applicability"],
  RISK_ASSESSMENT:["risk-governance-and-regulatory-applicability","financial-management-and-corporate-finance","quantitative-finance-and-financial-engineering","data-analytics-science","data-analytics-management-and-governance","data-science-ai-and-model-risk"],
  PORTFOLIO_OPTIMIZATION:["quantitative-finance-and-financial-engineering","data-analytics-science","data-analytics-management-and-governance","operations-research-and-optimization","economics-and-econometrics","data-science-ai-and-model-risk","risk-governance-and-regulatory-applicability"],
  PROCESS_REDESIGN:["strategy-enterprise-performance-and-process","data-analytics-science","data-analytics-management-and-governance","operations-research-and-optimization","organizational-and-people-analytics","behavioral-science-and-human-centered-design","reliable-data-and-platform-engineering"],
  HR_ANALYTICS:["organizational-and-people-analytics","data-analytics-science","data-analytics-management-and-governance","behavioral-science-and-human-centered-design","data-science-ai-and-model-risk","risk-governance-and-regulatory-applicability"],
  DIGITAL_FINANCIAL_PRODUCT:["behavioral-science-and-human-centered-design","data-analytics-science","data-analytics-management-and-governance","data-science-ai-and-model-risk","risk-governance-and-regulatory-applicability","reliable-data-and-platform-engineering"],
  GENERAL:["strategy-enterprise-performance-and-process","data-analytics-science","data-analytics-management-and-governance","data-science-ai-and-model-risk","risk-governance-and-regulatory-applicability","reliable-data-and-platform-engineering"]
};

const REFERENCES = [
  {id:"DAMA-DMBOK-REVISION",authority:"DAMA International",url:"https://dama.org/dama-dmbok-revision/",kind:"data-management-framework",rule:"حاکمیت، مالکیت، فراداده، کیفیت و تبارشناسی داده؛ وضعیت نسخه/بازنگری را هنگام استفاده بررسی کنید."},
  {id:"IFAC-AUDIT-DATA-ANALYTICS",authority:"IFAC / CPA Canada",url:"https://www.ifac.org/content/audit-data-analytics-guide",kind:"professional-guidance",rule:"راهنمای تحلیل داده برای گزارشگری مالی و حسابرسی؛ جایگزین استاندارد حسابرسی لازم‌الاجرا نیست."},
  {id:"NIST-AI-RMF",authority:"NIST",url:"https://www.nist.gov/itl/ai-risk-management-framework",kind:"framework",rule:"چارچوب داوطلبانه مدیریت ریسک هوش مصنوعی؛ بازنگری آن پیگیری شود."}
  {id:"OECD-AI",authority:"OECD",url:"https://www.oecd.org/en/topics/ai-principles.html",kind:"framework",rule:"اصول سیاستی؛ قانون خودکار هر کشور نیست."},
  {id:"COSO-ERM",authority:"COSO",url:"https://www.coso.org/enterprise-risk-management",kind:"framework",rule:"پیوند ریسک با راهبرد و عملکرد."},
  {id:"GOOGLE-ML-RULES",authority:"Google",url:"https://developers.google.com/machine-learning/guides/rules-of-ml",kind:"engineering",rule:"زیرساخت و خط مبنای ساده پیش از مدل پیچیده."},
  {id:"GOOGLE-ML-MONITORING",authority:"Google",url:"https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring",kind:"engineering",rule:"نسخه‌بندی و پایش مدل، داده و زمان پاسخ."},
  {id:"SKLEARN-TIME-SERIES",authority:"scikit-learn",url:"https://scikit-learn.org/stable/modules/cross_validation.html",kind:"engineering",rule:"اعتبارسنجی سری زمانی مبتنی بر ترتیب زمان."},
  {id:"BCBS-239",authority:"Basel Committee",url:"https://www.bis.org/publ/bcbs239.pdf",kind:"framework",rule:"اصول تجمیع و گزارش ریسک بانکی؛ دامنه شمول باید احراز شود."},
  {id:"WORLD-BANK-DIGITAL-FINANCE",authority:"World Bank",url:"https://digitalfinance.worldbank.org/topics/financial-consumer-protection",kind:"research",rule:"حفاظت مصرف‌کننده در مالی دیجیتال."}
] as const;

export class InterdisciplinaryDecisionKnowledgeService {
  readonly version = VERSION;

  getCatalogue() {
    return {
      version: VERSION, snapshotDate:"2026-10-10", designPrinciple:"TASK_RELEVANT_KNOWLEDGE_COMPOSITION",
      domainCount:DOMAINS.length,
      domains:DOMAINS.map((d)=>({...d,appliesWhen:[...d.appliesWhen],concepts:[...d.concepts],candidateMethods:[...d.candidateMethods],requiredEvidence:[...d.requiredEvidence],qualityGates:[...d.qualityGates],guardrails:[...d.guardrails],outcomeMetrics:[...d.outcomeMetrics]})),
      taskProfiles:Object.fromEntries(Object.entries(TASK_DOMAINS).map(([task,ids])=>[task,[...ids]])),
      references:REFERENCES.map((reference)=>({...reference})),
      rules:[
        "Define the objective and measurable success criterion before selecting methods.",
        "Start with an interpretable baseline; complexity must demonstrate measurable improvement.",
        "Use a time-aware evaluation for forecasts; prevent future-data leakage.",
        "Separate facts, calculations, assumptions, hypotheses and recommendations.",
        "Record source, version, uncertainty, limitations, owner, due date and outcome.",
        "Do not turn missing data into zero or correlation into causality.",
        "Use current local requirements only after checking entity, jurisdiction and effective date.",
        "Treat this catalogue as knowledge routing; it does not claim every listed algorithm is implemented."
      ]
    };
  }

  composeForTask(request:DecisionKnowledgeRequest|null|undefined) {
    const task=this.resolveTask(request?.task);
    const selected=DOMAINS.filter((d)=>TASK_DOMAINS[task].includes(d.id));
    const evidence=(request?.evidenceAvailable??[]).filter((v)=>v.trim()).slice(0,12);
    const contextComplete=Boolean(request?.jurisdiction?.trim()&&request?.entityType?.trim());
    const guidance=[
      "Select methods only if data, assumptions, objective and computational costs fit.",
      "Prefer a measured baseline over unnecessary complexity.",
      "For financial reports, confirm account mapping, period, currency, measurement basis and governing standards before asserting profit or compliance.",
      "For forecasts, validate chronologically and report uncertainty.",
      "For high-impact decisions, show material risks and preserve human review.",
      "Log the provenance, version, limitations and measurable outcome."
    ];
    if(!contextComplete) guidance.push("Jurisdiction and entity type are incomplete; do not claim entity-specific regulatory applicability.");
    if(!evidence.length) guidance.push("No evidence inventory supplied; identify missing inputs and keep conclusions conditional.");
    const context=[
      `Knowledge version=${VERSION}`,
      `Task profile=${task}`,
      `Selected domains=${selected.map((d)=>d.id).join(",")}`,
      ...guidance.map((line)=>`- ${line}`),
      ...selected.map((d)=>`- ${d.id}: methods=${d.candidateMethods.join("; ")}; evidence=${d.requiredEvidence.join("; ")}; gates=${d.qualityGates.join("; ")}; safeguards=${d.guardrails.join("; ")}`)
    ].join("\n");
    return {version:VERSION,task,domainIds:selected.map((d)=>d.id),domains:selected.map((d)=>({id:d.id,title:d.title,priority:d.priority})),evidenceAvailable:evidence,contextComplete,reasoningContext:context};
  }

  private resolveTask(input:string|undefined):DecisionTask {
    const task=(input??"").trim().toUpperCase().replace(/[\s-]+/g,"_");
    const aliases:Readonly<Record<string,DecisionTask>>={
      FINANCIAL_ANALYSIS:"FINANCIAL_STATEMENT_ANALYSIS",MANAGEMENT_DECISION:"EXECUTIVE_DECISION",
      FORECASTING:"ECONOMIC_FORECAST",TIME_SERIES:"ECONOMIC_FORECAST",RISK:"RISK_ASSESSMENT",
      PORTFOLIO:"PORTFOLIO_OPTIMIZATION",PROCESS_IMPROVEMENT:"PROCESS_REDESIGN",
      ORGANIZATIONAL_REDESIGN:"PROCESS_REDESIGN",PEOPLE_ANALYTICS:"HR_ANALYTICS",FINTECH_PRODUCT:"DIGITAL_FINANCIAL_PRODUCT"
    };
    if(Object.prototype.hasOwnProperty.call(TASK_DOMAINS,task)) return task as DecisionTask;
    return aliases[task]??"GENERAL";
  }
}
