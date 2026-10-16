'use client';

import { useState } from 'react';
import { DAYS, DAY_LABELS } from '@/lib/form/validate';

/* ------------------------------ tags ------------------------------ */
export function TagsInput({
  id,
  value,
  onChange,
  describedBy,
  invalid,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  describedBy?: string;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const commit = (raw: string) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < 60) next.push(p.slice(0, 80));
    onChange(next);
    setText('');
  };
  return (
    <div className="tags-wrap" aria-invalid={invalid || undefined}>
      {value.map((t, i) => (
        <span className="tag" key={`${t}-${i}`}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={text}
        placeholder={value.length ? '' : (placeholder ?? 'Type and press Enter')}
        aria-describedby={describedBy}
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(text);
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => commit(text)}
      />
    </div>
  );
}

/* ------------------------------ hours ------------------------------ */
type Slot = { open?: string; close?: string };
type Day = { state?: 'open' | 'closed'; slots?: Slot[] };
export type HoursValue = Partial<Record<(typeof DAYS)[number], Day>>;

export function HoursInput({
  id,
  value,
  onChange,
  errorId,
  invalid,
}: {
  id: string;
  value: HoursValue;
  onChange: (v: HoursValue) => void;
  errorId?: string;
  invalid?: boolean;
}) {
  const set = (d: (typeof DAYS)[number], day: Day) => onChange({ ...value, [d]: day });
  const copyMon = (days: readonly (typeof DAYS)[number][]) => {
    const mon = value.mon;
    if (!mon?.state) return;
    const next = { ...value };
    days.forEach((d) => (next[d] = JSON.parse(JSON.stringify(mon))));
    onChange(next);
  };
  return (
    <div className="hours" id={id} role="group" aria-describedby={errorId} data-invalid={invalid || undefined}>
      {DAYS.map((d) => {
        const day = value[d] ?? {};
        const slots = day.slots?.length ? day.slots : [{}];
        return (
          <div className="hours-row" key={d}>
            <span className="hours-day">{DAY_LABELS[d]}</span>
            <div className="seg" role="group" aria-label={`${DAY_LABELS[d]} status`}>
              <button type="button" aria-pressed={day.state === 'open'} onClick={() => set(d, { state: 'open', slots: day.slots?.length ? day.slots : [{ open: '', close: '' }] })}>
                Open
              </button>
              <button type="button" aria-pressed={day.state === 'closed'} onClick={() => set(d, { state: 'closed', slots: [] })}>
                Closed
              </button>
            </div>
            {day.state === 'open' && (
              <div className="slots">
                {slots.map((s, i) => (
                  <div className="slot" key={i}>
                    <input
                      type="time"
                      aria-label={`${DAY_LABELS[d]} shift ${i + 1} opens`}
                      value={s.open ?? ''}
                      onChange={(e) => set(d, { ...day, slots: slots.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)) })}
                    />
                    <span aria-hidden="true">to</span>
                    <input
                      type="time"
                      aria-label={`${DAY_LABELS[d]} shift ${i + 1} closes`}
                      value={s.close ?? ''}
                      onChange={(e) => set(d, { ...day, slots: slots.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)) })}
                    />
                    {i === 0 && slots.length < 2 && (
                      <button type="button" className="btn ghost small" onClick={() => set(d, { ...day, slots: [...slots, { open: '', close: '' }] })}>
                        Add a second shift
                      </button>
                    )}
                    {i === 1 && (
                      <button type="button" className="btn danger-ghost small" onClick={() => set(d, { ...day, slots: slots.slice(0, 1) })}>
                        Remove shift
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="hours-tools">
        <button type="button" className="btn ghost small" onClick={() => copyMon(['tue', 'wed', 'thu', 'fri'])}>
          Copy Monday to Tue–Fri
        </button>
        <button type="button" className="btn ghost small" onClick={() => copyMon(['tue', 'wed', 'thu', 'fri', 'sat', 'sun'])}>
          Copy Monday to every day
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ matrix ----------------------------- */
export function MatrixInput({
  rows,
  value,
  onChange,
  idPrefix,
}: {
  rows: { id: string; label: string }[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  idPrefix: string;
}) {
  const OPTS = [
    ['yes', 'Yes'],
    ['no', 'No'],
    ['unsure', 'Not sure'],
  ] as const;
  return (
    <div className="matrix">
      {rows.map((r) => (
        <fieldset className="matrix-row" key={r.id}>
          <legend className="sr-only">{r.label}</legend>
          <span aria-hidden="true">{r.label}</span>
          <div className="seg">
            {OPTS.map(([v, l]) => (
              <label key={v} style={{ display: 'contents' }}>
                <input
                  className="sr-only"
                  type="radio"
                  name={`${idPrefix}-${r.id}`}
                  checked={value[r.id] === v}
                  onChange={() => onChange({ ...value, [r.id]: v })}
                />
                <span
                  role="presentation"
                  style={{
                    padding: '8px 14px',
                    minHeight: 40,
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    background: value[r.id] === v ? 'var(--navy)' : '#fff',
                    color: value[r.id] === v ? '#fff' : 'inherit',
                    borderLeft: v === 'yes' ? 0 : '1px solid var(--line-strong)',
                  }}
                >
                  {l}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
