-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "isTimeless" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "topic" TEXT;

-- CreateTable
CREATE TABLE "UserQuizHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQuizHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserQuizHistory_userId_answeredAt_idx" ON "UserQuizHistory"("userId", "answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuizHistory_userId_questionId_key" ON "UserQuizHistory"("userId", "questionId");

-- CreateIndex
CREATE INDEX "QuizQuestion_isTimeless_sport_ageRange_idx" ON "QuizQuestion"("isTimeless", "sport", "ageRange");

-- CreateIndex
CREATE INDEX "QuizQuestion_topic_idx" ON "QuizQuestion"("topic");

-- AddForeignKey
ALTER TABLE "UserQuizHistory" ADD CONSTRAINT "UserQuizHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuizHistory" ADD CONSTRAINT "UserQuizHistory_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
