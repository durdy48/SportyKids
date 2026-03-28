/*
  Warnings:

  - The `allowedSports` column on the `ParentalProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `allowedFeeds` column on the `ParentalProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `allowedFormats` column on the `ParentalProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `options` column on the `QuizQuestion` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `nextMatch` column on the `TeamStats` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `favoriteSports` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `selectedFeeds` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `pushPreferences` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `recentResults` on the `TeamStats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "ParentalProfile" DROP COLUMN "allowedSports",
ADD COLUMN     "allowedSports" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "allowedFeeds",
ADD COLUMN     "allowedFeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "allowedFormats",
ADD COLUMN     "allowedFormats" TEXT[] DEFAULT ARRAY['news', 'reels', 'quiz']::TEXT[];

-- AlterTable
ALTER TABLE "QuizQuestion" DROP COLUMN "options",
ADD COLUMN     "options" TEXT[];

-- AlterTable
ALTER TABLE "TeamStats" DROP COLUMN "recentResults",
ADD COLUMN     "recentResults" JSONB NOT NULL,
DROP COLUMN "nextMatch",
ADD COLUMN     "nextMatch" JSONB;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "favoriteSports",
ADD COLUMN     "favoriteSports" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "selectedFeeds",
ADD COLUMN     "selectedFeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "pushPreferences",
ADD COLUMN     "pushPreferences" JSONB;

-- CreateIndex
CREATE INDEX "ActivityLog_userId_type_createdAt_idx" ON "ActivityLog"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "NewsItem_sport_safetyStatus_publishedAt_idx" ON "NewsItem"("sport", "safetyStatus", "publishedAt");

-- CreateIndex
CREATE INDEX "Reel_sport_safetyStatus_publishedAt_idx" ON "Reel"("sport", "safetyStatus", "publishedAt");
