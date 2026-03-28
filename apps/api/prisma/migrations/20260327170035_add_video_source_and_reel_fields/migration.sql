-- CreateTable
CREATE TABLE "VideoSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "channelId" TEXT,
    "playlistId" TEXT,
    "sport" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "addedBy" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reel" (
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
    "videoType" TEXT,
    "aspectRatio" TEXT,
    "previewGifUrl" TEXT,
    "rssGuid" TEXT,
    "videoSourceId" TEXT,
    "safetyStatus" TEXT NOT NULL DEFAULT 'approved',
    "safetyReason" TEXT,
    "moderatedAt" DATETIME,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Reel" ("aspectRatio", "createdAt", "durationSeconds", "id", "maxAge", "minAge", "previewGifUrl", "source", "sport", "team", "thumbnailUrl", "title", "videoType", "videoUrl") SELECT "aspectRatio", "createdAt", "durationSeconds", "id", "maxAge", "minAge", "previewGifUrl", "source", "sport", "team", "thumbnailUrl", "title", "videoType", "videoUrl" FROM "Reel";
DROP TABLE "Reel";
ALTER TABLE "new_Reel" RENAME TO "Reel";
CREATE UNIQUE INDEX "Reel_rssGuid_key" ON "Reel"("rssGuid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VideoSource_feedUrl_key" ON "VideoSource"("feedUrl");
