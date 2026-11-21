-- Drawn signatures on approval steps (typed name stays in "signature")
ALTER TABLE "ApprovalStep" ADD COLUMN "signatureImage" TEXT;

-- Scheduled-run slot: one run per job per slot, even with several app servers
ALTER TABLE "JobRun" ADD COLUMN "slot" TEXT;
CREATE UNIQUE INDEX "JobRun_job_slot_key" ON "JobRun"("job", "slot");
