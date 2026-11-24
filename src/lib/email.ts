import nodemailer from "nodemailer";

// Mail delivery (PRD NOT-1). Configure ONE of these in .env.local:
//   SMTP_HOST, SMTP_PORT (587 or 465), SMTP_USER, SMTP_PASS    any SMTP provider (SES, Zoho, cPanel…)
//   GMAIL_USER, GMAIL_APP_PASSWORD                            a Google account with an app password
// MAIL_FROM sets the sender, e.g. "CIMP-BIIF <startup@cimp.ac.in>". With neither configured,
// development logs every email to the terminal instead of sending it.
export type MailAttachment = { filename: string; content: Buffer; contentType: string };
export type MailMode = "smtp" | "gmail" | "log";

export function mailMode(): MailMode {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  return "log";
}

export function fromAddress() {
  return process.env.MAIL_FROM || `"CIMP-BIIF" <${process.env.SMTP_USER || process.env.GMAIL_USER || "no-reply@localhost"}>`;
}

let cached: { key: string; t: nodemailer.Transporter } | null = null;
function transporter() {
  const mode = mailMode();
  const key = `${mode}:${process.env.SMTP_HOST}:${process.env.SMTP_USER}:${process.env.GMAIL_USER}`;
  if (cached?.key === key) return cached.t;
  const port = Number(process.env.SMTP_PORT || 587);
  const t = mode === "smtp"
    ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
    : nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  cached = { key, t };
  return t;
}

/** Check the connection and login with the mail server (used by the admin "send test email"). */
export async function verifyMail() {
  if (mailMode() === "log") return false;
  await transporter().verify();
  return true;
}

const mailer = {
  async sendMail(opts: { from: string; to: string; subject: string; html: string; attachments?: MailAttachment[] }) {
    if (mailMode() === "log") {
      // Production must send real email, unless MAIL_TRANSPORT=log is set on purpose (CI, staging).
      if (process.env.NODE_ENV === "production" && process.env.MAIL_TRANSPORT !== "log") throw new Error("Email is not configured (set SMTP_* or GMAIL_* in the environment)");
      console.log(`[email:dev] to=${opts.to} subject="${opts.subject}"${opts.attachments?.length ? ` attachments=${opts.attachments.map((a) => a.filename).join(",")}` : ""} (not sent: no mail server configured)`);
      return;
    }
    await transporter().sendMail(opts);
  },
};

// ─── OTP Email (already working) ──────────────────────────────────────────────

export async function sendOTPEmail(to: string, name: string, otp: string) {
  if (mailMode() === "log" && process.env.NODE_ENV !== "production") {
    console.log(`[email:dev] OTP for ${to}: ${otp}`);
    return;
  }
  await mailer.sendMail({
    from: fromAddress(),
    to,
    subject: "Your CIMP-BIIF verification code",
    html: `
      <div style="font-family:'Montserrat','Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;background:#F5F8F0;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#3F7A16;color:#fff;font-size:20px;font-weight:700;
                      padding:10px 20px;border-radius:10px;letter-spacing:1px;">CIMP-BIIF</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:32px;text-align:center;">
          <h2 style="color:#1C3510;margin:0 0 8px;">Verify your email</h2>
          <p style="color:#6A7860;font-size:14px;margin:0 0 24px;">Hi ${esc(name)}, enter this code to activate your account</p>
          <div style="font-size:44px;font-weight:800;letter-spacing:16px;color:#3F7A16;
                      background:#F2F8EA;padding:20px;border-radius:12px;margin-bottom:24px;">${otp}</div>
          <p style="color:#A3B096;font-size:12px;margin:0;">Expires in 10 minutes. Do not share this code.</p>
        </div>
      </div>
    `,
  });
}

// ─── Welcome / Onboarding Email ───────────────────────────────────────────────

const ROLE_META: Record<
  string,
  {
    headline: string;
    subline: string;
    steps: { icon: string; title: string; desc: string }[];
    tips: { icon: string; text: string }[];
    ctaLabel: string;
    ctaUrl: string;
  }
> = {
  incubatee: {
    headline: "You're officially inside. 🚀",
    subline:
      "Your account is verified and ready. Here's exactly what happens from here.",
    steps: [
      {
        icon: "📝",
        title: "Submit Your Application",
        desc: "Fill in your startup details — name, industry, and your core idea. Be specific and compelling.",
      },
      {
        icon: "🔍",
        title: "Manager Review",
        desc: "Our team reviews your submission and may reach out with questions through the messaging system.",
      },
      {
        icon: "👑",
        title: "CEO Final Decision",
        desc: "The CEO personally reviews shortlisted applications — and can fast-track exceptional ones.",
      },
      {
        icon: "🎉",
        title: "Welcome to the Portfolio",
        desc: "If approved, you'll be listed on our public portfolio and begin your incubation journey.",
      },
    ],
    tips: [
      {
        icon: "✍️",
        text: "Write your idea clearly — what problem, who it's for, why you can win.",
      },
      {
        icon: "📎",
        text: "Upload a pitch deck to stand out from other applicants.",
      },
      {
        icon: "💬",
        text: "Check your messages — the team may reach out directly.",
      },
    ],
    ctaLabel: "Submit My Application",
    ctaUrl: "/apply",
  },
  mentor: {
    headline: "Welcome to the CIMP-BIIF network. 🧭",
    subline: "Your account is verified. Complete your mentor profile so the team can review it.",
    steps: [
      { icon: "📝", title: "Complete Your Profile", desc: "Add your headline, expertise and the sectors you know best." },
      { icon: "🔍", title: "Office Review", desc: "The incubation team reviews your profile before it is listed." },
      { icon: "🤝", title: "Receive Requests", desc: "Startups request a connection; the office routes suitable ones to you to accept or decline." },
      { icon: "💼", title: "Join as an Investor (optional)", desc: "Once approved as a mentor, you can also apply to be listed as an investor." },
    ],
    tips: [
      { icon: "🎯", text: "Be specific about the problems you can help with." },
      { icon: "🌐", text: "Keep your profile public so founders can find you." },
      { icon: "⏱️", text: "Respond to routed requests quickly; founders are waiting." },
    ],
    ctaLabel: "Open Mentor Hub",
    ctaUrl: "/mentor",
  },
  manager: {
    headline: "Access granted. Let's evaluate. 🔍",
    subline:
      "Your manager account is live. You have full access to the review pipeline.",
    steps: [
      {
        icon: "📋",
        title: "View All Applications",
        desc: "See every startup application submitted — sorted by date, filterable by stage.",
      },
      {
        icon: "✅",
        title: "Approve or Reject",
        desc: "Review the idea, add notes, and move applications to the CEO queue or reject with a reason.",
      },
      {
        icon: "💬",
        title: "Message Applicants",
        desc: "Communicate directly with incubatees through the built-in messaging system.",
      },
      {
        icon: "📊",
        title: "Track the Pipeline",
        desc: "Monitor approval rates and pipeline health from your dashboard at a glance.",
      },
    ],
    tips: [
      {
        icon: "⚡",
        text: "Add a note when approving — it helps the CEO make faster decisions.",
      },
      {
        icon: "📬",
        text: "Check messages regularly — applicants may have questions.",
      },
      {
        icon: "🎯",
        text: "Use filters to focus on pending applications first.",
      },
    ],
    ctaLabel: "Go to Approvals",
    ctaUrl: "/approvals",
  },
  ceo: {
    headline: "Full command is yours. 👑",
    subline:
      "CEO access activated. Every lever in the system is now at your disposal.",
    steps: [
      {
        icon: "👑",
        title: "Final Approval Authority",
        desc: "Every application that reaches you has cleared manager review. Your decision is final.",
      },
      {
        icon: "⚡",
        title: "Fast-Track Power",
        desc: "Spot an exceptional application? Bypass manager review entirely with one click.",
      },
      {
        icon: "🌐",
        title: "Publish to Portfolio",
        desc: "Approved startups can be made public — showcasing your portfolio to the world.",
      },
      {
        icon: "📊",
        title: "Analytics Dashboard",
        desc: "See industry breakdown, pipeline stats, fast-track counts, and recent activity in real time.",
      },
    ],
    tips: [
      {
        icon: "⚡",
        text: "Fast-track is your biggest differentiator — use it for exceptional founders.",
      },
      {
        icon: "🌐",
        text: "Publishing to the portfolio builds credibility for your incubator brand.",
      },
      {
        icon: "📋",
        text: "Check the activity feed daily to stay on top of manager decisions.",
      },
    ],
    ctaLabel: "Open Command Center",
    ctaUrl: "/dashboard",
  },
};

export async function sendWelcomeEmail(
  to: string,
  name: string,
  role: string,
) {
  // Office roles without their own template use the manager (office) template.
  const meta = ROLE_META[role] ?? (role === "incubatee" ? ROLE_META.incubatee : ROLE_META.manager);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const stepsHtml = meta.steps
    .map(
      (s, i) => `
    <tr>
      <td style="padding:0 0 20px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="48" valign="top" style="padding-right:14px;">
              <div style="width:40px;height:40px;background:#F2F8EA;border:1px solid #E3F0D2;
                          border-radius:10px;text-align:center;line-height:40px;font-size:18px;">
                ${s.icon}
              </div>
            </td>
            <td valign="top">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                <span style="font-size:11px;font-weight:700;color:#A3B096;font-family:'Montserrat','Segoe UI',Arial,sans-serif;
                             letter-spacing:1px;">STEP ${i + 1}</span>
              </div>
              <p style="margin:0 0 3px;font-size:15px;font-weight:700;color:#1C3510;">${s.title}</p>
              <p style="margin:0;font-size:13px;color:#6A7860;line-height:1.6;">${s.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `,
    )
    .join("");

  const tipsHtml = meta.tips
    .map(
      (t) => `
    <tr>
      <td style="padding:0 0 10px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="28" style="font-size:16px;">${t.icon}</td>
            <td style="font-size:13px;color:#4A5A3F;line-height:1.5;">${t.text}</td>
          </tr>
        </table>
      </td>
    </tr>
  `,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#EAF2DF;font-family:'Montserrat','Segoe UI',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#EAF2DF;padding:40px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

      <!-- Logo header -->
      <tr>
        <td align="center" style="padding-bottom:28px;">
          <div style="display:inline-block;background:#3F7A16;color:#fff;font-size:18px;font-weight:800;
                      padding:10px 22px;border-radius:10px;letter-spacing:2px;">CIMP-BIIF</div>
        </td>
      </tr>

      <!-- Hero card -->
      <tr>
        <td style="background:#1C3510;border-radius:20px 20px 0 0;padding:48px 48px 40px;text-align:center;">
          <div style="font-size:52px;margin-bottom:16px;">🎊</div>
          <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.25;">
            ${meta.headline}
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#A3B096;line-height:1.6;max-width:400px;margin-left:auto;margin-right:auto;">
            ${meta.subline}
          </p>
          <!-- Role badge -->
          <div style="display:inline-block;background:rgba(111,174,46,0.15);border:1px solid rgba(111,174,46,0.3);
                      color:#A6D45A;font-size:11px;font-weight:700;letter-spacing:2px;
                      padding:6px 16px;border-radius:999px;font-family:'Montserrat','Segoe UI',Arial,sans-serif;text-transform:uppercase;">
            ${role === "ceo" ? "👑" : role === "manager" ? "🔍" : "🚀"} &nbsp; ${role}
          </div>
        </td>
      </tr>

      <!-- Greeting ribbon -->
      <tr>
        <td style="background:#3F7A16;padding:16px 48px;">
          <p style="margin:0;font-size:14px;color:#C8E2A6;">
            Welcome aboard, <strong style="color:#fff;">${esc(name)}</strong> —
            your account is verified and fully active.
          </p>
        </td>
      </tr>

      <!-- Steps section -->
      <tr>
        <td style="background:#ffffff;padding:36px 48px 28px;">
          <p style="margin:0 0 24px;font-size:11px;font-weight:700;color:#A3B096;letter-spacing:2px;
                    font-family:'Montserrat','Segoe UI',Arial,sans-serif;text-transform:uppercase;">What happens next</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${stepsHtml}
          </table>
        </td>
      </tr>

      <!-- Divider -->
      <tr>
        <td style="background:#ffffff;padding:0 48px;">
          <div style="height:1px;background:#DCE5D0;"></div>
        </td>
      </tr>

      <!-- Tips section -->
      <tr>
        <td style="background:#ffffff;padding:28px 48px 36px;">
          <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#A3B096;letter-spacing:2px;
                    font-family:'Montserrat','Segoe UI',Arial,sans-serif;text-transform:uppercase;">Quick-start tips</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${tipsHtml}
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background:#F9FBF5;border:1px solid #DCE5D0;border-top:none;
                   padding:32px 48px;text-align:center;">
          <a href="${appUrl}${meta.ctaUrl}"
             style="display:inline-block;background:#3F7A16;color:#ffffff;font-size:15px;
                    font-weight:700;text-decoration:none;padding:14px 36px;
                    border-radius:12px;letter-spacing:0.5px;">
            ${meta.ctaLabel} →
          </a>
        </td>
      </tr>

      <!-- Support footer -->
      <tr>
        <td style="background:#F5F8F0;border-radius:0 0 20px 20px;padding:28px 48px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;color:#6A7860;">
            Questions? Reply to this email or reach out at
            <a href="mailto:${process.env.SUPPORT_EMAIL || "startup@cimp.ac.in"}" style="color:#3F7A16;text-decoration:none;">
              ${process.env.SUPPORT_EMAIL || "startup@cimp.ac.in"}
            </a>
          </p>
          <p style="margin:0;font-size:11px;color:#A3B096;">
            © ${new Date().getFullYear()} CIMP-BIIF · You're receiving this because you just registered.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>
  `;

  await mailer.sendMail({
    from: fromAddress(),
    to,
    subject: `Welcome to CIMP-BIIF, ${name} — you're in. 🚀`,
    html,
  });
}

// ─── Event emails (PRD NOT-1): one short template for workflow updates ────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const TONE: Record<string, { bar: string; chip: string; label: string }> = {
  success: { bar: "#3F7A16", chip: "#F2F8EA", label: "Update" },
  info: { bar: "#3F7A16", chip: "#F2F8EA", label: "Update" },
  warning: { bar: "#E8891B", chip: "#FFF5E8", label: "Action needed" },
  error: { bar: "#B42318", chip: "#FEF3F2", label: "Decision" },
};

/**
 * Short transactional email. `title` and `message` may contain user input
 * (startup names, reviewer remarks) and are escaped here.
 */
export async function sendEventEmail(opts: {
  to: string; name: string; title: string; message: string;
  type?: "info" | "success" | "warning" | "error"; ctaLabel?: string; ctaPath?: string; attachments?: MailAttachment[];
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const tone = TONE[opts.type ?? "info"];
  const cta = opts.ctaPath
    ? `<a href="${esc(appUrl + opts.ctaPath)}" style="display:inline-block;background:#3F7A16;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;">${esc(opts.ctaLabel ?? "Open the portal")}</a>`
    : "";
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EAF2DF;font-family:'Montserrat','Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EAF2DF;padding:32px 16px;"><tr><td align="center">
  <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
    <tr><td align="center" style="padding-bottom:20px;">
      <div style="display:inline-block;background:#3F7A16;color:#fff;font-size:16px;font-weight:800;padding:8px 18px;border-radius:10px;letter-spacing:2px;">CIMP-BIIF</div>
    </td></tr>
    <tr><td style="background:#fff;border-radius:16px;border-top:4px solid ${tone.bar};padding:32px;">
      <div style="display:inline-block;background:${tone.chip};color:${tone.bar};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">${tone.label}</div>
      <h1 style="margin:14px 0 8px;font-size:22px;line-height:1.3;color:#1C3510;">${esc(opts.title)}</h1>
      <p style="margin:0 0 6px;font-size:14px;color:#4A5A3F;">Hi ${esc(opts.name)},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A5A3F;white-space:pre-line;">${esc(opts.message)}</p>
      ${cta}
    </td></tr>
    <tr><td style="padding:18px 8px;text-align:center;font-size:11px;color:#6A7860;line-height:1.6;">
      CIMP Business Incubation and Innovation Foundation, Patna.<br>You receive this because you have an account on the CIMP-BIIF portal.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  await mailer.sendMail({ from: fromAddress(), to: opts.to, subject: `${opts.title} · CIMP-BIIF`, html, attachments: opts.attachments });
}

// ─── Password reset (PRD AUTH-4) ──────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, name: string, link: string) {
  if (mailMode() === "log" && process.env.NODE_ENV !== "production") {
    console.log(`[email:dev] Password reset link for ${to}: ${link}`);
    return;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sendEventEmail({
    to, name, type: "warning",
    title: "Reset your password",
    message: "Someone (we hope you) asked to reset the password of your CIMP-BIIF account. The link below works once, for 30 minutes.\n\nIf you did not ask for this, ignore this email: your password stays the same.",
    ctaLabel: "Choose a new password",
    ctaPath: link.startsWith(appUrl) ? link.slice(appUrl.length) : link,
  });
}

// ─── Sign-up with an address that already has an account ─────────────────────
// Sign-up answers the same either way (so it cannot be used to test which addresses are
// registered); the owner of the address learns what happened from this email.

export async function sendAccountExistsEmail(to: string, name: string) {
  if (mailMode() === "log" && process.env.NODE_ENV !== "production") {
    console.log(`[email:dev] Sign-up attempted for existing account ${to}`);
    return;
  }
  await sendEventEmail({
    to, name, type: "info",
    title: "You already have an account",
    message: "Someone (we hope you) tried to create a CIMP-BIIF account with this email address, but it already has one.\n\nSign in instead. If you forgot your password, use “Forgot password” on the sign-in page. If this was not you, you can ignore this email.",
    ctaLabel: "Sign in",
    ctaPath: "/login",
  });
}
