-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageGateCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentBy" TEXT,
ADD COLUMN     "consentDate" TIMESTAMP(3),
ADD COLUMN     "consentGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "socialId" TEXT;

-- CreateIndex
CREATE INDEX "User_authProvider_socialId_idx" ON "User"("authProvider", "socialId");
