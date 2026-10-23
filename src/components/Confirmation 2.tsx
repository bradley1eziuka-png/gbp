'use client';

import { buildSummary } from '@/lib/form/summary';
import type { FileMeta, FormData } from '@/lib/form/types';
import { publicConfig } from './ui';

export function Confirmation({
  submissionId,
  email,
  emailsConfigured,
  data,
  files,
}: {
  submissionId: string;
  email: string;
  emailsConfigured: boolean;
  data: FormData;
  files: FileMeta[];
}) {
  const download = () => {
    const record = { submissionId, submittedAt: new Date().toISOString(), answers: data, summary: buildSummary(data, files) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `arclo-gbp-${submissionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="hero" style={{ textAlign: 'left' }}>
      <div className="card">
        <div className="card-body">
          <p className="step-eyebrow">Submitted</p>
          <h1 className="step-title" tabIndex={-1} id="step-heading" style={{ fontSize: '1.875rem' }}>
            Thank you, we have your details
          </h1>
          <p className="step-intro">Your reference number is:</p>
          <p>
            <span className="ref-id" aria-label={`Reference ${submissionId.split('').join(' ')}`}>{submissionId}</span>
          </p>
          {emailsConfigured ? (
            <p>
              We are sending a confirmation to <strong>{email}</strong>. If it does not arrive within a few minutes, check your spam folder and keep this reference
              number.
            </p>
          ) : (
            <p>
              <strong>Please save your reference number.</strong> Confirmation emails are not enabled on this system, so none will be sent to {email}. Arclo will
              contact you directly.
            </p>
          )}
          <p>
            We’ll review your details, check Google for any existing listing, and be in touch if we need anything else. Google controls verification and
            eligibility, so we can’t promise a particular outcome or timeline.
          </p>
          <p className="small muted" style={{ marginTop: 20 }}>
            We will never ask for your Google password, security codes, ID documents, or bank details.
            {publicConfig.supportEmail && (
              <>
                {' '}Questions? <a href={`mailto:${publicConfig.supportEmail}`}>{publicConfig.supportEmail}</a>.
              </>
            )}
          </p>
          <div style={{ marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={download}>
              Download a copy of your answers (JSON)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
