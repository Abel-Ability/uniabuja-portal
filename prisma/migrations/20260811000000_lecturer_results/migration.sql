-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "resultKind" TEXT NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "ResultFile" (
    "id" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NORMAL',
    "academicSession" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "caMax" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "rawCsv" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResultFile_lecturerId_idx" ON "ResultFile"("lecturerId");

-- AddForeignKey
ALTER TABLE "ResultFile" ADD CONSTRAINT "ResultFile_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ResultCorrectionRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "studentMatricNo" TEXT NOT NULL,
    "studentName" TEXT,
    "currentGrade" TEXT,
    "requestedChange" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResultCorrectionRequest_requesterId_idx" ON "ResultCorrectionRequest"("requesterId");

-- AddForeignKey
ALTER TABLE "ResultCorrectionRequest" ADD CONSTRAINT "ResultCorrectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
