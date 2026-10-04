# AI Job Applier

Find jobs through JSearch, score how well they fit your CV, draft cover letters with OpenAI,
and review every application in an approval queue before it goes out.

Stack: Next.js 16 (App Router), Prisma 7 with PostgreSQL, OpenAI structured outputs, Tailwind CSS 4.

## Setup

Requires Node.js 20.9+ and Docker (or any PostgreSQL 14+).

```bash
cp .env.example .env          # add OPENAI_API_KEY and RAPIDAPI_KEY
npm install                   # also runs `prisma generate`
npm run db:up                 # starts Postgres in Docker
npm run db:migrate -- --name init
npm run dev
```

Open http://localhost:3000.

If `npm install` fails with `Cannot read properties of null (reading 'edgesOut')`,
run `npm install --legacy-peer-deps`. That's an npm resolver bug, not a project problem.

## How it works

1. **CV and profile**: upload a PDF or DOCX. Text is extracted, structured by the model, and shown
   in an editable form. Matching and letters only use what you save. Scanned (image-only) PDFs are
   rejected because they contain no text.
2. **Where you can work**: one row per country saying whether you need sponsorship. This drives the
   sponsorship warnings, match-score caps and whether a cover letter mentions a visa.
3. **Find jobs**: searches JSearch, stores results, and filters by site (LinkedIn, Indeed, Manpower,
   SEEK, Totaljobs). A job counts as listed on a site if any of its apply links points there.
   Identical searches are reused for 6 hours; "Fetch fresh results" bypasses that. Two sponsorship
   filters are available: hide posts that rule sponsorship out, or show only posts that mention it.
   Search a region by name, such as Scotland, to cover several cities at once.
4. **Score match**: 0–100 with strengths and gaps. The model's reading of the sponsorship wording
   replaces the keyword guess made at search time.
5. **Draft application**: writes a cover letter and puts it in the approval queue.
6. **Approval queue**: edit the letter, check the facts it relies on, then approve. Approved items
   give you the application link and a copy button; mark them as applied when sent, then track
   interviews and offers.

Status flow, enforced on the server:

```
PENDING_APPROVAL → APPROVED → APPLIED → INTERVIEWING / OFFER / REJECTED
        ↓              ↓
    WITHDRAWN ←────────┘   (reopen returns to PENDING_APPROVAL)
```

## Applier service (optional)

`services/applier` is a separate Playwright service that fills approved applications on employer
forms (Greenhouse, Lever, Ashby, other career pages) and waits for you to submit. Job boards such
as LinkedIn and Indeed are left for you to apply on directly. See `services/applier/README.md`.

## Browser extension (optional)

`extension/` is an unpacked Chrome extension for the sites the applier leaves alone: LinkedIn,
Indeed, Totaljobs and SEEK. Open a form, press **Fill this page** in its popup, check the result and
submit yourself. See `extension/README.md`.

## Project layout

```
prisma/schema.prisma          data model
src/app/                      pages: dashboard, profile, jobs, jobs/[id], queue
src/app/api/                  cv/parse, profiles/[id], jobs/search, jobs/[id]/match, applications
src/components/               UI components
src/lib/ai.ts                 CV parsing, match scoring, cover letters
src/lib/jobs/                 JSearch client, publisher filters, sponsorship detection, caching
src/lib/applications.ts       allowed status changes
src/lib/storage.ts            local ./storage or S3 when CV_BUCKET is set
src/app/api/worker/           endpoints used by the applier service
services/applier/             Playwright applier service
extension/                    Chrome extension: fill-on-click for job boards
```

## Before deploying

- **There is no login.** Every request acts as one local user. `npm start` refuses to run unless
  `SINGLE_USER_MODE=true`. Add Auth.js (and replace `getCurrentUser` in `src/lib/auth.ts`) before
  anyone else can reach the app.
- **CVs are personal data.** Use S3 with Block Public Access for hosted setups and set a retention
  policy.
- **Request limits.** Vercel caps request bodies at 4.5 MB, below the 5 MB CV limit. Lower
  `MAX_CV_BYTES` in `src/lib/constants.ts` or host on a Node server (EC2, ECS, etc.).
- **API costs.** Each score and each letter is one OpenAI call; each uncached search uses JSearch quota
  per results page.
