// Timestamp: 2026-11-18 10:58
import assert from "node:assert/strict";
import test from "node:test";

const { parseAdminChange } = await import("../src/lib/admin-input.ts");

test("administrative actions validate amounts, permission state and reason", () => {
  assert.equal(parseAdminChange({ action: "credits", value: -100, reason: "退款" }).value, -100);
  assert.equal(parseAdminChange({ action: "credits", value: 0, reason: "调整" }), null);
  assert.equal(parseAdminChange({ action: "extend", value: -1, reason: "调整" }), null);
  assert.equal(parseAdminChange({ action: "credits", value: 1, reason: "  " }), null);
  assert.equal(parseAdminChange({ action: "policy", feature: "admin", enabled: true, limit: 5, reason: "调整" }), null);
  assert.equal(parseAdminChange({ action: "policy", feature: "talk", enabled: "false", limit: 5, reason: "调整" }), null);
  assert.equal(parseAdminChange({ action: "policy", feature: "talk", enabled: false, limit: null, reason: "调整" }).enabled, false);
});
