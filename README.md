# RemoteFromAPAC — Remote Work Aggregator

Aggregates remote job opportunities from multiple sources into a single
searchable dashboard. Phase 1 MVP.

**Live demo:** https://remotefromapac.vercel.app

## Features

- **Job listings** from multiple providers ([Remotive](https://remotive.com), [Arbeitnow](https://www.arbeitnow.com) and [Jobicy](https://jobicy.com)), refreshed every 15 minutes, with cross-source deduplication
- **Job detail page** with full description and an *Apply* button that redirects to the original source
- **Search** by keyword (title, company, description)
- **Filters**: job type (full-time, part-time, contract, internship, freelance), experience level, category, and region (Worldwide, Asia, Europe, Americas, ...)
- **User accounts** via Auth.js (GitHub / Google OAuth)
- **Saved jobs** stored in MongoDB — bookmark jobs and manage them on the Saved page

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
| `GET /api/jobs?q=&type=&level=&category=&region=&page=` | Search + filter jobs |
| `GET /api/jobs/:id` | Single job detail |
| `GET/POST/DELETE /api/saved-jobs` | Manage bookmarks (auth required) |
| `GET /api/health` | Readiness probe: reports `database: connected \| not-configured \| error` (no secrets exposed) |

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
│   ├── page.tsx              # Job board (search + filters)
│   ├── jobs/[id]/page.tsx    # Job detail + Apply button
│   ├── saved/page.tsx        # Saved jobs (auth)
│   ├── signin/page.tsx       # Auth.js sign-in
│   └── api/                  # jobs, saved-jobs, auth routes
├── components/               # JobBrowser, JobCard, SaveJobButton, ...
├── lib/
│   ├── providers.ts          # Remotive + Arbeitnow fetchers & normalizers
│   ├── jobs.ts               # Aggregation, filtering, pagination
│   └── db.ts                 # Mongoose connection
└── models/saved-job.ts       # SavedJob schema
```

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
| `MONGODB_URI` | For saved jobs | Without it the Saved page shows a "needs a database" notice. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | For sign-in | Without them the Sign-in page shows setup instructions. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | For sign-in | Same as above. |

Browsing, searching and applying work with none of these set.

**Currently set on the live project:** `AUTH_SECRET` and `MONGODB_URI`
(the `savedjobs` collection lives in database `remotefromapac`).
Sign-in still needs an OAuth provider.

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
