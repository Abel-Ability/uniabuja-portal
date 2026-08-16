-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "studentCategory" TEXT;
