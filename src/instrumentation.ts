// Runs once when a Next.js server process starts: starts the in-app scheduler for reminders,
// ID-card renewal and the Excel export processor.
// The import must sit directly inside the NEXT_RUNTIME check: Next compiles this file for the
// edge runtime too, and only this pattern keeps Node-only modules (nodemailer, fs) out of it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return; // not while building
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
