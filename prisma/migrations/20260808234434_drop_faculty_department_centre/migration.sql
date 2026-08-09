/*
  Warnings:

  - You are about to drop the `Department` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DepartmentProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Faculty` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InstituteCentre` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `departmentId` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `departmentId` on the `Programme` table. All the data in the column will be lost.
  - You are about to drop the column `facultyId` on the `Programme` table. All the data in the column will be lost.
  - You are about to drop the column `departmentId` on the `StaffProfile` table. All the data in the column will be lost.
  - You are about to drop the column `departmentId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `facultyId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `facultyId` on the `Venue` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Department_code_key";

-- DropIndex
DROP INDEX "DepartmentProfile_departmentId_key";

-- DropIndex
DROP INDEX "Faculty_slug_key";

-- DropIndex
DROP INDEX "Faculty_code_key";

-- DropIndex
DROP INDEX "InstituteCentre_code_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Department";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DepartmentProfile";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Faculty";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InstituteCentre";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 150,
    "prerequisites" JSONB
);
INSERT INTO "new_Course" ("capacity", "code", "id", "level", "prerequisites", "semester", "title", "units") SELECT "capacity", "code", "id", "level", "prerequisites", "semester", "title", "units" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");
CREATE TABLE "new_Programme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programmeType" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "tuitionCents" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 200
);
INSERT INTO "new_Programme" ("capacity", "code", "durationYears", "id", "name", "programmeType", "tuitionCents") SELECT "capacity", "code", "durationYears", "id", "name", "programmeType", "tuitionCents" FROM "Programme";
DROP TABLE "Programme";
ALTER TABLE "new_Programme" RENAME TO "Programme";
CREATE UNIQUE INDEX "Programme_code_key" ON "Programme"("code");
CREATE TABLE "new_StaffProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "designation" TEXT,
    "orcid" TEXT,
    "scopUserId" TEXT,
    "bio" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StaffProfile" ("bio", "designation", "id", "orcid", "scopUserId", "updatedAt", "userId") SELECT "bio", "designation", "id", "orcid", "scopUserId", "updatedAt", "userId" FROM "StaffProfile";
DROP TABLE "StaffProfile";
ALTER TABLE "new_StaffProfile" RENAME TO "StaffProfile";
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "registrationNo" TEXT,
    "staffNo" TEXT,
    "jambNo" TEXT,
    "programmeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "failedAttempts", "firstName", "fullName", "id", "jambNo", "lastLoginAt", "lastName", "lockedUntil", "mfaEnabled", "mfaSecret", "mustChangePassword", "passwordHash", "phone", "programmeId", "registrationNo", "role", "staffNo", "status", "updatedAt", "username") SELECT "createdAt", "email", "failedAttempts", "firstName", "fullName", "id", "jambNo", "lastLoginAt", "lastName", "lockedUntil", "mfaEnabled", "mfaSecret", "mustChangePassword", "passwordHash", "phone", "programmeId", "registrationNo", "role", "staffNo", "status", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_registrationNo_key" ON "User"("registrationNo");
CREATE UNIQUE INDEX "User_staffNo_key" ON "User"("staffNo");
CREATE TABLE "new_Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "equipment" JSONB
);
INSERT INTO "new_Venue" ("building", "capacity", "equipment", "id", "name") SELECT "building", "capacity", "equipment", "id", "name" FROM "Venue";
DROP TABLE "Venue";
ALTER TABLE "new_Venue" RENAME TO "Venue";
CREATE UNIQUE INDEX "Venue_name_key" ON "Venue"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
