-- CreateTable
CREATE TABLE "CourseAssignmentMember" (
    "id" TEXT NOT NULL,
    "courseAssignmentId" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAssignmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseAssignmentMember_courseAssignmentId_lecturerId_key" ON "CourseAssignmentMember"("courseAssignmentId", "lecturerId");

-- AddForeignKey
ALTER TABLE "CourseAssignmentMember" ADD CONSTRAINT "CourseAssignmentMember_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "CourseAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignmentMember" ADD CONSTRAINT "CourseAssignmentMember_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
