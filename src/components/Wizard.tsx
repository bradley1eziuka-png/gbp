'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildContext, visibleSteps } from '@/lib/form/logic';
import { STEPS } from '@/lib/form/steps';
import type { FileMeta, FormData, Step } from '@/lib/form/types';
import { validateAll, validateStep, type Errors } from '@/lib/form/validate';
import { Confirmation } from './Confirmation';
import { FormEnvContext } from './env';
import { domId, FieldList } from './FieldView';
import { ReviewScreen } from './ReviewScreen';
import { Header, publicConfig } from './ui';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const TOKEN_KEY = 'arclo.gbp.token';

const DEFAULTS: FormData = {};
for (const s of STEPS) for (const f of s.fields) if (f.defaultValue !== undefined) DEFAULTS[f.id] = f.defaultValue;

function findLabel(step: Step, path: string): string {
  const [top, idx] = path.split('.');
  const f = step.fields.find((x) => x.id === top);
  if (!f) return path;
  if (idx !== undefined && f.type === 'repeater') return `${f.label} (${f.itemLabel ?? 'item'} ${Number(idx) + 1})`;
  return f.label;
}

export function Wizard({ token }: { token: string }) {
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'ready' | 'done'>('loading');
  const [data, setData] = useState<FormData>({});
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, Errors>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [panel, setPanel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; emailsConfigured: boolean } | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState<string | null>(null);
  const [mailStatus, setMailStatus] = useState<string | null>(null);

  const dirty = useRef(false);
  const latest = useRef({ data, stepIndex });
  latest.current = { data, stepIndex };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = useMemo(() => visibleSteps(STEPS, data), [data]);
  const total = steps.length + 1; // + review
  const isReview = stepIndex >= steps.length;
  const step = isReview ? null : steps[stepIndex];
  const ctx = useMemo(() => buildContext(data), [data]);

  /* ---------------------------- load draft ---------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/drafts/${token}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('invalid');
        const body = (await res.json()) as { data: FormData; step: number; files: FileMeta[]; submitted: string | null };
        if (cancelled) return;
        if (body.submitted) {
          setAlreadySubmitted(body.submitted);
          setPhase('done');
          return;
        }
        setData({ ...DEFAULTS, ...body.data });
        setFiles(body.files);
        setStepIndex(Math.max(0, body.step));
        setFurthest(Math.max(0, body.step));
        setPhase('ready');
        try {
          localStorage.setItem(TOKEN_KEY, token); // token only, answers never stored in the browser
        } catch {}
      } catch {
        if (!cancelled) setPhase('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /* ----------------------------- autosave ----------------------------- */
  const save = useCallback(
    async (keepalive = false) => {
      if (!dirty.current || saving.current) return;
      dirty.current = false;
      saving.current = true;
      setSaveState('saving');
      try {
        const res = await fetch(`/api/drafts/${token}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: latest.current.data, step: latest.current.stepIndex }),
          keepalive,
        });
        if (!res.ok) throw new Error(String(res.status));
        setSaveState('saved');
        setSavedAt(new Date());
      } catch {
        dirty.current = true;
        setSaveState('error');
        timer.current = setTimeout(() => void save(), 5000);
      } finally {
        saving.current = false;
        if (dirty.current && !timer.current) timer.current = setTimeout(() => ((timer.current = null), void save()), 1200);
      }
    },
    [token],
  );

  const queueSave = useCallback(() => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, 1200);
  }, [save]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        void save(true);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [save]);

  /* ----------------------------- data ops ----------------------------- */
  const onChange = (id: string, v: unknown) => {
    setData((d) => ({ ...d, [id]: v }));
    setErrors((e) => {
      if (!Object.keys(e).some((k) => k === id || k.startsWith(`${id}.`))) return e;
      const n = { ...e };
      for (const k of Object.keys(n)) if (k === id || k.startsWith(`${id}.`)) delete n[k];
      return n;
    });
    queueSave();
  };
  const onSkip = (id: string, v: boolean) => {
    setData((d) => ({ ...d, _skipped: { ...((d._skipped as Record<string, boolean>) ?? {}), [id]: v } }));
    if (v) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)));
    queueSave();
  };

  /* ------------------------------ files ------------------------------- */
  const upload = useCallback(
    (category: string, file: File, onProgress: (n: number) => void) =>
      new Promise<FileMeta>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/drafts/${token}/files`);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          let body: { file?: FileMeta; error?: string } = {};
          try {
            body = JSON.parse(xhr.responseText);
          } catch {}
          if (xhr.status >= 200 && xhr.status < 300 && body.file) {
            const meta = body.file;
            setFiles((f) => [...f, meta]);
            if (meta.mime.startsWith('image/')) setPreviews((p) => ({ ...p, [meta.id]: URL.createObjectURL(file) }));
            resolve(meta);
          } else reject(new Error(body.error ?? 'Upload failed. Please try again.'));
        };
        xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
        const fd = new FormData();
        fd.append('category', category);
        fd.append('file', file);
        xhr.send(fd);
      }),
    [token],
  );
  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/drafts/${token}/files?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles((f) => f.filter((x) => x.id !== id));
        setPreviews((p) => {
          if (p[id]) URL.revokeObjectURL(p[id]);
          const { [id]: _drop, ...rest } = p;
          void _drop;
          return rest;
        });
      }
    },
    [token],
  );

  /* ---------------------------- navigation ---------------------------- */
  const goto = (i: number) => {
    setErrors({});
    setShowSummary(false);
    setStepIndex(i);
    setFurthest((f) => Math.max(f, i));
    dirty.current = true;
    queueSave();
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      headingRef.current?.focus({ preventScroll: true });
    });
  };

  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(domId(first)) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    });
  };

  const next = () => {
    if (!step) return;
    const errs = validateStep(step, data);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setShowSummary(true);
      requestAnimationFrame(() => document.getElementById('error-summary')?.focus());
      return;
    }
    goto(stepIndex + 1);
  };

  const submit = async () => {
    setSubmitError(null);
    const { byStep } = validateAll(data);
    setStepErrors(byStep);
    if (Object.keys(byStep).length) {
      setSubmitError('Please fix the highlighted sections above before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      dirty.current = true;
      saving.current = false;
      await save();
      const res = await fetch(`/api/drafts/${token}/submit`, { method: 'POST' });
      const body = (await res.json()) as { submissionId?: string; emailsConfigured?: boolean; error?: string; errors?: Errors };
      if (!res.ok || !body.submissionId) {
        if (body.errors) {
          const grouped: Record<string, Errors> = {};
          for (const s of STEPS) {
            const e = validateStep(s, data);
            if (Object.keys(e).length) grouped[s.id] = e;
          }
          setStepErrors(grouped);
        }
        throw new Error(body.error ?? 'Submission failed.');
      }
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}
      setResult({ id: body.submissionId, emailsConfigured: !!body.emailsConfigured });
      setPhase('done');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resumeUrl = typeof window !== 'undefined' ? `${window.location.origin}/form/${token}` : '';
  const emailLink = async () => {
    setMailStatus('sending');
    try {
      const res = await fetch(`/api/drafts/${token}/email-link`, { method: 'POST' });
      const b = (await res.json()) as { status?: string };
      setMailStatus(res.ok ? (b.status ?? 'failed') : 'failed');
    } catch {
      setMailStatus('failed');
    }
  };

  /* ------------------------------ render ------------------------------ */
  const env = useMemo(
    () => ({ files, previews, upload, remove, vars: { privacy: publicConfig.privacyUrl, terms: publicConfig.termsUrl } }),
    [files, previews, upload, remove],
  );

  if (phase === 'loading')
    return (
      <>
        <Header />
        <main className="shell"><p className="muted" role="status">Loading your form…</p></main>
      </>
    );
  if (phase === 'invalid')
    return (
      <>
        <Header />
        <main className="shell hero">
          <div className="card"><div className="card-body">
            <h1 className="step-title">This link isn’t valid</h1>
            <p>It may have expired (links last 60 days after your last save) or been copied incorrectly. You can start again, or contact Arclo if you need your earlier answers.</p>
            <Link className="btn" href="/">Start a new form</Link>
          </div></div>
        </main>
      </>
    );
  if (phase === 'done')
    return (
      <>
        <Header />
        <main className="shell">
          {result ? (
            <Confirmation submissionId={result.id} email={String(data.contactEmail ?? '')} emailsConfigured={result.emailsConfigured} data={data} files={files} />
          ) : (
            <div className="hero"><div className="card"><div className="card-body">
              <h1 className="step-title">Already submitted</h1>
              <p>This form was submitted{alreadySubmitted ? <> (reference <strong>{alreadySubmitted}</strong>)</> : null}. Contact Arclo if you need to change anything.</p>
            </div></div></div>
          )}
        </main>
      </>
    );

  const pct = Math.round((stepIndex / total) * 100);
  const phases = ['all'];
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <FormEnvContext.Provider value={env}>
      <Header
        right={
          <button type="button" className="header-link" onClick={() => setPanel((p) => !p)} aria-expanded={panel}>
            Save &amp; finish later
          </button>
        }
      />
      <main className="shell">
        {panel && (
          <div className="panel" style={{ marginBottom: 20 }} role="region" aria-label="Save and resume">
            <h2 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>Your progress is saved automatically</h2>
            <p className="small muted">
              Use this private link to come back any time in the next 60 days. Treat it like a password: anyone with the link can view and edit your answers.
              Never forward it.
            </p>
            <div className="link-box">
              <input readOnly value={resumeUrl} aria-label="Your private resume link" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn secondary small" onClick={() => navigator.clipboard?.writeText(resumeUrl)}>Copy link</button>
              <button type="button" className="btn secondary small" onClick={emailLink} disabled={mailStatus === 'sending'}>Email it to me</button>
            </div>
            {mailStatus && mailStatus !== 'sending' && (
              <p className="small" role="status" style={{ marginTop: 8 }}>
                {mailStatus === 'sent' && 'Sent. Check your inbox (and spam folder).'}
                {mailStatus === 'not_configured' && 'Email is not set up on this system, so nothing was sent. Please copy the link above and keep it somewhere safe.'}
                {mailStatus === 'failed' && 'The email could not be sent. Please copy the link above instead.'}
              </p>
            )}
            <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setPanel(false)}>Close</button>
          </div>
        )}

        <div className="progress-mobile">
          <div className="progress-meta">
            <strong>{isReview ? 'Review' : step?.title}</strong>
            <span>Step {Math.min(stepIndex + 1, total)} of {total}</span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Form progress"><span style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="wizard">
          <nav className="sidebar" aria-label="Form steps">
            {phases.map((ph) => {
              const list = steps.map((s, i) => ({ s, i }));
              const hasReview = true;
              return (
                <div className="phase" key={ph}>
                                    {list.map(({ s, i }) => {
                    const done = i < furthest && Object.keys(validateStep(s, data)).length === 0;
                    const bad = i < furthest && !done && i !== stepIndex;
                    return (
                      <button type="button" key={s.id} className={`step-link${done ? ' done' : ''}${bad ? ' has-error' : ''}`} aria-current={i === stepIndex ? 'step' : undefined} onClick={() => goto(i)}>
                        <span className="step-dot" aria-hidden="true">{done ? '✓' : bad ? '!' : i + 1}</span>
                        {s.short}
                        {done && <span className="sr-only"> (complete)</span>}
                        {bad && <span className="sr-only"> (needs attention)</span>}
                      </button>
                    );
                  })}
                  {hasReview && (
                    <button type="button" className="step-link" aria-current={isReview ? 'step' : undefined} onClick={() => goto(steps.length)}>
                      <span className="step-dot" aria-hidden="true">{steps.length + 1}</span>Review &amp; submit
                    </button>
                  )}
                </div>
              );
            })}
            <p className={`save-status${saveState === 'error' ? ' err' : ''}`} role="status" aria-live="polite">
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && savedAt && `Saved at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              {saveState === 'error' && 'Couldn’t save. Retrying…'}
              {saveState === 'idle' && 'Changes save automatically'}
            </p>
          </nav>

          <div className="card">
            <div className="card-body">
              {isReview ? (
                <ReviewScreen
                  data={data}
                  files={files}
                  stepErrors={stepErrors}
                  onEdit={(id) => {
                    const i = steps.findIndex((s) => s.id === id);
                    goto(i >= 0 ? i : 0);
                  }}
                  onSubmit={submit}
                  submitting={submitting}
                  submitError={submitError}
                />
              ) : (
                step && (
                  <form
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      next();
                    }}
                  >
                    <p className="step-eyebrow">Step {stepIndex + 1} of {total}</p>
                    <h2 className="step-title" ref={headingRef} tabIndex={-1} id="step-heading">{step.title}</h2>
                    {step.intro && <p className="step-intro">{step.intro}</p>}

                    {showSummary && hasErrors && (
                      <div className="error-summary" id="error-summary" role="alert" tabIndex={-1}>
                        <strong>Please check the following:</strong>
                        <ul>
                          {Object.entries(errors).slice(0, 12).map(([path, msg]) => (
                            <li key={path}>
                              <a
                                href={`#${domId(path)}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  focusFirstError({ [path]: msg });
                                }}
                              >
                                {findLabel(step, path)}
                              </a>
                              : {msg}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="fields">
                      <FieldList
                        fields={step.fields}
                        values={data}
                        ctx={ctx}
                        onChange={onChange}
                        errors={errors}
                        skipped={(data._skipped as Record<string, boolean>) ?? {}}
                        onSkip={onSkip}
                      />
                    </div>

                    <div className="nav-bar">
                      <button type="button" className="btn secondary" onClick={() => goto(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0}>
                        Back
                      </button>
                      <button type="submit" className="btn">
                        {stepIndex === steps.length - 1 ? 'Review answers' : 'Continue'}
                      </button>
                    </div>
                  </form>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </FormEnvContext.Provider>
  );
}
