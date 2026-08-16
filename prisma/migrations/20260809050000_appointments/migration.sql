-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "unit" TEXT,
    "appointeeId" TEXT NOT NULL,
    "proposerId" TEXT,
    "approverId" TEXT,
    "recorderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "academicSession" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_appointeeId_idx" ON "Appointment"("appointeeId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_appointeeId_fkey" FOREIGN KEY ("appointeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_recorderId_fkey" FOREIGN KEY ("recorderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
