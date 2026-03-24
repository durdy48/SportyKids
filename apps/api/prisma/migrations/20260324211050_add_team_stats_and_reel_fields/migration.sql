-- AlterTable
ALTER TABLE "Reel" ADD COLUMN "aspectRatio" TEXT;
ALTER TABLE "Reel" ADD COLUMN "previewGifUrl" TEXT;
ALTER TABLE "Reel" ADD COLUMN "videoType" TEXT;

-- CreateTable
CREATE TABLE "TeamStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamName" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "leaguePosition" INTEGER,
    "recentResults" TEXT NOT NULL,
    "topScorer" TEXT,
    "nextMatch" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "favoriteSports" TEXT NOT NULL DEFAULT '[]',
    "favoriteTeam" TEXT,
    "selectedFeeds" TEXT NOT NULL DEFAULT '[]',
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushPreferences" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATETIME,
    "currentQuizCorrectStreak" INTEGER NOT NULL DEFAULT 0,
    "quizPerfectCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("age", "createdAt", "currentQuizCorrectStreak", "currentStreak", "favoriteSports", "favoriteTeam", "id", "lastActiveDate", "longestStreak", "name", "quizPerfectCount", "selectedFeeds", "totalPoints", "updatedAt") SELECT "age", "createdAt", "currentQuizCorrectStreak", "currentStreak", "favoriteSports", "favoriteTeam", "id", "lastActiveDate", "longestStreak", "name", "quizPerfectCount", "selectedFeeds", "totalPoints", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TeamStats_teamName_key" ON "TeamStats"("teamName");
