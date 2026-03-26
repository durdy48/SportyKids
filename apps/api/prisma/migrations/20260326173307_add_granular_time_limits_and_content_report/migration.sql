-- AlterTable
ALTER TABLE "ParentalProfile" ADD COLUMN "maxNewsMinutes" INTEGER;
ALTER TABLE "ParentalProfile" ADD COLUMN "maxQuizMinutes" INTEGER;
ALTER TABLE "ParentalProfile" ADD COLUMN "maxReelsMinutes" INTEGER;

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ContentReport_userId_contentType_idx" ON "ContentReport"("userId", "contentType");

-- CreateIndex
CREATE INDEX "ContentReport_status_idx" ON "ContentReport"("status");
