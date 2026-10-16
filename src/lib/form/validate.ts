import { z } from 'zod';
import { STEPS } from './steps';
import { buildContext, evalCond, isRequired, skippedMap, visibleFields } from './logic';
import type { Field, FormData, Step } from './types';

export type Errors = Record<string, string>;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const isEmpty = (v: unknown): boolean => {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
};

/** Accepts "example.com" or "https://example.com"; only http(s) allowed. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!u.hostname.includes('.') || u.hostname.length < 4) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const MSG = {
  required: 'This is required',
  email: 'Enter a valid email address',
  url: 'Enter a valid web address (starting with http:// or https://, or like example.com)',
  tel: 'Enter a valid phone number',
  date: 'Enter a valid date',
  time: 'Enter a valid time',
  option: 'Choose one of the options',
};

/** A zod schema for the *leaf* value of a field (not including requiredness for empty values). */
export function leafSchema(f: Field): z.ZodType {
  const max = f.maxLength ?? (f.type === 'textarea' ? 5000 : 300);
  switch (f.type) {
    case 'text':
    case 'textarea':
      return z.string().trim().max(max, `Keep this under ${max} characters`);
    case 'email':
      return z.string().trim().max(254).pipe(z.email(MSG.email));
    case 'tel':
      return z
        .string()
        .trim()
        .max(30)
        .refine((v) => /^[+()\-.\s\d]+$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15, MSG.tel);
    case 'url':
      return z
        .string()
        .trim()
        .max(2000)
        .refine((v) => normalizeUrl(v) !== null, MSG.url);
    case 'number': {
      let n = z.coerce.number().refine(Number.isFinite, 'Enter a number');
      if (f.min !== undefined) n = n.min(f.min, `Must be at least ${f.min}`);
      if (f.max !== undefined) n = n.max(f.max, `Must be ${f.max} or less`);
      return n;
    }
    case 'date':
      return z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, MSG.date)
        .refine((v) => !Number.isNaN(Date.parse(v)), MSG.date);
    case 'time':
      return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, MSG.time);
    case 'select':
    case 'radio': {
      const values = (f.options ?? []).map((o) => o.value);
      return z.string().refine((v) => values.includes(v), MSG.option);
    }
    case 'checkbox':
      return z.boolean();
    case 'checkboxgroup': {
      const values = (f.options ?? []).map((o) => o.value);
      return z.array(z.string().refine((v) => values.includes(v), MSG.option)).max(values.length);
    }
    case 'tags':
      return z.array(z.string().trim().min(1).max(80)).max(60, 'That is too many items');
    default:
      return z.unknown();
  }
}

function validateHours(v: unknown, required: boolean): string | null {
  if (isEmpty(v)) return required ? 'Tell us your hours for each day' : null;
  const obj = v as Record<string, { state?: string; slots?: { open?: string; close?: string }[] }>;
  for (const d of DAYS) {
    const day = obj[d];
    if (!day || (day.state !== 'open' && day.state !== 'closed')) {
      if (required) return `Mark ${DAY_LABELS[d]} as open or closed`;
      continue;
    }
    if (day.state === 'open') {
      const slots = day.slots ?? [];
      if (slots.length === 0) return `Add opening and closing times for ${DAY_LABELS[d]}`;
      for (const s of slots) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.open ?? '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.close ?? ''))
          return `Complete the times for ${DAY_LABELS[d]}`;
        if (s.open === s.close) return `Opening and closing times for ${DAY_LABELS[d]} are the same`;
      }
    }
  }
  return null;
}

const firstIssue = (r: z.ZodSafeParseResult<unknown>): string | null =>
  r.success ? null : (r.error.issues[0]?.message ?? 'Check this answer');

function validateFields(
  fields: Field[],
  values: Record<string, unknown>,
  ctx: Record<string, unknown>,
  prefix: string,
  errors: Errors,
  skipped: Record<string, boolean>,
  topLevel: boolean,
) {
  for (const f of visibleFields(fields, ctx)) {
    if (f.type === 'notice' || f.type === 'heading' || f.type === 'files') continue;
    const path = prefix + f.id;
    const v = values[f.id];
    const required = isRequired(f, ctx);
    const wasSkipped = topLevel && f.skippable && skipped[f.id];

    if (f.type === 'hours') {
      const msg = validateHours(v, required && !wasSkipped);
      if (msg) errors[path] = msg;
      continue;
    }

    if (f.type === 'matrix') {
      const rows = (f.rows ?? []).filter((r) => evalCond(r.showIf, ctx));
      const rec = (v ?? {}) as Record<string, string>;
      for (const r of rows) {
        if (rec[r.id] !== undefined && !['yes', 'no', 'unsure'].includes(rec[r.id])) errors[`${path}.${r.id}`] = MSG.option;
      }
      continue;
    }

    if (f.type === 'repeater') {
      const items = Array.isArray(v) ? v : [];
      if (!Array.isArray(v) && v !== undefined) errors[path] = 'Invalid entry';
      if (items.length > (f.maxItems ?? 200)) errors[path] = `Too many entries (maximum ${f.maxItems ?? 200})`;
      if (required && items.length === 0 && !wasSkipped) errors[path] = MSG.required;
      items.forEach((item, i) => {
        if (typeof item !== 'object' || item === null) {
          errors[`${path}.${i}`] = 'Invalid entry';
          return;
        }
        const itemCtx = { ...ctx, ...(item as object) };
        validateFields(f.fields ?? [], item as Record<string, unknown>, itemCtx, `${path}.${i}.`, errors, {}, false);
      });
      continue;
    }

    if (f.type === 'checkbox') {
      if (required && v !== true) errors[path] = 'Please tick this box to continue';
      continue;
    }

    if (isEmpty(v)) {
      if (required && !wasSkipped) errors[path] = MSG.required;
      continue;
    }
    const msg = firstIssue(leafSchema(f).safeParse(v));
    if (msg) errors[path] = msg;
  }
}

export function validateStep(step: Step, data: FormData): Errors {
  const errors: Errors = {};
  const ctx = buildContext(data);
  validateFields(step.fields, data, ctx, '', errors, skippedMap(data), true);
  return errors;
}

export function validateAll(data: FormData): { errors: Errors; byStep: Record<string, Errors> } {
  const errors: Errors = {};
  const byStep: Record<string, Errors> = {};
  for (const s of STEPS) {
    const e = validateStep(s, data);
    if (Object.keys(e).length) byStep[s.id] = e;
    Object.assign(errors, e);
  }
  return { errors, byStep };
}

/**
 * Keep only known, currently-visible answers. Run on submit so hidden-question leftovers
 * (e.g. an address typed before switching to "online only") are never stored.
 */
export function pruneData(data: FormData, opts: { keepHidden?: boolean } = {}): FormData {
  const out: FormData = {};
  const ctx = buildContext(data);
  const skipped = skippedMap(data);
  const outSkipped: Record<string, boolean> = {};

  const pruneFields = (fields: Field[], src: Record<string, unknown>, c: Record<string, unknown>): Record<string, unknown> => {
    const res: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'notice' || f.type === 'heading' || f.type === 'files') continue;
      if (!opts.keepHidden && !evalCond(f.showIf, c)) continue;
      const v = src[f.id];
      if (v === undefined) continue;
      if (f.type === 'repeater' && Array.isArray(v)) {
        res[f.id] = v
          .filter((i) => typeof i === 'object' && i !== null)
          .slice(0, f.maxItems ?? 200)
          .map((item) => pruneFields(f.fields ?? [], item as Record<string, unknown>, { ...c, ...(item as object) }));
      } else if (f.type === 'number' && typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
        res[f.id] = Number(v);
      } else if (f.type === 'text' || f.type === 'textarea' || f.type === 'email' || f.type === 'tel' || f.type === 'url') {
        res[f.id] = typeof v === 'string' ? v.trim() : v;
      } else {
        res[f.id] = v;
      }
    }
    return res;
  };

  for (const s of STEPS) {
    Object.assign(out, pruneFields(s.fields, data, ctx));
    for (const f of s.fields) {
      if (f.skippable && skipped[f.id] && (opts.keepHidden || evalCond(f.showIf, ctx))) outSkipped[f.id] = true;
    }
  }
  if (Object.keys(outSkipped).length) out._skipped = outSkipped;
  return out;
}
