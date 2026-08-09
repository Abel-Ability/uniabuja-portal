// Minimal email transport: Resend via REST (no extra dependency).
// Without RESEND_API_KEY the app runs in demo mode: callers receive the
// verification link back and show it on-screen instead of sending an email.

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "UniAbuja Portal <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return RESEND_API_KEY.length > 0;
}

export type EmailResult = { ok: boolean; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)." };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Email send failed (${res.status}): ${body.slice(0, 200)}` };
  }
  return { ok: true };
}
