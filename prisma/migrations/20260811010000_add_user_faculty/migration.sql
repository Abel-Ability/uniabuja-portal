-- Add faculty to staff users (matches the Fac_Dept_All structure).
ALTER TABLE "User" ADD COLUMN "faculty" TEXT;
