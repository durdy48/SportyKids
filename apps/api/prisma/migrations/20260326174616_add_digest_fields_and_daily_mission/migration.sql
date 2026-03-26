-- CreateTable
CREATE TABLE "DailyMission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "rewardType" TEXT NOT NULL,
    "rewardRarity" TEXT,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    CONSTRAINT "ParentalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ParentalProfile" ("allowedFeeds", "allowedFormats", "allowedSports", "id", "maxDailyTimeMinutes", "maxNewsMinutes", "maxQuizMinutes", "maxReelsMinutes", "pin", "userId") SELECT "allowedFeeds", "allowedFormats", "allowedSports", "id", "maxDailyTimeMinutes", "maxNewsMinutes", "maxQuizMinutes", "maxReelsMinutes", "pin", "userId" FROM "ParentalProfile";
DROP TABLE "ParentalProfile";
ALTER TABLE "new_ParentalProfile" RENAME TO "ParentalProfile";
CREATE UNIQUE INDEX "ParentalProfile_userId_key" ON "ParentalProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyMission_userId_completed_idx" ON "DailyMission"("userId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMission_userId_date_key" ON "DailyMission"("userId", "date");
