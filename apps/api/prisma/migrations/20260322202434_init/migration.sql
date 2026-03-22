-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "team" TEXT,
    "minAge" INTEGER NOT NULL DEFAULT 6,
    "maxAge" INTEGER NOT NULL DEFAULT 14,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rssGuid" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "favoriteSports" TEXT NOT NULL DEFAULT '[]',
    "favoriteTeam" TEXT,
    "selectedFeeds" TEXT NOT NULL DEFAULT '[]',
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "team" TEXT,
    "minAge" INTEGER NOT NULL DEFAULT 6,
    "maxAge" INTEGER NOT NULL DEFAULT 14,
    "durationSeconds" INTEGER NOT NULL DEFAULT 60,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "sport" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "relatedNewsId" TEXT
);

-- CreateTable
CREATE TABLE "ParentalProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "allowedSports" TEXT NOT NULL DEFAULT '[]',
    "allowedFeeds" TEXT NOT NULL DEFAULT '[]',
    "allowedFormats" TEXT NOT NULL DEFAULT '["news","reels","quiz"]',
    "maxDailyTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    CONSTRAINT "ParentalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RssSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_rssGuid_key" ON "NewsItem"("rssGuid");

-- CreateIndex
CREATE UNIQUE INDEX "ParentalProfile_userId_key" ON "ParentalProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RssSource_url_key" ON "RssSource"("url");
