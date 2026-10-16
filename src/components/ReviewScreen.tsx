'use client';

import { useMemo } from 'react';
import { computeFlags } from '@/lib/form/flags';
import { buildSummary } from '@/lib/form/summary';
import { STEPS } from '@/lib/form/steps';
import type { FileMeta, FormData } from '@/lib/form/types';
import type { Errors } from '@/lib/form/validate';
import { Notice } from './ui';

export function ReviewScreen({
  data,
  files,
  stepErrors,
  onEdit,
  onSubmit,
  submitting,
  submitError,
}: {
  data: FormData;
  files: FileMeta[];
  stepErrors: Record<string, Errors>;
  onEdit: (stepId: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const sections = useMemo(() => buildSummary(data, files), [data, files]);
  const followUps = useMemo(
    () =>
      computeFlags(data, files).filter(
        (f) => f.category === 'missing' || (['verification', 'media'].includes(f.category) && f.severity !== 'info'),
      ),
    [data, files],
  );
  const problemSteps = Object.keys(stepErrors);

  return (
    <div>
      <p className="step-eyebrow">Almost done</p>
      <h2 className="step-title" tabIndex={-1} id="step-heading">
        Review your answers
      </h2>
      <p className="step-intro">Check your answers. Use “Edit” to change anything. Nothing is sent until you press Submit.</p>

      {problemSteps.length > 0 && (
        <div className="error-summary" role="alert">
          <strong>Some required answers are missing or need fixing:</strong>
          <ul>
            {problemSteps.map((id) => (
              <li key={id}>
                <button type="button" className="btn ghost small" onClick={() => onEdit(id)}>
                  {STEPS.find((s) => s.id === id)?.title}
                </button>{' '}
               : {Object.keys(stepErrors[id]).length} item(s)
              </li>
            ))}
          </ul>
        </div>
      )}

      {followUps.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Notice tone="info">
            <strong>We will follow up on:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {followUps.map((f) => (
                <li key={f.id}>{f.message}</li>
              ))}
            </ul>
            <p style={{ margin: '8px 0 0' }}>You can submit now. You do not need to have everything.</p>
          </Notice>
        </div>
      )}

      {sections.map((s) => (
        <section className="review-section" key={s.stepId} aria-labelledby={`rv-${s.stepId}`}>
          <div className="review-head">
            <h3 id={`rv-${s.stepId}`}>{s.title}</h3>
            <button type="button" className="btn secondary small" onClick={() => onEdit(s.stepId)}>
              Edit<span className="sr-only"> {s.title}</span>
            </button>
          </div>
          <dl className="review-rows">
            {s.rows.map((r) => (
              <div className="review-row" key={r.id}>
                <dt>{r.label}</dt>
                <dd className={r.skipped ? 'skipped' : undefined}>{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <div style={{ marginTop: 28 }}>
        <p className="small muted">
          By submitting you confirm the authorizations you ticked on the previous step. Your submission will be time-stamped automatically.
        </p>
        {submitError && (
          <div className="error-summary" role="alert">
            {submitError}
          </div>
        )}
      </div>
      <div className="nav-bar">
        <button type="button" className="btn secondary" onClick={() => onEdit('finish')}>
          Back
        </button>
        <button type="button" className="btn" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit to Arclo'}
        </button>
      </div>
    </div>
  );
}
