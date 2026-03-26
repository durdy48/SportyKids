-- AlterTable
ALTER TABLE "ParentalProfile" ADD COLUMN "allowedHoursStart" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "ParentalProfile" ADD COLUMN "allowedHoursEnd" INTEGER NOT NULL DEFAULT 21;
ALTER TABLE "ParentalProfile" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid';
