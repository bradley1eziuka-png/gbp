import { computeFlags } from './flags';
import { fmtTime } from './summary';
import { DAYS, DAY_LABELS, pruneData } from './validate';
import type { FormData } from './types';

/** Public Formspree form for Arclo GBP onboarding. Override with NEXT_PUBLIC_FORMSPREE_ENDPOINT (e.g. for testing). */
export const FORMSPREE_ENDPOINT = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || 'https://formspree.io/f/mqpewrak';

export interface AttachedFile {
  category: 'logo' | 'photos';
  name: string;
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const LABEL = {
  presence: { yes: 'Yes', no: 'No', unsure: 'Not sure' },
  mode: { visit: 'Storefront (customers visit)', travel: 'Service-area (travels to customers)', both: 'Both (storefront and service-area)' },
  hours: { set: 'Regular hours', '24-7': 'Open 24 hours, every day', appointment: 'By appointment only' },
  verify: { yes: 'Yes, can help with verification', assist: 'Needs assistance with verification' },
  yn: { yes: 'Yes', no: 'No' },
} as const;
const pick = (map: Record<string, string>, v: unknown) => map[s(v)] ?? s(v);

/** Human-readable fields for the Formspree dashboard. Contains only what the client typed, plus a few review notes. */
export function buildPayload(raw: FormData, ref: string, attached: AttachedFile[]): Record<string, string> {
  const d: FormData = { ...pruneData(raw), contactName: raw.contactName, contactEmail: raw.contactEmail };
  const out: Record<string, string> = {};
  const set = (k: string, v: unknown) => {
    const t = typeof v === 'string' ? v.trim() : '';
    if (t) out[k] = t;
  };

  out._subject = `New GBP onboarding: ${s(d.businessName)} (${ref})`;
  set('email', d.contactEmail); // Formspree uses "email" as the reply-to address
  set('Submission reference', ref);
  set('Submitted at (UTC)', new Date().toISOString());

  set('Contact name', d.contactName);
  set('Contact email', d.contactEmail);

  set('Business name', d.businessName);
  set('What the business does', d.whatWeDo);
  set('Business phone', d.phonePrimary);
  set('Website', d.website || '(none)');
  set('Already on Google Maps', pick(LABEL.presence, d.existingPresence));
  set('Google Maps listing link', d.mapsUrl);

  set('Business type', pick(LABEL.mode, d.serviceMode));
  set('Operating address', [s(d.addr_street), s(d.addr_city), s(d.addr_state), s(d.addr_zip), s(d.addr_country)].filter(Boolean).join(', '));
  set('Customers visit this address during business hours', pick(LABEL.yn, d.customerVisits));
  set('Cities and areas served', d.saAreas);

  set('Hours type', pick(LABEL.hours, d.hoursMode));
  if (d.hoursMode === 'set') {
    const hrs = (d.hours ?? {}) as Record<string, { state?: string; slots?: { open?: string; close?: string }[] }>;
    for (const day of DAYS) {
      const h = hrs[day];
      out[`Hours: ${DAY_LABELS[day]}`] = !h?.state
        ? 'Not provided'
        : h.state === 'closed'
          ? 'Closed'
          : (h.slots ?? []).map((x) => `${fmtTime(x.open)} - ${fmtTime(x.close)}`).join(' and ');
    }
  }

  set('Main services or products', d.servicesText);
  set('Services NOT offered', d.notOffered);

  set('Profile owner name', d.ownerName);
  set('Owner Google account email', d.ownerGoogleEmail);
  set('Verification contact phone', d.ownerPhoneSame ? `${s(d.phonePrimary)} (same as business phone)` : d.ownerPhone);
  set('Verification assistance', pick(LABEL.verify, d.verifyHelp));

  const media: Record<string, string> = {
    upload: attached.length ? 'Uploaded with this form' : 'Said they would upload, but nothing was attached',
    provided: 'Already provided to Arclo',
    later: 'Not right now',
  };
  set('Logo and photos', media[s(d.mediaStatus)] ?? s(d.mediaStatus));
  if (attached.length) set('Attached files', attached.map((f) => `${f.category === 'logo' ? 'Logo' : 'Photo'}: ${f.name}`).join(', '));

  set('Authorization confirmed', d.consentAuthorize ? 'Yes' : 'No');
  set('Completed by', s(d.completedBy) || `Profile owner (${s(d.ownerName)})`);

  const notes = computeFlags(d, attached)
    .filter((f) => f.severity !== 'info' || f.category === 'eligibility' || f.category === 'existing-listing')
    .map((f) => `[${f.severity}] ${f.message}`);
  if (notes.length) out['Review notes for Arclo'] = notes.join('\n');
  return out;
}

/** Short, readable reference the client can quote, e.g. GBP-7K3QM9. */
export function makeReference(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(6));
  return `GBP-${Array.from(b, (x) => alphabet[x % alphabet.length]).join('')}`;
}
