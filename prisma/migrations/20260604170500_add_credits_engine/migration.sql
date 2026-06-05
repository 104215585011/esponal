-- CREDITS-ENGINE Phase 1: user credit state + credit ledger.

CREATE TYPE "Plan" AS ENUM (
  'free',
  'premium_m',
  'premium_y',
  'ultra_m',
  'ultra_y',
  'lifetime_premium',
  'lifetime_ultra'
);

CREATE TYPE "CreditSource" AS ENUM ('free', 'subscription', 'lifetime');

CREATE TYPE "CreditReason" AS ENUM ('grant', 'refill', 'spend');

ALTER TABLE "User"
ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'free',
ADD COLUMN "creditSource" "CreditSource" NOT NULL DEFAULT 'free',
ADD COLUMN "creditBalanceMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "planExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastRefillAt" TIMESTAMP(3),
ADD COLUMN "signupGranted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deltaMinor" INTEGER NOT NULL,
  "reason" "CreditReason" NOT NULL,
  "refType" TEXT,
  "refId" TEXT,
  "balanceAfterMinor" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

ALTER TABLE "CreditTransaction"
ADD CONSTRAINT "CreditTransaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
