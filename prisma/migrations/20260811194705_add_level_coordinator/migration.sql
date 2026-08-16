-- CreateTable
CREATE TABLE "LevelCoordinator" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "coordinatorId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelCoordinator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LevelCoordinator_level_department_academicSession_key" ON "LevelCoordinator"("level", "department", "academicSession");

-- AddForeignKey
ALTER TABLE "LevelCoordinator" ADD CONSTRAINT "LevelCoordinator_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelCoordinator" ADD CONSTRAINT "LevelCoordinator_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
