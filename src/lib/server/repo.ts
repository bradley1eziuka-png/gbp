import { computeFlags } from '../form/flags';
import type { FileMeta, FormData } from '../form/types';
import { pruneData, validateAll } from '../form/validate';
import { LIMITS } from './config';
import { decryptJSON, encryptJSON, publicId, randomToken, sha256, uuid } from './crypto';
import { db, nowIso } from './db';
import { deleteFile } from './storage';
import { CHECKLIST, STATUS_VALUES } from './workflow';

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86_400_000).toISOString();

export interface DraftRecord {
  id: string;
  clientId: string;
  contactName: string;
  contactEmail: string;
  data: FormData;
  stepIndex: number;
  rev: number;
  submissionPublicId: string | null;
  updatedAt: string;
}

interface DraftRow {
  id: string;
  client_id: string;
  contact_name: string;
  contact_email: string;
  data_enc: Buffer;
  step_index: number;
  rev: number;
  updated_at: string;
  expires_at: string;
  submission_id: string | null;
}

export const audit = (actor: string, action: string, submissionId?: string | null, detail?: string) =>
  db()
    .prepare('INSERT INTO audit_log (ts, actor, action, submission_id, detail) VALUES (?,?,?,?,?)')
    .run(nowIso(), actor, action, submissionId ?? null, detail ?? null);

/* ------------------------------ drafts ------------------------------ */

export function purgeExpiredDrafts() {
  const d = db();
  const expired = d
    .prepare('SELECT id FROM drafts WHERE expires_at < ? AND submission_id IS NULL')
    .all(nowIso()) as { id: string }[];
  for (const { id } of expired) {
    const files = d.prepare('SELECT storage_key FROM files WHERE draft_id = ?').all(id) as { storage_key: string }[];
    files.forEach((f) => void deleteFile(f.storage_key));
    d.prepare('DELETE FROM drafts WHERE id = ?').run(id);
  }
}

export function createDraft(name: string, email: string): { token: string; draftId: string } {
  const d = db();
  purgeExpiredDrafts();
  const now = nowIso();
  const em = email.trim().toLowerCase();
  let client = d.prepare('SELECT id FROM clients WHERE email = ?').get(em) as { id: string } | undefined;
  if (!client) {
    client = { id: uuid() };
    d.prepare('INSERT INTO clients (id, email, name, created_at) VALUES (?,?,?,?)').run(client.id, em, name, now);
  }
  const token = randomToken(32);
  const id = uuid();
  const data: FormData = { contactName: name, contactEmail: em };
  d.prepare(
    `INSERT INTO drafts (id, token_hash, client_id, contact_name, contact_email, data_enc, created_at, updated_at, expires_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(id, sha256(token), client.id, name, em, encryptJSON(data), now, now, addDays(now, LIMITS.draftTtlDays));
  audit('client', 'draft.created', null, id);
  return { token, draftId: id };
}

export function getDraft(token: string): DraftRecord | null {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const row = db().prepare('SELECT * FROM drafts WHERE token_hash = ?').get(sha256(token)) as DraftRow | undefined;
  if (!row) return null;
  if (!row.submission_id && row.expires_at < nowIso()) return null;
  const sub = row.submission_id
    ? (db().prepare('SELECT public_id FROM submissions WHERE id = ?').get(row.submission_id) as { public_id: string } | undefined)
    : undefined;
  return {
    id: row.id,
    clientId: row.client_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    data: decryptJSON<FormData>(row.data_enc),
    stepIndex: row.step_index,
    rev: row.rev,
    submissionPublicId: sub?.public_id ?? null,
    updatedAt: row.updated_at,
  };
}

export function saveDraft(draft: DraftRecord, data: FormData, stepIndex: number): { rev: number; savedAt: string } {
  const now = nowIso();
  const clean = pruneData(data, { keepHidden: true });
  const rev = draft.rev + 1;
  db()
    .prepare(
      'UPDATE drafts SET data_enc=?, step_index=?, rev=?, business_name=?, updated_at=?, expires_at=? WHERE id=? AND submission_id IS NULL',
    )
    .run(
      encryptJSON(clean),
      Math.max(0, Math.min(40, Math.floor(stepIndex) || 0)),
      rev,
      typeof clean.businessName === 'string' ? clean.businessName.slice(0, 150) : '',
      now,
      addDays(now, LIMITS.draftTtlDays),
      draft.id,
    );
  return { rev, savedAt: now };
}

/* ------------------------------ files ------------------------------ */

const fileRow = (r: Record<string, unknown>): FileMeta => ({
  id: r.id as string,
  category: r.category as string,
  name: r.name as string,
  mime: r.mime as string,
  size: r.size as number,
});

export const listDraftFiles = (draftId: string): FileMeta[] =>
  (db().prepare('SELECT * FROM files WHERE draft_id = ? ORDER BY created_at').all(draftId) as Record<string, unknown>[]).map(fileRow);

export const listSubmissionFiles = (submissionId: string): FileMeta[] =>
  (db().prepare('SELECT * FROM files WHERE submission_id = ? ORDER BY category, created_at').all(submissionId) as Record<string, unknown>[]).map(fileRow);

export function draftUsage(draftId: string): { count: number; bytes: number } {
  const r = db().prepare('SELECT COUNT(*) c, COALESCE(SUM(size),0) b FROM files WHERE draft_id = ?').get(draftId) as { c: number; b: number };
  return { count: r.c, bytes: r.b };
}

export function draftCategoryCount(draftId: string, category: string): number {
  return (db().prepare('SELECT COUNT(*) c FROM files WHERE draft_id = ? AND category = ?').get(draftId, category) as { c: number }).c;
}

export function insertDraftFile(draftId: string, f: Omit<FileMeta, 'id'> & { storageKey: string }): FileMeta {
  const id = uuid();
  db()
    .prepare('INSERT INTO files (id, draft_id, category, name, mime, size, storage_key, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, draftId, f.category, f.name, f.mime, f.size, f.storageKey, nowIso());
  return { id, category: f.category, name: f.name, mime: f.mime, size: f.size };
}

export async function removeDraftFile(draftId: string, fileId: string): Promise<boolean> {
  const row = db().prepare('SELECT storage_key FROM files WHERE id = ? AND draft_id = ?').get(fileId, draftId) as { storage_key: string } | undefined;
  if (!row) return false;
  db().prepare('DELETE FROM files WHERE id = ?').run(fileId);
  await deleteFile(row.storage_key);
  return true;
}

export function getFileForAdmin(fileId: string): { storage_key: string; name: string; mime: string } | undefined {
  return db().prepare('SELECT storage_key, name, mime FROM files WHERE id = ? AND submission_id IS NOT NULL').get(fileId) as
    | { storage_key: string; name: string; mime: string }
    | undefined;
}

/* ---------------------------- submission ---------------------------- */

export type SubmitResult =
  | { ok: true; publicId: string; submissionId: string }
  | { ok: false; reason: 'already_submitted' | 'invalid'; errors?: Record<string, string> };

export function submitDraft(draft: DraftRecord): SubmitResult {
  if (draft.submissionPublicId) return { ok: false, reason: 'already_submitted' };
  const { errors } = validateAll(draft.data);
  if (Object.keys(errors).length) return { ok: false, reason: 'invalid', errors };

  const d = db();
  const clean: FormData = { ...pruneData(draft.data), contactName: draft.contactName, contactEmail: draft.contactEmail };
  const files = listDraftFiles(draft.id);
  const flags = computeFlags(clean, files);
  const now = nowIso();
  const id = uuid();
  const pid = publicId();
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  const tx = d.transaction(() => {
    const hasMain = !!clean.addr_city || !!clean.addr_street;
    const locCount = hasMain ? 1 : 0;
    d.prepare(
      `INSERT INTO submissions (id, public_id, client_id, business_name, contact_name, contact_email, status, data_enc,
         location_count, blockers, attention, submitted_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      pid,
      draft.clientId,
      str(clean.businessName).slice(0, 150),
      str(clean.contactName),
      str(clean.contactEmail).toLowerCase(),
      'submitted',
      encryptJSON({
        data: { ...clean, _submittedAt: now, _submittedBy: str(clean.completedBy) || str(clean.ownerName) },
      }),
      Math.max(locCount, 1),
      flags.filter((f) => f.severity === 'blocker').length,
      flags.filter((f) => f.severity === 'attention').length,
      now,
      now,
    );

    const insLoc = d.prepare(
      `INSERT INTO locations (id, submission_id, position, kind, label, city, region, country, address_hidden, address_enc)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    );
    if (hasMain) {
      insLoc.run(
        uuid(), id, 0, clean.serviceMode === 'travel' ? 'service-area-base' : 'primary', 'Main location',
        str(clean.addr_city), str(clean.addr_state), str(clean.addr_country),
        clean.serviceMode === 'travel' && clean.customerVisits === 'no' ? 1 : null,
        encryptJSON({ street: str(clean.addr_street), unit: str(clean.addr_unit), zip: str(clean.addr_zip) }),
      );
    }
    const insCk = d.prepare('INSERT INTO checklist (submission_id, item_key, done) VALUES (?,?,0)');
    CHECKLIST.forEach((c) => insCk.run(id, c.key));

    d.prepare('UPDATE files SET draft_id = NULL, submission_id = ? WHERE draft_id = ?').run(id, draft.id);
    d.prepare('UPDATE drafts SET data_enc=?, submission_id=?, updated_at=? WHERE id=?').run(encryptJSON({}), id, now, draft.id);
  });
  tx();
  audit('client', 'submission.created', id, pid);
  return { ok: true, publicId: pid, submissionId: id };
}

export function setEmailStatus(id: string, which: 'client' | 'notify', status: string, error?: string) {
  const col = which === 'client' ? 'client_email' : 'notify_email';
  db().prepare(`UPDATE submissions SET ${col}_status = ?, ${col}_error = ? WHERE id = ?`).run(status, error ?? null, id);
}

/* ------------------------------- admin ------------------------------ */

export interface SubmissionListItem {
  id: string;
  publicId: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  locationCount: number;
  blockers: number;
  attention: number;
  submittedAt: string;
}

export function listSubmissions(status?: string): SubmissionListItem[] {
  const rows = (
    status && STATUS_VALUES.includes(status)
      ? db().prepare('SELECT * FROM submissions WHERE status = ? ORDER BY submitted_at DESC LIMIT 500').all(status)
      : db().prepare('SELECT * FROM submissions ORDER BY submitted_at DESC LIMIT 500').all()
  ) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    publicId: r.public_id as string,
    businessName: r.business_name as string,
    contactName: r.contact_name as string,
    contactEmail: r.contact_email as string,
    status: r.status as string,
    locationCount: r.location_count as number,
    blockers: r.blockers as number,
    attention: r.attention as number,
    submittedAt: r.submitted_at as string,
  }));
}

export function listInProgressDrafts() {
  return db()
    .prepare(
      `SELECT business_name, contact_name, contact_email, step_index, updated_at, created_at
       FROM drafts WHERE submission_id IS NULL AND expires_at > ? ORDER BY updated_at DESC LIMIT 200`,
    )
    .all(nowIso()) as {
    business_name: string;
    contact_name: string;
    contact_email: string;
    step_index: number;
    updated_at: string;
    created_at: string;
  }[];
}

export function statusCounts(): Record<string, number> {
  const rows = db().prepare('SELECT status, COUNT(*) c FROM submissions GROUP BY status').all() as { status: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.c]));
}

export interface SubmissionDetail extends SubmissionListItem {
  data: FormData;
  files: FileMeta[];
  checklist: { key: string; done: boolean; doneAt: string | null; doneBy: string | null }[];
  notes: { id: string; author: string; body: string; createdAt: string }[];
  locations: { label: string; kind: string; city: string; region: string; country: string; addressHidden: boolean | null; address: { street: string; unit: string; zip: string } }[];
  emailStatus: { client: string; clientError: string | null; notify: string; notifyError: string | null };
  audit: { ts: string; actor: string; action: string; detail: string | null }[];
}

export function getSubmission(id: string): SubmissionDetail | null {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const d = db();
  const r = d.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  const payload = decryptJSON<{ data: FormData }>(r.data_enc as Buffer);
  const ck = d.prepare('SELECT * FROM checklist WHERE submission_id = ?').all(id) as Record<string, unknown>[];
  const ckMap = new Map(ck.map((c) => [c.item_key as string, c]));
  return {
    id,
    publicId: r.public_id as string,
    businessName: r.business_name as string,
    contactName: r.contact_name as string,
    contactEmail: r.contact_email as string,
    status: r.status as string,
    locationCount: r.location_count as number,
    blockers: r.blockers as number,
    attention: r.attention as number,
    submittedAt: r.submitted_at as string,
    data: payload.data,
    files: listSubmissionFiles(id),
    checklist: CHECKLIST.map((c) => {
      const row = ckMap.get(c.key);
      return { key: c.key, done: !!row?.done, doneAt: (row?.done_at as string) ?? null, doneBy: (row?.done_by as string) ?? null };
    }),
    notes: (d.prepare('SELECT * FROM notes WHERE submission_id = ? ORDER BY created_at DESC').all(id) as Record<string, unknown>[]).map((n) => ({
      id: n.id as string,
      author: n.author as string,
      body: (decryptJSON<{ b: string }>(n.body_enc as Buffer)).b,
      createdAt: n.created_at as string,
    })),
    locations: (d.prepare('SELECT * FROM locations WHERE submission_id = ? ORDER BY position').all(id) as Record<string, unknown>[]).map((l) => ({
      label: l.label as string,
      kind: l.kind as string,
      city: (l.city as string) || '',
      region: (l.region as string) || '',
      country: (l.country as string) || '',
      addressHidden: l.address_hidden === null ? null : !!l.address_hidden,
      address: decryptJSON(l.address_enc as Buffer),
    })),
    emailStatus: {
      client: r.client_email_status as string,
      clientError: r.client_email_error as string | null,
      notify: r.notify_email_status as string,
      notifyError: r.notify_email_error as string | null,
    },
    audit: d.prepare('SELECT ts, actor, action, detail FROM audit_log WHERE submission_id = ? ORDER BY id DESC LIMIT 100').all(id) as SubmissionDetail['audit'],
  };
}

export function setStatus(id: string, status: string, actor: string): boolean {
  if (!STATUS_VALUES.includes(status)) return false;
  const res = db().prepare('UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), id);
  if (res.changes) audit(actor, 'status.changed', id, status);
  return res.changes > 0;
}

export function setChecklist(id: string, key: string, done: boolean, actor: string): boolean {
  if (!CHECKLIST.some((c) => c.key === key)) return false;
  const res = db()
    .prepare('UPDATE checklist SET done = ?, done_at = ?, done_by = ? WHERE submission_id = ? AND item_key = ?')
    .run(done ? 1 : 0, done ? nowIso() : null, done ? actor : null, id, key);
  if (res.changes) audit(actor, done ? 'checklist.done' : 'checklist.undone', id, key);
  return res.changes > 0;
}

export function addNote(id: string, body: string, actor: string): boolean {
  if (!db().prepare('SELECT 1 FROM submissions WHERE id = ?').get(id)) return false;
  db().prepare('INSERT INTO notes (id, submission_id, author, body_enc, created_at) VALUES (?,?,?,?,?)').run(uuid(), id, actor, encryptJSON({ b: body }), nowIso());
  audit(actor, 'note.added', id);
  return true;
}
