# Arclo — Google Business Profile Onboarding

Reusable client intake for GBP setup: 14-step conditional wizard → review → secure submission → admin review workflow.

**Stack:** Next.js 16 (App Router) · TypeScript · Zod · SQLite (better-sqlite3) · local encrypted file storage · pdfkit.

## Run locally
```bash
npm install
cp .env.example .env.local     # then fill in (see below)
npm run keys:generate          # paste DATA_ENCRYPTION_KEY and SESSION_SECRET
npm run admin:hash -- "a long unique password"   # paste into ADMIN_PASSWORD_HASH
npm run dev                    # http://localhost:3000  (admin: /admin)
npm run check                  # typecheck + lint + unit tests
```
End-to-end: build, start on port 3111 with a scratch `DATA_DIR`, then run `tests/e2e.mjs` (header comment has the command).

## Configuration
| Variable | Needed for |
|---|---|
| `DATA_ENCRYPTION_KEY`, `SESSION_SECRET` | **Required.** App refuses to store data without them. Back up the key — losing it makes data unreadable. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | Admin sign-in (disabled until set). Single admin; add a user table/SSO for teams. |
| `APP_URL` | Links in emails |
| `DATA_DIR` | DB + uploads location (default `./.data`). Must be a persistent, private volume. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ARCLO_NOTIFY_EMAIL` | Resume-link, client confirmation, and Arclo notification emails. Without them nothing is sent and the UI/admin say so. |
| `TRUST_PROXY=true` | Only behind a proxy that sets `X-Forwarded-For`; otherwise rate limits share one bucket. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional Cloudflare Turnstile |
| `NEXT_PUBLIC_PRIVACY_URL`, `NEXT_PUBLIC_TERMS_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL` | Links on the form. Privacy defaults to a **draft** `/privacy` page that needs legal review. |

## Security model
- Answers, notes, address records and uploaded files are AES-256-GCM encrypted at rest; DB file mode 600; uploads live outside any public dir.
- Drafts are stored server-side, addressed by a 256-bit random token (only its hash is stored). The browser keeps only the token — never answers.
- Submission IDs are random (`ARC-XXXX-XXXX`); admin URLs use separate random 128-bit IDs.
- Uploads: type detected from bytes (JPG/PNG/WebP/HEIC/MP4/MOV only; SVG rejected), size/count caps, only readable via authenticated admin route.
- Server re-validates everything with the same schema; hidden-question answers are dropped on submit.
- Admin: scrypt password, signed httpOnly SameSite=Strict cookie, login rate limits, Origin check on all mutations, audit log.
- Spam: honeypot, minimum-time check, per-IP rate limits, optional Turnstile.
- The form never asks for passwords, 2FA/backup codes, IDs, tax/bank data (enforced by a unit test on field IDs).

## Deploying (not done — review locally first)
Needs a host with **persistent disk** (VPS, Fly volume, Railway volume) because of SQLite + local files, and a single instance (rate limiter is in-memory). For serverless/multi-instance (e.g. Vercel) swap: `src/lib/server/db.ts` → Postgres, `storage.ts` → private S3/R2 bucket (keep client-side-encrypt calls), `rateLimit.ts` → Redis/Upstash. Always serve over HTTPS (cookie is `Secure` in production).

## Admin workflow
`/admin`: filter by status (Onboarding incomplete → Submitted → Needs clarification → Ready for setup → Verification pending → Verified → Optimization in progress → Complete). Detail page: auto-generated follow-up flags (blocker/attention/info), answers by section, locations, category/attribute prep (search terms only — verify against Google's current categories), media, the 18-step setup checklist, notes, PDF/JSON export.

## Extending
All questions live in `src/lib/form/steps.ts` as data (types, options, `showIf`/`requiredIf` conditions). Eligibility/follow-up rules: `flags.ts`. Business-kind mapping: `logic.ts`. Add a field there and the UI, validation, review, PDF, and JSON export pick it up.

## Not configured / not tested / known gaps
- **Email never tested against a real provider** (Resend code path is untested; "not configured" path is tested).
- Turnstile untested. Production deployment, HTTPS, backups, and multi-instance operation untested.
- No client-facing PDF (clients can download JSON; admins get PDF + JSON). PDF uses Latin-1 fonts — non-Latin text prints as `?`.
- Clients cannot edit after submitting; Arclo follows up by email.
- Single admin account; no password reset UI.
- Privacy page is placeholder wording; terms link only appears if `NEXT_PUBLIC_TERMS_URL` is set. Typed acknowledgment is not a legal e-signature.
- Repeaters capped at 200 items (100 locations) as an abuse guard; videos 75 MB, images 15 MB.
- `npm audit` reports a `braces` advisory in the ESLint toolchain (dev-only, not shipped).
- Draft links last 60 days after last save; expired drafts are purged lazily.
