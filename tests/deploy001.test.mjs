import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("DEPLOY-001 nextauth route is force-dynamic", async () => {
  const routePath = "src/app/api/auth/[...nextauth]/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /NextAuth\(authOptions\)/);
});

test("DEPLOY-001 auth options guard adapter and providers behind env checks", async () => {
  const authPath = "src/lib/auth.ts";
  assert.ok(existsSync(authPath), `${authPath} should exist`);

  const auth = await readText(authPath);

  assert.match(auth, /const hasDatabaseUrl = Boolean\(process\.env\.DATABASE_URL\)/);
  assert.match(auth, /const hasGoogleProvider = Boolean\(/);
  assert.match(auth, /const adapter = hasDatabaseUrl \? PrismaAdapter\(prisma\) : undefined/);
  assert.match(auth, /providers = hasGoogleProvider/);
  assert.match(auth, /strategy: adapter \? "database" : "jwt"/);
});
