'use client';

import { useRef, useState } from 'react';
import type { Field } from '@/lib/form/types';
import { useFormEnv } from './env';

const IMG_MAX = 15 * 1024 * 1024;
const VID_MAX = 75 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;

interface Pending {
  key: string;
  name: string;
  progress: number;
  error?: string;
}

function checkFile(f: File, accept: NonNullable<Field['accept']>): string | null {
  const isImg = /^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
  const isVid = /^video\/(mp4|quicktime)$/.test(f.type) || /\.(mp4|mov)$/i.test(f.name);
  if (accept === 'image' && !isImg) return 'Use a JPG, PNG, WebP, or HEIC image.';
  if (accept === 'video' && !isVid) return 'Use an MP4 or MOV video.';
  if (accept === 'media' && !isImg && !isVid) return 'Unsupported file type.';
  if (isImg && f.size > IMG_MAX) return `Too large (${mb(f.size)}). Images can be up to ${mb(IMG_MAX)}.`;
  if (isVid && f.size > VID_MAX) return `Too large (${mb(f.size)}). Videos can be up to ${mb(VID_MAX)}.`;
  return null;
}

export function FilesInput({ field, id }: { field: Field; id: string }) {
  const env = useFormEnv();
  const category = field.category!;
  const accept = field.accept ?? 'image';
  const max = field.maxFiles ?? 10;
  const mine = env.files.filter((f) => f.category === category);
  const [pending, setPending] = useState<Pending[]>([]);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const replace = max === 1;

  const handle = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const room = replace ? 1 : max - mine.length - pending.filter((p) => !p.error).length;
    const batch = files.slice(0, Math.max(room, 0));
    const skippedCount = files.length - batch.length;
    if (skippedCount > 0)
      setPending((p) => [...p, { key: `x${Date.now()}`, name: `${skippedCount} file(s) not added`, progress: 0, error: `Limit is ${max} here.` }]);
    for (const f of batch) {
      const key = `${Date.now()}-${f.name}-${Math.random()}`;
      const err = checkFile(f, accept);
      if (err) {
        setPending((p) => [...p, { key, name: f.name, progress: 0, error: err }]);
        continue;
      }
      setPending((p) => [...p, { key, name: f.name, progress: 0 }]);
      try {
        const oldIds = replace ? mine.map((m) => m.id) : [];
        await env.upload(category, f, (pct) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress: pct } : x))));
        for (const old of oldIds) await env.remove(old);
        setPending((p) => p.filter((x) => x.key !== key));
      } catch (e) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: e instanceof Error ? e.message : 'Upload failed' } : x)));
      }
    }
  };

  const atMax = !replace && mine.length >= max;
  const accAttr = accept === 'video' ? 'video/mp4,video/quicktime,.mp4,.mov' : 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic';

  return (
    <div>
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!atMax) void handle(e.dataTransfer.files);
        }}
      >
        <input
          ref={picker}
          id={id}
          className="sr-only"
          type="file"
          accept={accAttr}
          multiple={!replace}
          onChange={(e) => {
            if (e.target.files) void handle(e.target.files);
            e.target.value = '';
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn secondary small" disabled={atMax} onClick={() => picker.current?.click()}>
            {replace && mine.length ? 'Replace file' : accept === 'video' ? 'Choose video' : 'Choose photos'}
          </button>
          {accept !== 'video' && (
            <>
              <input
                ref={camera}
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  if (e.target.files) void handle(e.target.files);
                  e.target.value = '';
                }}
              />
              <button type="button" className="btn secondary small" disabled={atMax} onClick={() => camera.current?.click()}>
                Take a photo
              </button>
            </>
          )}
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {accept === 'video' ? 'MP4 or MOV, up to 75 MB each.' : 'JPG, PNG, WebP, or HEIC, up to 15 MB each.'} {replace ? '' : `Up to ${max} files.`} You can also drag files here.
        </p>
      </div>

      {(mine.length > 0 || pending.length > 0) && (
        <div className="file-grid" aria-live="polite">
          {mine.map((f) => (
            <div className="file" key={f.id}>
              <div className="thumb">
                {env.previews[f.id] && f.mime.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={env.previews[f.id]} alt="" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
                ) : (
                  <span aria-hidden="true">{f.mime.startsWith('video/') ? '▶ Video' : '🖼'}</span>
                )}
              </div>
              <div className="meta">
                <span className="name" title={f.name}>{f.name}</span>
                <span className="muted">{mb(f.size)}</span>
              </div>
              <button type="button" className="remove" aria-label={`Remove ${f.name}`} onClick={() => void env.remove(f.id)}>
                ×
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div className="file" key={p.key}>
              <div className="meta">
                <span className="name" title={p.name}>{p.name}</span>
                {p.error ? (
                  <>
                    <span style={{ color: 'var(--error)' }}>{p.error}</span>
                    <button type="button" className="btn ghost small" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <div className="prog" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${p.name}`}>
                    <span style={{ width: `${p.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
