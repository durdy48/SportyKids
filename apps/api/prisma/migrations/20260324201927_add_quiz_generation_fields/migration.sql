-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN "ageRange" TEXT;
ALTER TABLE "QuizQuestion" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "QuizQuestion" ADD COLUMN "generatedAt" DATETIME;

-- CreateIndex
CREATE INDEX "QuizQuestion_expiresAt_sport_idx" ON "QuizQuestion"("expiresAt", "sport");
