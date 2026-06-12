export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/** 쿼리스트링 page/limit 파싱 — 잘못된 값은 기본값, 상한 클램프 */
export function parsePagination(
  query: { page?: string; limit?: string },
  opts: PaginationOptions = {},
): Pagination {
  const defaultLimit = opts.defaultLimit ?? 25;
  const maxLimit = opts.maxLimit ?? 100;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}
