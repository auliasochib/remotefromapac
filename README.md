# RemoteFromAPAC — Remote Work Aggregator

Aggregates remote job opportunities from job boards and company career pages
into a single searchable dashboard, filtered to roles someone in Asia–Pacific
can actually take.

**Live demo:** https://remotefromapac.vercel.app

## Features

- **Job listings** from five job boards — [We Work Remotely](https://weworkremotely.com) (RSS), [RemoteOK](https://remoteok.com) (JSON API), [Remotive](https://remotive.com), [Arbeitnow](https://www.arbeitnow.com), [Jobicy](https://jobicy.com) — plus 13 **company career pages** via the public Greenhouse, Lever and Ashby job-board APIs
- **Stored in MongoDB** and refreshed by a sync job, so reads are fast and the board survives an upstream outage
- **APAC focus**: only roles located in APAC or open worldwide-remote are ingested, and jobs located in the region get an APAC badge
- **Search** by keyword (title, company, category, description)
- **Filters**: location (incl. APAC-located only), job type, experience level, category, and source; plus sort by newest / oldest / company
- **Job detail page** with the full description and an *Apply* button that redirects to the original posting
- **User accounts** via Auth.js (GitHub / Google OAuth)
- **Saved jobs** in MongoDB — bookmark roles and manage them on the Saved page

### Sources that are deliberately not included

**LinkedIn** and **Wellfound** are not scraped: neither offers a public jobs
API, LinkedIn's user agreement prohibits automated collection, and Wellfound is
behind a Cloudflare bot challenge. Bypassing either would be circumventing an
access control, so the board sticks to sources published for exactly this use —
job-board APIs, RSS feeds, and ATS career-page endpoints.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes |
| Database | MongoDB (Mongoose) |
| Auth | Auth.js v5 (NextAuth) |
| Deployment | Vercel |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev
```

Open http://localhost:3000.

Browsing and searching jobs works with **zero configuration** — the app runs
against public job APIs. The optional features below need environment
variables:

### 1. Saved jobs (MongoDB)

Set `MONGODB_URI` in `.env.local`:

- **Local MongoDB**: `mongodb://localhost:27017` (install via
  `brew install mongodb-community` or Docker:
  `docker run -d -p 27017:27017 mongo`)
- **Free cloud option**: create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
  and paste the connection string

### 2. Sign in (Auth.js OAuth)

`AUTH_SECRET` is already generated in `.env.local`. To enable a provider:

- **GitHub**: GitHub → Settings → Developer settings → OAuth Apps → New OAuth
  App. Callback URL: `http://localhost:3000/api/auth/callback/github`. Put the
  client ID/secret into `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
- **Google**: Google Cloud Console → APIs & Services → Credentials → Create
  OAuth Client ID. Redirect URI:
  `http://localhost:3000/api/auth/callback/google`. Put the values into
  `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

Restart the dev server after changing `.env.local`.

## API

| Endpoint | Description |
|---|---|
| `GET /api/jobs?q=&type=&level=&category=&region=&source=&sort=&page=` | Search + filter jobs (`region=apac` = located in the region; `source=careers` = all company boards) |
| `GET /api/jobs/:id` | Single job detail |
| `POST /api/jobs/sync` | Re-ingest every source (requires `SYNC_SECRET` or `CRON_SECRET`) |
| `GET/POST/DELETE /api/saved-jobs` | Manage bookmarks (auth required) |
| `GET /api/health` | Readiness probe: reports `database: connected \| not-configured \| error` (no secrets exposed) |

Job reads come from MongoDB and fall back to the live provider APIs whenever the
database is empty or unreachable, so the board keeps working either way.

## Syncing jobs

The board is filled by an ingest run that fetches every source, keeps only
APAC-reachable roles, de-duplicates across boards and upserts the results:

```bash
npm run sync
```

Each run also deletes any stored job from a **successfully fetched** source that
it did not re-confirm — a closed posting, or one that stopped being
APAC-relevant. A source that fails is left untouched, so a transient outage
never wipes its jobs.

In production the same work is exposed at `POST /api/jobs/sync`, protected by
`SYNC_SECRET` (manual calls) or `CRON_SECRET` (Vercel Cron sends it
automatically). `vercel.json` schedules it once a day.

## Health check

`GET /api/health` returns:

```json
{ "status": "ok", "database": "connected", "timestamp": "..." }
```

Use it to confirm the deployment can reach MongoDB — for example after
changing `MONGODB_URI` or the Atlas network access list. `status` is `degraded`
with HTTP 503 when the database is configured but unreachable.

## Project structure

```
src/
├── app/
│   ├── page.tsx              # Job board (search + filters, server-rendered stats)
│   ├── jobs/[id]/page.tsx    # Job detail + Apply button
│   ├── saved/page.tsx        # Saved jobs (auth)
│   ├── signin/page.tsx       # Auth.js sign-in
│   └── api/                  # jobs, jobs/sync, saved-jobs, health, auth routes
├── components/               # JobBoard, JobCard, SaveJobButton, ...
├── lib/
│   ├── sources.ts            # We Work Remotely, RemoteOK, ATS career boards
│   ├── providers.ts          # Remotive, Arbeitnow, Jobicy + normalizers
│   ├── apac.ts               # APAC eligibility classification
│   ├── sync.ts               # Ingest pipeline (fetch → filter → upsert)
│   ├── stats.ts              # Counts for the board header and filters
│   ├── jobs.ts               # DB reads with live fallback, filtering, paging
│   └── db.ts                 # Mongoose connection
├── models/
│   ├── job.ts                # Job schema (tags, source/region/apac)
│   └── saved-job.ts          # SavedJob schema
scripts/sync-jobs.ts          # `npm run sync`
```

## How APAC relevance is decided

`src/lib/apac.ts` classifies every job location as:

| Classification | Meaning | Ingested? |
|---|---|---|
| `apac` | Located in, or explicitly open to, an APAC country (countries, major cities and region names are matched with word boundaries) | Yes |
| `worldwide` | Open anywhere — reachable from APAC | Yes |
| `restricted` | Limited to a region that excludes APAC (US-only, EMEA, Europe, …) | No |

Explicit exclusions are checked first, so `Remote - US only` is not mistaken for
an open worldwide role.

## AI features (Phase 4)

The Dashboard (`/dashboard`) turns a resume into job recommendations:

| Feature | How it works | Needs AI key? |
|---|---|---|
| **Skill extraction** | 55-skill dictionary matched with word boundaries against the extracted resume text; years of experience parsed from phrasings like "7 years" | No |
| **Match score per job** | Skill coverage of the job's detected requirements + seniority alignment, computed over the 300 most recent jobs | No |
| **Recommended jobs** | Top matches with strengths (resume skills the job wants) and missing skills | No |
| **Resume review** | Rule-based structural/ATS checklist always runs; with an AI key it adds a role-aware critique benchmarked against live market titles | Optional |
| **Cover letter** | Written from the stored resume + the job's description (on each job detail page) | **Yes** |

Upload a PDF or text file (≤2 MB) on the Dashboard. Only extracted text is
stored (capped, in `resumeAnalyses`) — never the file itself. Matching,
review and the letter all read that stored analysis.

**To enable the AI upgrade**, set one provider key (see `.env.example`) and
redeploy — no code changes. Without a key, matching and the rule-based review
work fully, and the cover letter button explains what is missing.

### Phase 5 groundwork (notifications)

`subscriptions` and `/api/job-alerts` (auth CRUD) store keyword alerts with a
frequency. Delivery is not wired yet — it needs a provider credential:
Resend (email), a Telegram bot token, or a web-push VAPID key. The daily cron
can compile matches per alert once a channel exists.

## Job schema

The stored document (`jobs` collection, `src/models/job.ts`) against the
planned schema:

| Planned field | Stored as | Notes |
|---|---|---|
| `_id` | `_id` + `id` | MongoDB's `_id`, plus a stable `id` of `<source>-<externalId>` used as the upsert key, so a re-sync updates a posting instead of duplicating it |
| `title` | `title` | |
| `company` | `company` | |
| `location` | `location` | Raw string from the source |
| `category` | `category` | Normalised onto canonical values (Engineering, Data & AI, Design, …) instead of raw ATS department names |
| `tags` | `tags` | Raw tags/industries/departments from the source, de-duplicated and capped at 12; searchable and shown on cards |
| `salary?` | `salary` | Formatted string when the source publishes one |
| `description` | `descriptionHtml` | Named `descriptionHtml` deliberately: it is markup, sanitised before rendering, not plain text |
| `applyUrl` | `applyUrl` | Link to the original posting |
| `source` | `source` | `remotive`, `arbeitnow`, `jobicy`, `weworkremotely`, `remoteok`, `greenhouse`, `lever`, `ashby` |
| `publishedAt` | `publishedAt` | `Date` |
| `createdAt` | `createdAt` | From schema timestamps, alongside `updatedAt` |

Extra fields the filters and UI depend on: `companyLogo`, `region`, `apac`,
`jobType`, `level`, `syncedAt`.

### Deduplication

Two layers:

1. **Within a run** — postings are keyed by `company + title` (lower-cased), so
   the same role appearing on several boards is stored once.
2. **Across runs** — every write is an upsert on the stable `id`, so a posting
   that is re-fetched updates in place rather than creating a new row.

Jobs a successful run did not re-confirm are deleted (see *Syncing jobs*), which
is what keeps closed postings from accumulating.

## Deploying to Vercel

The project is already linked to a Vercel project (`remotefromapac`), so
deploying is one command:

```bash
vercel --prod
```

Alternatively, via the dashboard:

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com) → Add New Project → import the repo
3. Add the environment variables (see below)
4. Deploy

### Production environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | **Yes** | Signs Auth.js sessions. The app returns errors without it in production. Generate with `openssl rand -base64 32`. |
| `MONGODB_URI` | For the job board and saved jobs | The job database and bookmarks both live here. Without it the board falls back to live provider fetches and the Saved page shows a "needs a database" notice. |
| `SYNC_SECRET` / `CRON_SECRET` | To run the sync endpoint | Authorizes `POST /api/jobs/sync`. Vercel Cron sends `CRON_SECRET` automatically. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | For sign-in | Without them the Sign-in page shows setup instructions. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | For sign-in | Same as above. |

Browsing, searching and applying work with none of these set.

**Currently set on the live project:** `AUTH_SECRET`, `MONGODB_URI`,
`SYNC_SECRET`, `CRON_SECRET`, `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`
(the `jobs` and `savedjobs` collections live in database `remotefromapac`).

> If MongoDB is unreachable from Vercel, check Atlas → **Network Access**:
> serverless functions connect from changing IPs, so `0.0.0.0/0` must be
> allowed. Confirm with `GET /api/health`.

### URL-encoding the MongoDB password

If your Atlas password contains any of `@ : / ? # [ ] %`, percent-encode it in
the connection string (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`).
Passwords generated by Atlas's *Autogenerate Secure Password* are alphanumeric
and need no encoding.

Set them non-interactively with:

```bash
printf '%s' "$VALUE" | vercel env add VARIABLE_NAME production
vercel --prod   # redeploy to pick up new values
```

Remember to update your OAuth callback URLs to the production domain, e.g.
`https://remotefromapac.vercel.app/api/auth/callback/github`.

## Roadmap (Phase 2+)

- AI-powered job matching (OpenAI / Gemini / OpenRouter)
- Job alerts (email notifications)
- More providers
- Job salary insights
