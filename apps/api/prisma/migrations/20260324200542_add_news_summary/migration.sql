-- CreateTable
CREATE TABLE "NewsSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "newsItemId" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsSummary_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "NewsItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsSummary_newsItemId_ageRange_locale_key" ON "NewsSummary"("newsItemId", "ageRange", "locale");
