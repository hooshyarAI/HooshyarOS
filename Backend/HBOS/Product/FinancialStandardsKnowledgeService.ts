export type StandardKnowledgeStatus =
  | "CURRENT_EDITION"
  | "REPORTED_EFFECTIVE_PRIMARY_CONFIRMATION_REQUIRED"
  | "ISSUED_NOT_YET_EFFECTIVE"
  | "APPLICABILITY_NOT_AUTOMATIC"
  | "LEGACY_PROFILE_REQUIRES_REFRESH";

export interface StandardKnowledgeEntry {
  readonly id: string;
  readonly framework: string;
  readonly domain: string;
  readonly title: string;
  readonly status: StandardKnowledgeStatus;
  readonly sourceKind: "PRIMARY_ISSUER" | "PROFESSIONAL_BODY" | "SECONDARY_REFERENCE";
  readonly authority: string;
  readonly sourceUrl: string;
  readonly effectiveFrom?: string;
  readonly supersedes?: readonly string[];
  readonly verifiedAsOf: "2026-10-10";
  readonly note: string;
}

export interface IranianStandardsContext {
  readonly jurisdiction: string;
  readonly entityType: string;
  readonly fiscalYearStartJalali: string;
  readonly isListed?: boolean;
  readonly isFinancialInstitution?: boolean;
  readonly publicInterestEntity?: boolean;
}

const DATE = "2026-10-10";
const ENTRIES: readonly StandardKnowledgeEntry[] = [
  {
    id: "IR-NAS-43", framework: "IRAN_NATIONAL_ACCOUNTING_STANDARDS", domain: "REVENUE",
    title: "استاندارد حسابداری ۴۳ ـ درآمد عملیاتی حاصل از قرارداد با مشتریان",
    status: "REPORTED_EFFECTIVE_PRIMARY_CONFIRMATION_REQUIRED", sourceKind: "PROFESSIONAL_BODY",
    authority: "انجمن حسابداران خبره ایران؛ متن نهایی باید از سازمان حسابرسی کنترل شود",
    sourceUrl: "https://www.iica.ir/professional-education/14010303-1",
    effectiveFrom: "1404-01-01 (طبق منابع حرفه‌ای جدیدتر؛ متن نهایی رسمی لازم است)",
    supersedes: ["استاندارد حسابداری ۳", "استاندارد حسابداری ۹", "استاندارد حسابداری ۲۹"],
    verifiedAsOf: DATE,
    note: "مدل پنج‌مرحله‌ای درآمد، تعهدات عملکردی، قیمت معامله، تخصیص قیمت و زمان انتقال کنترل. برخی منابع قدیمی‌تر تاریخ اجرای متفاوت گزارش می‌کنند؛ بدون متن رسمی، تاریخ قطعی اعلام نشود."
  },
  {
    id: "IR-NAS-44", framework: "IRAN_NATIONAL_ACCOUNTING_STANDARDS", domain: "LEASES",
    title: "استاندارد حسابداری ۴۴ ـ اجاره‌ها",
    status: "REPORTED_EFFECTIVE_PRIMARY_CONFIRMATION_REQUIRED", sourceKind: "PROFESSIONAL_BODY",
    authority: "انجمن حسابداران خبره ایران؛ تطبیق متن نهایی با سازمان حسابرسی لازم است",
    sourceUrl: "https://iica.ir/",
    effectiveFrom: "1405-01-01 (طبق اطلاع‌رسانی حرفه‌ای مشاهده‌شده)",
    supersedes: ["استاندارد حسابداری ۲۱ ـ حسابداری اجاره‌ها"],
    verifiedAsOf: DATE,
    note: "تشخیص اجاره، حق کنترل استفاده، مدت، پرداخت‌ها، نرخ تنزیل، دارایی حق استفاده، بدهی اجاره و معافیت‌ها طبق متن مصوب."
  },
  {
    id: "IR-NAS-15-REVISION-1404", framework: "IRAN_NATIONAL_ACCOUNTING_STANDARDS", domain: "INVESTMENTS",
    title: "استاندارد حسابداری ۱۵ ـ سرمایه‌گذاری‌ها؛ تجدیدنظر گزارش‌شده ۱۴۰۴",
    status: "REPORTED_EFFECTIVE_PRIMARY_CONFIRMATION_REQUIRED", sourceKind: "SECONDARY_REFERENCE",
    authority: "گزارش ثانویه حرفه‌ای؛ متن مصوب و تاریخ اثر مستقلاً احراز نشده",
    sourceUrl: "https://shahinhesab.com/article/",
    effectiveFrom: "1405-01-01 (گزارش ثانویه؛ منتظر تأیید رسمی)",
    verifiedAsOf: DATE,
    note: "هشدار پیگیری است؛ نسخه قدیمی نباید خودکار برای دوره جدید استفاده شود. نتیجه تا دریافت متن رسمی REVIEW_REQUIRED است."
  },
  {
    id: "IR-SDS-2-CLIMATE", framework: "IRAN_SUSTAINABILITY_DISCLOSURE", domain: "CLIMATE",
    title: "استاندارد افشای پایداری ۲ ـ اقلیم؛ گزارش‌شده در منبع ثانویه",
    status: "REPORTED_EFFECTIVE_PRIMARY_CONFIRMATION_REQUIRED", sourceKind: "SECONDARY_REFERENCE",
    authority: "گزارش ثانویه حرفه‌ای؛ دامنه و متن رسمی احراز نشده",
    sourceUrl: "https://shahinhesab.com/article/",
    effectiveFrom: "1405-01-01 (گزارش ثانویه؛ اجرای خودکار ممنوع تا احراز متن)",
    verifiedAsOf: DATE,
    note: "از IFRS S1/S2 و ISSA 5000 متمایز است؛ افشا و اطمینان‌بخشی دو الزام متفاوت‌اند."
  },
  {
    id: "IFRS-REQUIRED-2026", framework: "IFRS_ACCOUNTING_STANDARDS", domain: "GENERAL_PURPOSE_FINANCIAL_REPORTING",
    title: "IFRS Accounting Standards — Required 2026", status: "CURRENT_EDITION",
    sourceKind: "PRIMARY_ISSUER", authority: "IFRS Foundation / IASB",
    sourceUrl: "https://www.ifrs.org/news-and-events/news/2026/01/now-available-ifrs-accounting-standards-required-2026-two-editions/",
    effectiveFrom: "متناظر با استانداردهای لازم‌الاجرا تا 2026-01-01؛ مقررات گذار هر استاندارد جداست",
    verifiedAsOf: DATE,
    note: "Required را با Issued یا با الزام محلی ایران یکی نگیرید؛ حوزه قضایی، نوع واحد و پذیرش محلی جدا بررسی شود."
  },
  {
    id: "IFRS-18", framework: "IFRS_ACCOUNTING_STANDARDS", domain: "PRESENTATION_DISCLOSURE",
    title: "IFRS 18 — Presentation and Disclosure in Financial Statements",
    status: "ISSUED_NOT_YET_EFFECTIVE", sourceKind: "PRIMARY_ISSUER", authority: "IFRS Foundation / IASB",
    sourceUrl: "https://www.ifrs.org/issued-standards/list-of-standards/ifrs-18-presentation-and-disclosure-in-financial-statements/",
    effectiveFrom: "2027-01-01 برای دوره‌های سالانه؛ اجرای زودهنگام طبق متن ممکن",
    supersedes: ["IAS 1 در دامنه‌ای که IFRS 18 جایگزین می‌کند"], verifiedAsOf: DATE,
    note: "ارائه سود و زیان، جمع‌های فرعی تعریف‌شده و افشای معیارهای عملکرد تعریف‌شده توسط مدیریت از محورهای مهم‌اند."
  },
  {
    id: "IFRS-19", framework: "IFRS_ACCOUNTING_STANDARDS", domain: "SUBSIDIARY_DISCLOSURES",
    title: "IFRS 19 — Subsidiaries without Public Accountability: Disclosures",
    status: "ISSUED_NOT_YET_EFFECTIVE", sourceKind: "PRIMARY_ISSUER", authority: "IFRS Foundation / IASB",
    sourceUrl: "https://www.ifrs.org/issued-standards/",
    effectiveFrom: "2027-01-01؛ احراز شرایط صلاحیت و گذار الزامی است", verifiedAsOf: DATE,
    note: "کاهش افشاها به معنای معافیت از شناسایی و اندازه‌گیری IFRS نیست."
  },
  {
    id: "IAASB-HANDBOOK-2026", framework: "INTERNATIONAL_AUDITING_AND_ASSURANCE", domain: "AUDIT_REVIEW_ASSURANCE",
    title: "2026 IAASB Handbook — پنج جلد استانداردهای کیفیت، حسابرسی، بررسی، اطمینان‌بخشی و خدمات مرتبط",
    status: "CURRENT_EDITION", sourceKind: "PRIMARY_ISSUER", authority: "IAASB",
    sourceUrl: "https://www.iaasb.org/publications/2026-handbook-international-quality-management-auditing-review-sustainability-and-other-assurance",
    verifiedAsOf: DATE,
    note: "وجود استاندارد در Handbook به معنی لازم‌الاجرا بودن فوری یا پذیرش محلی نیست؛ هر استاندارد تاریخ اجرای جدا دارد."
  },
  {
    id: "ISA-240-REVISED", framework: "INTERNATIONAL_AUDITING_AND_ASSURANCE", domain: "FRAUD",
    title: "ISA 240 (Revised) — مسئولیت حسابرس درباره تقلب", status: "ISSUED_NOT_YET_EFFECTIVE",
    sourceKind: "PRIMARY_ISSUER", authority: "IAASB", sourceUrl: "https://www.iaasb.org/standards-pronouncements",
    effectiveFrom: "اثر اعلام‌شده برای دسامبر ۲۰۲۶؛ متن کامل و پذیرش محلی کنترل شود", verifiedAsOf: DATE,
    note: "صرف انتشار Handbook 2026، آن را الزام جاری همه مأموریت‌ها نمی‌کند."
  },
  {
    id: "ISA-570-REVISED-2024", framework: "INTERNATIONAL_AUDITING_AND_ASSURANCE", domain: "GOING_CONCERN",
    title: "ISA 570 (Revised 2024) — تداوم فعالیت", status: "ISSUED_NOT_YET_EFFECTIVE",
    sourceKind: "PRIMARY_ISSUER", authority: "IAASB", sourceUrl: "https://www.iaasb.org/standards-pronouncements",
    effectiveFrom: "اثر اعلام‌شده برای دسامبر ۲۰۲۶؛ دوره‌های دقیق از متن کامل بررسی شود", verifiedAsOf: DATE,
    note: "تا زمان اجرا، نسخه قبلی لازم‌الاجرا و مقررات محلی سنجیده شوند."
  },
  {
    id: "ISSA-5000", framework: "SUSTAINABILITY_ASSURANCE", domain: "SUSTAINABILITY_ASSURANCE",
    title: "ISSA 5000 — General Requirements for Sustainability Assurance Engagements",
    status: "ISSUED_NOT_YET_EFFECTIVE", sourceKind: "PRIMARY_ISSUER", authority: "IAASB",
    sourceUrl: "https://www.iaasb.org/standards-pronouncements",
    effectiveFrom: "اثر اعلام‌شده برای دسامبر ۲۰۲۶؛ شرط دقیق دوره و پذیرش محلی بررسی شود", verifiedAsOf: DATE,
    note: "استاندارد اطمینان‌بخشی است، نه جایگزین استانداردهای حسابداری یا افشای پایداری."
  },
  {
    id: "IESBA-HANDBOOK-2026", framework: "ACCOUNTANT_ETHICS_AND_INDEPENDENCE", domain: "ETHICS_INDEPENDENCE",
    title: "2026 IESBA Handbook — آیین اخلاق حرفه‌ای و استانداردهای استقلال",
    status: "CURRENT_EDITION", sourceKind: "PRIMARY_ISSUER", authority: "IESBA",
    sourceUrl: "https://www.ethicsboard.org/publications/2026-handbook-international-code-ethics-professional-accountants",
    verifiedAsOf: DATE,
    note: "برخی اصلاحات از ۱۵ دسامبر ۲۰۲۶ مؤثرند؛ نسخه منتشرشده با نسخه لازم‌الاجرا در تاریخ مأموریت فرق دارد."
  },
  {
    id: "IPSAS-HANDBOOK-2026", framework: "PUBLIC_SECTOR_ACCOUNTING", domain: "PUBLIC_SECTOR_FINANCIAL_REPORTING",
    title: "2026 IPSASB Handbook", status: "APPLICABILITY_NOT_AUTOMATIC",
    sourceKind: "PRIMARY_ISSUER", authority: "IPSASB", sourceUrl: "https://www.ipsasb.org/standards-pronouncements",
    verifiedAsOf: DATE,
    note: "مرجع بین‌المللی بخش عمومی است؛ استفاده در ایران فقط پس از احراز مقررات ملی و مبنای حسابداری مجاز است."
  },
  {
    id: "IFRS-S1-S2", framework: "SUSTAINABILITY_DISCLOSURE", domain: "SUSTAINABILITY_DISCLOSURE",
    title: "IFRS S1/S2 — افشاهای مالی مرتبط با پایداری و اقلیم",
    status: "APPLICABILITY_NOT_AUTOMATIC", sourceKind: "PRIMARY_ISSUER", authority: "IFRS Foundation / ISSB",
    sourceUrl: "https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/",
    effectiveFrom: "اثر بین‌المللی از دوره‌های آغازشده در 2024؛ مشروط به پذیرش حوزه قضایی",
    verifiedAsOf: DATE,
    note: "اثر بین‌المللی را نباید خودکار به الزام قانونی ایران یا همه واحدها تعمیم داد."
  },
  {
    id: "IR-IFRS-JURISDICTION-PROFILE", framework: "IRAN_IFRS_ADOPTION_CONTEXT", domain: "JURISDICTION_AND_ADOPTION",
    title: "نمایه استفاده از IFRS در ایران — داده تاریخی نیازمند بازتأیید",
    status: "LEGACY_PROFILE_REQUIRES_REFRESH", sourceKind: "PRIMARY_ISSUER", authority: "IFRS Foundation",
    sourceUrl: "https://www.ifrs.org/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction/iran/",
    verifiedAsOf: DATE,
    note: "صفحه آخرین به‌روزرسانی خود را ۱۵ دسامبر ۲۰۱۶ اعلام می‌کند؛ برای حکم جاری شرکت بورسی، بانک، بیمه یا مؤسسه مالی کافی نیست."
  }
];

const ACCOUNTING_PRINCIPLES = [
  "مبنای تعهدی و تداوم فعالیت، مگر آن‌که مبنای دیگری مستند و لازم باشد.",
  "ارائه منصفانه و رعایت مقررات واقعاً لازم‌الاجرا برای واحد و دوره.",
  "اهمیت و تجمیع مناسب؛ اطلاعات بااهمیت نباید زیر اقلام کم‌اهمیت پنهان شود.",
  "ثبات رویه و قابلیت مقایسه همراه با افشای تغییرات سیاست؛ ثبات به معنی تکرار رویه نامناسب نیست.",
  "قابلیت اتکا، کامل‌بودن، بی‌طرفی، قابلیت ردیابی و سازگاری با شواهد.",
  "محتوای اقتصادی معامله بر شکل ظاهری، در دامنه استاندارد مربوط مقدم است.",
  "عدم تهاتر دارایی/بدهی یا درآمد/هزینه مگر با مجوز مشخص استاندارد.",
  "تفکیک سیاست حسابداری، تغییر برآورد، اصلاح اشتباه و رویداد پس از دوره.",
  "اندازه‌گیری طبق معیار استاندارد مربوط؛ بهای تمام‌شده، ارزش منصفانه، ارزش فعلی یا معیار تخصصی.",
  "افشای قضاوت‌های مهم، عدم‌قطعیت برآورد، اشخاص وابسته، تعهدات و ریسک‌ها.",
  "اگر طبقه‌بندی حساب، منبع، دوره، واحد پول یا شواهد کافی نیست، نتیجه قطعی منتشر نشود."
] as const;

const AUDIT_PRINCIPLES = [
  "حسابرسی مستقل اطمینان معقول فراهم می‌کند، نه اطمینان مطلق.",
  "شک و قضاوت حرفه‌ای در سراسر مأموریت لازم است.",
  "خطر تحریف بااهمیت ناشی از تقلب یا اشتباه در سطح صورت‌ها و ادعاها ارزیابی شود.",
  "اهمیت، شناخت واحد و کنترل داخلی، پاسخ حسابرسی و نمونه‌گیری متناسب با خطر طراحی شود.",
  "شواهد کافی و مناسب، تأییدیه‌ها، روش‌های تحلیلی و مستندسازی قابل بازبینی لازم‌اند.",
  "برآوردها، اشخاص وابسته، رویدادهای بعد از دوره و تداوم فعالیت بررسی شوند.",
  "موضوعات مهم و ضعف‌های کنترل داخلی به‌موقع با ارکان راهبری مطرح شوند.",
  "اظهارنظر حسابرس بر اساس شواهد، تحریف و محدودیت رسیدگی انتخاب شود؛ گزارش از پیش فرض نشود.",
  "مدیریت کیفیت، استقلال، تعارض منافع و صلاحیت تیم پیش از پذیرش و در طول کار بررسی شود.",
  "حسابرسی، بررسی محدود، سایر اطمینان‌بخشی و روش‌های توافقی مأموریت‌های قابل جایگزینی نیستند."
] as const;

const REPORTING_DOMAINS = [
  "ارائه صورت‌های مالی، جریان نقدی، تغییرات حقوق مالکانه، گزارشگری میان‌دوره‌ای و یادداشت‌ها",
  "درآمد قرارداد با مشتری، تعهد عملکردی، قیمت معامله و زمان انتقال کنترل",
  "موجودی، بهای تمام‌شده، دارایی ثابت، استهلاک، دارایی نامشهود و کاهش ارزش",
  "ترکیب و تلفیق واحدهای تجاری، مشارکت، واحد وابسته و بخش‌های عملیاتی",
  "ابزار مالی، طبقه‌بندی و اندازه‌گیری، کاهش ارزش اعتباری، پوشش ریسک و ارزش منصفانه",
  "اجاره‌ها، دارایی حق استفاده و بدهی اجاره",
  "ذخایر، بدهی‌های احتمالی، مزایای کارکنان، مالیات جاری/انتقالی و کمک دولتی",
  "تسعیر ارز، مخارج تأمین مالی، رویدادهای بعد از دوره و اشخاص وابسته",
  "فعالیت کشاورزی، املاک سرمایه‌گذاری، دارایی نگهداری‌شده برای فروش و عملیات متوقف‌شده",
  "سود هر سهم، تداوم فعالیت، سیاست/برآورد/اشتباه و افشاهای بااهمیت",
  "افشای پایداری/اقلیم و اطمینان‌بخشی آن به‌عنوان لایه‌های جداگانه"
] as const;

const GOVERNANCE_RULES = [
  "استانداردهای ایران، IFRS، ISA/IAASB، اخلاق IESBA، IPSAS و افشای پایداری مجموعه‌های مستقل‌اند؛ یکدیگر را خودکار جایگزین نمی‌کنند.",
  "قبل از نتیجه، حوزه قضایی، نوع واحد، نهاد ناظر، بورسی/مالی بودن، صورت مالی جداگانه یا تلفیقی، دوره، صنعت و نوع مأموریت مشخص شود.",
  "وضعیت انتشار، تاریخ اثر، پذیرش محلی، مقررات گذار، جایگزینی و اصلاحیه هر استاندارد جدا ثبت شود.",
  "منبع ثانویه برای کشف تغییر مفید است؛ حکم قطعی به متن مصوب مرجع صلاحیت‌دار نیاز دارد.",
  "نمایه IFRS ایران در snapshot قدیمی است؛ به‌تنهایی مبنای تعیین الزام جاری نیست.",
  "تاریخ‌های گزارش‌شده برای استاندارد ۴۳، ۴۴، تجدیدنظر ۱۵ و افشای اقلیم تا تأیید متن رسمی REVIEW_REQUIRED هستند.",
  "متن کامل دارای حق نشر بازنشر نمی‌شود؛ فراداده، خلاصه کاربردی، کنترل و پیوند منبع نگهداری می‌شود.",
  "نسخه قدیمی، پیش‌نویس یا استاندارد صادرشده اما لازم‌الاجرا نشده به عنوان الزام فعلی معرفی نشود."
] as const;

export class FinancialStandardsKnowledgeService {
  readonly version = "financial-standards-2026-10-10.v1";
  readonly snapshotDate = DATE;

  getCatalogue() {
    return {
      version: this.version,
      snapshotDate: this.snapshotDate,
      decisionPolicy: "CONTEXT_AND_LOCAL_ADOPTION_REQUIRED",
      standardEntries: ENTRIES.map((entry) => ({ ...entry, supersedes: entry.supersedes ? [...entry.supersedes] : undefined })),
      principles: {
        accountingAndReporting: [...ACCOUNTING_PRINCIPLES],
        auditingAndAssurance: [...AUDIT_PRINCIPLES],
        coverageDomains: [...REPORTING_DOMAINS],
        mandatoryGovernanceRules: [...GOVERNANCE_RULES]
      },
      applicabilityRequired: true,
      disclaimer: "این کاتالوگ دانش راهنما و شاخص ارجاع است، نه نظر حقوقی یا اظهارنظر حسابرسی. نتیجه نهایی نیازمند تطبیق متن رسمی لازم‌الاجرا با نوع واحد، دوره، حوزه قضایی و نهاد ناظر است."
    };
  }

  assessIranianApplicability(context: IranianStandardsContext | null | undefined) {
    if (!context || context.jurisdiction?.trim().toUpperCase() !== "IR" ||
        !context.entityType?.trim() ||
        !/^14\d{2}-\d{2}-\d{2}$/.test(context.fiscalYearStartJalali ?? "")) {
      return {
        status: "NEEDS_CONTEXT" as const,
        requiredFields: ["jurisdiction=IR", "entityType", "fiscalYearStartJalali (YYYY-MM-DD in Jalali calendar)"],
        finalDeterminationAllowed: false
      };
    }

    const start = context.fiscalYearStartJalali;
    const candidates = ENTRIES.filter((entry) => {
      if (entry.id === "IR-NAS-43") return start >= "1404-01-01";
      if (entry.id === "IR-NAS-44") return start >= "1405-01-01";
      if (["IR-NAS-15-REVISION-1404", "IR-SDS-2-CLIMATE"].includes(entry.id)) return start >= "1405-01-01";
      if (entry.id === "IR-IFRS-JURISDICTION-PROFILE" &&
          (context.isListed || context.isFinancialInstitution || context.publicInterestEntity)) return true;
      return false;
    }).map(({ id, title, status, effectiveFrom, note, sourceUrl }) =>
      ({ id, title, status, effectiveFrom, note, sourceUrl })
    );

    return {
      status: "REVIEW_REQUIRED" as const,
      jurisdiction: "IR",
      entityType: context.entityType,
      fiscalYearStartJalali: start,
      candidates,
      flags: [
        "فهرست بالا فقط تغییرات/پرچم‌های شناخته‌شده است، نه فهرست کامل استانداردهای واجد شمول.",
        "تاریخ اجرای استانداردهای گزارش‌شده از منابع ثانویه باید با متن رسمی نهایی تطبیق یابد.",
        "برای شرکت بورسی، بانک، بیمه، مؤسسه مالی یا واحد دارای منافع عمومی، مقررات جاری نهاد ناظر و تفاوت صورت‌های مالی جداگانه/تلفیقی بررسی شود.",
        "تا تکمیل منبع رسمی و قواعد شمول، خروجی نهایی و اظهار انطباق مجاز نیست."
      ],
      finalDeterminationAllowed: false
    };
  }
}
