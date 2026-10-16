import PDFDocument from 'pdfkit';
import { computeFlags } from '../form/flags';
import { buildSummary } from '../form/summary';
import type { SubmissionDetail } from './repo';
import { CHECKLIST, statusLabel } from './workflow';

const NAVY = '#0b1f3a';
const GRAY = '#5b6778';

/** Standard PDF fonts only cover Latin-1/WinAnsi; map a few common extras and replace the rest. */
const safe = (s: string) =>
  s
    .replace(/[→]/g, '->')
    .replace(/[✓✔]/g, 'x')
    .replace(/[^\u0009\u000a -~ -ÿ–—‘’“”•…]/g, '?');

export function buildPdf(sub: SubmissionDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, info: { Title: `GBP onboarding ${sub.publicId}`, Author: 'Arclo' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const h1 = (t: string) => doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(safe(t)).moveDown(0.2);
    const kv = (k: string, v: string) => {
      if (doc.y > 700) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text(safe(k), { continued: false });
      doc.font('Helvetica').fontSize(10).fillColor('#111').text(safe(v || '-'), { indent: 8 }).moveDown(0.3);
    };

    doc.font('Helvetica-Bold').fontSize(20).fillColor(NAVY).text('Arclo');
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text('Google Business Profile onboarding record');
    doc.moveDown(0.8).font('Helvetica-Bold').fontSize(16).fillColor('#111').text(safe(sub.businessName));
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(
      safe(`Reference ${sub.publicId} · Submitted ${new Date(sub.submittedAt).toUTCString()} · Status: ${statusLabel(sub.status)}`),
    );
    doc.text(safe(`Contact: ${sub.contactName} <${sub.contactEmail}>`));

    const flags = computeFlags(sub.data, sub.files);
    h1('Follow-up flags');
    if (!flags.length) doc.font('Helvetica').fontSize(10).fillColor('#111').text('None.');
    flags.forEach((f) => {
      if (doc.y > 700) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(f.severity === 'blocker' ? '#a11a1a' : f.severity === 'attention' ? '#8a5a00' : GRAY)
        .text(f.severity.toUpperCase() + ' · ' + f.category, { continued: false });
      doc.font('Helvetica').fontSize(10).fillColor('#111').text(safe(f.message), { indent: 8 }).moveDown(0.25);
    });

    for (const section of buildSummary(sub.data, sub.files)) {
      h1(section.title);
      section.rows.forEach((r) => kv(r.label, r.value));
    }

    h1('Locations');
    sub.locations.forEach((l) =>
      kv(
        `${l.label} (${l.kind}${l.addressHidden === true ? ', address hidden' : l.addressHidden === false ? ', address shown' : ''})`,
        [l.address.street, l.address.unit, l.city, l.region, l.address.zip, l.country].filter(Boolean).join(', '),
      ),
    );

    h1('Setup checklist');
    CHECKLIST.forEach((c) => {
      const s = sub.checklist.find((x) => x.key === c.key);
      doc.font('Helvetica').fontSize(10).fillColor('#111').text(safe(`${s?.done ? '[x]' : '[ ]'} ${c.label}`));
    });

    doc.end();
  });
}
