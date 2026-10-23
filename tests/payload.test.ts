import { describe, expect, it } from 'vitest';
import { buildPayload, makeReference } from '@/lib/form/payload';

const week = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri'].map((d) => [d, { state: 'open', slots: [{ open: '08:00', close: '17:00' }] }]));
Object.assign(week, { sat: { state: 'closed', slots: [] }, sun: { state: 'closed', slots: [] } });

const data = {
  contactName: 'Sam', contactEmail: 'sam@gmail.com',
  businessName: 'Acme', whatWeDo: 'Drywall', phonePrimary: '555-123-4567', existingPresence: 'yes', mapsUrl: 'https://maps.app.goo.gl/x',
  serviceMode: 'both', addr_street: '1 Main', addr_city: 'Monroe', addr_state: 'MI', addr_zip: '48161', addr_country: 'United States',
  customerVisits: 'no', saAreas: 'Monroe, Toledo', hoursMode: 'set', hours: week, servicesText: 'Repair', ownerName: 'Pat', ownerGoogleEmail: 'p@gmail.com',
  ownerPhoneSame: true, verifyHelp: 'assist', mediaStatus: 'upload', consentAuthorize: true, completedBy: 'Office manager', evil: 'dropped',
};

describe('Formspree payload', () => {
  const p = buildPayload(data, 'GBP-TEST01', [{ category: 'logo', name: 'logo.png' }, { category: 'photos', name: 'a.jpg' }]);
  it('uses clear, human-readable field names and values', () => {
    expect(p['Contact name']).toBe('Sam');
    expect(p.email).toBe('sam@gmail.com');
    expect(p['Business name']).toBe('Acme');
    expect(p['Already on Google Maps']).toBe('Yes');
    expect(p['Business type']).toBe('Both (storefront and service-area)');
    expect(p['Operating address']).toBe('1 Main, Monroe, MI, 48161, United States');
    expect(p['Customers visit this address during business hours']).toBe('No');
    expect(p['Cities and areas served']).toBe('Monroe, Toledo');
    expect(p['Hours: Monday']).toBe('8:00 AM - 5:00 PM');
    expect(p['Hours: Saturday']).toBe('Closed');
    expect(p['Verification contact phone']).toBe('555-123-4567 (same as business phone)');
    expect(p['Verification assistance']).toBe('Needs assistance with verification');
    expect(p['Authorization confirmed']).toBe('Yes');
    expect(p['Completed by']).toBe('Office manager');
    expect(p['Submission reference']).toBe('GBP-TEST01');
    expect(p['Attached files']).toBe('Logo: logo.png, Photo: a.jpg');
    expect(p._subject).toContain('GBP-TEST01');
  });
  it('drops unknown keys and includes review notes', () => {
    expect(JSON.stringify(p)).not.toContain('dropped');
    expect(p['Review notes for Arclo']).toContain('Already on Google Maps');
  });
  it('omits hours rows for appointment-only and notes missing uploads', () => {
    const q = buildPayload({ ...data, hoursMode: 'appointment' }, 'GBP-X', []);
    expect(Object.keys(q).some((k) => k.startsWith('Hours: '))).toBe(false);
    expect(q['Logo and photos']).toBe('Said they would upload, but nothing was attached');
  });
  it('makes short unique references', () => {
    const refs = new Set(Array.from({ length: 200 }, makeReference));
    expect(refs.size).toBe(200);
    expect([...refs][0]).toMatch(/^GBP-[A-Z2-9]{6}$/);
  });
});
