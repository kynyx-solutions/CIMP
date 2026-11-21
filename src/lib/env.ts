// Environment check at server start (PRD §8: validate environment variables).
// In production a missing or weak required setting stops the server with a clear message;
// in development the same problems are printed as warnings.

type Issue = { level: "error" | "warn"; msg: string };

export function checkEnv(env: NodeJS.ProcessEnv = process.env): Issue[] {
  const prod = env.NODE_ENV === "production";
  const issues: Issue[] = [];
  const need = (ok: boolean, msg: string) => { if (!ok) issues.push({ level: prod ? "error" : "warn", msg }); };
  const warn = (ok: boolean, msg: string) => { if (!ok) issues.push({ level: "warn", msg }); };

  need(!!env.DATABASE_URL && /^postgres(ql)?:\/\//.test(env.DATABASE_URL), "DATABASE_URL must be a postgresql:// connection string");
  need((env.JWT_SECRET ?? "").length >= 32, "JWT_SECRET must be at least 32 random characters (e.g. `openssl rand -base64 48`)");
  need(!!env.COMPANY_EMAIL_DOMAINS?.trim(), "COMPANY_EMAIL_DOMAINS must list the office email domain(s), e.g. cimp.ac.in");
  const url = env.NEXT_PUBLIC_APP_URL ?? "";
  need(/^https?:\/\//.test(url), "NEXT_PUBLIC_APP_URL must be the portal's public address");
  if (prod) need(url.startsWith("https://"), "NEXT_PUBLIC_APP_URL must use https:// in production");
  if (env.SCHEDULER_ENABLED === "false") need((env.CRON_SECRET ?? "").length >= 24, "CRON_SECRET (24+ characters) is required when SCHEDULER_ENABLED=false");

  if (env.STORAGE_DRIVER === "s3")
    for (const k of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) need(!!env[k], `${k} is required when STORAGE_DRIVER=s3`);

  // Sign-up codes go by email, so production needs a mail account (MAIL_TRANSPORT=log only for CI/staging).
  const mail = !!(env.SMTP_HOST || env.GMAIL_USER);
  if (env.MAIL_TRANSPORT === "log") warn(!prod, "MAIL_TRANSPORT=log: emails are not sent, only noted in the log (CI or staging only)");
  else need(mail, "A mail account is required (SMTP_HOST/SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD): sign-up codes are sent by email");
  warn(!!env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY is not set: the AI assistant stays unavailable");
  return issues;
}

/** Print problems; throw in production when a required setting is missing. */
export function validateEnv() {
  const issues = checkEnv();
  for (const i of issues) (i.level === "error" ? console.error : console.warn)(`[env] ${i.level === "error" ? "ERROR" : "warning"}: ${i.msg}`);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) throw new Error(`Server not started: ${errors.length} required setting(s) missing or invalid. See the [env] lines above.`);
}
