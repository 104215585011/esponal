// Timestamp: 2026-11-18 10:47
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
  return { user: await admin.getAdminUser(request), queries };
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
  for (const user of [null, { id: "owner-id" }]) {
    const route = await loadModule("src/app/api/admin/me/route.ts", {
      "@/lib/admin": { getAdminUser: async () => user },
      "next/server": { NextResponse: Response }
    });
    const response = await route.GET(new Request("https://example.com/api/admin/me"));
    assert.equal(response.status, user ? 200 : 403);
    assert.match(response.headers.get("cache-control"), /no-store/);
    if (user) assert.equal((await response.json()).isAdmin, true);
  }
});
