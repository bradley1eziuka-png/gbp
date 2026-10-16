import { appUrl, emailConfig } from './config';

export type EmailResult = { status: 'sent' | 'not_configured' | 'failed'; error?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Sends through Resend's REST API (https://resend.com). Returns "not_configured" rather than
 * pretending to send when RESEND_API_KEY / EMAIL_FROM are missing.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<EmailResult> {
  const cfg = emailConfig();
  if (!cfg) return { status: 'not_configured' };
  if (!to) return { status: 'not_configured', error: 'No recipient' };
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#10213a;line-height:1.55;max-width:560px">${esc(text)
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`)
    .join('')}</div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: 'failed', error: `Email provider responded ${res.status}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export const resumeEmail = (name: string, token: string) => ({
  subject: 'Your Google Business Profile setup: resume link',
  text: `Hi ${name},\n\nYou can pick up your Google Business Profile setup exactly where you left off using this private link:\n\n${appUrl()}/form/${token}\n\nAnyone with this link can view and edit your answers, so please don’t forward it. The link stays active for 60 days after you last save.\n\nArclo`,
});

export const confirmationEmail = (name: string, business: string, id: string) => ({
  subject: `We received your Google Business Profile details (${id})`,
  text: `Hi ${name},\n\nThank you, we’ve received the Google Business Profile information for ${business}.\n\nYour reference: ${id}\n\nWe’ll review your details and check Google for any existing listing. We’ll contact you if we need anything else. Google controls verification and eligibility, so we can’t promise a particular outcome or timeline.\n\nPlease don’t send passwords, ID documents, or financial details by email. We never need them.\n\nArclo`,
});

export const notifyEmail = (business: string, id: string, internalId: string, blockers: number, attention: number) => ({
  subject: `New GBP onboarding: ${business} (${id})`,
  text: `A new Google Business Profile onboarding form was submitted.\n\nBusiness: ${business}\nReference: ${id}\nFlags: ${blockers} blocker(s), ${attention} needing attention\n\nReview it (admin sign-in required): ${appUrl()}/admin/${internalId}`,
});
