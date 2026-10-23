// Real-browser tests of the whole form. Formspree is intercepted (no real submissions are made).
//   npm run build && npx next start -p 3111      then:   UI_BASE=http://localhost:3111 node tests/ui-e2e.mjs
// Needs Playwright:  npm i -g playwright  (or in a scratch dir) and  npx playwright install chromium
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.UI_BASE || 'http://localhost:3111', OUT = process.env.UI_OUT || './shots'; fs.mkdirSync(OUT, { recursive: true });
const FS = '**/formspree.io/f/**';
const browser = await chromium.launch(); const errors = []; const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + x}`); };
const OK = { status: 200, contentType: 'application/json', body: '{"ok":true,"next":"/thanks"}' };
const heading = (p, h) => p.waitForFunction((h) => document.querySelector('#step-heading')?.textContent === h, h);
const cont = async (p, h) => { await p.click('button:has-text("Continue"), button:has-text("Review answers")'); await heading(p, h); };
fs.writeFileSync(`${OUT}/logo.png`, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

async function open(viewport, label) {
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('Failed to load resource') && errors.push(`[${label}] ${m.text()}`));
  return { ctx, page };
}

/** Completes steps 1-6 and lands on the review screen. */
async function fillAll(page, { photos = false, label = 'x' } = {}) {
  await page.goto(BASE + '/');
  await page.fill('#s-name', 'Alex Morgan'); await page.fill('#s-email', `alex.${label}@gmail.com`);
  await page.click('button:has-text("Start setup")'); await page.waitForSelector('#step-heading');
  await page.fill('#fld-businessName', `TEST UI ${label}`); await page.fill('#fld-whatWeDo', 'Drywall repair');
  await page.fill('#fld-phonePrimary', '734 555 0101'); await page.check('input[name="fld-existingPresence"][value="no"]');
  await cont(page, 'Location and service area');
  await page.check('input[name="fld-serviceMode"][value="travel"]');
  await page.fill('#fld-addr_street', '1 Main St'); await page.fill('#fld-addr_city', 'Monroe'); await page.fill('#fld-addr_state', 'MI'); await page.fill('#fld-addr_zip', '48161');
  await page.check('input[name="fld-customerVisits"][value="no"]'); await page.fill('#fld-saAreas', 'Monroe, Toledo');
  await cont(page, 'Business hours');
  await page.check('input[name="fld-hoursMode"][value="set"]');
  await page.locator('.hours-row').first().locator('button:has-text("Open")').click();
  const t = page.locator('.hours-row').first().locator('input[type=time]'); await t.nth(0).fill('08:00'); await t.nth(1).fill('17:00');
  await page.click('button:has-text("Copy Monday to Tue–Fri")');
  for (const i of [5, 6]) await page.locator('.hours-row').nth(i).locator('button:has-text("Closed")').click();
  await cont(page, 'Services');
  await page.fill('#fld-servicesText', 'Drywall repair, installation'); await cont(page, 'Google account and verification');
  await page.fill('#fld-ownerName', 'Pat Owner'); await page.fill('#fld-ownerGoogleEmail', 'pat@gmail.com'); await page.check('#fld-ownerPhoneSame');
  await page.check('input[name="fld-verifyHelp"][value="yes"]'); await cont(page, 'Photos and authorization');
  if (photos) {
    await page.check('input[name="fld-mediaStatus"][value="upload"]');
    await page.locator('#fld-f-logo').setInputFiles(`${OUT}/logo.png`); await page.waitForSelector('.file .name');
  } else await page.check('input[name="fld-mediaStatus"][value="later"]');
  await page.check('label.choice:has-text("I confirm") input');
  await page.click('button:has-text("Review answers")'); await page.waitForSelector('text=Review your answers');
}

for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  // ---- validation, conditional questions, back/forward, refresh ----
  { const { ctx, page } = await open(vp, label);
    await page.goto(BASE + '/');
    const home = await page.textContent('main');
    check(`${label}: opening copy and 5-10 minute estimate`, home.includes('We’ll handle setting up your Google Business Profile') && home.includes('About 5–10 minutes'));
    check(`${label}: no resume/email promises`, !/resume|emailed? you a link/i.test(home));
    await page.fill('#s-name', 'Alex'); await page.fill('#s-email', 'not-an-email'); await page.click('button:has-text("Start setup")');
    check(`${label}: start requires a valid email`, (await page.textContent('main')).includes('valid email'));
    await page.fill('#s-email', 'alex@gmail.com'); await page.click('button:has-text("Start setup")'); await page.waitForSelector('#step-heading');
    check(`${label}: starts with a Gmail address`, (await page.textContent('#step-heading')) === 'Business information');
    await page.click('button:has-text("Continue")'); await page.waitForSelector('#error-summary');
    check(`${label}: required validation`, (await page.textContent('#error-summary')).includes('Business name'));
    await page.fill('#fld-businessName', 'Back Forth Co'); await page.fill('#fld-whatWeDo', 'x'); await page.fill('#fld-phonePrimary', '7345550101');
    await page.check('input[name="fld-existingPresence"][value="yes"]');
    check(`${label}: listing link only when already listed`, (await page.locator('#fld-mapsUrl').count()) === 1);
    await page.check('input[name="fld-existingPresence"][value="no"]');
    check(`${label}: listing link hidden otherwise`, (await page.locator('#fld-mapsUrl').count()) === 0);
    await cont(page, 'Location and service area');
    check(`${label}: no service-area field before choosing`, (await page.locator('#fld-saAreas').count()) === 0);
    await page.check('input[name="fld-serviceMode"][value="both"]');
    check(`${label}: service-area field appears for travel`, (await page.locator('#fld-saAreas').count()) === 1);
    await page.fill('#fld-addr_street', '9 Elm');
    await page.click('button:has-text("Back")'); await heading(page, 'Business information');
    check(`${label}: Back keeps answers`, (await page.inputValue('#fld-businessName')) === 'Back Forth Co');
    await page.click('button:has-text("Continue")'); await heading(page, 'Location and service area');
    check(`${label}: Forward keeps answers`, (await page.inputValue('#fld-addr_street')) === '9 Elm');
    await page.reload(); await page.waitForSelector('#step-heading');
    check(`${label}: refresh restores progress in this tab`, (await page.textContent('#step-heading')) === 'Location and service area' && (await page.inputValue('#fld-addr_street')) === '9 Elm');
    check(`${label}: no password fields anywhere`, (await page.locator('input[type=password]').count()) === 0);
    await ctx.close(); }

  // ---- success without photos: JSON ----
  { const { ctx, page } = await open(vp, label); const reqs = [];
    await page.route(FS, (r) => { reqs.push(r.request()); r.fulfill(OK); });
    await fillAll(page, { label: `${label}-ok` });
    check(`${label}: review shows all sections`, (await page.locator('.review-section').count()) === 6);
    await page.click('button:has-text("Submit to Arclo")'); await page.waitForSelector('.ref-id');
    const body = JSON.parse(reqs[0].postData());
    check(`${label}: sent once to the Arclo Formspree endpoint as JSON`, reqs.length === 1 && reqs[0].url() === 'https://formspree.io/f/mqpewrak' && reqs[0].headers()['content-type'].includes('json'));
    check(`${label}: payload readable`, body['Business name'] === `TEST UI ${label}-ok` && body['Contact email'] === `alex.${label}-ok@gmail.com` && body['Hours: Monday'] === '8:00 AM - 5:00 PM' && body['Cities and areas served'] === 'Monroe, Toledo' && body['Authorization confirmed'] === 'Yes' && !!body['Owner Google account email']);
    check(`${label}: confirmation shows after success`, /^GBP-/.test(await page.textContent('.ref-id')));
    await page.screenshot({ path: `${OUT}/${label}-confirm.png`, fullPage: true });
    await page.reload(); await page.waitForSelector('.ref-id');
    check(`${label}: refreshing after success shows confirmation, not the form`, true);
    await ctx.close(); }

  // ---- failure, retry; duplicate clicks ----
  { const { ctx, page } = await open(vp, label); let n = 0, fail = true;
    await page.route(FS, async (r) => { n++; await new Promise((s) => setTimeout(s, 700)); r.fulfill(fail ? { status: 500, contentType: 'application/json', body: '{"error":"boom"}' } : OK); });
    await fillAll(page, { label: `${label}-fail` });
    const btn = page.locator('button:has-text("Submit to Arclo")');
    await btn.dblclick(); await page.waitForSelector('[role=alert]:has-text("couldn’t send")');
    check(`${label}: double-click while sending makes ONE request`, n === 1, String(n));
    check(`${label}: failure shows a helpful message and keeps the review screen`, (await page.locator('.ref-id').count()) === 0 && (await page.textContent('main')).includes('Review your answers'));
    fail = false; await btn.click(); await page.waitForSelector('.ref-id');
    check(`${label}: retry after failure succeeds`, n === 2 && (await page.locator('.ref-id').count()) === 1);
    await ctx.close(); }

  // ---- network down ----
  { const { ctx, page } = await open(vp, label);
    await page.route(FS, (r) => r.abort('internetdisconnected'));
    await fillAll(page, { label: `${label}-net` });
    await page.click('button:has-text("Submit to Arclo")'); await page.waitForSelector('[role=alert]:has-text("internet connection")');
    check(`${label}: offline shows a connection message`, true);
    await ctx.close(); }

  // ---- photos: multipart; rejection falls back to no photos ----
  { const { ctx, page } = await open(vp, label); const reqs = []; let reject = true;
    await page.route(FS, (r) => { reqs.push(r.request()); r.fulfill(reject && reqs.length === 1 ? { status: 422, contentType: 'application/json', body: '{"error":"x","errors":[{"code":"FILES_TOO_BIG","message":"big"}]}' } : OK); });
    await fillAll(page, { photos: true, label: `${label}-photo` });
    await page.click('button:has-text("Submit to Arclo")'); await page.waitForSelector('text=Submit without photos');
    const first = reqs[0]; const buf = first.postDataBuffer();
    check(`${label}: photos sent as multipart with the file attached`, first.headers()['content-type'].startsWith('multipart/form-data') && buf.includes('logo.png') && buf.includes('Business name'));
    check(`${label}: rejected photos offer "submit without photos"`, true);
    await page.click('button:has-text("Submit without photos")'); await page.waitForSelector('.ref-id');
    const body = JSON.parse(reqs[1].postData());
    check(`${label}: fallback sends JSON without files`, reqs[1].headers()['content-type'].includes('json') && body['Logo and photos'].includes('nothing was attached'));
    await ctx.close(); }
}
await browser.close();
console.log('Console errors:', errors.length ? [...new Set(errors)] : 'none');
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
