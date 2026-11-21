// Shared notification constants (client and server).

/**
 * Deduplication window (PRD NOT-4): the same title + message to the same person within this
 * window is dropped, in-app and by email. Demo: checked in the database; Phase 1: Redis.
 */
export const DEDUP_MINUTES = 10;
