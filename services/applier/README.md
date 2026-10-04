# Applier service

Takes applications you approved in the queue, opens the employer's application form in a real
Chromium window, fills your details, attaches your CV and cover letter, and waits for you to submit.
When it sees the confirmation page it marks the application as applied.

## What it will and won't do

| Where the job is listed | What happens |
| --- | --- |
| Greenhouse, Lever, Ashby | Fills the form with exact selectors, then by label |
| Other employer career pages | Fills by label only; you always submit |
| LinkedIn, Indeed, SEEK, Totaljobs, Glassdoor and other job boards | Not automated. Marked "apply yourself" in the queue |

Job boards are skipped on purpose: their terms prohibit automated applying and they restrict
accounts that do it. There is no bot-detection evasion and no CAPTCHA solving. When a CAPTCHA
appears, you solve it in the window.

**Review mode (default):** the service fills the form, outlines required fields it couldn't answer
(usually screening questions), and waits up to `APPLIER_REVIEW_MINUTES` for you to press submit.

**Auto-submit (`APPLIER_AUTO_SUBMIT=true`):** submits only on Greenhouse, Lever or Ashby forms,
and only when every required field is filled and there is no interactive CAPTCHA. Otherwise it
falls back to review mode. Screening questions are never answered for you.

## Setup

In the app's `.env`, set `WORKER_TOKEN` (e.g. `openssl rand -hex 32`) and restart the app. Run
the database migration for the new fields:

```bash
npm run db:migrate -- --name applier
```

Then:

```bash
cd services/applier
cp .env.example .env        # same WORKER_TOKEN as the app
npm install
npm run setup               # downloads Chromium
npm start                   # keeps polling; or: npm run once
```

Add your email, phone and LinkedIn URL on the app's **CV and profile** page first. They fill the
forms and are never sent to the AI.

## Check an adapter before trusting it

ATS pages change their markup. Try a real form without touching the queue; nothing is submitted:

```bash
npm run try -- https://job-boards.greenhouse.io/<company>/jobs/<id> --cv ~/cv.pdf
```

It prints which fields were filled and which required ones are still empty, and outlines them.

## How it talks to the app

The service never touches the database. It uses three endpoints with a bearer token:

- `POST /api/worker/claim` hands out the oldest **APPROVED** application as a 30-minute lease.
  Only approved items can be claimed, so the approval queue stays the gate.
- `GET /api/worker/applications/:id/cv` streams the CV to the worker holding the claim.
- `POST /api/worker/applications/:id/result` reports `submitted`, `needs_manual`, `failed` or `timeout`.

Failed attempts are retried up to 3 times; after that, apply manually. "Back to review" in the
queue resets the attempts. Screenshots of each filled form are kept in `artifacts/<id>/`; the
downloaded CV copy is deleted after every run.
