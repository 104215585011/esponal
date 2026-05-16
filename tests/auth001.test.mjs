import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("AUTH-001 user model stores nullable password hashes", async () => {
  const schema = await readText("prisma/schema.prisma");
  const migrations = existsSync("prisma/migrations")
    ? readdirSync("prisma/migrations")
    : [];

  assert.match(schema, /model User \{[\s\S]*password\s+String\?/);
  assert.ok(
    migrations.some((name) => name.includes("add_user_password")),
    "expected a Prisma migration named add_user_password"
  );
});

test("AUTH-001 dependencies include bcryptjs runtime and types", async () => {
  const packageJson = JSON.parse(await readText("package.json"));

  assert.ok(packageJson.dependencies?.bcryptjs);
  assert.ok(packageJson.devDependencies?.["@types/bcryptjs"]);
});

test("AUTH-001 register route validates, hashes, and creates users", async () => {
  const routePath = "src/app/api/auth/register/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /bcrypt\.hash\(password,\s*10\)/);
  assert.match(route, /prisma\.user\.findUnique/);
  assert.match(route, /prisma\.user\.create/);
  assert.match(route, /status:\s*201/);
  assert.match(route, /password\.length < 8/);
  assert.match(route, /emailRegex/);
});

test("AUTH-001 auth options support credentials with jwt sessions", async () => {
  const auth = await readText("src/lib/auth.ts");

  assert.match(auth, /CredentialsProvider/);
  assert.match(auth, /from "next-auth\/providers\/credentials"/);
  assert.match(auth, /from "bcryptjs"/);
  assert.match(auth, /bcrypt\.compare\(credentials\.password,\s*user\.password\)/);
  assert.match(auth, /if \(!user\?\.password\) return null/);
  assert.match(auth, /callbacks/);
  assert.match(auth, /session\.user as \{ id\?: string \}/);
  assert.match(auth, /token\.sub/);
  assert.match(auth, /strategy: "jwt"/);
  assert.doesNotMatch(auth, /strategy: "database"/);
});

test("AUTH-001 sign-in page offers google and credentials login", async () => {
  const pagePath = "src/app/auth/sign-in/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /signIn\("google",\s*\{\s*callbackUrl\b/);
  assert.match(page, /signIn\("credentials"/);
  assert.match(page, /CredentialsSignin/);
  assert.match(page, /邮箱或密码错误/);
  assert.match(page, /href="\/auth\/sign-up"/);
});

test("AUTH-001 sign-up page registers then signs in with credentials", async () => {
  const pagePath = "src/app/auth/sign-up/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /fetch\("\/api\/auth\/register"/);
  assert.match(page, /signIn\("credentials"/);
  assert.match(page, /callbackUrl: "\/"/);
  assert.match(page, /href="\/auth\/sign-in"/);
  assert.doesNotMatch(page, /signIn\("google"/);
});
