-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Faculty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Faculty_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Faculty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Faculty" ("code", "id", "name", "slug") SELECT "code", "id", "name", "slug" FROM "Faculty";
DROP TABLE "Faculty";
ALTER TABLE "new_Faculty" RENAME TO "Faculty";
CREATE UNIQUE INDEX "Faculty_code_key" ON "Faculty"("code");
CREATE UNIQUE INDEX "Faculty_slug_key" ON "Faculty"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
