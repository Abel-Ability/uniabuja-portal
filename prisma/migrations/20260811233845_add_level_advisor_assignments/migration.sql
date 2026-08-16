-- CreateTable
CREATE TABLE "LevelAdvisorAssignment" (
    "id" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "faculty" TEXT,
    "department" TEXT NOT NULL,
    "programmeId" TEXT,
    "level" INTEGER NOT NULL,
    "adviserId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelAdvisorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LevelAdvisorAssignment_adviserId_status_idx" ON "LevelAdvisorAssignment"("adviserId", "status");

-- CreateIndex
CREATE INDEX "LevelAdvisorAssignment_department_academicSession_idx" ON "LevelAdvisorAssignment"("department", "academicSession");

-- CreateIndex
CREATE UNIQUE INDEX "LevelAdvisorAssignment_department_academicSession_level_pro_key" ON "LevelAdvisorAssignment"("department", "academicSession", "level", "programmeId");

-- AddForeignKey
ALTER TABLE "LevelAdvisorAssignment" ADD CONSTRAINT "LevelAdvisorAssignment_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelAdvisorAssignment" ADD CONSTRAINT "LevelAdvisorAssignment_adviserId_fkey" FOREIGN KEY ("adviserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelAdvisorAssignment" ADD CONSTRAINT "LevelAdvisorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
