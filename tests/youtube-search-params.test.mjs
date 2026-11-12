// Behavioural tests: these import and execute the real module instead of
// regex-matching its source text. Node 22 strips TS types at import time.

import assert from "node:assert/strict";
import test from "node:test";

import {
  SEARCH_ORDERS,
  buildSearchCacheInput,
  isDefaultSearch,
  isFreshRequested,
  normalizePageToken,
  normalizeRegionCode,
  normalizeSearchOrder
} from "../src/lib/youtube-search-params.ts";

const baseInput = {
  query: "comida",
  maxResults: 20,
  order: "relevance",
  region: "",
  pageToken: ""
};

test("order normalisation only accepts documented search.list values", () => {
  for (const order of SEARCH_ORDERS) {
    assert.equal(normalizeSearchOrder(order), order);
  }

  assert.equal(normalizeSearchOrder("relevance"), "relevance");
  assert.equal(normalizeSearchOrder("viewCount"), "viewCount");
  assert.equal(normalizeSearchOrder("DATE"), "relevance");
  assert.equal(normalizeSearchOrder("random injection"), "relevance");
  assert.equal(normalizeSearchOrder(null), "relevance");
  assert.equal(normalizeSearchOrder(undefined), "relevance");
});

test("region normalisation accepts two-letter codes and uppercases them", () => {
  assert.equal(normalizeRegionCode("es"), "ES");
  assert.equal(normalizeRegionCode(" MX "), "MX");
  assert.equal(normalizeRegionCode("ESP"), "");
  assert.equal(normalizeRegionCode("E1"), "");
  assert.equal(normalizeRegionCode(null), "");
});

test("page token rejects oversized or unsafe values", () => {
  assert.equal(normalizePageToken("abcDEF-_=+/123"), "abcDEF-_=+/123");
  assert.equal(normalizePageToken("  token  "), "token");
  assert.equal(normalizePageToken("a".repeat(513)), "");
  assert.equal(normalizePageToken("<script>"), "");
  assert.equal(normalizePageToken(null), "");
});

test("fresh flag is opt-in only", () => {
  assert.equal(isFreshRequested("1"), true);
  assert.equal(isFreshRequested("TRUE"), true);
  assert.equal(isFreshRequested("0"), false);
  assert.equal(isFreshRequested(""), false);
  assert.equal(isFreshRequested(null), false);
});

test("default searches keep the legacy cache key so existing entries are reused", () => {
  // Clearing youtube:v2:search would force a cold rehydration of every popular
  // query and burn 100 quota units each. This contract is deliberately strict.
  assert.equal(buildSearchCacheInput(baseInput), "comida:20");
  assert.equal(
    buildSearchCacheInput({ ...baseInput, query: "español para principiantes" }),
    "español para principiantes:20"
  );
  assert.equal(isDefaultSearch(baseInput), true);
});

test("non-default dimensions produce distinct, non-colliding cache keys", () => {
  const keys = new Set([
    buildSearchCacheInput({ ...baseInput, order: "date" }),
    buildSearchCacheInput({ ...baseInput, order: "viewCount" }),
    buildSearchCacheInput({ ...baseInput, region: "ES" }),
    buildSearchCacheInput({ ...baseInput, pageToken: "next-page-token" }),
    buildSearchCacheInput({ ...baseInput, order: "date", region: "ES" }),
    buildSearchCacheInput(baseInput)
  ]);

  assert.equal(keys.size, 6, "each parameter combination needs its own cache entry");

  assert.equal(
    buildSearchCacheInput({ ...baseInput, order: "date" }),
    "comida:20|date|-|-"
  );
  assert.equal(isDefaultSearch({ order: "date", region: "", pageToken: "" }), false);
});

test("colons inside a query cannot collide with the maxResults segment", () => {
  assert.equal(
    buildSearchCacheInput({ ...baseInput, query: "español:20", maxResults: 8 }),
    "español:20:8"
  );

  assert.notEqual(
    buildSearchCacheInput({ ...baseInput, query: "español:20", maxResults: 8, order: "date" }),
    buildSearchCacheInput({ ...baseInput, query: "español", maxResults: 8, order: "date" })
  );
});
