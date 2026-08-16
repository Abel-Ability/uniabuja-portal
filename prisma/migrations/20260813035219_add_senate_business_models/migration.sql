-- CreateTable
CREATE TABLE "SenateMatter" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "session" TEXT NOT NULL DEFAULT '2025/2026',
    "submittedById" TEXT NOT NULL,
    "screenedById" TEXT,
    "screenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenateMatter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenateDecision" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "decisionBody" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenateDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenateAgenda" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "session" TEXT NOT NULL DEFAULT '2025/2026',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "items" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenateAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SenateMatter_reference_key" ON "SenateMatter"("reference");

-- CreateIndex
CREATE INDEX "SenateMatter_status_idx" ON "SenateMatter"("status");

-- CreateIndex
CREATE INDEX "SenateMatter_session_idx" ON "SenateMatter"("session");

-- CreateIndex
CREATE UNIQUE INDEX "SenateDecision_matterId_key" ON "SenateDecision"("matterId");

-- CreateIndex
CREATE INDEX "SenateDecision_recordedById_idx" ON "SenateDecision"("recordedById");

-- CreateIndex
CREATE INDEX "SenateAgenda_status_idx" ON "SenateAgenda"("status");

-- AddForeignKey
ALTER TABLE "SenateMatter" ADD CONSTRAINT "SenateMatter_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenateMatter" ADD CONSTRAINT "SenateMatter_screenedById_fkey" FOREIGN KEY ("screenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenateDecision" ADD CONSTRAINT "SenateDecision_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "SenateMatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenateDecision" ADD CONSTRAINT "SenateDecision_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenateAgenda" ADD CONSTRAINT "SenateAgenda_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
