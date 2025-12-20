/*
  Warnings:

  - Backfills menuId and timestamps for existing menu/category records.
*/
-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main menu',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuChangeEvent" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuChangeEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "color" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "menuId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "menuId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Seed a menu row for every venue to keep existing data valid
INSERT INTO "Menu" ("id", "venueId", "name", "version", "createdAt", "updatedAt")
SELECT CONCAT("id", ':menu'), "id", 'Main menu', 1, NOW(), NOW() FROM "Venue"
ON CONFLICT DO NOTHING;

-- Backfill category/menu relations
UPDATE "MenuCategory" AS mc
SET "menuId" = m."id"
FROM "Menu" m
WHERE mc."venueId" = m."venueId" AND mc."menuId" IS NULL;

-- Backfill menu on menu items using category linkage
UPDATE "MenuItem" AS mi
SET "menuId" = mc."menuId"
FROM "MenuCategory" mc
WHERE mi."categoryId" = mc."id" AND mi."menuId" IS NULL;

-- Enforce non-null relations after backfill
ALTER TABLE "MenuCategory" ALTER COLUMN "menuId" SET NOT NULL;
ALTER TABLE "MenuItem" ALTER COLUMN "menuId" SET NOT NULL;

-- Indexes
CREATE UNIQUE INDEX "Menu_venueId_key" ON "Menu"("venueId");
CREATE INDEX "MenuChangeEvent_venueId_version_idx" ON "MenuChangeEvent"("venueId", "version");
CREATE INDEX "MenuChangeEvent_menuId_version_idx" ON "MenuChangeEvent"("menuId", "version");
CREATE INDEX "MenuChangeEvent_createdAt_idx" ON "MenuChangeEvent"("createdAt");
CREATE INDEX "MenuCategory_menuId_sortOrder_idx" ON "MenuCategory"("menuId", "sortOrder");
CREATE INDEX "MenuItem_menuId_sortOrder_idx" ON "MenuItem"("menuId", "sortOrder");
CREATE INDEX "Table_venueId_createdAt_idx" ON "Table"("venueId", "createdAt");

-- Foreign keys
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuChangeEvent" ADD CONSTRAINT "MenuChangeEvent_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuChangeEvent" ADD CONSTRAINT "MenuChangeEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
