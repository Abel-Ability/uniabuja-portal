-- CreateTable
CREATE TABLE "CommitteeMembership" (
    "id" TEXT NOT NULL,
    "committee" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommitteeMembership_committee_status_idx" ON "CommitteeMembership"("committee", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMembership_committee_userId_key" ON "CommitteeMembership"("committee", "userId");

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
