/**
 * Runtime query pagination — additive bounding contract for list endpoints.
 *
 * Supporting (non-Engine) utility for the commercial runtime. It provides a
 * single, explicit pagination contract for every list route:
 *
 *   - a safe default limit when the client omits `limit`
 *   - an explicit maximum limit that is rejected, never silently clamped
 *   - strict validation of `limit`/`offset` (integers, bounded)
 *   - continuation metadata (`total`, `hasMore`, `nextOffset`) so clients can
 *     walk a stable ordering without duplicates or gaps
 *
 * The owner of each collection is responsible for applying the tenant filter
 * and a total ordering *before* slicing; this module only parses and shapes.
 * It is NOT a new Engine and does not alter any frozen contract.
 */

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PageMeta {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
  readonly returned: number;
  readonly hasMore: boolean;
  readonly nextOffset: number | null;
}

export interface PageSlice<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export type PaginationParse =
  | { readonly ok: true; readonly page: PageRequest }
  | { readonly ok: false; readonly error: string };

const normalize = (raw: string | null): string | null => {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * Parse `limit`/`offset` from query parameters.
 *
 * Invalid input (non-integer, non-positive limit, negative offset, or a limit
 * above `MAX_PAGE_LIMIT`) fails closed with a precise error code; it is never
 * clamped, so a client can never receive a page whose bounds differ from the
 * requested bounds.
 */
export const parsePagination = (params: URLSearchParams): PaginationParse => {
  const rawLimit = normalize(params.get("limit"));
  const rawOffset = normalize(params.get("offset"));

  if (rawLimit !== null && !/^\d+$/.test(rawLimit)) return { ok: false, error: "PAGINATION_LIMIT_INVALID" };
  if (rawOffset !== null && !/^\d+$/.test(rawOffset)) return { ok: false, error: "PAGINATION_OFFSET_INVALID" };

  const limit = rawLimit === null ? DEFAULT_PAGE_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1) return { ok: false, error: "PAGINATION_LIMIT_INVALID" };
  if (limit > MAX_PAGE_LIMIT) return { ok: false, error: "PAGINATION_LIMIT_EXCEEDED" };

  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) return { ok: false, error: "PAGINATION_OFFSET_INVALID" };

  return { ok: true, page: { limit, offset } };
};

/** Slice an already tenant-filtered, deterministically ordered collection. */
export const slicePage = <T>(items: readonly T[], page: PageRequest): PageSlice<T> => ({
  items: items.slice(page.offset, page.offset + page.limit),
  total: items.length,
});

/** Build bounded continuation metadata for a page. */
export const toPageMeta = (page: PageRequest, slice: PageSlice<unknown>): PageMeta => {
  const returned = slice.items.length;
  const hasMore = page.offset + returned < slice.total;
  return {
    limit: page.limit,
    offset: page.offset,
    total: slice.total,
    returned,
    hasMore,
    nextOffset: hasMore ? page.offset + returned : null,
  };
};
