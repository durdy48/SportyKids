-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ParentalProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "allowedSports" TEXT NOT NULL DEFAULT '[]',
    "allowedFeeds" TEXT NOT NULL DEFAULT '[]',
    "allowedFormats" TEXT NOT NULL DEFAULT '["news","reels","quiz"]',
    "maxDailyTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxNewsMinutes" INTEGER,
    "maxReelsMinutes" INTEGER,
    "maxQuizMinutes" INTEGER,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "digestEmail" TEXT,
    "digestDay" INTEGER NOT NULL DEFAULT 1,
    "lastDigestSentAt" DATETIME,
    "allowedHoursStart" INTEGER NOT NULL DEFAULT 7,
    "allowedHoursEnd" INTEGER NOT NULL DEFAULT 21,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    CONSTRAINT "ParentalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ParentalProfile" ("allowedFeeds", "allowedFormats", "allowedHoursEnd", "allowedHoursStart", "allowedSports", "digestDay", "digestEmail", "digestEnabled", "id", "lastDigestSentAt", "maxDailyTimeMinutes", "maxNewsMinutes", "maxQuizMinutes", "maxReelsMinutes", "pin", "timezone", "userId") SELECT "allowedFeeds", "allowedFormats", "allowedHoursEnd", "allowedHoursStart", "allowedSports", "digestDay", "digestEmail", "digestEnabled", "id", "lastDigestSentAt", "maxDailyTimeMinutes", "maxNewsMinutes", "maxQuizMinutes", "maxReelsMinutes", "pin", "timezone", "userId" FROM "ParentalProfile";
DROP TABLE "ParentalProfile";
ALTER TABLE "new_ParentalProfile" RENAME TO "ParentalProfile";
CREATE UNIQUE INDEX "ParentalProfile_userId_key" ON "ParentalProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
