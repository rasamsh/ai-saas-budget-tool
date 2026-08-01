# Ledgii

A personal finance dashboard. Bank statement CSVs are parsed, categorized, and deduped by a
Python CLI, uploaded to Supabase (Postgres), and visualized in a Next.js web app: yearly and
monthly breakdowns, category donuts, top merchants, recurring-subscription detection, cash-flow
Sankey, spending heatmaps, anomaly alerts, and prior-year trend comparisons.

> Status: personal project / work in progress. Product direction lives in `ROADMAP.md`;
> engineering work (cleanup + architecture / mobile-readiness) lives in `TECH-DEBT.md`.
> New here? Start with `CLAUDE.md` for a codebase orientation.

## Repository layout

```
.
├── web/               Next.js 15 + React 19 + Tailwind dashboard (Supabase client)
├── budget-pipeline/   Python CLI: parse → categorize → dedupe → upload bank CSVs
├── supabase/          Postgres schema migrations (RLS-protected tables)
├── CLAUDE.md          Codebase orientation for a new contributor/agent
├── ROADMAP.md         Prioritized product features
└── TECH-DEBT.md       Engineering plan: cleanup, code quality, architecture/mobile
```

## Architecture

1. You export CSV statements from your banks (Chase, Amex, Citi, BofA supported) into
   `budget-pipeline/input/` and describe them in `input/manifest.yaml`.
2. `python budget.py --all` parses each file with the bank-specific parser, categorizes
   transactions via `config/categories.yaml`, deduplicates against previously seen rows, and
   uploads to Supabase.
3. The web app reads from Supabase (with row-level security scoped per user) and renders the
   dashboards. Auth is Supabase email/password.

The database schema (accounts, categories, transactions, monthly summaries, user income,
transaction flags, import batches) is defined in `supabase/migrations/`.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- A Supabase project (free tier is fine)

## Setup

### 1. Database

Apply the migrations in `supabase/migrations/` to your Supabase project in order
(`001_initial_schema.sql`, `002_user_income.sql`, `003_transaction_flags.sql`) via the Supabase
SQL editor or the Supabase CLI. Create a user in Supabase Auth and note its `user_id`.

### 2. Web app (`web/`)

```bash
cd web
npm install
cp .env.example .env.local   # then fill in your values
npm run dev                  # http://localhost:3000
```

`.env.local` (never committed):

| Variable                                | Description                                         |
| --------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | `https://YOUR_PROJECT_REF.supabase.co`              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | Supabase publishable/anon key (`sb_publishable_...`) — safe for the browser, protected by RLS |
| `NEXT_PUBLIC_USE_MOCK_DATA`             | `true` to run the UI against built-in mock data with no Supabase connection; otherwise `false` |

Tip: set `NEXT_PUBLIC_USE_MOCK_DATA=true` to explore the UI without any backend.

### 3. Data pipeline (`budget-pipeline/`)

```bash
cd budget-pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp secrets/config.example.json secrets/config.json   # then fill in your values
# drop bank CSVs into input/ and edit input/manifest.yaml
python budget.py --all --dry-run    # preview
python budget.py --all              # upload
```

`secrets/config.json` (never committed) holds:

| Field              | Description                                                        |
| ------------------ | ----------------------------------------------------------------- |
| `supabase_url`     | Your project URL                                                  |
| `service_role_key` | Supabase **secret** service-role key (`sb_secret_...`) — server-side only, bypasses RLS. Keep private. |
| `user_id`          | The auth user id transactions are attributed to                  |
| `start_date`       | Earliest transaction date to import                              |
| `ach_names`        | Account labels treated as ACH/checking sources                   |

## Common commands

Web (`web/`):

```bash
npm run dev            # dev server
npm run build          # production build
npm test               # vitest run (unit tests)
npm run test:watch     # vitest watch
```

Pipeline (`budget-pipeline/`, venv active):

```bash
python budget.py --all [--dry-run] [--force]      # import all files in the manifest
python budget.py --recategorize                   # re-apply categories.yaml to existing rows
python -m pytest tests/ -v                         # run pipeline tests
```

## Secrets & what is gitignored

No real credentials are committed. The following are ignored (see `.gitignore`):

- `web/.env.local` — Supabase URL + publishable key
- `budget-pipeline/secrets/*` (except `config.example.json`) — service-role key, dedup state
- `budget-pipeline/input/*.csv` / `*.CSV` — personal bank exports
- `.claude/settings.local.json` — machine-local agent config

Templates to copy from: `web/.env.example` and `budget-pipeline/secrets/config.example.json`.

Two key types are used: the **publishable** (anon) key is exposed to the browser by design and
guarded by row-level security; the **secret** (service-role) key is used only by the Python
pipeline and must never reach the client or version control.
