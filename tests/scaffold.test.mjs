import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readText = (path) => readFile(path, "utf8");

test("package declares the INFRA-001 application stack", async () => {
  const pkg = await readJson("package.json");

  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.test, "node --test tests/*.test.mjs");
  assert.match(pkg.dependencies.next, /^14\./);
  assert.ok(pkg.dependencies.react);
  assert.ok(pkg.dependencies["@prisma/client"]);
  assert.ok(pkg.dependencies["next-auth"]);
  assert.ok(pkg.dependencies.ioredis);
  assert.ok(pkg.devDependencies.prisma);
  assert.ok(pkg.devDependencies.tailwindcss);
  assert.ok(pkg.devDependencies.typescript);
});

test("welcome page is present in the Next.js App Router", async () => {
  assert.ok(existsSync("src/app/page.tsx"), "src/app/page.tsx should exist");

  const page = await readText("src/app/page.tsx");
  assert.match(page, /西语学习平台/);
  assert.match(page, /INFRA-001/);
  assert.match(page, /Next\.js 14/);
});

test("Prisma is configured for PostgreSQL with initial models", async () => {
  assert.ok(existsSync("prisma/schema.prisma"), "prisma/schema.prisma should exist");

  const schema = await readText("prisma/schema.prisma");
  assert.match(schema, /provider\s+=\s+"postgresql"/);
  assert.match(schema, /model User/);
  assert.match(schema, /model Account/);
  assert.match(schema, /model Session/);
});

test("initial Prisma migration is checked in", async () => {
  const migrationPath = "prisma/migrations/20260513112000_init/migration.sql";
  assert.ok(existsSync(migrationPath), `${migrationPath} should exist`);

  const migration = await readText(migrationPath);
  assert.match(migration, /CREATE TABLE "User"/);
  assert.match(migration, /CREATE TABLE "Account"/);
  assert.match(migration, /CREATE TABLE "Session"/);
});

test("environment example documents required local services", async () => {
  const env = await readText(".env.example");

  assert.match(env, /DATABASE_URL=/);
  assert.match(env, /REDIS_URL=/);
  assert.match(env, /NEXTAUTH_SECRET=/);
  assert.match(env, /NEXTAUTH_URL=/);
});
