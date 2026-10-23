import { STEPS } from './steps';
import { buildContext, evalCond, skippedMap, visibleFields } from './logic';
import { DAYS, DAY_LABELS, isEmpty } from './validate';
import type { Field, FileMeta, FormData } from './types';

export interface SummaryRow {
  id: string;
  label: string;
  value: string;
  skipped?: boolean;
  visibility?: Field['visibility'];
}
export interface SummarySection {
  stepId: string;
  title: string;
  rows: SummaryRow[];
}

export const fmtTime = (t?: string) => {
  if (!t) return '?';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

export function formatHours(v: unknown): string {
  const obj = (v ?? {}) as Record<string, { state?: string; slots?: { open?: string; close?: string }[] }>;
  return DAYS.map((d) => {
    const day = obj[d];
    if (!day?.state) return `${DAY_LABELS[d]}: not set`;
    if (day.state === 'closed') return `${DAY_LABELS[d]}: Closed`;
    return `${DAY_LABELS[d]}: ${(day.slots ?? []).map((s) => `${fmtTime(s.open)} – ${fmtTime(s.close)}`).join(', ')}`;
  }).join('\n');
}

export function formatValue(f: Field, v: unknown, ctx: Record<string, unknown>): string {
  if (isEmpty(v) && v !== false) return '';
  const label = (val: string) => f.options?.find((o) => o.value === val)?.label ?? val;
  switch (f.type) {
    case 'checkbox':
      return v ? 'Yes' : 'No';
    case 'select':
    case 'radio':
      return label(String(v));
    case 'checkboxgroup':
      return (v as string[]).map(label).join(', ');
    case 'tags':
      return (v as string[]).join(', ');
    case 'hours':
      return formatHours(v);
    case 'matrix': {
      const rec = v as Record<string, string>;
      return (f.rows ?? [])
        .filter((r) => evalCond(r.showIf, ctx))
        .map((r) => `${r.label}: ${{ yes: 'Yes', no: 'No', unsure: 'Not sure' }[rec[r.id]] ?? 'Not answered'}`)
        .join('\n');
    }
    case 'repeater':
      return (v as Record<string, unknown>[])
        .map((item, i) => {
          const itemCtx = { ...ctx, ...item };
          const parts = visibleFields(f.fields ?? [], itemCtx)
            .filter((c) => !isEmpty(item[c.id]))
            .map((c) => {
              const val = formatValue(c, item[c.id], itemCtx);
              return c.type === 'hours' ? `${c.label}:\n${val.replace(/^/gm, '    ')}` : `${c.label}: ${val}`;
            });
          return `${i + 1}. ${parts.join(' · ').replace(/\n {4}/g, '\n    ')}`;
        })
        .join('\n');
    case 'url':
    case 'date':
    case 'time':
    default:
      return String(v);
  }
}

export function buildSummary(data: FormData, files: FileMeta[] = []): SummarySection[] {
  const ctx = buildContext(data);
  const skipped = skippedMap(data);
  const out: SummarySection[] = [];
  for (const step of STEPS) {
    const rows: SummaryRow[] = [];
    for (const f of visibleFields(step.fields, ctx)) {
      if (f.type === 'notice' || f.type === 'heading') continue;
      if (f.type === 'files') {
        const mine = files.filter((x) => x.category === f.category);
        if (mine.length) rows.push({ id: f.id, label: f.label, value: mine.map((x) => x.name).join('\n') });
        continue;
      }
      const value = formatValue(f, data[f.id], ctx);
      if (value) rows.push({ id: f.id, label: f.label, value, visibility: f.visibility });
      else if (skipped[f.id]) rows.push({ id: f.id, label: f.label, value: 'Does not have this yet', skipped: true });
    }
    if (rows.length) out.push({ stepId: step.id, title: step.title, rows });
  }
  // Answers from earlier versions of the form: shown as-is so old submissions stay readable.
  const known = new Set<string>(['contactName', 'contactEmail']);
  for (const st of STEPS) for (const f of st.fields) known.add(f.id);
  const legacy = Object.entries(data)
    .filter(([k, v]) => !known.has(k) && !k.startsWith('_') && !isEmpty(v))
    .map(([k, v]) => ({ id: k, label: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
  if (legacy.length) out.push({ stepId: 'legacy', title: 'Other answers (earlier form version)', rows: legacy });
  return out;
}
