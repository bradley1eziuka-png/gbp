import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  data_enc BLOB NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  rev INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  submission_id TEXT
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL,
  data_enc BLOB NOT NULL,
  location_count INTEGER NOT NULL DEFAULT 1,
  blockers INTEGER NOT NULL DEFAULT 0,
  attention INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  client_email_status TEXT NOT NULL DEFAULT 'pending',
  client_email_error TEXT,
  notify_email_status TEXT NOT NULL DEFAULT 'pending',
  notify_email_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_sub_client ON submissions(client_id);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  city TEXT,
  region TEXT,
  country TEXT,
  address_hidden INTEGER,
  address_enc BLOB
);
CREATE INDEX IF NOT EXISTS idx_loc_sub ON locations(submission_id);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  draft_id TEXT REFERENCES drafts(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_draft ON files(draft_id);
CREATE INDEX IF NOT EXISTS idx_files_sub ON files(submission_id);

CREATE TABLE IF NOT EXISTS checklist (
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  done_by TEXT,
  PRIMARY KEY (submission_id, item_key)
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body_enc BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  submission_id TEXT,
  detail TEXT
);
`;

const g = globalThis as unknown as { __arcloDb?: Database.Database };

export function db(): Database.Database {
  if (!g.__arcloDb) {
    fs.mkdirSync(dataDir(), { recursive: true, mode: 0o700 });
    const d = new Database(path.join(dataDir(), 'arclo.db'));
    d.pragma('journal_mode = WAL');
    d.pragma('foreign_keys = ON');
    d.exec(SCHEMA);
    try {
      fs.chmodSync(path.join(dataDir(), 'arclo.db'), 0o600);
    } catch {
      /* best effort */
    }
    g.__arcloDb = d;
  }
  return g.__arcloDb;
}

export const nowIso = () => new Date().toISOString();
