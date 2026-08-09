-- CreateTable
CREATE TABLE "BreachLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'LOW',
    "description" TEXT NOT NULL,
    "notifiedNdpc" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BreachLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
