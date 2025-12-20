-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "sharesPaid" INTEGER,
ADD COLUMN     "splitPlanId" TEXT;

-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN     "stateVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "SplitPlan" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalShares" INTEGER NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentQuote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "stateVersion" INTEGER NOT NULL,
    "splitPlanId" TEXT,
    "sharesToPay" INTEGER,
    "selectedItems" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SplitPlan_sessionId_idx" ON "SplitPlan"("sessionId");

-- CreateIndex
CREATE INDEX "PaymentQuote_sessionId_idx" ON "PaymentQuote"("sessionId");

-- CreateIndex
CREATE INDEX "PaymentQuote_expiresAt_idx" ON "PaymentQuote"("expiresAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_splitPlanId_idx" ON "PaymentIntent"("splitPlanId");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_splitPlanId_fkey" FOREIGN KEY ("splitPlanId") REFERENCES "SplitPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitPlan" ADD CONSTRAINT "SplitPlan_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
