-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "changeRequest" TEXT,
ADD COLUMN     "returnedFrom" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAt" TIMESTAMP(3);
