-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "applicantEmail" TEXT,
ADD COLUMN     "applicantName" TEXT,
ADD COLUMN     "applicantPhone" TEXT,
ADD COLUMN     "chairmanDecision" TEXT,
ADD COLUMN     "chairmanDecisionAt" TIMESTAMP(3),
ADD COLUMN     "chairmanDecisionNotes" TEXT,
ADD COLUMN     "chairmanDecisionUserId" TEXT,
ADD COLUMN     "committeeCategory" TEXT,
ADD COLUMN     "committeeJustification" TEXT,
ADD COLUMN     "committeeNotes" TEXT,
ADD COLUMN     "committeeSelectionAt" TIMESTAMP(3),
ADD COLUMN     "committeeSelectionUserId" TEXT,
ADD COLUMN     "compositeScore" DOUBLE PRECISION,
ADD COLUMN     "cutoffMet" BOOLEAN,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "eligible" BOOLEAN,
ADD COLUMN     "faculty" TEXT,
ADD COLUMN     "jambContribution" DOUBLE PRECISION,
ADD COLUMN     "jambRawScore" DOUBLE PRECISION,
ADD COLUMN     "meritRank" INTEGER,
ADD COLUMN     "olevelContribution" DOUBLE PRECISION,
ADD COLUMN     "olevelRawPoints" DOUBLE PRECISION,
ADD COLUMN     "olevelSubjects" JSONB,
ADD COLUMN     "postUtmContribution" DOUBLE PRECISION,
ADD COLUMN     "postUtmScore" DOUBLE PRECISION,
ADD COLUMN     "programmeCutoff" DOUBLE PRECISION,
ADD COLUMN     "programmeName" TEXT;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_committeeSelectionUserId_fkey" FOREIGN KEY ("committeeSelectionUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_chairmanDecisionUserId_fkey" FOREIGN KEY ("chairmanDecisionUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
