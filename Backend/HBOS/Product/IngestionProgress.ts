/**
 * Stage 15-ING.1 — Canonical ingestion progress contract.
 *
 * A pure, shared type module (NOT an Engine, NOT a second orchestration layer)
 * that defines the observable progress/stage vocabulary for long-running
 * ingestion. `FinancialDataIngestionAdapter`, `ScannedPdfRouter`,
 * `FinancialIngestionService` and the durable `IngestionJobService` all speak
 * this single contract, so the runtime and the web client can render REAL
 * state instead of fake progress.
 *
 * Progress is truthful by construction:
 *   - a stage event is emitted only when the underlying work actually begins;
 *   - `percent` is only present for OCR, where it is derived from the count of
 *     pages that were actually routed to and completed by OCR;
 *   - `page`/`pages` are the real routed page numbers, never a timer estimate.
 */

export const INGESTION_STAGES = [
  "RECEIVED",
  "VALIDATING",
  "READING_FILE",
  "READING_PDF",
  "SCANNED_DETECTED",
  "OCR",
  "DOCUMENT_DETECTION",
  "SECTION_DETECTION",
  "SECTION_AUDITOR_REPORT",
  "SECTION_BOARD_REPORT",
  "SECTION_BALANCE_SHEET",
  "SECTION_INCOME_STATEMENT",
  "SECTION_CASH_FLOW",
  "SECTION_EQUITY",
  "SECTION_NOTES",
  "NORMALIZING",
  "EVIDENCE_VALIDATION",
  "CANONICAL_VALIDATION",
  "PERSISTING",
  "COMPLETED",
  "FAILED",
] as const;

export type IngestionStage = (typeof INGESTION_STAGES)[number];

export interface IngestionProgressEvent {
  readonly stage: IngestionStage;
  /** 1-based index of the page whose OCR result was just produced. */
  readonly page?: number;
  /** Total pages actually routed to OCR in this run. */
  readonly pages?: number;
  /** Real completion percentage (0-100), only when derivable from real work. */
  readonly percent?: number;
  /** Optional precise technical code for diagnostics (never a user message). */
  readonly code?: string;
}

export type IngestionProgressObserver = (event: IngestionProgressEvent) => void;

/** True when the stage is a truthful terminal state. */
export const isTerminalIngestionStage = (stage: IngestionStage): boolean =>
  stage === "COMPLETED" || stage === "FAILED";

/**
 * Human-readable Persian label per stage. This is the PRIMARY user-facing
 * message; technical codes stay in diagnostics only.
 */
export const INGESTION_STAGE_MESSAGES_FA: Record<IngestionStage, string> = {
  RECEIVED: "دریافت شد",
  VALIDATING: "در حال اعتبارسنجی ورودی",
  READING_FILE: "در حال خواندن فایل",
  READING_PDF: "در حال خواندن فایل PDF",
  SCANNED_DETECTED: "فایل اسکن‌شده شناسایی شد؛ آماده‌سازی تشخیص متن",
  OCR: "در حال تشخیص متن تصویر (OCR)",
  DOCUMENT_DETECTION: "در حال تشخیص نوع سند",
  SECTION_DETECTION: "در حال تشخیص بخش‌های گزارش",
  SECTION_AUDITOR_REPORT: "گزارش حسابرس",
  SECTION_BOARD_REPORT: "گزارش هیئت‌مدیره",
  SECTION_BALANCE_SHEET: "صورت وضعیت مالی",
  SECTION_INCOME_STATEMENT: "سود و زیان",
  SECTION_CASH_FLOW: "جریان وجوه نقد",
  SECTION_EQUITY: "حقوق مالکانه",
  SECTION_NOTES: "یادداشت‌ها",
  NORMALIZING: "در حال نرمال‌سازی ساختار سند",
  EVIDENCE_VALIDATION: "در حال اعتبارسنجی شواهد",
  CANONICAL_VALIDATION: "در حال اعتبارسنجی مدل مالی کانونی",
  PERSISTING: "در حال ذخیره‌سازی نتیجه",
  COMPLETED: "تکمیل شد",
  FAILED: "پردازش ناموفق بود",
};

/** Build the Persian message for a stage, including real OCR page progress. */
export function ingestionStageMessageFa(event: IngestionProgressEvent): string {
  if (event.stage === "OCR" && typeof event.page === "number" && typeof event.pages === "number" && event.pages > 0) {
    return `در حال تشخیص متن تصویر (OCR) — صفحه ${event.page} از ${event.pages}`;
  }
  return INGESTION_STAGE_MESSAGES_FA[event.stage];
}

/**
 * Precise technical ingestion failure codes mapped to human-readable Persian.
 * Unknown codes fall back to a generic message; the technical code is always
 * preserved separately for diagnostics.
 */
const INGESTION_FAILURE_MESSAGES_FA: Record<string, string> = {
  "ingestion-schema-invalid": "ساختار فایل با مدل مالی کانونی سازگار نیست.",
  "ingestion-table-schema-invalid": "یکی از ردیف‌های جدول مالی با مدل کانونی سازگار نیست.",
  "ingestion-ambiguous-table-mapping": "جدول مالی با اطمینان قابل نگاشت به مدل کانونی نیست؛ نیاز به بازبینی دارد.",
  "ingestion-ocr-empty": "متن قابل خواندن با OCR پیدا نشد؛ کیفیت تصویر را بررسی کنید.",
  "ingestion-ocr-unsupported": "موتور OCR یا داده زبانی محلی آن در دسترس نیست.",
  "ingestion-ocr-recognize-failed": "تشخیص متن تصویر ناموفق بود.",
  "ingestion-pdf-scanned-no-ocr-yet": "این PDF متنی نیست و مسیر OCR در دسترس نیست.",
  "ingestion-pdf-password-protected": "فایل PDF با گذرواژه محافظت شده است.",
  "ingestion-pdf-corrupt": "فایل PDF آسیب‌دیده یا نامعتبر است.",
  "ingestion-header-and-data-required": "فایل باید یک سرستون و حداقل یک ردیف داده داشته باشد.",
  "ingestion-source-empty": "فایل ورودی خالی است.",
  "ingestion-job-interrupted": "پردازش پیش از تکمیل متوقف شد؛ دوباره تلاش کنید.",
  "financial-report-partial-success": "بخشی از گزارش مالی خوانده شد؛ برخی بخش‌ها نیاز به بازبینی دارند.",
  "financial-report-ambiguous-table": "یک یا چند جدول گزارش با اطمینان قابل نگاشت نیست؛ نیاز به بازبینی دارد.",
  "financial-report-insufficient-evidence": "شواهد کافی برای استخراج گزارش مالی پیدا نشد.",
  "spreadsheet-statement-ambiguous": "کاربرگ صفحه‌گسترده به‌صورت قطعی صورت مالی یا دفتر تشخیص داده نشد.",
  "xls-provider-unavailable": "مسیر خواندن فایل XLS در دسترس نیست.",
  "xls-malformed": "فایل XLS آسیب‌دیده یا نامعتبر است.",
  "xls-encrypted-unsupported": "فایل XLS رمزنگاری‌شده پشتیبانی نمی‌شود.",
};

export function ingestionFailureMessageFa(code: string | undefined): string {
  if (!code) return INGESTION_STAGE_MESSAGES_FA.FAILED;
  const exact = INGESTION_FAILURE_MESSAGES_FA[code];
  if (exact) return exact;
  const prefix = Object.keys(INGESTION_FAILURE_MESSAGES_FA).find((key) => code.startsWith(`${key}:`));
  return prefix ? INGESTION_FAILURE_MESSAGES_FA[prefix] : INGESTION_STAGE_MESSAGES_FA.FAILED;
}
