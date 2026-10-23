'use client';

import { publicConfig } from './ui';

export function Confirmation({ reference, email, photosAttached }: { reference: string; email: string; photosAttached: boolean }) {
  return (
    <div className="hero" style={{ textAlign: 'left' }}>
      <div className="card">
        <div className="card-body">
          <p className="step-eyebrow">Submitted</p>
          <h1 className="step-title" tabIndex={-1} id="step-heading" style={{ fontSize: '1.875rem' }}>
            Thank you, we have your details
          </h1>
          <p className="step-intro">Your reference number is:</p>
          <p><span className="ref-id">{reference}</span></p>
          <p>
            Arclo will review your details, check Google for any existing listing, and contact you at <strong>{email}</strong> if anything else is needed. Google
            controls verification and eligibility, so we can’t promise a particular outcome or timeline.
          </p>
          {!photosAttached && (
            <p>
              If you haven’t already, please send your logo and business photos to Arclo separately
              {publicConfig.supportEmail ? <> at <a href={`mailto:${publicConfig.supportEmail}`}>{publicConfig.supportEmail}</a></> : null}.
            </p>
          )}
          <p className="small muted" style={{ marginTop: 20 }}>We will never ask for your Google password, security codes, or financial details.</p>
        </div>
      </div>
    </div>
  );
}
