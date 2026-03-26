-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "updatedAt" DATETIME NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es'
);
INSERT INTO "new_User" ("age", "createdAt", "currentQuizCorrectStreak", "currentStreak", "favoriteSports", "favoriteTeam", "id", "lastActiveDate", "longestStreak", "name", "pushEnabled", "pushPreferences", "quizPerfectCount", "selectedFeeds", "totalPoints", "updatedAt") SELECT "age", "createdAt", "currentQuizCorrectStreak", "currentStreak", "favoriteSports", "favoriteTeam", "id", "lastActiveDate", "longestStreak", "name", "pushEnabled", "pushPreferences", "quizPerfectCount", "selectedFeeds", "totalPoints", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");
