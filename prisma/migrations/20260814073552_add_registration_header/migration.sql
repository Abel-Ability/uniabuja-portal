-- AlterTable
ALTER TABLE "CourseRegistration" ADD COLUMN     "registrationId" TEXT;

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationReference" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FINALIZED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalisedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_registrationReference_key" ON "Registration"("registrationReference");

-- CreateIndex
CREATE INDEX "Registration_userId_idx" ON "Registration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_userId_academicSession_semester_key" ON "Registration"("userId", "academicSession", "semester");

-- CreateIndex
CREATE INDEX "CourseAssignment_courseCode_idx" ON "CourseAssignment"("courseCode");

-- CreateIndex
CREATE INDEX "CourseAssignment_lecturerId_idx" ON "CourseAssignment"("lecturerId");

-- CreateIndex
CREATE INDEX "CourseAssignment_department_academicSession_idx" ON "CourseAssignment"("department", "academicSession");

-- CreateIndex
CREATE INDEX "CourseAssignmentMember_lecturerId_idx" ON "CourseAssignmentMember"("lecturerId");

-- CreateIndex
CREATE INDEX "CourseRegistration_registrationId_idx" ON "CourseRegistration"("registrationId");

-- CreateIndex
CREATE INDEX "LevelCoordinator_coordinatorId_idx" ON "LevelCoordinator"("coordinatorId");

-- CreateIndex
CREATE INDEX "ResultCorrectionRequest_courseCode_idx" ON "ResultCorrectionRequest"("courseCode");

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CourseOffering_courseId_programmeId_academicSession_semester__i" RENAME TO "CourseOffering_courseId_programmeId_academicSession_semeste_key";
