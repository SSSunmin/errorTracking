/**
 * 이슈 검색 쿼리 파서.
 * `cannot read browser:Chrome environment:production` →
 *   { text: "cannot read", filters: [{key:"browser",value:"Chrome"}, ...] }
 */

export interface SearchFilter {
  key: string;
  value: string;
}

export interface ParsedSearch {
  /** 제목 free-text (없으면 null) */
  text: string | null;
  /** `key:value` 태그 필터 */
  filters: SearchFilter[];
}

const TOKEN_RE = /^([a-zA-Z_][\w.-]*):(.+)$/;

export function parseSearch(q: string | undefined | null): ParsedSearch {
  if (!q || !q.trim()) return { text: null, filters: [] };
  const filters: SearchFilter[] = [];
  const textParts: string[] = [];
  for (const token of q.trim().split(/\s+/)) {
    const m = TOKEN_RE.exec(token);
    if (m) filters.push({ key: m[1]!.toLowerCase(), value: m[2]! });
    else textParts.push(token);
  }
  return {
    text: textParts.length > 0 ? textParts.join(" ") : null,
    filters,
  };
}
