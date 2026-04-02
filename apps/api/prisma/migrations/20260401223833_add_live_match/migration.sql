-- CreateTable
CREATE TABLE "LiveMatch" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "progress" TEXT NOT NULL DEFAULT 'NS',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "league" TEXT NOT NULL DEFAULT '',
    "matchDate" TIMESTAMP(3) NOT NULL,
    "sport" TEXT NOT NULL,
    "homeGoalDetails" TEXT NOT NULL DEFAULT '',
    "awayGoalDetails" TEXT NOT NULL DEFAULT '',
    "homeRedCards" TEXT NOT NULL DEFAULT '',
    "awayRedCards" TEXT NOT NULL DEFAULT '',
    "lastPolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedEvents" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "LiveMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveMatch_externalEventId_key" ON "LiveMatch"("externalEventId");

-- CreateIndex
CREATE INDEX "LiveMatch_status_idx" ON "LiveMatch"("status");

-- CreateIndex
CREATE INDEX "LiveMatch_homeTeam_idx" ON "LiveMatch"("homeTeam");

-- CreateIndex
CREATE INDEX "LiveMatch_awayTeam_idx" ON "LiveMatch"("awayTeam");
