#!/usr/bin/env node
/**
 * Seed (or refresh) the deterministic E2E test user used by Playwright specs.
 *
 * Usage:
 *   node scripts/seed-e2e-user.mjs
 *
 * Reads env vars:
 *   E2E_USER_EMAIL    (default: e2e@esponal.test)
 *   E2E_USER_PASSWORD (default: test-e2e-password-2026)
 *
 * Idempotent: re-running just resets the password hash so flaky tests can't
 * lock out the account.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const email = process.env.E2E_USER_EMAIL ?? "e2e@esponal.test";
const password = process.env.E2E_USER_PASSWORD ?? "test-e2e-password-2026";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, password: hash, name: "E2E User" },
    update: { password: hash }
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded e2e user: ${user.email} (id=${user.id})`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to seed e2e user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
