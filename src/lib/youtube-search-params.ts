// Pure helpers for the YouTube search endpoint. Kept free of path aliases and
// Next.js imports so `node --test` can import this module directly and assert
// real runtime behaviour instead of matching source text.

export const SEARCH_ORDERS = [
  "relevance",
  "date",
  "viewCount",
  "rating",
  "title"
] as const;

export type SearchOrder = (typeof SEARCH_ORDERS)[number];

export type SearchCacheInput = {
  query: string;
  maxResults: number;
  order: SearchOrder;
  region: string;
  pageToken: string;
};

const DEFAULT_CACHE_INPUT = "relevance";

export function normalizeSearchOrder(value: string | null | undefined): SearchOrder {
  const candidate = (value ?? "").trim();

  return (SEARCH_ORDERS as readonly string[]).includes(candidate)
    ? (candidate as SearchOrder)
    : DEFAULT_CACHE_INPUT;
}

export function normalizeRegionCode(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();

  return /^[A-Za-z]{2}$/.test(candidate) ? candidate.toUpperCase() : "";
}

export function normalizePageToken(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();

  if (!candidate || candidate.length > 512) {
    return "";
  }

  return /^[A-Za-z0-9_\-=/+]+$/.test(candidate) ? candidate : "";
}

export function isFreshRequested(value: string | null | undefined): boolean {
  const candidate = (value ?? "").trim().toLowerCase();

  return candidate === "1" || candidate === "true";
}

// Backwards compatibility matters here: a default search must produce exactly
// the same cache key as the previous implementation (`${query}:${maxResults}`).
// Clearing `youtube:v2:search` keys by accident would burn search.list quota
// (100 units per cold query). Only non-default dimensions get appended.
export function buildSearchCacheInput(input: SearchCacheInput): string {
  const base = `${input.query}:${input.maxResults}`;
  const isDefault =
    input.order === "relevance" && !input.region && !input.pageToken;

  if (isDefault) {
    return base;
  }

  return [
    base,
    input.order,
    input.region || "-",
    input.pageToken || "-"
  ].join("|");
}

export function isDefaultSearch(input: Pick<SearchCacheInput, "order" | "region" | "pageToken">) {
  return input.order === "relevance" && !input.region && !input.pageToken;
}
