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
  assert.match(route, /NextAuth\(getAuthOptions\(\)\)/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
});

test("DEPLOY-001 auth options are built lazily behind env checks", async () => {
  const authPath = "src/lib/auth.ts";
  assert.ok(existsSync(authPath), `${authPath} should exist`);

  const auth = await readText(authPath);

  assert.match(auth, /export function getAuthOptions\(\): NextAuthOptions/);
  assert.match(auth, /const hasDatabaseUrl = Boolean\(process\.env\.DATABASE_URL\)/);
  assert.match(auth, /const hasGoogleProvider = Boolean\(/);
  assert.match(auth, /providers = hasGoogleProvider/);
  assert.match(auth, /if \(!hasDatabaseUrl\)/);
  assert.match(auth, /const \{ prisma \} = require\("@\/lib\/prisma"\)/);
  assert.match(auth, /strategy: "jwt"/);
  assert.match(auth, /strategy: "database"/);
});

test("DEPLOY-001 vercel install generates Prisma Client before Next build", async () => {
  const packageJson = JSON.parse(await readText("package.json"));

  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.postinstall, "prisma generate");
});
