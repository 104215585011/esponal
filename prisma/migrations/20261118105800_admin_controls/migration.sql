-- AlterEnum
ALTER TYPE "CreditReason" ADD VALUE 'adjustment';

-- CreateTable
CREATE TABLE "AdminFeaturePolicy" (
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyLimit" INTEGER,

    CONSTRAINT "AdminFeaturePolicy_pkey" PRIMARY KEY ("userId","feature")
);

-- CreateTable
CREATE TABLE "AdminFeatureCounter" (
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdminFeatureCounter_pkey" PRIMARY KEY ("userId","feature","day")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "unit" TEXT,
    "units" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiQuota" (
    "provider" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "allowance" INTEGER NOT NULL,
    "baseline" INTEGER NOT NULL,
    "usdPerThousand" DOUBLE PRECISION,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiQuota_pkey" PRIMARY KEY ("provider")
);

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- CreateIndex
CREATE INDEX "ApiUsageEvent_createdAt_idx" ON "ApiUsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ApiUsageEvent_userId_createdAt_idx" ON "ApiUsageEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminFeaturePolicy" ADD CONSTRAINT "AdminFeaturePolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
