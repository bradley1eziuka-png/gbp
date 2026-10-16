'use client';

import { useState } from 'react';
import { evalCond, isRequired, visibleFields } from '@/lib/form/logic';
import type { Field } from '@/lib/form/types';
import type { Errors } from '@/lib/form/validate';
import { useFormEnv } from './env';
import { FilesInput } from './FilesInput';
import { HoursInput, MatrixInput, TagsInput, type HoursValue } from './inputs';
import { Inline, Notice } from './ui';

export const domId = (path: string) => `fld-${path.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

export interface FieldViewProps {
  field: Field;
  values: Record<string, unknown>;
  ctx: Record<string, unknown>;
  onChange: (id: string, v: unknown) => void;
  errors: Errors;
  prefix?: string;
  skipped?: Record<string, boolean>;
  onSkip?: (id: string, v: boolean) => void;
}

const BADGE = { public: 'Shown on Google', internal: 'Private to Arclo', mixed: 'May appear on Google' } as const;

export function FieldList(props: Omit<FieldViewProps, 'field'> & { fields: Field[] }) {
  const { fields, ...rest } = props;
  return (
    <>
      {visibleFields(fields, props.ctx).map((f) => (
        <FieldView key={f.id} field={f} {...rest} />
      ))}
    </>
  );
}

export function FieldView({ field: f, values, ctx, onChange, errors, prefix = '', skipped, onSkip }: FieldViewProps) {
  const env = useFormEnv();
  const path = prefix + f.id;
  const id = domId(path);
  const err = errors[path];
  const errId = err ? `${id}-err` : undefined;
  const helpId = f.help ? `${id}-help` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  const value = values[f.id];
  const required = isRequired(f, ctx);
  const isSkipped = !!(f.skippable && skipped?.[f.id]);
  const set = (v: unknown) => {
    onChange(f.id, v);
    if (isSkipped && onSkip) onSkip(f.id, false);
  };
  const cls = `field${f.half ? ' half' : ''}`;

  if (f.type === 'notice') {
    return (
      <div className="notice-wrap" style={{ gridColumn: '1 / -1' }}>
        <Notice tone={f.tone ?? 'info'}>{f.label}</Notice>
      </div>
    );
  }
  if (f.type === 'heading') {
    return (
      <div className="heading-field">
        <h3>{f.label}</h3>
        {f.help && <p>{f.help}</p>}
      </div>
    );
  }

  const labelEl = (
    <>
      <span>{f.type === 'checkbox' ? '' : f.label}</span>
      {required && f.type !== 'checkbox' && <span className="req" aria-hidden="true"> *</span>}
      {f.visibility && <span className={`badge ${f.visibility}`}>{BADGE[f.visibility]}</span>}
    </>
  );
  const head = (asLegend: boolean) =>
    asLegend ? (
      <legend className="lbl">{labelEl}</legend>
    ) : (
      <label className="lbl" htmlFor={id}>
        {labelEl}
      </label>
    );
  const helpEl = f.help && (
    <p className="help" id={helpId}>
      {f.help}
    </p>
  );
  const errEl = err && (
    <p className="error-text" id={errId}>
      <span aria-hidden="true">⚠</span> {err}
    </p>
  );
  const skipEl =
    f.skippable && onSkip ? (
      <div className="skip-row">
        <label>
          <input type="checkbox" checked={isSkipped} onChange={(e) => onSkip(f.id, e.target.checked)} />I don’t have this yet, flag it for follow-up
        </label>
      </div>
    ) : null;

  const str = typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);

  /* ---------- checkbox ---------- */
  if (f.type === 'checkbox') {
    return (
      <div className={cls}>
        <label className="choice" htmlFor={id}>
          <input id={id} type="checkbox" checked={value === true} aria-invalid={!!err} aria-describedby={describedBy} onChange={(e) => set(e.target.checked)} />
          <span className="ctext">
            <Inline text={f.label} vars={env.vars} />
            {required && <span className="req" aria-hidden="true"> *</span>}
          </span>
        </label>
        {helpEl}
        {errEl}
      </div>
    );
  }

  /* ---------- radio / checkbox group ---------- */
  if (f.type === 'radio' || f.type === 'checkboxgroup') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const short = (f.options ?? []).every((o) => o.label.length < 28) && (f.options ?? []).length <= 4;
    return (
      <fieldset className={cls} aria-describedby={describedBy} id={id} tabIndex={-1}>
        {head(true)}
        {helpEl}
        <div className={`choices${short && f.type === 'radio' ? ' inline' : ''}`}>
          {(f.options ?? []).map((o) => (
            <label className="choice" key={o.value}>
              {f.type === 'radio' ? (
                <input type="radio" name={id} value={o.value} checked={value === o.value} onChange={() => set(o.value)} />
              ) : (
                <input
                  type="checkbox"
                  checked={arr.includes(o.value)}
                  onChange={(e) => set(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))}
                />
              )}
              <span className="ctext">{o.label}</span>
            </label>
          ))}
        </div>
        {errEl}
      </fieldset>
    );
  }

  /* ---------- tags ---------- */
  if (f.type === 'tags') {
    return (
      <div className={cls}>
        {head(false)}
        {helpEl}
        <TagsInput id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={set} describedBy={describedBy} invalid={!!err} placeholder={f.placeholder} />
        {errEl}
      </div>
    );
  }

  /* ---------- hours ---------- */
  if (f.type === 'hours') {
    return (
      <fieldset className={cls}>
        {head(true)}
        {helpEl}
        <HoursInput id={id} value={(value as HoursValue) ?? {}} onChange={set} errorId={errId} invalid={!!err} />
        {skipEl}
        {errEl}
      </fieldset>
    );
  }

  /* ---------- matrix ---------- */
  if (f.type === 'matrix') {
    const rows = (f.rows ?? []).filter((r) => evalCond(r.showIf, ctx));
    return (
      <fieldset className={cls}>
        {head(true)}
        {helpEl}
        <MatrixInput idPrefix={id} rows={rows} value={(value as Record<string, string>) ?? {}} onChange={set} />
        {errEl}
      </fieldset>
    );
  }

  /* ---------- files ---------- */
  if (f.type === 'files') {
    return (
      <div className={cls}>
        {head(false)}
        {helpEl}
        <FilesInput field={f} id={id} />
      </div>
    );
  }

  /* ---------- repeater ---------- */
  if (f.type === 'repeater') {
    return <Repeater {...{ f, id, path, value, set, ctx, errors, helpEl, errEl, head, cls }} />;
  }

  /* ---------- simple inputs ---------- */
  const common = {
    id,
    value: str,
    'aria-invalid': err ? true : undefined,
    'aria-describedby': describedBy,
    'aria-required': required || undefined,
  };

  let input: React.ReactNode;
  switch (f.type) {
    case 'textarea':
      input = (
        <>
          <textarea {...common} maxLength={f.maxLength ? f.maxLength + 200 : undefined} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} rows={4} />
          {f.maxLength && str.length > f.maxLength * 0.7 && (
            <div className="counter" style={str.length > f.maxLength ? { color: 'var(--error)' } : undefined}>
              {str.length} / {f.maxLength}
            </div>
          )}
        </>
      );
      break;
    case 'select':
      input = (
        <select {...common} onChange={(e) => set(e.target.value)}>
          <option value="">Select…</option>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    default: {
      const type = f.type === 'number' ? 'number' : f.type;
      input = (
        <input
          {...common}
          type={type}
          inputMode={f.type === 'number' ? 'numeric' : f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : undefined}
          autoComplete={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'off'}
          placeholder={f.placeholder ?? (f.type === 'url' ? 'https://' : undefined)}
          min={f.min}
          max={f.max}
          maxLength={f.type === 'text' ? f.maxLength : undefined}
          onChange={(e) => set(e.target.value)}
        />
      );
    }
  }

  return (
    <div className={cls}>
      {head(false)}
      {helpEl}
      {input}
      {skipEl}
      {errEl}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Repeater({
  f,
  id,
  path,
  value,
  set,
  ctx,
  errors,
  helpEl,
  errEl,
  head,
  cls,
}: {
  f: Field;
  id: string;
  path: string;
  value: unknown;
  set: (v: unknown) => void;
  ctx: Record<string, unknown>;
  errors: Errors;
  helpEl: React.ReactNode;
  errEl: React.ReactNode;
  head: (legend: boolean) => React.ReactNode;
  cls: string;
}) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const max = f.maxItems ?? 200;

  const blank = (): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    for (const c of f.fields ?? []) if (c.defaultValue !== undefined) o[c.id] = c.defaultValue;
    return o;
  };
  const update = (i: number, key: string, v: unknown) => set(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));

  const addBulk = () => {
    const lines = bulkText.split('\n').map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim()).filter(Boolean);
    const next = [...items, ...lines.map((l) => ({ ...blank(), [f.bulkField!]: l.slice(0, 150) }))].slice(0, max);
    set(next);
    setBulkText('');
    setBulkOpen(false);
  };

  return (
    <fieldset className={cls} id={id}>
      {head(true)}
      {helpEl}
      {items.map((item, i) => {
        const itemCtx = { ...ctx, ...item };
        return (
          <div className="repeater-item" key={i}>
            <div className="repeater-head">
              <span>
                {f.itemLabel ?? 'Item'} {i + 1}
                {typeof item.name === 'string' && item.name ? `: ${item.name}` : ''}
              </span>
              <button type="button" className="btn danger-ghost small" onClick={() => set(items.filter((_, j) => j !== i))} aria-label={`Remove ${f.itemLabel ?? 'item'} ${i + 1}`}>
                Remove
              </button>
            </div>
            <div className="repeater-body">
              <div className="fields">
                <FieldList fields={f.fields ?? []} values={item} ctx={itemCtx} onChange={(k, v) => update(i, k, v)} errors={errors} prefix={`${path}.${i}.`} />
              </div>
            </div>
          </div>
        );
      })}
      {bulkOpen && (
        <div className="bulk" style={{ marginBottom: 12 }}>
          <label className="lbl" htmlFor={`${id}-bulk`}>
            Paste a list, one per line
          </label>
          <textarea id={`${id}-bulk`} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'Drain cleaning\nWater heater install\nLeak repair'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn small" onClick={addBulk} disabled={!bulkText.trim()}>
              Add these
            </button>
            <button type="button" className="btn secondary small" onClick={() => setBulkOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn secondary small" disabled={items.length >= max} onClick={() => set([...items, blank()])}>
          + {f.addLabel ?? 'Add'}
        </button>
        {f.bulkField && !bulkOpen && (
          <button type="button" className="btn ghost small" onClick={() => setBulkOpen(true)}>
            Paste a list
          </button>
        )}
      </div>
      {errEl}
    </fieldset>
  );
}
