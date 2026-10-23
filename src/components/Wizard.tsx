'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildContext, visibleSteps } from '@/lib/form/logic';
import { buildPayload, FORMSPREE_ENDPOINT, makeReference } from '@/lib/form/payload';
import { STEPS } from '@/lib/form/steps';
import type { FileMeta, FormData, Step } from '@/lib/form/types';
import { validateAll, validateStep, type Errors } from '@/lib/form/validate';
import { Confirmation } from './Confirmation';
import { FormEnvContext } from './env';
import { domId, FieldList } from './FieldView';
import { ReviewScreen } from './ReviewScreen';
import { StartScreen } from './StartScreen';
import { Header, publicConfig } from './ui';

const SNAP_KEY = 'arclo.gbp.progress';
const DONE_KEY = 'arclo.gbp.submitted';
const MAX_TOTAL_BYTES = 8 * 1024 * 1024; // keep one submission comfortably small for Formspree

const DEFAULTS: FormData = {};
for (const s of STEPS) for (const f of s.fields) if (f.defaultValue !== undefined) DEFAULTS[f.id] = f.defaultValue;

function findLabel(step: Step, path: string): string {
  const [top, idx] = path.split('.');
  const f = step.fields.find((x) => x.id === top);
  if (!f) return path;
  if (idx !== undefined && f.type === 'repeater') return `${f.label} (${f.itemLabel ?? 'item'} ${Number(idx) + 1})`;
  return f.label;
}

const readSession = (k: string): string | null => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeSession = (k: string, v: string | null) => {
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch {
    /* storage unavailable: the form still works, just without tab persistence */
  }
};

export function Wizard() {
  const [phase, setPhase] = useState<'loading' | 'start' | 'form' | 'done'>('loading');
  const [data, setData] = useState<FormData>({});
  const [files, setFiles] = useState<FileMeta[]>([]);
  const fileStore = useRef(new Map<string, File>());
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, Errors>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fileProblem, setFileProblem] = useState(false);
  const [done, setDone] = useState<{ ref: string; email: string; photos: boolean } | null>(null);
  const inFlight = useRef(false);
  const honeypot = useRef('');
  const reference = useRef('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = useMemo(() => visibleSteps(STEPS, data), [data]);
  const total = steps.length + 1; // + review
  const isReview = stepIndex >= steps.length;
  const step = isReview ? null : steps[stepIndex];
  const ctx = useMemo(() => buildContext(data), [data]);

  /* ---------------- restore tab progress / already-submitted ---------------- */
  useEffect(() => {
    const submitted = readSession(DONE_KEY);
    if (submitted) {
      try {
        const j = JSON.parse(submitted) as { ref: string; email: string; photos: boolean };
        setDone(j);
        setPhase('done');
        return;
      } catch {
        writeSession(DONE_KEY, null);
      }
    }
    const snap = readSession(SNAP_KEY);
    if (snap) {
      try {
        const j = JSON.parse(snap) as { data: FormData; step: number; furthest: number };
        setData({ ...DEFAULTS, ...j.data });
        setStepIndex(j.step);
        setFurthest(j.furthest);
        setPhase('form');
        return;
      } catch {
        writeSession(SNAP_KEY, null);
      }
    }
    setPhase('start');
  }, []);

  // Keep answers (never files) in this tab's session storage while working.
  useEffect(() => {
    if (phase === 'form') writeSession(SNAP_KEY, JSON.stringify({ data, step: stepIndex, furthest }));
  }, [phase, data, stepIndex, furthest]);

  const begin = (name: string, email: string, hp: string) => {
    honeypot.current = hp;
    setData({ ...DEFAULTS, contactName: name, contactEmail: email });
    setStepIndex(0);
    setFurthest(0);
    setPhase('form');
    window.scrollTo({ top: 0 });
  };

  /* ----------------------------- data ops ----------------------------- */
  const onChange = (id: string, v: unknown) => {
    setData((d) => ({ ...d, [id]: v }));
    setErrors((e) => {
      if (!Object.keys(e).some((k) => k === id || k.startsWith(`${id}.`))) return e;
      const n = { ...e };
      for (const k of Object.keys(n)) if (k === id || k.startsWith(`${id}.`)) delete n[k];
      return n;
    });
  };
  const onSkip = (id: string, v: boolean) => {
    setData((d) => ({ ...d, _skipped: { ...((d._skipped as Record<string, boolean>) ?? {}), [id]: v } }));
    if (v) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)));
  };

  /* ------------------------------ files ------------------------------- */
  const upload = useCallback(async (category: string, file: File, onProgress: (n: number) => void) => {
    const used = Array.from(fileStore.current.values()).reduce((n, f) => n + f.size, 0);
    if (used + file.size > MAX_TOTAL_BYTES)
      throw new Error('That is the most we can attach to one form. Please send any extra photos to Arclo separately.');
    const meta: FileMeta = { id: crypto.randomUUID(), category, name: file.name, mime: file.type || 'application/octet-stream', size: file.size };
    fileStore.current.set(meta.id, file);
    setFiles((f) => [...f, meta]);
    if (file.type.startsWith('image/')) setPreviews((p) => ({ ...p, [meta.id]: URL.createObjectURL(file) }));
    onProgress(100);
    return meta;
  }, []);
  const remove = useCallback(async (id: string) => {
    fileStore.current.delete(id);
    setFiles((f) => f.filter((x) => x.id !== id));
    setPreviews((p) => {
      if (p[id]) URL.revokeObjectURL(p[id]);
      const { [id]: _drop, ...rest } = p;
      void _drop;
      return rest;
    });
  }, []);

  /* ---------------------------- navigation ---------------------------- */
  const goto = (i: number) => {
    setErrors({});
    setShowSummary(false);
    setStepIndex(i);
    setFurthest((f) => Math.max(f, i));
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

  /* ------------------------ submit directly to Formspree ------------------------ */
  const submit = async (withPhotos = true) => {
    if (inFlight.current) return; // a second click while a request is running does nothing
    setSubmitError(null);
    setFileProblem(false);
    const { byStep } = validateAll(data);
    setStepErrors(byStep);
    if (Object.keys(byStep).length) {
      setSubmitError('Please fix the highlighted sections above before submitting.');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      if (!reference.current) reference.current = makeReference();
      const attached = withPhotos
        ? files.filter((f) => fileStore.current.has(f.id)).map((f) => ({ category: f.category as 'logo' | 'photos', name: f.name }))
        : [];
      const payload = buildPayload(data, reference.current, attached);
      if (honeypot.current) payload._gotcha = honeypot.current;

      let init: RequestInit;
      if (attached.length) {
        const fd = new window.FormData();
        for (const [k, v] of Object.entries(payload)) fd.append(k, v);
        let n = 0;
        for (const f of files) {
          const file = fileStore.current.get(f.id);
          if (file) fd.append(f.category === 'logo' ? 'Logo' : `Photo ${++n}`, file, f.name);
        }
        init = { method: 'POST', headers: { Accept: 'application/json' }, body: fd };
      } else {
        init = { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
      }

      const res = await fetch(FORMSPREE_ENDPOINT, init);
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: { code?: string; message?: string }[] };
      if (!res.ok || body.ok === false) {
        const codes = (body.errors ?? []).map((e) => e.code ?? '');
        if (attached.length && codes.some((c) => ['NO_FILE_UPLOADS', 'TOO_MANY_FILES', 'FILES_TOO_BIG'].includes(c))) {
          setFileProblem(true);
          throw new Error('Your photos could not be sent with the form. You can submit without them and send them to Arclo separately.');
        }
        if (res.status === 429) throw new Error('Too many submissions right now. Please wait a minute and try again.');
        throw new Error('We couldn’t send your form just now. Your answers are still here. Please try again in a moment.');
      }
      const result = { ref: reference.current, email: String(data.contactEmail ?? ''), photos: attached.length > 0 };
      writeSession(DONE_KEY, JSON.stringify(result));
      writeSession(SNAP_KEY, null);
      setDone(result);
      setPhase('done');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSubmitError(
        e instanceof TypeError
          ? 'We couldn’t reach the server. Please check your internet connection and try again. Your answers are still here.'
          : e instanceof Error
            ? e.message
            : 'Submission failed. Please try again.',
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  /* ------------------------------ render ------------------------------ */
  const env = useMemo(
    () => ({ files, previews, upload, remove, vars: { privacy: publicConfig.privacyUrl, terms: publicConfig.termsUrl } }),
    [files, previews, upload, remove],
  );

  if (phase === 'loading') return <><Header /><main className="shell"><p className="muted" role="status">Loading…</p></main></>;
  if (phase === 'start') return <><Header /><main className="shell"><StartScreen onStart={begin} /></main></>;
  if (phase === 'done' && done)
    return <><Header /><main className="shell"><Confirmation reference={done.ref} email={done.email} photosAttached={done.photos} /></main></>;

  const pct = Math.round((stepIndex / total) * 100);
  const phases = ['all'];
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <FormEnvContext.Provider value={env}>
      <Header />
      <main className="shell">
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
            <p className="save-status">Your answers stay in this browser tab until you submit</p>
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
                  onSubmit={() => void submit(true)}
                  submitting={submitting}
                  submitError={submitError}
                  onSubmitWithoutPhotos={fileProblem ? () => void submit(false) : undefined}
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
