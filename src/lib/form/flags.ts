import { STEPS } from './steps';
import { buildContext } from './logic';
import type { FileMeta, Flag, FormData } from './types';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Review items for Arclo, derived from the answers on read (never stored). */
export function computeFlags(data: FormData, files: Pick<FileMeta, 'category'>[] = []): Flag[] {
  const flags: Flag[] = [];
  const add = (f: Omit<Flag, 'id'>) => flags.push({ ...f, id: `${f.category}-${flags.length}` });
  const ctx = buildContext(data);
  void STEPS;

  /* eligibility */
  if (/\b(online[- ]only|online|virtual|remote|e-?commerce|digital|web ?based)\b/i.test(str(data.whatWeDo)))
    add({ severity: 'attention', category: 'eligibility', stepId: 'business', message: 'Description mentions online/remote work. Confirm the business has in-person customer contact before creating a profile.' });
  if (ctx.$visits && data.customerVisits === 'no')
    add({ severity: 'attention', category: 'eligibility', stepId: 'location', message: 'Client says customers visit, but also that customers do not visit this address. It may not qualify to show an address; consider a service-area setup with the address hidden. Clarify.' });
  if (data.serviceMode === 'travel' && data.customerVisits === 'no')
    add({ severity: 'info', category: 'eligibility', stepId: 'location', message: 'Travels to customers, no customer visits: set up as a service-area business with the address hidden (Google may still need it for verification).' });
  if (data.serviceMode === 'travel' && data.customerVisits === 'yes')
    add({ severity: 'info', category: 'eligibility', stepId: 'location', message: 'Travels to customers but customers also visit the address. Confirm whether to show the address.' });

  /* existing listing */
  if (data.existingPresence === 'yes')
    add({ severity: 'attention', category: 'existing-listing', stepId: 'business', message: data.mapsUrl ? 'Already on Google Maps. Check the linked listing and arrange ownership; do not create a duplicate.' : 'Already on Google Maps but no link given. Find the listing and arrange ownership; do not create a duplicate.' });
  if (data.existingPresence === 'unsure')
    add({ severity: 'attention', category: 'existing-listing', stepId: 'business', message: 'Client is unsure whether a listing exists. Search Google Maps thoroughly before creating one.' });
  if (data.existingPresence === 'no')
    add({ severity: 'info', category: 'existing-listing', stepId: 'business', message: 'Client says no listing exists. Still search Google Maps by name, address, and phone before creating.' });

  /* verification */
  if (data.verifyHelp === 'assist')
    add({ severity: 'attention', category: 'verification', stepId: 'google', message: 'Client needs assistance with verification. Plan to walk them through it.' });

  /* media */
  if (data.mediaStatus === 'provided')
    add({ severity: 'info', category: 'media', stepId: 'finish', message: 'Client says logo/photos were already provided (website onboarding). Locate them.' });
  else if (data.mediaStatus === 'later')
    add({ severity: 'info', category: 'media', stepId: 'finish', message: 'No logo/photos yet. Request them later.' });
  else if (data.mediaStatus === 'upload' && files.length === 0)
    add({ severity: 'attention', category: 'media', stepId: 'finish', message: 'Client said they would upload media but none was uploaded.' });

  if (data.hoursMode === 'appointment')
    add({ severity: 'info', category: 'missing', stepId: 'hours', message: 'Appointment-only: no set hours given.' });

  add({ severity: 'info', category: 'categories', stepId: 'services', message: 'Choose categories from Google’s current list based on the business description and services.' });

  const order = { blocker: 0, attention: 1, info: 2 } as const;
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
