# Arclo: Google Business Profile Onboarding

A polished six-step intake form. The client's answers go **straight from their browser to Formspree** (`https://formspree.io/f/mqpewrak`). There is no database, no backend, no admin app, and no environment variables are required.

**Stack:** Next.js 16 (static pages) · TypeScript · Zod validation · Formspree.

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + unit tests
```

## How it works
1. Client enters name and email, then completes six steps: Business, Location, Hours, Services, Google account, Photos and authorization. Conditional questions appear only when relevant.
2. Answers are kept in the browser tab (session storage, never files) so Back/Forward and accidental refreshes don't lose work. They are cleared after a successful submit.
3. On Submit the form validates everything, then POSTs once to Formspree (JSON, or multipart if photos are attached) with readable field names such as "Business name", "Operating address", "Hours: Monday".
4. The confirmation screen appears only after Formspree answers `ok`. If it fails, the client sees a clear message and their answers are still there to retry. Double-clicks are ignored while a request is in flight, and a refresh after success shows the confirmation instead of the form.

## Photos
Logo and photos are attached to the same Formspree submission as files (multipart upload). Photos are resized in the browser (about 1.5 MB each) and capped at about 8 MB in total. If Formspree rejects the files, the client can submit without them and is told to send them separately. Files appear as attachments on the submission in your Formspree dashboard.

## Deploying to Vercel
Import the repo. No database or environment variables are required. Optional: set `NEXT_PUBLIC_SUPPORT_EMAIL` (shown on the confirmation page). In Formspree, make sure notifications for the GBP form are enabled.

## Limits worth knowing
- Validation runs in the browser only (Formspree can't validate), so a determined person could post anything to the public endpoint. Use Formspree's spam filtering and the honeypot (`_gotcha`); you can restrict allowed domains in the Formspree form settings.
- There is no resume link or emailed confirmation: if the client closes the tab before submitting, they start over.
- The privacy page is draft wording and should be reviewed or replaced (`NEXT_PUBLIC_PRIVACY_URL`).
