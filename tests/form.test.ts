import { describe, expect, it } from 'vitest';
import { computeFlags } from '@/lib/form/flags';
import { buildContext, visibleFields } from '@/lib/form/logic';
import { STEPS, STEP_BY_ID } from '@/lib/form/steps';
import { buildSummary } from '@/lib/form/summary';
import { normalizeUrl, pruneData, validateAll, validateStep } from '@/lib/form/validate';

const ids = (stepId: string, data: Record<string, unknown>) =>
  visibleFields(STEP_BY_ID[stepId].fields, buildContext(data)).map((f) => f.id);

const week = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { state: 'closed' }]));
const valid = {
  businessName: 'Acme Drywall', whatWeDo: 'Drywall repair', phonePrimary: '(555) 123-4567', existingPresence: 'no',
  serviceMode: 'visit', addr_street: '1 Main St', addr_city: 'Monroe', addr_state: 'MI', addr_zip: '48161', addr_country: 'United States',
  customerVisits: 'yes', hoursMode: 'set', hours: week, servicesText: 'Drywall repair',
  ownerName: 'Sam Rivera', ownerGoogleEmail: 'sam@example.com', ownerPhoneSame: true, verifyHelp: 'yes',
  mediaStatus: 'later', consentAuthorize: true,
};

describe('simplified form shape', () => {
  it('has exactly 6 short steps and no removed sections', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['business', 'location', 'hours', 'services', 'google', 'finish']);
    const all = STEPS.flatMap((s) => s.fields.map((f) => f.id)).join(' ');
    expect(all).not.toMatch(/legal|entity|industry|review|social|pricing|parking|accessib|menu|brands|managers|history|differentiators/i);
  });
  it('never asks for credentials or sensitive identifiers', () => {
    const forbidden = /^(password|passcode|pwd|ssn|socialsecurity|taxid|ein|bank|routing|account(number)?|backupcode|twofactor|2fa|otp|securityanswer)/i;
    expect(STEPS.flatMap((s) => s.fields.map((f) => f.id)).filter((id) => forbidden.test(id))).toEqual([]);
  });
  it('valid minimal answers pass whole-form validation', () => {
    expect(validateAll(valid).errors).toEqual({});
  });
});

describe('conditional logic', () => {
  it('asks for service areas only when travelling', () => {
    expect(ids('location', { serviceMode: 'visit' })).not.toContain('saAreas');
    expect(ids('location', { serviceMode: 'travel' })).toContain('saAreas');
    expect(ids('location', { serviceMode: 'both' })).toContain('saAreas');
  });
  it('asks for the listing link only when already listed', () => {
    expect(ids('business', { existingPresence: 'no' })).not.toContain('mapsUrl');
    expect(ids('business', { existingPresence: 'yes' })).toContain('mapsUrl');
  });
  it('shows weekly hours only for regular hours', () => {
    expect(ids('hours', { hoursMode: 'set' })).toContain('hours');
    expect(ids('hours', { hoursMode: '24-7' })).not.toContain('hours');
    expect(ids('hours', { hoursMode: 'appointment' })).not.toContain('hours');
  });
  it('asks for an owner phone unless "same as business phone"', () => {
    expect(ids('google', {})).toContain('ownerPhone');
    expect(ids('google', { ownerPhoneSame: true })).not.toContain('ownerPhone');
  });
  it('shows uploads only when the client will upload', () => {
    expect(ids('finish', { mediaStatus: 'upload' })).toEqual(expect.arrayContaining(['f-logo', 'f-photos']));
    expect(ids('finish', { mediaStatus: 'provided' })).not.toContain('f-logo');
  });
});

describe('validation', () => {
  it('requires the essentials', () => {
    const e = validateAll({}).errors;
    for (const k of ['businessName', 'whatWeDo', 'phonePrimary', 'existingPresence', 'serviceMode', 'addr_street', 'customerVisits', 'hoursMode', 'servicesText', 'ownerName', 'ownerGoogleEmail', 'verifyHelp', 'mediaStatus', 'consentAuthorize'])
      expect(e[k], k).toBeTruthy();
    expect(e.website).toBeUndefined();
    expect(e.notOffered).toBeUndefined();
  });
  it('requires service areas for travelling businesses, owner phone when different', () => {
    expect(validateStep(STEP_BY_ID.location, { ...valid, serviceMode: 'travel' }).saAreas).toBeTruthy();
    expect(validateStep(STEP_BY_ID.google, { ...valid, ownerPhoneSame: false }).ownerPhone).toBeTruthy();
  });
  it('validates formats', () => {
    expect(validateStep(STEP_BY_ID.business, { ...valid, phonePrimary: 'abc', website: 'javascript:alert(1)' }).phonePrimary).toBeTruthy();
    expect(validateStep(STEP_BY_ID.business, { ...valid, website: 'javascript:alert(1)' }).website).toBeTruthy();
    expect(validateStep(STEP_BY_ID.google, { ...valid, ownerGoogleEmail: 'nope' }).ownerGoogleEmail).toBeTruthy();
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('data:text/html,hi')).toBeNull();
  });
  it('validates hours day by day', () => {
    expect(validateStep(STEP_BY_ID.hours, { hoursMode: 'set' }).hours).toBeTruthy();
    expect(validateStep(STEP_BY_ID.hours, { hoursMode: 'set', hours: week }).hours).toBeUndefined();
    expect(validateStep(STEP_BY_ID.hours, { hoursMode: 'set', hours: { ...week, mon: { state: 'open', slots: [{ open: '09:00', close: '' }] } } }).hours).toBeTruthy();
  });
  it('requires the authorization checkbox', () => {
    expect(validateStep(STEP_BY_ID.finish, { ...valid, consentAuthorize: false }).consentAuthorize).toBeTruthy();
  });
});

describe('pruning', () => {
  it('drops hidden and unknown answers on submit, keeps hidden in drafts', () => {
    const data = { ...valid, serviceMode: 'visit', saAreas: 'Detroit', evil: 'x', businessName: ' Acme ' };
    const out = pruneData(data);
    expect(out.saAreas).toBeUndefined();
    expect(out.evil).toBeUndefined();
    expect(out.businessName).toBe('Acme');
    expect(pruneData(data, { keepHidden: true }).saAreas).toBe('Detroit');
  });
});

describe('flags & summary', () => {
  it('flags non-qualifying situations for review rather than promising eligibility', () => {
    expect(computeFlags({ whatWeDo: 'Online marketing courses' }).some((f) => f.category === 'eligibility')).toBe(true);
    expect(computeFlags({ serviceMode: 'visit', customerVisits: 'no' }).some((f) => f.severity === 'attention' && f.category === 'eligibility')).toBe(true);
    expect(computeFlags({ serviceMode: 'travel', customerVisits: 'no' }).some((f) => f.message.includes('service-area'))).toBe(true);
  });
  it('flags existing listings, verification help and missing media', () => {
    const f = computeFlags({ existingPresence: 'yes', verifyHelp: 'assist', mediaStatus: 'upload' }, []);
    expect(f.some((x) => x.category === 'existing-listing')).toBe(true);
    expect(f.some((x) => x.category === 'verification')).toBe(true);
    expect(f.some((x) => x.category === 'media' && x.severity === 'attention')).toBe(true);
  });
  it('summarises answers with labels and keeps legacy answers readable', () => {
    const s = buildSummary({ serviceMode: 'travel', oldField: 'kept' });
    expect(s.find((x) => x.stepId === 'location')!.rows[0].value).toContain('travel to customers');
    expect(s.find((x) => x.stepId === 'legacy')!.rows[0]).toMatchObject({ id: 'oldField', value: 'kept' });
  });
});
