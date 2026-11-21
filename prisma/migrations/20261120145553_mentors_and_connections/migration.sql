-- CreateTable
CREATE TABLE "MentorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "organisation" TEXT,
    "expertise" TEXT NOT NULL,
    "sectors" TEXT[],
    "bio" TEXT,
    "linkedin" TEXT,
    "yearsExperience" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "investorStatus" TEXT NOT NULL DEFAULT 'none',
    "investorThesis" TEXT,
    "ticketSize" TEXT,
    "investorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "incubateeId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'mentorship',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionStep" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "remark" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorProfile_userId_key" ON "MentorProfile"("userId");

-- CreateIndex
CREATE INDEX "MentorProfile_status_idx" ON "MentorProfile"("status");

-- CreateIndex
CREATE INDEX "Connection_incubateeId_idx" ON "Connection"("incubateeId");

-- CreateIndex
CREATE INDEX "Connection_mentorId_idx" ON "Connection"("mentorId");

-- CreateIndex
CREATE INDEX "Connection_status_idx" ON "Connection"("status");

-- CreateIndex
CREATE INDEX "ConnectionStep_connectionId_idx" ON "ConnectionStep"("connectionId");

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_incubateeId_fkey" FOREIGN KEY ("incubateeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionStep" ADD CONSTRAINT "ConnectionStep_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
