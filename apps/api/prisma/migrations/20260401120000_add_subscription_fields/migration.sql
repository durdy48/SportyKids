-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "subscriptionExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ParentalProfile" ADD COLUMN     "revenuecatCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ParentalProfile_revenuecatCustomerId_key" ON "ParentalProfile"("revenuecatCustomerId");
