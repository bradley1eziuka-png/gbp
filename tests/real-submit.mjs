// ONE real submission to the live Formspree endpoint (labeled as a test). Run: UI_BASE=... node tests/real-submit.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.UI_BASE || 'http://localhost:3111', OUT = process.env.UI_OUT || './shots';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/logo.png`, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const heading = (p, h) => p.waitForFunction((h) => document.querySelector('#step-heading')?.textContent === h, h);
const cont = async (p, h) => { await p.click('button:has-text("Continue"), button:has-text("Review answers")'); await heading(p, h); };
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


const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('response', async (r) => { if (r.url().includes('formspree.io')) console.log('FORMSPREE RESPONSE', r.status(), await r.text()); });
await fillAll(page, { photos: true, label: 'REAL-TEST-IGNORE' });
await page.click('button:has-text("Submit to Arclo")');
await page.waitForSelector('.ref-id, [role=alert]:has-text("could")', { timeout: 30000 });
console.log('SCREEN:', (await page.locator('.ref-id').count()) ? 'confirmation ' + (await page.textContent('.ref-id')) : 'error: ' + (await page.textContent('[role=alert]')));
await browser.close();
