# AI Job Applier — start here

Everything is in this one folder:

| Folder | What it is | Needed? |
| --- | --- | --- |
| `src/`, `prisma/` | The web app: CV upload, job search, match scores, cover letters, approval queue | Yes |
| `services/applier/` | Playwright service that fills employer application forms | Optional |
| `extension/` | Chrome extension that fills LinkedIn, Indeed, Totaljobs and SEEK forms | Optional |

## Run the app (10 minutes)

You need Node.js 20.9+ and a terminal. On a phone this won't run: copy the folder to a computer first.

```bash
cd ai-job-applier
cp .env.example .env
```

Open `.env` and fill in three values:

- `OPENAI_API_KEY` from platform.openai.com
- `RAPIDAPI_KEY` from rapidapi.com, subscribed to the JSearch API
- `DATABASE_URL`: use a free Neon database (neon.com) and paste its connection string,
  or keep the default line and run `npm run db:up` if you have Docker.

Then:

```bash
npm install
npx prisma migrate deploy     # creates the tables
npm run dev
```

Open http://localhost:3000.

## First five minutes in the app

1. **CV and profile**: upload your CV, check what it read, add your email, phone and LinkedIn, then save.
2. Still on that page, add the countries you can work in and whether you need sponsorship.
3. **Find jobs**: search a title and place, such as "DevOps Engineer" in "Scotland", United Kingdom.
4. Open a job, press **Score match**, then **Draft application** to get a cover letter.
5. **Approval queue**: read the letter, fix anything wrong, then approve. Nothing is sent until you do.

Full details: `README.md`. Applier service: `services/applier/README.md`. Extension: `extension/README.md`.

## If something breaks

- `npm install` fails with `edgesOut`: run `npm install --legacy-peer-deps`.
- Pages say the database isn't reachable: check `DATABASE_URL`, and that Docker is running if you use it.
- OpenAI model error: set `OPENAI_MODEL` in `.env` to a current model name.
