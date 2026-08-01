# Ledgii - codebase orientation

Personal-finance dashboard. Bank CSVs are parsed, categorized, deduped, and stored in
Supabase (Postgres), then visualized in a Next.js app. Single-developer project; the "user"
is the developer. Read this first, then `README.md` for setup.

## Layout

```
web/              Next.js 15 (App Router) + React 19 + Tailwind + Recharts. The dashboard.
budget-pipeline/  Python CLI: parse -> categorize -> dedupe -> upload bank CSVs (the original importer).
supabase/         Postgres schema migrations (RLS-protected, one row-set per user).
```

Docs (single source each): `ARCHITECTURE.md` = deep technical map (data model, module layout,
hard contracts) - read it when changing how the pieces fit; `ROADMAP.md` = product features;
`TECH-DEBT.md` = all non-feature engineering work (cleanup, code quality, architecture /
mobile-readiness); this file = quick codebase orientation + conventions. The Hi-Bit visual
refresh and the in-app importer both shipped; their residual follow-ups live in those two files.

## Two ways data gets in (and the contract between them)

1. **Python CLI** (`budget-pipeline/budget.py --all`): the original path. Uses the Supabase
   **service-role key** (bypasses RLS), reads `input/manifest.yaml` + `config/categories.yaml`.
2. **In-app import** (`web/`, drag-drop on `/settings/imports`): a faithful **TypeScript port**
   of the pipeline under `web/lib/import/`, run from a server action
   (`web/app/actions/import.ts`) under the user's **RLS session** (no service-role key).

Both dedupe against `transactions.UNIQUE(user_id, hash)`. **The hash is a hard contract:**
`web/lib/import/hash.ts` must stay byte-identical to
`budget-pipeline/deduplicator.py::compute_hash` (`sha256("{date}|{amount:.2f}|{rawDesc}|{account}")`),
or a web import duplicates the user's entire CLI history. Guarded by golden vectors in
`web/__tests__/import/hash.test.ts` and a 2-decimal representability assertion. The category
rules (`web/lib/import/rules.ts`) and file/account rules (`web/lib/import/manifest.ts`) are
hand-ports of the pipeline's YAML - changing one means changing both (tracked in `TECH-DEBT.md`).

The web importer's flow per file (mirrors `budget.py::_process_file_entry`):
parse -> exclude-pattern filter -> refund netting -> override merchant -> hash (raw desc)
-> categorize -> scrub PII. `run-import.ts` orchestrates; parsers live in
`web/lib/import/parsers/`. Then a two-step server action: `previewImport` (dry run: new vs.
duplicate vs. collapsed) then `commitImport` (accounts -> batch -> chunked upsert, idempotent).

**Direction is authoritative.** The parsers derive money-in/money-out from the bank's own sign,
and nothing downstream may flip it: category rules only apply to a credit if they resolve to
`income`, exclude patterns only apply to debits, and an unmatched credit stays `Income` rather
than falling back to `Misc`/`expense`. Getting this wrong turns money in into money out - a
double-sized error in net cash flow. `categorizer.ts` / `categorizer.py` enforce it in step 1-3;
credits that match no known `income_patterns` source surface as an advisory review warning on
the import preview (`lib/import/warnings.ts`) instead of being silently re-signed.

## Web architecture

- **Data fetching is inline in server components** (`app/[year]/page.tsx`,
  `app/[year]/[month]/page.tsx` run several Supabase queries each). Not yet extracted into a
  reusable core - that's the shared-core initiative in `TECH-DEBT.md`.
- **Mutations are server actions** (`app/actions/*.ts`): `income.ts`, `import.ts`. Follow that
  pattern for new writes; set `user_id` server-side, never from the client.
- **Pure business logic is tested TS**: `lib/finance.ts` (recurring detection, anomalies,
  sparklines, sankey, benchmarks), `lib/utils.ts` (formatting). Add tests for new pure logic.
- **Supabase access goes through a `DbClient` abstraction** (`lib/supabase/db-client.ts`).
  `lib/supabase/server.ts` returns either the real SSR client or a **mock client**
  (`lib/supabase/mock-client.ts`) when `NEXT_PUBLIC_USE_MOCK_DATA=true` - the whole UI runs with
  no backend in mock mode. If you add a query operator, add it to both the interface and the mock.
- **Auth**: Supabase email/password; every page/action does `getUser()` and redirects to
  `/login` if absent. RLS (`user_id = auth.uid()`) enforces per-user isolation.
- **UI kit**: `components/ui/` (Card, Button, Pill, Eyebrow, Input, Mascot) - the "Hi-Bit"
  design system (warm cream, ink outlines, hard offset shadows, one periwinkle accent, pixel
  font for labels only, never for numbers). Tokens in `app/globals.css`.

## Commands (from `web/`)

```bash
npm run dev            # dev server (http://localhost:3000)
npm run build          # production build (the real type/compile gate)
npm test               # vitest run — 325 tests; keep green
```

Pipeline (`budget-pipeline/`, venv active): `python budget.py --all [--dry-run]`,
`python -m pytest tests/ -v`.

## Conventions

- Keep `npm test` and `npm run build` green. There is **no ESLint config** (see `TECH-DEBT.md`).
- Plain dash `-`, never the em dash. Don't add agent co-author trailers to commits.
- Prefer quality/simplicity/maintainability over saving implementation effort.
- The current branch is `redesign`; `main` is the default branch.
