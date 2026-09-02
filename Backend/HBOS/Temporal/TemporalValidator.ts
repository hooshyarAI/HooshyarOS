/**
 * Stage 07-A - Temporal Data Validation
 *
 * Deterministic validation for temporal observations.
 * Rejects invalid observations explicitly without silent coercion.
 */

import {
    ValidationResult,
    AppendObservationInput,
    TIMESTAMP_PATTERNS,
    METRIC_NAME_PATTERN,
    SOURCE_PATTERN
} from "./TemporalTypes";

/**
 * Validation error codes
 */
export const ValidationError = {
    TENANT_ID_REQUIRED: "temporal-validation:tenant-required",
    TENANT_ID_EMPTY: "temporal-validation:tenant-empty",
    METRIC_NAME_REQUIRED: "temporal-validation:metric-name-required",
    METRIC_NAME_INVALID: "temporal-validation:metric-name-invalid",
    VALUE_REQUIRED: "temporal-validation:value-required",
    VALUE_NOT_FINITE: "temporal-validation:value-not-finite",
    VALUE_NAN: "temporal-validation:value-nan",
    VALUE_INFINITE: "temporal-validation:value-infinite",
    TIMESTAMP_REQUIRED: "temporal-validation:timestamp-required",
    TIMESTAMP_INVALID_FORMAT: "temporal-validation:timestamp-invalid-format",
    TIMESTAMP_FUTURE: "temporal-validation:timestamp-future",
    SOURCE_REQUIRED: "temporal-validation:source-required",
    SOURCE_INVALID: "temporal-validation:source-invalid",
    START_TIME_INVALID: "temporal-validation:start-time-invalid",
    END_TIME_INVALID: "temporal-validation:end-time-invalid",
    TIME_RANGE_INVALID: "temporal-validation:time-range-invalid"
} as const;

/**
 * Temporal data validator
 */
export const TemporalValidator = {
    /**
     * Validate an observation input before appending
     */
    validateObservation(input: AppendObservationInput): ValidationResult {
        const errors: string[] = [];

        // Tenant validation
        if (!input.tenantId) {
            errors.push(ValidationError.TENANT_ID_REQUIRED);
        } else if (typeof input.tenantId !== "string" || input.tenantId.trim().length === 0) {
            errors.push(ValidationError.TENANT_ID_EMPTY);
        }

        // Metric name validation
        if (!input.metricName) {
            errors.push(ValidationError.METRIC_NAME_REQUIRED);
        } else if (!METRIC_NAME_PATTERN.test(input.metricName)) {
            errors.push(`${ValidationError.METRIC_NAME_INVALID}: ${input.metricName}`);
        }

        // Value validation
        if (input.value === undefined || input.value === null) {
            errors.push(ValidationError.VALUE_REQUIRED);
        } else if (typeof input.value !== "number") {
            errors.push(`${ValidationError.VALUE_NOT_FINITE}: got ${typeof input.value}`);
        } else if (isNaN(input.value)) {
            errors.push(ValidationError.VALUE_NAN);
        } else if (!Number.isFinite(input.value)) {
            errors.push(ValidationError.VALUE_INFINITE);
        }

        // Timestamp validation
        if (!input.timestamp) {
            errors.push(ValidationError.TIMESTAMP_REQUIRED);
        } else if (!TemporalValidator.isValidTimestamp(input.timestamp)) {
            errors.push(`${ValidationError.TIMESTAMP_INVALID_FORMAT}: ${input.timestamp}`);
        } else if (TemporalValidator.isFutureTimestamp(input.timestamp)) {
            // Allow some tolerance for clock skew (5 minutes)
            const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
            if (new Date(input.timestamp).getTime() > fiveMinutesFromNow) {
                errors.push(`${ValidationError.TIMESTAMP_FUTURE}: ${input.timestamp}`);
            }
        }

        // Source validation
        if (!input.source) {
            errors.push(ValidationError.SOURCE_REQUIRED);
        } else if (!SOURCE_PATTERN.test(input.source)) {
            errors.push(`${ValidationError.SOURCE_INVALID}: ${input.source}`);
        }

        return {
            valid: errors.length === 0,
            errors: Object.freeze(errors)
        };
    },

    /**
     * Check if a timestamp string is valid
     */
    isValidTimestamp(ts: string): boolean {
        if (!ts || typeof ts !== "string") {
            return false;
        }
        // Must match ISO date format
        return TIMESTAMP_PATTERNS.ISO_DATE.test(ts) || TIMESTAMP_PATTERNS.ISO_FULL.test(ts);
    },

    /**
     * Check if timestamp is in the future (with tolerance)
     */
    isFutureTimestamp(ts: string): boolean {
        try {
            const tsDate = new Date(ts);
            return tsDate.getTime() > Date.now();
        } catch {
            return false;
        }
    },

    /**
     * Validate a metric name
     */
    isValidMetricName(name: string): boolean {
        return METRIC_NAME_PATTERN.test(name);
    },

    /**
     * Validate a time range query
     */
    validateTimeRange(startTime: string, endTime: string): ValidationResult {
        const errors: string[] = [];

        if (!startTime) {
            errors.push(ValidationError.START_TIME_INVALID);
        } else if (!TemporalValidator.isValidTimestamp(startTime)) {
            errors.push(`${ValidationError.START_TIME_INVALID}: ${startTime}`);
        }

        if (!endTime) {
            errors.push(ValidationError.END_TIME_INVALID);
        } else if (!TemporalValidator.isValidTimestamp(endTime)) {
            errors.push(`${ValidationError.END_TIME_INVALID}: ${endTime}`);
        }

        if (errors.length === 0) {
            try {
                const start = new Date(startTime).getTime();
                const end = new Date(endTime).getTime();
                if (start >= end) {
                    errors.push(ValidationError.TIME_RANGE_INVALID);
                }
            } catch {
                errors.push(ValidationError.TIME_RANGE_INVALID);
            }
        }

        return {
            valid: errors.length === 0,
            errors: Object.freeze(errors)
        };
    },

    /**
     * Check if a value is valid for storage
     */
    isValidValue(value: unknown): boolean {
        return typeof value === "number" && Number.isFinite(value) && !isNaN(value);
    },

    /**
     * Parse and validate a timestamp, returning Date or null
     */
    parseTimestamp(ts: string): Date | null {
        if (!TemporalValidator.isValidTimestamp(ts)) {
            return null;
        }
        try {
            return new Date(ts);
        } catch {
            return null;
        }
    }
};
