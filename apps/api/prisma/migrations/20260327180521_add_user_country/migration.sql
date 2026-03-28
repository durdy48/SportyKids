-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'anonymous',
    "role" TEXT NOT NULL DEFAULT 'child',
    "parentUserId" TEXT,
    "lastLoginAt" DATETIME,
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
    "locale" TEXT NOT NULL DEFAULT 'es',
    "country" TEXT NOT NULL DEFAULT 'ES',
    CONSTRAINT "User_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("age", "authProvider", "createdAt", "currentQuizCorrectStreak", "currentStreak", "email", "favoriteSports", "favoriteTeam", "id", "lastActiveDate", "lastLoginAt", "locale", "longestStreak", "name", "parentUserId", "passwordHash", "pushEnabled", "pushPreferences", "quizPerfectCount", "role", "selectedFeeds", "totalPoints", "updatedAt") SELECT "age", "authProvider", "createdAt", "currentQuizCorrectStreak", "currentStreak", "email", "favoriteSports", "favoriteTeam", "id", "lastActiveDate", "lastLoginAt", "locale", "longestStreak", "name", "parentUserId", "passwordHash", "pushEnabled", "pushPreferences", "quizPerfectCount", "role", "selectedFeeds", "totalPoints", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
