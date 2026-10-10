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

export type IranianStandardLifecycleStatus =
  | "REPORTED_CURRENT"
  | "REPORTED_WITHDRAWN"
  | "REPORTED_MERGED"
  | "REPORTED_SUPERSEDED"
  | "REPORTED_REVISED_EDITION"
  | "REPORTED_EFFECTIVE";

export interface IranianAccountingStandardInventoryEntry {
  readonly id: string;
  readonly number: number;
  readonly edition: string;
  readonly title: string;
  readonly lifecycleStatus: IranianStandardLifecycleStatus;
  readonly lifecycleDate?: string;
  readonly successorOrRelated?: string;
  readonly verificationStatus: "SECONDARY_SNAPSHOT_ONLY" | "PROFESSIONAL_BODY_NOTICE_PRIMARY_TEXT_REQUIRED";
  readonly sourceUrl: string;
  readonly sourceAuthority: string;
  readonly verifiedAsOf: "2026-10-10";
  readonly note: string;
}

const IRAN_LIST_SOURCE = "https://persianacc.ir/لیست-استاندارد-های-حسابداری/";
const IICA_SOURCE = "https://iica.ir/";
const IRAN_LIST_AUTHORITY = "PersianAcc professional secondary index (dated 2024-11-17; not the issuer's authoritative source)";
const IRAN_LIST_VERIFICATION = "SECONDARY_SNAPSHOT_ONLY" as const;
const IRAN_DATE = "2026-10-10" as const;

const IRANIAN_ACCOUNTING_STANDARD_INVENTORY: readonly IranianAccountingStandardInventoryEntry[] = [
  { id:"IR-NAS-01-2017",number:1,edition:"revised 1397",title:"ارائه صورت‌های مالی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه آن را لازم‌الاجرا معرفی می‌کند؛ متن/اصلاحیه جاری باید رسمی کنترل شود." },
  { id:"IR-NAS-02-2017",number:2,edition:"revised 1397",title:"صورت جریان‌های نقدی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"نسخه نهایی و اصلاحیه‌های متعاقب از مرجع رسمی دریافت شود." },
  { id:"IR-NAS-03-OLD",number:3,edition:"edition preceding NAS 43",title:"درآمد عملیاتی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1404-01-01",successorOrRelated:"IR-NAS-43",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"منبع ثانویه کنارگذاری از 1404/01/01 را گزارش می‌کند؛ پیش از نتیجه قطعی، ابلاغ رسمی بررسی شود." },
  { id:"IR-NAS-04-2005",number:4,edition:"revised 1384",title:"ذخایر، بدهی‌های احتمالی و دارایی‌های احتمالی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"وضعیت گزارش‌شده در فهرست ثانویه؛ متن رسمی و اصلاحیه‌ها بررسی شوند." },
  { id:"IR-NAS-05-2005",number:5,edition:"revised 1384",title:"رویدادهای بعد از تاریخ ترازنامه",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"عنوان در منابع جدید ممکن است با عبارت «رویدادهای بعد از دوره گزارشگری» بیان شود؛ متن جاری مرجع است." },
  { id:"IR-NAS-06-OLD",number:6,edition:"historical edition",title:"گزارش عملکرد مالی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1398-01-01",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"منبع ثانویه کنارگذاری از ابتدای 1398 را گزارش می‌کند." },
  { id:"IR-NAS-07",number:7,edition:"historical / merged topic",title:"حسابداری مخارج تحقیق و توسعه",lifecycleStatus:"REPORTED_MERGED",successorOrRelated:"IR-NAS-17",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"منبع ثانویه این موضوع را با استاندارد 17 تلفیق‌شده معرفی می‌کند؛ متن مصوب مرجع کنترل شود." },
  { id:"IR-NAS-08",number:8,edition:"current edition reported",title:"حسابداری موجودی مواد و کالا",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"استانداردهای گزارش‌شده پس از NAS 43 می‌توانند اصلاحات تبعی داشته باشند؛ اصلاحیه‌های جاری کنترل شوند." },
  { id:"IR-NAS-09-OLD",number:9,edition:"historical edition",title:"حسابداری پیمان‌های بلندمدت",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1404-01-01",successorOrRelated:"IR-NAS-43",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"منبع ثانویه کنارگذاری از 1404/01/01 را گزارش می‌کند." },
  { id:"IR-NAS-10",number:10,edition:"current edition reported",title:"حسابداری کمک‌های بلاعوض دولت",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"دامنه و اصلاحیه‌های جاری با متن رسمی کنترل شوند." },
  { id:"IR-NAS-11",number:11,edition:"revised 1386 with later consequential amendments reported",title:"دارایی‌های ثابت مشهود",lifecycleStatus:"REPORTED_REVISED_EDITION",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"اصلاحات تبعی مرتبط با استانداردهای جدید، از جمله درآمد و ابزارهای مالی، باید از متن رسمی تطبیق داده شوند." },
  { id:"IR-NAS-12",number:12,edition:"revised 1386 reported",title:"افشای اطلاعات اشخاص وابسته",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"متن جاری رسمی بررسی شود." },
  { id:"IR-NAS-13",number:13,edition:"current edition reported",title:"حسابداری مخارج تأمین مالی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"دامنه سرمایه‌سازی مخارج تأمین مالی و اصلاحیه‌ها نیازمند متن جاری است." },
  { id:"IR-NAS-14-OLD",number:14,edition:"historical edition",title:"نحوه ارائه دارایی‌های جاری و بدهی‌های جاری",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1398-01-01",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"منبع ثانویه کنارگذاری از ابتدای 1398 را گزارش می‌کند." },
  { id:"IR-NAS-15-BASE",number:15,edition:"legacy/current status needs revision verification",title:"حسابداری سرمایه‌گذاری‌ها",lifecycleStatus:"REPORTED_CURRENT",successorOrRelated:"IR-NAS-15-REVISION-1404",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه قدیمی آن را جاری معرفی می‌کند؛ خبر تجدیدنظر 1404 در منبع ثانویه وجود دارد و متن رسمی لازم است." },
  { id:"IR-NAS-15-REVISION-1404-INVENTORY",number:15,edition:"revision reported in 1404; final text not independently verified",title:"استاندارد 15 ـ سرمایه‌گذاری‌ها (تجدیدنظر گزارش‌شده)",lifecycleStatus:"REPORTED_REVISED_EDITION",lifecycleDate:"1405-01-01 (secondary report only)",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:"https://shahinhesab.com/article/",sourceAuthority:"Secondary professional report; final issuer text not verified in this snapshot",verifiedAsOf:IRAN_DATE,note:"فقط رکورد پیگیری است؛ تا تأیید متن مصوب نباید حکم استانداردی خودکار صادر شود." },
  { id:"IR-NAS-16-OLD",number:16,edition:"revised 1391 / amended 1392 historical edition",title:"آثار تغییر در نرخ ارز ـ نسخه قدیمی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1401-01-01",successorOrRelated:"IR-NAS-16-REV-1400",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه کنارگذاری از 1401/01/01 را ثبت کرده است." },
  { id:"IR-NAS-16-REV-1400",number:16,edition:"revised 1400",title:"آثار تغییر در نرخ ارز ـ تجدیدنظر 1400",lifecycleStatus:"REPORTED_EFFECTIVE",lifecycleDate:"1401-01-01",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"تاریخ لازم‌الاجرا در منبع ثانویه گزارش شده؛ متن رسمی و قواعد گذار کنترل شوند." },
  { id:"IR-NAS-17",number:17,edition:"revised 1386 with later consequential amendments reported",title:"دارایی‌های نامشهود",lifecycleStatus:"REPORTED_REVISED_EDITION",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"موضوع تحقیق و توسعه استاندارد قدیمی 7 نیز به این دامنه مرتبط است؛ متن نهایی کنترل شود." },
  { id:"IR-NAS-18-CONSOLIDATED-OLD",number:18,edition:"revised 1384 / amended 1389 historical edition",title:"صورت‌های مالی تلفیقی و حسابداری سرمایه‌گذاری در واحدهای تجاری فرعی ـ نسخه قدیمی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1400-01-01",successorOrRelated:"IR-NAS-39",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه کنارگذاری از 1400/01/01 را گزارش می‌کند." },
  { id:"IR-NAS-18-SEPARATE-1398",number:18,edition:"revised 1398",title:"صورت‌های مالی جداگانه",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"نسخه جداگانه را با نسخه تاریخی شماره 18 مربوط به تلفیق خلط نکنید." },
  { id:"IR-NAS-19-OLD",number:19,edition:"revised 1384 historical edition",title:"ترکیب‌های تجاری ـ نسخه قدیمی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1400-01-01",successorOrRelated:"IR-NAS-38",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه کنارگذاری از 1400/01/01 را گزارش می‌کند." },
  { id:"IR-NAS-20-OLD",number:20,edition:"revised 1389 historical edition",title:"سرمایه‌گذاری در واحدهای تجاری وابسته ـ نسخه قدیمی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1400-01-01",successorOrRelated:"IR-NAS-20-REV-1398",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه کنارگذاری از 1400/01/01 را گزارش می‌کند." },
  { id:"IR-NAS-20-REV-1398",number:20,edition:"revised 1398",title:"سرمایه‌گذاری در واحدهای تجاری وابسته و مشارکت‌های خاص",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"عنوان دقیق در متن مصوب رسمی کنترل شود." },
  { id:"IR-NAS-21-OLD",number:21,edition:"legacy lease accounting",title:"حسابداری اجاره‌ها ـ نسخه پیش از استاندارد 44",lifecycleStatus:"REPORTED_SUPERSEDED",lifecycleDate:"1405-01-01",successorOrRelated:"IR-NAS-44",verificationStatus:"PROFESSIONAL_BODY_NOTICE_PRIMARY_TEXT_REQUIRED",sourceUrl:IICA_SOURCE,sourceAuthority:"Iranian professional-body notice; official final text required",verifiedAsOf:IRAN_DATE,note:"اعلام حرفه‌ای از جایگزینی توسط استاندارد 44 از ابتدای 1405 حکایت دارد؛ ابلاغ رسمی لازم است." },
  { id:"IR-NAS-22-OLD",number:22,edition:"legacy interim reporting edition",title:"گزارشگری مالی میان‌دوره‌ای ـ نسخه قدیمی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1400-07-01",successorOrRelated:"IR-NAS-22-REV-1400",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه کنارگذاری از 1400/07/01 را گزارش می‌کند." },
  { id:"IR-NAS-22-REV-1400",number:22,edition:"revised 1400",title:"گزارشگری مالی میان‌دوره‌ای ـ تجدیدنظر 1400",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"نسخه جدید و نسخه تاریخی شماره 22 باید در دامنه زمانی درست اعمال شوند." },
  { id:"IR-NAS-23-OLD",number:23,edition:"legacy joint venture accounting",title:"حسابداری مشارکت‌های خاص ـ نسخه قدیمی",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1400-01-01",successorOrRelated:"IR-NAS-40",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"فهرست ثانویه کنارگذاری از 1400/01/01 را گزارش می‌کند." },
  { id:"IR-NAS-24",number:24,edition:"current edition reported",title:"گزارشگری مالی واحدهای تجاری در مرحله قبل از بهره‌برداری",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"محدوده شمول و هر جایگزینی احتمالی به متن رسمی وابسته است." },
  { id:"IR-NAS-25",number:25,edition:"current edition reported",title:"گزارشگری بر حسب قسمت‌های مختلف",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"اصطلاحات و الزامات افشا را از متن لازم‌الاجرا کنترل کنید." },
  { id:"IR-NAS-26",number:26,edition:"current edition reported",title:"فعالیت‌های کشاورزی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"استاندارد تخصصی؛ شرایط شمول و معیار اندازه‌گیری با متن رسمی کنترل شود." },
  { id:"IR-NAS-27",number:27,edition:"current edition reported",title:"طرح‌های مزایای بازنشستگی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"موضوع طرح‌های مزایای بازنشستگی با مزایای کارکنان در NAS 33 متفاوت است." },
  { id:"IR-NAS-28",number:28,edition:"current edition reported",title:"فعالیت‌های بیمه عمومی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"مقررات تخصصی بیمه و الزامات نهاد ناظر نیز باید سنجیده شوند." },
  { id:"IR-NAS-29-OLD",number:29,edition:"legacy property construction activities",title:"فعالیت‌های ساخت املاک",lifecycleStatus:"REPORTED_WITHDRAWN",lifecycleDate:"1404-01-01",successorOrRelated:"IR-NAS-43",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"منبع ثانویه کنارگذاری از 1404/01/01 را گزارش می‌کند." },
  { id:"IR-NAS-30",number:30,edition:"current edition reported",title:"سود هر سهم",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"روش محاسبه سود پایه/تقلیل‌یافته و افشا را از متن جاری کنترل کنید." },
  { id:"IR-NAS-31",number:31,edition:"current edition reported",title:"دارایی‌های غیرجاری نگهداری‌شده برای فروش و عملیات متوقف‌شده",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"شرایط طبقه‌بندی، اندازه‌گیری و ارائه با متن مصوب کنترل شود." },
  { id:"IR-NAS-32",number:32,edition:"current edition reported",title:"کاهش ارزش دارایی‌ها",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"نشانه‌های کاهش ارزش، مبلغ بازیافتنی و واحد مولد وجه نقد حوزه‌های اصلی‌اند." },
  { id:"IR-NAS-33",number:33,edition:"current edition reported",title:"مزایای بازنشستگی کارکنان",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"تعهدات مزایای کارکنان را با استاندارد 27 درباره طرح‌ها خلط نکنید." },
  { id:"IR-NAS-34",number:34,edition:"current edition reported",title:"رویه‌های حسابداری، تغییر در برآوردهای حسابداری و اشتباهات",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"تفکیک تغییر سیاست، تغییر برآورد و اصلاح اشتباه اهمیت دارد." },
  { id:"IR-NAS-35",number:35,edition:"current edition reported; later amendments need review",title:"مالیات بر درآمد",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"تفاوت سود حسابداری و مالیاتی، مالیات انتقالی و اصلاحیه‌ها بررسی شوند." },
  { id:"IR-NAS-36",number:36,edition:"current edition reported; later amendments need review",title:"ابزارهای مالی ـ ارائه",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"طبقه‌بندی بدهی/حقوق مالکانه، تهاتر و سود/زیان جامع طبق متن لازم‌الاجرا بررسی شوند." },
  { id:"IR-NAS-37",number:37,edition:"current edition reported",title:"ابزارهای مالی ـ افشا",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"افشاهای ریسک اعتباری، نقدینگی و بازار و مدیریت ریسک نیازمند داده پشتیبان‌اند." },
  { id:"IR-NAS-38-1398",number:38,edition:"approved 1398",title:"ترکیب‌های تجاری",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"روش تحصیل، شناسایی دارایی و بدهی قابل تشخیص و سرقفلی از محورهای کلیدی‌اند." },
  { id:"IR-NAS-39-1398",number:39,edition:"approved 1398",title:"صورت‌های مالی تلفیقی",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"کنترل، دامنه تلفیق، منافع فاقد کنترل و تاریخ‌های تحصیل/واگذاری بررسی شوند." },
  { id:"IR-NAS-40-1398",number:40,edition:"approved 1398",title:"مشارکت‌ها",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"تمایز عملیات مشترک از مشارکت خاص باید با حقوق و تعهدات طرفین سنجیده شود." },
  { id:"IR-NAS-41-1398",number:41,edition:"approved 1398",title:"افشای منافع در واحدهای تجاری دیگر",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"نوع منافع، کنترل، نفوذ قابل ملاحظه و ماهیت ریسک‌ها افشا شوند." },
  { id:"IR-NAS-42",number:42,edition:"current edition reported",title:"اندازه‌گیری ارزش منصفانه",lifecycleStatus:"REPORTED_CURRENT",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"تکنیک‌های ارزش‌گذاری، ورودی‌ها و سلسله‌مراتب ارزش منصفانه باید مستند شوند." },
  { id:"IR-NAS-43",number:43,edition:"reported effective from 1404-01-01",title:"درآمد عملیاتی حاصل از قرارداد با مشتریان",lifecycleStatus:"REPORTED_EFFECTIVE",lifecycleDate:"1404-01-01",successorOrRelated:"Replaces reported scope of NAS 3, 9 and 29",verificationStatus:IRAN_LIST_VERIFICATION,sourceUrl:IRAN_LIST_SOURCE,sourceAuthority:IRAN_LIST_AUTHORITY,verifiedAsOf:IRAN_DATE,note:"منبع ثانویه تاریخ اجرا و کنارگذاری 3/9/29 را گزارش می‌کند؛ تاریخ رسمی باید از متن ابلاغی تأیید شود." },
  { id:"IR-NAS-44",number:44,edition:"reported effective from 1405-01-01",title:"اجاره‌ها",lifecycleStatus:"REPORTED_EFFECTIVE",lifecycleDate:"1405-01-01",successorOrRelated:"Replaces reported scope of NAS 21",verificationStatus:"PROFESSIONAL_BODY_NOTICE_PRIMARY_TEXT_REQUIRED",sourceUrl:IICA_SOURCE,sourceAuthority:"Iranian professional-body notice; official final text and adoption notice remain required",verifiedAsOf:IRAN_DATE,note:"منابع حرفه‌ای اعلام اجرا از ابتدای 1405 می‌کنند؛ متن نهایی و دامنه گذار را از مرجع رسمی تطبیق دهید." }
];


const IRANIAN_AUDIT_STANDARD_SOURCE = "https://persianacc.ir/استانداردهای-حسابرسی/";
const IRANIAN_AUDIT_STANDARD_AUTHORITY = "PersianAcc professional secondary index (dated 2024-11-18; current official revisions must be confirmed)";
const IRANIAN_AUDIT_STANDARD_INVENTORY = [
  {id:"IR-AUD-QUALITY-01",number:"1",title:"کنترل کیفیت در مؤسسات ارائه‌کننده خدمات حسابرسی، سایر خدمات اطمینان‌بخشی و خدمات مرتبط",reportedEdition:"legacy local quality-control standard; currentness review required",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"با ISQM 1/2، ISA 220 (Revised) و پذیرش محلی جدید تطبیق شود؛ این رکورد ادعای جاری‌بودن متن قدیمی را نمی‌کند."},
  {id:"IR-ISA-200",number:"200",title:"اهداف کلی حسابرس مستقل و انجام حسابرسی طبق استانداردهای حسابرسی",reportedEdition:"revised 1391 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"نسخه لازم‌الاجرا و اصلاحات بعد از 1391 از مرجع رسمی کنترل شود."},
  {id:"IR-ISA-210",number:"210",title:"توافق در خصوص شرایط کار حسابرسی",reportedEdition:"revised 1401 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"پذیرش کار و توافق شرایط باید با نسخه جاری مرجع رسمی تطبیق داده شود."},
  {id:"IR-ISA-220-OLD",number:"220",title:"کنترل کیفیت حسابرسی اطلاعات مالی تاریخی",reportedEdition:"revised 1386 per secondary index; latestness unverified",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"به‌علت تحولات مدیریت کیفیت بین‌المللی، این نسخه قدیمی بدون تطبیق رسمی نباید به‌عنوان نسخه جاری فرض شود."},
  {id:"IR-ISA-230",number:"230",title:"مستندات حسابرسی",reportedEdition:"revised 1395 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"مستندات باید به‌اندازه‌ای باشد که حسابرس باتجربه مستقل بتواند ماهیت، زمان‌بندی، دامنه و نتیجه کار را درک کند؛ متن محلی جاری کنترل شود."},
  {id:"IR-ISA-240",number:"240",title:"مسئولیت حسابرس در ارتباط با تقلب در حسابرسی صورت‌های مالی",reportedEdition:"revised 1394 per secondary index; global ISA 240 Revised effective date differs",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"نسخه محلی و پذیرش بازنگری بین‌المللی ISA 240 (Revised) را جداگانه کنترل کنید."},
  {id:"IR-ISA-250",number:"250",title:"ارزیابی رعایت قوانین و مقررات در حسابرسی صورت‌های مالی",reportedEdition:"revised 1394 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"قوانین با اثر مستقیم بر مبالغ/افشا و سایر قوانین با اثر بر عملیات تفکیک و مستند شوند."},
  {id:"IR-ISA-260",number:"260",title:"اطلاع‌رسانی به ارکان راهبری",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"الزامات ارتباط با ارکان راهبری و پذیرش محلی با متن مصوب جاری تطبیق داده شود."},
  {id:"IR-ISA-265",number:"265",title:"اطلاع‌رسانی ضعف‌های کنترل داخلی به ارکان راهبری و مدیران اجرایی",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"ضعف‌های بااهمیت و مهم باید بر اساس معیار حرفه‌ای و شواهد مستند شوند."},
  {id:"IR-ISA-300",number:"300",title:"برنامه‌ریزی حسابرسی صورت‌های مالی",reportedEdition:"revised 1392 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"برنامه حسابرسی، راهبرد کلی، منابع، زمان‌بندی و برنامه‌های رسیدگی باید مستند شوند."},
  {id:"IR-ISA-315",number:"315",title:"تشخیص و ارزیابی خطرهای تحریف بااهمیت از طریق شناخت واحد تجاری و محیط آن",reportedEdition:"revised 1393 per secondary index; global 2019 revision exists",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"آخرین نسخه قابل اعمال محلی باید با ISA 315 (Revised 2019) و پذیرش رسمی مقایسه شود."},
  {id:"IR-ISA-320",number:"320",title:"اهمیت در برنامه‌ریزی و اجرای عملیات حسابرسی",reportedEdition:"revised 1392 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"اهمیت صورت‌های مالی، اهمیت اجرای کار و بازنگری اهمیت در طول مأموریت مستند شوند."},
  {id:"IR-ISA-330",number:"330",title:"برخوردهای حسابرس با خطرهای ارزیابی‌شده",reportedEdition:"revised 1393 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"آزمون کنترل‌ها و روش‌های محتوایی باید به خطر ارزیابی‌شده پیوند داشته باشد."},
  {id:"IR-ISA-450",number:"450",title:"ارزیابی تحریف‌های شناسایی‌شده در حسابرسی",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"تحریف‌های اصلاح‌شده و اصلاح‌نشده تجمیع و اثر آنها بر اظهارنظر سنجیده شود."},
  {id:"IR-ISA-500",number:"500",title:"شواهد حسابرسی",reportedEdition:"revised 1395 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"کفایت به کمیت و مناسب‌بودن به کیفیت/ارتباط/اتکاپذیری شواهد مربوط است."},
  {id:"IR-ISA-501",number:"501",title:"شواهد حسابرسی ـ ملاحظات خاص درباره برخی اقلام",reportedEdition:"revised 1395 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"موجودی، دعاوی و ادعاها، و اطلاعات بخش‌ها از موارد ویژه‌ای هستند که نسخه قابل اعمال باید تعیین کند."},
  {id:"IR-ISA-505",number:"505",title:"تأییدیه‌های برون‌سازمانی",reportedEdition:"revised 1392 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"کنترل ارسال/دریافت مستقیم تأییدیه و پیگیری عدم پاسخ مهم است."},
  {id:"IR-ISA-510",number:"510",title:"حسابرسی نخستین ـ مانده‌های اول دوره",reportedEdition:"revised 1395 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"مانده‌های اول دوره، رویه‌های حسابداری و اثر احتمالی بر اظهارنظر کنترل شوند."},
  {id:"IR-ISA-520",number:"520",title:"روش‌های تحلیلی",reportedEdition:"revised 1395 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"انتظار حسابرس، دقت داده و آستانه بررسی مغایرت‌ها باید مستند باشد."},
  {id:"IR-ISA-530",number:"530",title:"نمونه‌گیری در حسابرسی",reportedEdition:"revised 1395 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"ریسک نمونه‌گیری، روش انتخاب و ارزیابی نتایج باید متناسب با هدف رسیدگی باشد."},
  {id:"IR-ISA-540",number:"540",title:"حسابرسی برآوردهای حسابداری، شامل ارزش منصفانه و افشاهای مرتبط",reportedEdition:"revised 1392 per secondary index; global ISA 540 revision exists",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"تطبیق نسخه رسمی ایران با ISA 540 (Revised) ضروری است؛ مدل/داده/فرض‌های برآورد باید بررسی شوند."},
  {id:"IR-ISA-550",number:"550",title:"اشخاص وابسته",reportedEdition:"revised 1389 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"شناسایی اشخاص وابسته و معاملات خارج از روال عادی نیازمند شک حرفه‌ای است."},
  {id:"IR-ISA-560",number:"560",title:"رویدادهای پس از تاریخ صورت‌های مالی",reportedEdition:"revised 1396 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"رویدادهای تعدیلی/غیرتعدیلی و تاریخ گزارش حسابرس باید مطابق متن مصوب تعیین شود."},
  {id:"IR-ISA-570",number:"570",title:"تداوم فعالیت",reportedEdition:"revised 1401 per secondary index; global ISA 570 Revised 2024 not yet effective at snapshot",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"نسخه محلی موجود و تاریخ اجرای ISA 570 (Revised 2024) را یکی نگیرید؛ منابع مالی، پیش‌بینی نقد، تعهدات و افشای تردید عمده بررسی شوند."},
  {id:"IR-ISA-580",number:"580",title:"تأییدیه کتبی مدیران",reportedEdition:"revised 1396 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"تأییدیه مدیریت مکمل شواهد حسابرسی است و جایگزین شواهد دیگر نمی‌شود."},
  {id:"IR-ISA-600",number:"600",title:"ملاحظات خاص در حسابرسی صورت‌های مالی گروه، شامل کار حسابرسان بخش",reportedEdition:"revised 1389 per secondary index; global ISA 600 Revised differs",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"نقش حسابرس گروه، کار حسابرسان اجزاء و مسؤولیت گزارشگری باید با نسخه محلی و پذیرش جدیدترین نسخه تطبیق یابد."},
  {id:"IR-ISA-610",number:"610",title:"استفاده از کار حسابرسان داخلی",reportedEdition:"revised 1397 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"بی‌طرفی، صلاحیت، رویکرد نظام‌مند و محدودیت اتکا بررسی شوند."},
  {id:"IR-ISA-620",number:"620",title:"استفاده از کارشناس حسابرس",reportedEdition:"revised 1398 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"صلاحیت، توانایی، بی‌طرفی و کفایت کار کارشناس سنجیده شود."},
  {id:"IR-ISA-700",number:"700",title:"اظهارنظر و گزارشگری نسبت به صورت‌های مالی",reportedEdition:"revised 1401 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"ساختار گزارش و اظهارنظر باید بر اساس شواهد و نسخه جاری محلی تعیین شود."},
  {id:"IR-ISA-701",number:"701",title:"اطلاع‌رسانی مسائل عمده حسابرسی در گزارش حسابرس مستقل",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"دامنه شمول الزام KAM و استثناها باید در مقررات ایران برای واحد مربوط بررسی شود."},
  {id:"IR-ISA-705",number:"705",title:"اظهارنظرهای تعدیل‌شده در گزارش حسابرس مستقل",reportedEdition:"revised 1401 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"مشروط، مردود و عدم اظهارنظر بر مبنای ماهیت و فراگیری آثار تعیین می‌شوند."},
  {id:"IR-ISA-706",number:"706",title:"بندهای تأکید بر مطلب خاص و سایر بندهای توضیحی",reportedEdition:"revised 1401 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"بند تأکید مطلب جایگزین اظهارنظر تعدیل‌شده نیست."},
  {id:"IR-ISA-710",number:"710",title:"اطلاعات مقایسه‌ای",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"ارقام مقایسه‌ای و صورت‌های مالی مقایسه‌ای بر اساس چارچوب گزارشگری قابل اعمال تفکیک شوند."},
  {id:"IR-ISA-720",number:"720",title:"مسئولیت‌های حسابرس در قبال سایر اطلاعات",reportedEdition:"revised 1401 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"رسیدگی به سایر اطلاعات به معنای اظهارنظر حسابرسی بر کل گزارش سالانه نیست."},
  {id:"IR-ISA-800",number:"800",title:"ملاحظات خاص در حسابرسی صورت‌های مالی تهیه‌شده بر اساس چارچوب‌های با مقاصد خاص",reportedEdition:"revised 1390 per secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"مناسب بودن چارچوب و توضیح هدف استفاده‌کنندگان باید سنجیده شود."},
  {id:"IR-ISA-805",number:"805",title:"ملاحظات خاص در حسابرسی یک صورت مالی یا اجزای یک صورت مالی",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"اهمیت و روش‌ها باید متناسب با صورت/عنصر مورد رسیدگی باشند."},
  {id:"IR-ISRE-2400",number:"2400",title:"بررسی اجمالی صورت‌های مالی",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"بررسی اجمالی با حسابرسی فرق دارد و سطح اطمینان آن محدود است."},
  {id:"IR-ISRE-2410",number:"2410",title:"بررسی اجمالی اطلاعات مالی میان‌دوره‌ای توسط حسابرس مستقل واحد تجاری",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"دامنه مأموریت، پرس‌وجوها و روش‌های تحلیلی با حسابرسی کامل برابر نیست."},
  {id:"IR-ISAE-3400",number:"3400",title:"رسیدگی به اطلاعات مالی آتی",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"فرض‌های بهترین برآورد و فرضی از هم متمایز شوند؛ نوع نتیجه و محدودیت استفاده صریح باشد."},
  {id:"IR-ISRS-4400",number:"4400",title:"اجرای روش‌های توافقی رسیدگی به اطلاعات مالی",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"یافته‌های واقعی گزارش می‌شوند؛ اطمینان‌بخشی و اظهارنظر حسابرسی نباید القا شود."},
  {id:"IR-ISRS-4410",number:"4410",title:"تنظیم اطلاعات مالی",reportedEdition:"edition/date not displayed in secondary index",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:IRANIAN_AUDIT_STANDARD_SOURCE,sourceAuthority:IRANIAN_AUDIT_STANDARD_AUTHORITY,verifiedAsOf:DATE,note:"خدمت تنظیم/Compilation جایگزین حسابرسی یا بررسی اجمالی نیست."}
] as const;

const IRANIAN_OPERATIONAL_AUDIT_INVENTORY = [
  {id:"IR-OPA-01",number:"1",title:"استانداردهای حسابرسی عملیاتی ـ اصول و ضوابط حسابداری و حسابرسی",reportedEdition:"source notes localized adaptation of GAGAS sections 1–3, 7 and 8 from 2007 edition; local update status unverified",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:"https://persianacc.ir/اصول-و-ضوابط-حسابداری-و-حسابرسی/",sourceAuthority:"PersianAcc reproduction of a document attributed to Iran Audit Organization; primary current approval remains to be verified",verifiedAsOf:DATE,note:"Requirements are distinguished from explanatory guidance in the source, but current formal adoption and any later amendments need official review."}
] as const;

const IRANIAN_PUBLIC_SECTOR_STANDARD_SOURCE = "https://persianacc.ir/استاندارد-های-حسابداری-بخش-عمومی/";
const IRANIAN_PUBLIC_SECTOR_INVENTORY = [
  {id:"IR-PSAS-01",number:1,title:"نحوه ارائه صورت‌های مالی"},
  {id:"IR-PSAS-02",number:2,title:"نحوه ارائه اطلاعات بودجه‌ای در صورت‌های مالی"},
  {id:"IR-PSAS-03",number:3,title:"درآمد حاصل از عملیات غیرمبادله‌ای (مالیات و انتقالات)"},
  {id:"IR-PSAS-04",number:4,title:"درآمدهای حاصل از عملیات مبادله‌ای"},
  {id:"IR-PSAS-05",number:5,title:"دارایی‌های ثابت مشهود"},
  {id:"IR-PSAS-06",number:6,title:"موجودی‌ها"},
  {id:"IR-PSAS-07",number:7,title:"دارایی‌های نامشهود"},
  {id:"IR-PSAS-08",number:8,title:"ذخایر، بدهی‌های احتمالی و دارایی‌های احتمالی"},
  {id:"IR-PSAS-09",number:9,title:"حسابداری مخارج تأمین مالی"},
  {id:"IR-PSAS-10",number:10,title:"رویه‌های حسابداری، تغییر در برآوردهای حسابداری و اشتباهات"},
  {id:"IR-PSAS-11",number:11,title:"افشای اطلاعات اشخاص وابسته"},
  {id:"IR-PSAS-12",number:12,title:"مزایای بازنشستگی کارکنان"},
  {id:"IR-PSAS-13",number:13,title:"آثار تغییر در نرخ تبدیل ارز"},
  {id:"IR-PSAS-14",number:14,title:"رویدادهای پس از تاریخ گزارشگری"},
  {id:"IR-PSAS-15",number:15,title:"صورت‌های مالی تلفیقی"},
  {id:"IR-PSAS-16",number:16,title:"سرمایه‌گذاری در واحدهای وابسته و مشارکت‌های خاص"},
  {id:"IR-PSAS-17",number:17,title:"ترکیب‌های بخش عمومی"},
  {id:"IR-PSAS-18",number:18,title:"صورت‌های مالی جداگانه"},
  {id:"IR-PSAS-19",number:19,title:"صورت جریان‌های نقدی"},
  {id:"IR-PSAS-20",number:20,title:"افشای منافع در واحدهای دیگر"}
].map((entry) => ({
  ...entry,
  framework:"IRAN_PUBLIC_SECTOR_ACCOUNTING_STANDARDS",
  lifecycleStatus:"REPORTED_IN_SECONDARY_INDEX",
  verificationStatus:"SECONDARY_SNAPSHOT_ONLY",
  sourceUrl:IRANIAN_PUBLIC_SECTOR_STANDARD_SOURCE,
  sourceAuthority:"PersianAcc secondary index (dated 2024-11-17; official approved catalogue must be verified)",
  verifiedAsOf:DATE,
  note:"برای کاربرد در واحد ایرانی، نسخه و اصلاحیه مصوب و دامنه شمول را از متن رسمی جاری دریافت کنید؛ این رکورد به‌تنهایی اثبات‌کننده لازم‌الاجرا بودن نیست."
}));

const IRANIAN_SUSTAINABILITY_DISCLOSURE_INVENTORY = [
  {id:"IR-SDS-01",number:1,title:"الزامات کلی افشای اطلاعات مالی مرتبط با پایداری",status:"REPORTED_IN_SECONDARY_INDEX",verificationStatus:"SECONDARY_SNAPSHOT_ONLY",sourceUrl:"https://persianacc.ir/disclosure-standards/",sourceAuthority:"PersianAcc secondary index dated 2024-11-17",verifiedAsOf:DATE,note:"متن مصوب، دامنه شمول، تاریخ لازم‌الاجرا و سازوکار پذیرش باید از مرجع رسمی تأیید شوند."},
  {id:"IR-SDS-02-CLIMATE",number:2,title:"اطلاعات افشای مالی مرتبط با پایداری ـ اقلیم (گزارش‌شده در منابع حرفه‌ای)",status:"REPORTED_EFFECTIVE_PRIMARY_CONFIRMATION_REQUIRED",verificationStatus:"SECONDARY_REFERENCE_REQUIRES_PRIMARY_CONFIRMATION",sourceUrl:"https://shahinhesab.com/article/",sourceAuthority:"Secondary professional report; official scope/effective date not verified",verifiedAsOf:DATE,note:"رکورد پیگیری است و تا تأیید متن نهایی نباید به عنوان الزام قطعی واحد خاص اعمال شود."}
] as const;

const INTERNATIONAL_AUDIT_STANDARD_INDEX = [
  {group:"Quality management",identifiers:["ISQM 1","ISQM 2","ISA 220 (Revised)"],note:"Quality management at firm and engagement levels; adoption and effective dates remain jurisdiction-specific."},
  {group:"General principles and responsibilities",identifiers:["ISA 200","ISA 210","ISA 220","ISA 230","ISA 240","ISA 250","ISA 260","ISA 265"],note:"Overall objectives, engagement terms, quality, documentation, fraud, laws/regulations, governance communication and control deficiencies."},
  {group:"Risk assessment and response",identifiers:["ISA 300","ISA 315 (Revised 2019)","ISA 320","ISA 330","ISA 402","ISA 450"],note:"Planning, risk identification, materiality, responses to assessed risks, service organizations and misstatements."},
  {group:"Audit evidence",identifiers:["ISA 500","ISA 501","ISA 505","ISA 510","ISA 520","ISA 530","ISA 540 (Revised)","ISA 550","ISA 560","ISA 570","ISA 580"],note:"Evidence, specific items, external confirmations, opening balances, analytical procedures, sampling, estimates, related parties, subsequent events, going concern and written representations."},
  {group:"Using work of others",identifiers:["ISA 600 (Revised)","ISA 610 (Revised)","ISA 620"],note:"Group audits, internal auditors and auditor's experts."},
  {group:"Audit conclusions and reporting",identifiers:["ISA 700 (Revised)","ISA 701","ISA 705 (Revised)","ISA 706 (Revised)","ISA 710","ISA 720 (Revised)"],note:"Opinion formation, key audit matters, modified opinions, emphasis/other matter, comparatives and other information."},
  {group:"Specialized audits",identifiers:["ISA 800 (Revised)","ISA 805 (Revised)","ISA 810 (Revised)"],note:"Special-purpose frameworks, single statements/specific elements and summary financial statements."},
  {group:"Less complex entities",identifiers:["ISA for LCE"],note:"Separate stand-alone standard; eligibility restrictions and adoption must be checked."},
  {group:"Review engagements",identifiers:["ISRE 2400 (Revised)","ISRE 2410"],note:"Review of historical financial statements and interim information."},
  {group:"Other assurance engagements",identifiers:["ISAE 3000 (Revised)","ISAE 3400","ISAE 3402","ISAE 3410","ISAE 3420"],note:"Assurance other than audit/review of historical information, prospective information, controls at service organizations, greenhouse gases and pro forma financial information."},
  {group:"Related services",identifiers:["ISRS 4400 (Revised)","ISRS 4410 (Revised)"],note:"Agreed-upon procedures and compilation engagements; these are not audits and must not be reported as audit opinions."},
  {group:"Sustainability assurance",identifiers:["ISSA 5000"],note:"General requirements for sustainability assurance; IAASB indicates effectiveness in December 2026, subject to exact transition wording and local adoption."},
  {group:"Practice notes and frameworks",identifiers:["IAPNs","IAASB Framework for Assurance Engagements","IAASB Framework for Audit Quality"],note:"Guidance/framework materials are not automatically equivalent to mandatory requirements of an individual ISA."}
] as const;

const INTERNATIONAL_ACCOUNTING_STANDARD_INDEX = [
  {id:"IFRS 1",title:"First-time Adoption of International Financial Reporting Standards",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 2",title:"Share-based Payment",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 3",title:"Business Combinations",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 4",title:"Insurance Contracts",status:"SUPERSEDED_FOR_MAIN_SCOPE_BY_IFRS_17"},
  {id:"IFRS 5",title:"Non-current Assets Held for Sale and Discontinued Operations",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 6",title:"Exploration for and Evaluation of Mineral Resources",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 7",title:"Financial Instruments: Disclosures",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 8",title:"Operating Segments",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 9",title:"Financial Instruments",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 10",title:"Consolidated Financial Statements",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 11",title:"Joint Arrangements",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 12",title:"Disclosure of Interests in Other Entities",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 13",title:"Fair Value Measurement",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 14",title:"Regulatory Deferral Accounts",status:"LIMITED_ELIGIBILITY_REQUIRES_CONTEXT"},
  {id:"IFRS 15",title:"Revenue from Contracts with Customers",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 16",title:"Leases",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 17",title:"Insurance Contracts",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IFRS 18",title:"Presentation and Disclosure in Financial Statements",status:"ISSUED_NOT_YET_EFFECTIVE"},
  {id:"IFRS 19",title:"Subsidiaries without Public Accountability: Disclosures",status:"ISSUED_NOT_YET_EFFECTIVE"},
  {id:"IAS 1",title:"Presentation of Financial Statements",status:"CURRENT_UNTIL_IFRS_18_EFFECTIVE_FOR_APPLICABLE_PERIOD"},
  {id:"IAS 2",title:"Inventories",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 7",title:"Statement of Cash Flows",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 8",title:"Accounting Policies, Changes in Accounting Estimates and Errors; presentation basis changes with IFRS 18",status:"CURRENT_WITH_TRANSITION_UPDATE_REQUIRES_CONTEXT"},
  {id:"IAS 10",title:"Events after the Reporting Period",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 12",title:"Income Taxes",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 16",title:"Property, Plant and Equipment",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 19",title:"Employee Benefits",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 20",title:"Accounting for Government Grants and Disclosure of Government Assistance",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 21",title:"The Effects of Changes in Foreign Exchange Rates",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 23",title:"Borrowing Costs",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 24",title:"Related Party Disclosures",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 26",title:"Accounting and Reporting by Retirement Benefit Plans",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 27",title:"Separate Financial Statements",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 28",title:"Investments in Associates and Joint Ventures",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 29",title:"Financial Reporting in Hyperinflationary Economies",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 32",title:"Financial Instruments: Presentation",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 33",title:"Earnings per Share",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 34",title:"Interim Financial Reporting",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 36",title:"Impairment of Assets",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 37",title:"Provisions, Contingent Liabilities and Contingent Assets",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 38",title:"Intangible Assets",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 39",title:"Financial Instruments: Recognition and Measurement",status:"PARTIALLY_SUPERSEDED_REQUIRES_HEDGE_ACCOUNTING_SCOPE_CHECK"},
  {id:"IAS 40",title:"Investment Property",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 41",title:"Agriculture",status:"CURRENT_SCOPE_REQUIRES_CONTEXT"},
  {id:"IAS 11",title:"Construction Contracts",status:"SUPERSEDED_FOR_MAIN_SCOPE_BY_IFRS_15"},
  {id:"IAS 14",title:"Segment Reporting",status:"SUPERSEDED_FOR_MAIN_SCOPE_BY_IFRS_8"},
  {id:"IAS 17",title:"Leases",status:"SUPERSEDED_FOR_MAIN_SCOPE_BY_IFRS_16"},
  {id:"IAS 18",title:"Revenue",status:"SUPERSEDED_FOR_MAIN_SCOPE_BY_IFRS_15"},
  {id:"IAS 22",title:"Business Combinations",status:"SUPERSEDED_BY_IFRS_3"},
  {id:"IAS 30",title:"Disclosures in the Financial Statements of Banks and Similar Financial Institutions",status:"SUPERSEDED_BY_IFRS_7"},
  {id:"IAS 31",title:"Interests in Joint Ventures",status:"SUPERSEDED_FOR_MAIN_SCOPE_BY_IFRS_11"},
  {id:"IAS 35",title:"Discontinuing Operations",status:"SUPERSEDED_BY_IFRS_5"}
] as const;

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
  readonly version = "financial-standards-2026-10-10.v3";
  readonly snapshotDate = DATE;

  getCatalogue() {
    return {
      version: this.version,
      snapshotDate: this.snapshotDate,
      decisionPolicy: "CONTEXT_AND_LOCAL_ADOPTION_REQUIRED",
      standardEntries: ENTRIES.map((entry) => ({ ...entry, supersedes: entry.supersedes ? [...entry.supersedes] : undefined })),
      iranianNationalStandardInventory: IRANIAN_ACCOUNTING_STANDARD_INVENTORY.map((entry) => ({ ...entry })),
      internationalAccountingStandardIndex: INTERNATIONAL_ACCOUNTING_STANDARD_INDEX.map((entry) => ({ ...entry })),
      internationalAuditStandardIndex: INTERNATIONAL_AUDIT_STANDARD_INDEX.map((entry) => ({ ...entry, identifiers: [...entry.identifiers] })),
      iranianAuditingStandardInventory: IRANIAN_AUDIT_STANDARD_INVENTORY.map((entry) => ({ ...entry })),
      iranianOperationalAuditInventory: IRANIAN_OPERATIONAL_AUDIT_INVENTORY.map((entry) => ({ ...entry })),
      iranianPublicSectorStandardInventory: IRANIAN_PUBLIC_SECTOR_INVENTORY.map((entry) => ({ ...entry })),
      iranianSustainabilityDisclosureInventory: IRANIAN_SUSTAINABILITY_DISCLOSURE_INVENTORY.map((entry) => ({ ...entry })),
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
