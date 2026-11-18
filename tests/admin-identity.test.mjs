// Timestamp: 2026-11-18 10:58
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function loadModule(path, dependencies) {
  const source = await readFile(path, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    }
  });
  return exports;
}

async function resolveAdmin({ userId = "owner-id", email = "easternwang123@gmail.com" } = {}) {
  const queries = [];
  const admin = await loadModule("src/lib/admin.ts", {
    "@/lib/api-auth": { getAuthedUserId: async () => userId },
    "@/lib/prisma": {
      prisma: { user: { findUnique: async (query) => {
        queries.push(query);
        return email === null ? null : { id: userId, email };
      } } }
    }
  });
  const request = new Request("https://example.com/api/admin/me?email=easternwang123@gmail.com");
  return { ...(await admin.getAdminAccess(request)), queries };
}

test("only the authenticated owner's database email grants administrator access", async () => {
  const owner = await resolveAdmin();
  assert.equal(owner.user.id, "owner-id");
  assert.equal(owner.queries[0].where.id, "owner-id");
  assert.ok((await resolveAdmin({ email: " EasternWang123@Gmail.com " })).user);
  assert.equal((await resolveAdmin({ email: "someone@example.com" })).user, null);
  assert.equal((await resolveAdmin({ email: null })).user, null);
});

test("anonymous requests cannot gain admin access by supplying the owner's email", async () => {
  const anonymous = await resolveAdmin({ userId: null });
  assert.equal(anonymous.user, null);
  assert.equal(anonymous.queries.length, 0);
});

test("admin identity responses are private, uncached and reject non-admins", async () => {
  for (const [signedIn, user, status] of [[false, null, 401], [true, null, 403], [true, { id: "owner-id" }, 200]]) {
    const route = await loadModule("src/app/api/admin/me/route.ts", {
      "@/lib/admin": { getAdminAccess: async () => ({ signedIn, user }) },
      "next/server": { NextResponse: Response }
    });
    const response = await route.GET(new Request("https://example.com/api/admin/me"));
    assert.equal(response.status, status);
    assert.match(response.headers.get("cache-control"), /no-store/);
    if (user) assert.equal((await response.json()).isAdmin, true);
  }
});

test("ordinary users and anonymous requests cannot read or write admin data", async () => {
  for (const signedIn of [true, false]) {
    const route = await loadModule("src/app/api/admin/manage/route.ts", {
      "@/lib/admin": { getAdminAccess: async () => ({ signedIn, user: null }) },
      "@/lib/admin-data": {},
      "@/lib/admin-input": {},
      "@/lib/prisma": {},
      "next/server": { NextResponse: Response }
    });
    const request = new Request("https://example.com/api/admin/manage?view=users");
    assert.equal((await route.GET(request)).status, signedIn ? 403 : 401);
    assert.equal((await route.POST(request)).status, signedIn ? 403 : 401);
  }
});

test("a per-user daily limit admits at most the configured number of simultaneous requests", async () => {
  const adminInput = await import("../src/lib/admin-input.ts");
  const date = adminInput.adminDayStart(new Date("2026-11-18T16:00:00Z"));
  assert.equal(date.toISOString(), "2026-11-18T16:00:00.000Z");
  let used = 0;
  const rule = { enabled: true, dailyLimit: 2 };
  const policy = await loadModule("src/lib/admin-policy.ts", {
    "@/lib/admin-input": adminInput,
    "@/lib/prisma": {
      prisma: {
        adminFeaturePolicy: { findUnique: async () => rule },
        adminFeatureCounter: {
          upsert: async () => undefined,
          updateMany: async ({ where }) => {
            if (used >= where.used.lt) return { count: 0 };
            used += 1;
            return { count: 1 };
          }
        }
      }
    },
    "next/server": { NextResponse: Response }
  });
  const results = await Promise.all(Array.from({ length: 5 }, () => policy.checkAdminFeature("learner", "talk")));
  assert.equal(results.filter((result) => result === null).length, 2);
  assert.equal(results.filter((result) => result?.status === 429).length, 3);
  rule.enabled = false;
  assert.equal((await policy.checkAdminFeature("learner", "talk")).status, 403);
});
