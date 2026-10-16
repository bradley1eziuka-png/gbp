// End-to-end smoke test against a running server.
//   DATA_DIR=/tmp/x npm run build && DATA_DIR=/tmp/x npx next start -p 3111
//   E2E_BASE=http://localhost:3111 E2E_ADMIN_EMAIL=.. E2E_ADMIN_PASSWORD=.. DATA_DIR=/tmp/x node tests/e2e.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.E2E_BASE || 'http://localhost:3111';
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`);
};
const H = { 'Content-Type': 'application/json', Origin: BASE };
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

const week = Object.fromEntries(['mon','tue','wed','thu','fri'].map(d => [d, { state: 'open', slots: [{ open: '08:00', close: '17:00' }] }]));
week.sat = { state: 'closed', slots: [] }; week.sun = { state: 'closed', slots: [] };

const answers = {
  businessName: 'Northwind Plumbing', whatWeDo: 'Residential plumbing repair and installs.', phonePrimary: '(303) 555-0142', website: 'northwind.example',
  existingPresence: 'no',
  serviceMode: 'travel', addr_street: '12 Test Lane', addr_city: 'Denver', addr_state: 'CO', addr_zip: '80202', addr_country: 'United States',
  customerVisits: 'no', saAreas: 'Denver, Aurora',
  hoursMode: 'set', hours: week,
  servicesText: 'Drain cleaning, water heater install',
  ownerName: 'Sam Rivera', ownerGoogleEmail: 'sam@northwind.example', ownerPhoneSame: true, verifyHelp: 'yes',
  mediaStatus: 'upload',
  consentAuthorize: true,
};
const PNG = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.from('arclo-test-image-bytes-0123456789')]);

// --- client flow ---------------------------------------------------------
let r = await fetch(`${BASE}/api/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Sam', email: 'sam@northwind.example', ts: Date.now() - 5000 }) });
check('CSRF: draft creation without Origin is blocked', r.status === 403, r.status);

r = await fetch(`${BASE}/api/drafts`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Bot', email: 'bot@x.com', hp: 'gotcha', ts: Date.now() - 5000 }) });
const fake = await j(r);
check('Honeypot: bot gets a fake token', r.ok && !!fake.token);
r = await fetch(`${BASE}/api/drafts/${fake.token}`);
check('Honeypot: fake token resolves to nothing', r.status === 404);

r = await fetch(`${BASE}/api/drafts`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Sam Rivera', email: 'sam@northwind.example', ts: Date.now() - 5000 }) });
const created = await j(r);
check('Create draft', r.ok && created.token?.length >= 40, JSON.stringify(created));
check('Email honestly reported as not configured', created.emailStatus === 'not_configured', created.emailStatus);
const token = created.token;

r = await fetch(`${BASE}/api/drafts/${token}`);
const loaded = await j(r);
check('Load draft prefilled with contact', loaded.data?.contactName === 'Sam Rivera' && loaded.data?.contactEmail === 'sam@northwind.example');

r = await fetch(`${BASE}/api/drafts/${token}`, { method: 'PUT', headers: H, body: JSON.stringify({ data: { ...answers, evil: 'x' }, step: 3 }) });
check('Autosave draft', r.ok);
r = await fetch(`${BASE}/api/drafts/${token}`);
const reloaded = await j(r);
check('Resume returns saved answers + step, strips unknown keys', reloaded.data?.businessName === 'Northwind Plumbing' && reloaded.step === 3 && reloaded.data?.evil === undefined);

// bad upload attempts
const fd = (buf, name, category) => { const f = new FormData(); f.append('category', category); f.append('file', new Blob([buf]), name); return f; };
r = await fetch(`${BASE}/api/drafts/${token}/files`, { method: 'POST', headers: { Origin: BASE }, body: fd(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'logo.png', 'logo') });
check('Upload: SVG disguised as .png rejected by content sniffing', r.status === 415, r.status);
r = await fetch(`${BASE}/api/drafts/${token}/files`, { method: 'POST', headers: { Origin: BASE }, body: fd(PNG, 'x.png', 'not-a-category') });
check('Upload: unknown category rejected', r.status === 400, r.status);
r = await fetch(`${BASE}/api/drafts/${token}/files`, { method: 'POST', body: fd(PNG, 'x.png', 'logo') });
check('Upload: missing Origin blocked', r.status === 403, r.status);
r = await fetch(`${BASE}/api/drafts/${token}/files`, { method: 'POST', headers: { Origin: BASE }, body: fd(Buffer.concat([PNG, Buffer.alloc(1000)]), '../../etc/passwd.png', 'logo') });
const up = await j(r);
check('Upload: valid PNG accepted, path stripped from name', r.ok && up.file?.mime === 'image/png' && !up.file.name.includes('/'), JSON.stringify(up));
r = await fetch(`${BASE}/api/drafts/${token}/files`, { method: 'POST', headers: { Origin: BASE }, body: fd(PNG, 'b.png', 'logo') });
r = await fetch(`${BASE}/api/drafts/${token}/files`, { method: 'POST', headers: { Origin: BASE }, body: fd(PNG, 'c.png', 'logo') });
r = await fetch(`${BASE}/api/drafts/${token}/files`, { method: 'POST', headers: { Origin: BASE }, body: fd(PNG, 'd.png', 'logo') });
check('Upload: per-field file cap enforced', r.status === 400, r.status);
const fileId = up.file?.id;
r = await fetch(`${BASE}/api/admin/files/${fileId}`);
check('Uploaded file NOT accessible without admin auth', r.status === 401, r.status);

// incomplete submission is rejected server-side
const t2 = (await j(await fetch(`${BASE}/api/drafts`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Part', email: 'p@x.com', ts: Date.now() - 5000 }) }))).token;
r = await fetch(`${BASE}/api/drafts/${t2}/submit`, { method: 'POST', headers: H });
check('Server-side validation rejects incomplete submission (422)', r.status === 422, r.status);

r = await fetch(`${BASE}/api/drafts/${token}/submit`, { method: 'POST', headers: H });
const sub = await j(r);
check('Submit succeeds and returns random reference ID', r.ok && /^ARC-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(sub.submissionId), JSON.stringify(sub));
check('Response does not claim emails work', sub.emailsConfigured === false);
r = await fetch(`${BASE}/api/drafts/${token}/submit`, { method: 'POST', headers: H });
check('Double submit rejected (409)', r.status === 409, r.status);
r = await fetch(`${BASE}/api/drafts/${token}`, { method: 'PUT', headers: H, body: JSON.stringify({ data: { businessName: 'Hacked' }, step: 0 }) });
check('Draft is locked after submission', r.status === 409, r.status);

// --- admin ----------------------------------------------------------------
r = await fetch(`${BASE}/admin`, { redirect: 'manual' });
check('Admin page redirects to login when signed out', r.status >= 300 && r.status < 400 && r.headers.get('location')?.includes('/admin/login'), r.status);
r = await fetch(`${BASE}/api/admin/submissions/abc/export`);
check('Admin export API requires auth', r.status === 401);
r = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: H, body: JSON.stringify({ email: process.env.E2E_ADMIN_EMAIL, password: 'wrong-password' }) });
check('Wrong admin password rejected', r.status === 401, r.status);
r = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: H, body: JSON.stringify({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }) });
const cookie = (r.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
check('Admin login succeeds with httpOnly + SameSite=Strict cookie', r.ok && /httponly/i.test(r.headers.getSetCookie().join()) && /samesite=strict/i.test(r.headers.getSetCookie().join()));
const A = { ...H, Cookie: cookie };

r = await fetch(`${BASE}/admin`, { headers: { Cookie: cookie } });
const listHtml = await r.text();
check('Admin list shows submission', r.ok && listHtml.includes('Northwind Plumbing') && listHtml.includes(sub.submissionId));
const internalId = listHtml.match(/\/admin\/([a-f0-9]{32})/)?.[1];
check('Admin URLs use unguessable internal IDs', !!internalId);
r = await fetch(`${BASE}/admin/${internalId}`, { headers: { Cookie: cookie } });
const detail = await r.text();
check('Admin detail renders flags, answers, checklist', r.ok && detail.includes('Follow-up flags') && detail.includes('Setup checklist') && detail.includes('Drain cleaning'));
check('Service-area setup recommendation flagged', detail.includes('service-area business'));

r = await fetch(`${BASE}/api/admin/files/${fileId}`, { headers: { Cookie: cookie } });
const bytes = Buffer.from(await r.arrayBuffer());
check('Admin can fetch decrypted file', r.ok && bytes.subarray(0, 8).equals(PNG.subarray(0, 8)) && r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('content-type') === 'image/png');

r = await fetch(`${BASE}/api/admin/submissions/${internalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ status: 'complete' }) });
check('Admin mutation without Origin blocked (CSRF)', r.status === 403, r.status);
r = await fetch(`${BASE}/api/admin/submissions/${internalId}`, { method: 'PATCH', headers: A, body: JSON.stringify({ status: 'needs_clarification' }) });
check('Admin sets status', r.ok);
r = await fetch(`${BASE}/api/admin/submissions/${internalId}`, { method: 'PATCH', headers: A, body: JSON.stringify({ status: 'bogus' }) });
check('Invalid status rejected', r.status === 400);
r = await fetch(`${BASE}/api/admin/submissions/${internalId}/checklist`, { method: 'POST', headers: A, body: JSON.stringify({ key: 'duplicates', done: true }) });
check('Admin ticks checklist', r.ok);
r = await fetch(`${BASE}/api/admin/submissions/${internalId}/notes`, { method: 'POST', headers: A, body: JSON.stringify({ body: 'Called client <b>ok</b>' }) });
check('Admin adds note', r.ok);

r = await fetch(`${BASE}/api/admin/submissions/${internalId}/export?format=json`, { headers: { Cookie: cookie } });
const rec = await j(r);
check('JSON export is structured', r.ok && rec.schema === 'arclo.gbp-onboarding/1' && rec.status === 'needs_clarification' && rec.flags.length > 0 && rec.checklist.some(c => c.key === 'duplicates' && c.done) && rec.notes.length === 1);
r = await fetch(`${BASE}/api/admin/submissions/${internalId}/export?format=pdf`, { headers: { Cookie: cookie } });
const pdf = Buffer.from(await r.arrayBuffer());
check('PDF export is a real PDF', r.ok && pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 3000, `${pdf.length}`);
fs.writeFileSync(process.env.E2E_PDF_OUT || '/tmp/e2e.pdf', pdf);

// --- at rest ---------------------------------------------------------------
const dir = process.env.DATA_DIR;
if (dir) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const all = walk(dir).filter(f => !f.endsWith('-shm'));
  const blob = Buffer.concat(all.map(f => fs.readFileSync(f)));
  check('At rest: no plaintext address or business details in DB/WAL (names in list columns are by design)', !blob.includes('12 Test Lane') && !blob.includes('Residential plumbing') && !blob.includes('(303) 555-0142'));
  check('At rest: uploaded files are encrypted (no PNG header on disk)', !walk(path.join(dir, 'uploads')).some(f => fs.readFileSync(f).subarray(1, 4).toString() === 'PNG'));
  const mode = fs.statSync(path.join(dir, 'arclo.db')).mode & 0o777;
  check('At rest: database file permissions 600', mode === 0o600, mode.toString(8));
}

// --- headers & brute-force -------------------------------------------------
r = await fetch(`${BASE}/`);
check('Security headers present', r.headers.get('x-frame-options') === 'DENY' && !!r.headers.get('content-security-policy') && r.headers.get('referrer-policy') === 'no-referrer' && !r.headers.get('x-powered-by'));
let limited = false;
for (let i = 0; i < 12; i++) {
  r = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: H, body: JSON.stringify({ email: 'x@y.com', password: 'nope' + i }) });
  if (r.status === 429) limited = true;
}
check('Admin login brute-force is rate limited', limited);

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
