-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NewsItem" (
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
    "rssGuid" TEXT NOT NULL,
    "safetyStatus" TEXT NOT NULL DEFAULT 'pending',
    "safetyReason" TEXT,
    "moderatedAt" DATETIME
);
INSERT INTO "new_NewsItem" ("createdAt", "id", "imageUrl", "maxAge", "minAge", "publishedAt", "rssGuid", "source", "sourceUrl", "sport", "summary", "team", "title") SELECT "createdAt", "id", "imageUrl", "maxAge", "minAge", "publishedAt", "rssGuid", "source", "sourceUrl", "sport", "summary", "team", "title" FROM "NewsItem";
DROP TABLE "NewsItem";
ALTER TABLE "new_NewsItem" RENAME TO "NewsItem";
CREATE UNIQUE INDEX "NewsItem_rssGuid_key" ON "NewsItem"("rssGuid");
CREATE TABLE "new_RssSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME,
    "country" TEXT NOT NULL DEFAULT 'ES',
    "language" TEXT NOT NULL DEFAULT 'es',
    "logoUrl" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "addedBy" TEXT
);
INSERT INTO "new_RssSource" ("active", "id", "lastSyncedAt", "name", "sport", "url") SELECT "active", "id", "lastSyncedAt", "name", "sport", "url" FROM "RssSource";
DROP TABLE "RssSource";
ALTER TABLE "new_RssSource" RENAME TO "RssSource";
CREATE UNIQUE INDEX "RssSource_url_key" ON "RssSource"("url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
