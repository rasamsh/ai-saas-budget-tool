# Ledgii - architecture

Deep technical map of the system, written for an agent (or new engineer) that needs to
change code safely. For quick orientation and working conventions read `CLAUDE.md` first;
for product features see `ROADMAP.md`; for engineering backlog see `TECH-DEBT.md`. This
file is the single source for "how the pieces fit and what must not break".

Ledgii is a single-developer personal-finance dashboard. Bank CSVs are parsed, categorized,
deduped, and stored in Supabase (Postgres); a Next.js app visualizes them. The "user" is the
developer, but the app is fully multi-tenant (per-user RLS) so nothing about the design assumes
a single account.

---

## 1. The big picture: two ways data gets in

This is the one idea that explains most of the codebase. Transactions reach the database
through **two independent ingestion paths that must produce byte-identical results**:

```
                 ┌─────────────────────────┐
   bank CSVs ───▶│ 1. Python CLI pipeline   │──(service_role key, bypasses RLS)──┐
                 │    budget-pipeline/       │                                    │
                 └─────────────────────────┘                                     ▼
                                                                        ┌──────────────────┐
                 ┌─────────────────────────┐                           │ Supabase Postgres │
   bank CSVs ───▶│ 2. In-app importer      │──(user RLS session)──────▶│  transactions     │
   (drag-drop)   │    web/lib/import/       │                           │  UNIQUE(user_id,  │
                 └─────────────────────────┘                           │         hash)     │
                                                                        └──────────────────┘
                                                                                 ▲
                 ┌─────────────────────────┐                                     │
   browser ─────▶│ 3. Next.js dashboard    │──(server components, RLS)───────────┘
                 │    web/app/              │      read-only queries
                 └─────────────────────────┘
```

1. **Python CLI** (`budget-pipeline/budget.py --all`) - the original importer. Uses the
   Supabase **service-role key** (bypasses RLS), driven by `input/manifest.yaml` +
   `config/categories.yaml`.
2. **In-app import** (`web/`, drag-drop on `/settings/imports`) - a faithful **TypeScript
   port** of the pipeline under `web/lib/import/`, run from a server action
   (`web/app/actions/import.ts`) under the user's **RLS session** (no service-role key).

Both dedupe against `transactions.UNIQUE(user_id, hash)`. Because two code bases write to the
same table, several things are **hard contracts** (see §6).

---

## 2. Repository layout

```
web/              Next.js 15 (App Router) + React 19 + Tailwind v4 + Recharts. The dashboard.
  app/            Routes (server components) + server actions.
  components/     Presentational + chart components. `ui/` is the Hi-Bit design kit.
  lib/            Pure logic: finance.ts, utils.ts, import/ (the TS pipeline port), supabase/.
  __tests__/      Vitest. Pure-logic + component tests. `import/` mirrors the pipeline tests.
budget-pipeline/  Python CLI: parse -> categorize -> dedupe -> upload (the original importer).
supabase/         Postgres schema migrations (RLS-protected, one row-set per user).
```

Docs: `CLAUDE.md` (orientation + conventions), `README.md` (setup), `ROADMAP.md` (features),
`TECH-DEBT.md` (engineering backlog), this file (architecture).

---

## 3. Data model (`supabase/migrations/`)

All tables are RLS-protected with `user_id = auth.uid()` except `categories` (global reference
data, world-readable, writable only by the service-role key).

| Table / view | Purpose | Key columns / constraints |
|---|---|---|
| `accounts` | one row per bank account | `UNIQUE(user_id, name)`; `bank IN (chase,amex,citi,bofa)` |
| `categories` | **global** reference data (seeded) | PK `name`; `txn_type IN (expense,income,investment,debt)`; `color` |
| `import_batches` | one row per import run | `period_start/end`, `file_count`, `transaction_count` |
| `transactions` | the ledger | `amount NUMERIC(10,2) CHECK (>0)`; `txn_type`; FK `category`→categories, `account_id`→accounts, `import_batch_id`→batches; **`UNIQUE(user_id, hash)`**; `flag IN (reimbursable,one_time,excluded)`, `notes` (migration 003) |
| `user_income` | per-user, per-year salary | PK `(user_id, year)` (migration 002) |
| `monthly_summaries` *(view)* | per month: income / expenses / invested / debt_payments / savings_rate_pct | `security_invoker = true` so RLS is enforced as the caller |
| `monthly_category_totals` *(view)* | per month+category: count + total_amount | `security_invoker = true` |

**Money sign convention (everywhere):** `amount` is **always positive**; direction is carried
by `txn_type`. `savings_rate_pct = (income - expenses - debt) / income` (investments are
savings, not spend).

**`security_invoker = true` on both views is load-bearing** - without it the view owner would
bypass RLS and leak every user's data.

---

## 4. Web app architecture (`web/`)

### Routes (App Router, all server components)
| Route | File | What it does |
|---|---|---|
| `/` | `app/page.tsx` | redirects to `/{currentYear}` |
| `/{year}` | `app/[year]/page.tsx` | annual dashboard: KPIs, month grid, annual chart, income input, cash-flow waterfall, recurring subscriptions |
| `/{year}/{month}` | `app/[year]/[month]/page.tsx` | monthly detail: KPIs, category donut, top merchants, day heatmap, anomaly banner, transaction table |
| `/login` | `app/login/page.tsx` | Supabase email/password auth |
| `/settings` | `app/settings/page.tsx` | accounts + categories editors |
| `/settings/imports` | `app/settings/imports/page.tsx` + `import-uploader.tsx` | drag-drop CSV import + history |

### Data fetching - inline in server components
`app/[year]/page.tsx` and `app/[year]/[month]/page.tsx` each run several Supabase queries
directly (against the views + `transactions` + `user_income`, current year and prior year for
trends). This is **not** yet extracted into a reusable core - that's the shared-core initiative
in `TECH-DEBT.md`. Every page/action starts with `getUser()` and `redirect('/login')` if absent.

### Mutations - server actions (`app/actions/`)
- `income.ts` → `setAnnualIncome(year, annualIncome)`
- `import.ts` → `previewImport(formData)` (dry run) then `commitImport(formData)` (write)

Pattern for any new write: a server action that sets `user_id` **server-side** from
`getUser()`, never from the client.

### Supabase access - the `DbClient` abstraction (`lib/supabase/`)
- `db-client.ts` - the interface (`DbQueryBuilder`, `DbSingleBuilder`, `DbClient`) both
  implementations satisfy.
- `server.ts` - `createClient()` returns the real SSR client, **or** the mock client when
  `NEXT_PUBLIC_USE_MOCK_DATA=true`.
- `mock-client.ts` - an in-memory implementation (auth always returns a `MOCK_USER`; queries
  filter over seeded `mock-data.ts`). The **entire UI runs with no backend** in mock mode - this
  is how you develop and how the browser E2E checks run.
- `client.ts` - browser client (auth flows).

> **Rule:** if you add a query operator, add it to the `DbClient` interface **and** the mock
> client, or mock mode breaks.

### UI kit - "Hi-Bit" design system (`components/ui/`)
`Card`, `Button`, `Pill`, `Eyebrow`, `Input`, `Mascot`. Warm cream, ink outlines, hard offset
shadows, one periwinkle accent, pixel font for labels only (never for numbers). Tokens live in
`app/globals.css`. Charts (`components/`) use Recharts; the `_*-inner.tsx` files are the
client-only chart bodies split out from their server wrappers.

---

## 5. The import pipeline (`web/lib/import/`) - the heart of the system

A pure, I/O-free TypeScript port of `budget-pipeline/`. Given file text + `{bank, account}`,
it produces categorized, PII-scrubbed, deduped `ParsedTransaction[]`. No Supabase in this layer.

### Per-file flow (`run-import.ts::processFile`, mirrors `budget.py::_process_file_entry`)
```
parse (bank parser)  ->  exclude-pattern filter  ->  refund netting  ->  override merchant
   ->  hash (from RAW description)  ->  categorize  ->  scrub PII
```
`processFiles` then dedupes across the whole batch by hash (identical rows "collapse", exactly
as the DB's `UNIQUE(user_id, hash)` would).

### Module map
| File | Responsibility |
|---|---|
| `parsers/{chase,amex,citi,bofa}.ts` | bank-specific CSV → `ParsedTransaction[]`, split into debits + credits. `shared.ts` = `makeTxn`. |
| `csv.ts` | CSV reading (papaparse). |
| `detect.ts` | guess the bank from the header row (client hint + server authority). |
| `manifest.ts` | filename/account rules (exclude patterns, merchant overrides) - hand-port of `manifest.yaml`. |
| `date.ts` | explicit `MM/DD/YYYY` / ISO → `YYYY-MM-DD` (avoids `new Date(string)` TZ bugs). |
| `netting.ts` | net refunds/credits against matching debits. |
| `hash.ts` | **the dedup hash** (see §6). |
| `rules.ts` | category + income patterns - hand-port of `config/categories.yaml`. |
| `categorizer.ts` | assign category + enforce money **direction** (see §6). |
| `clean-merchant.ts` | tidy merchant strings (`pythonTitle`). |
| `scrubber.ts` | strip PII (Zelle names, ACH names, check numbers, ref codes). |
| `warnings.ts` | advisory review signals for the preview (e.g. unrecognized income). |
| `edits.ts` | apply the user's per-row preview edits (selection + txn_type overrides). |
| `types.ts` | `ParsedTransaction`, `Bank`, rule types. |

### Two-step server action (`app/actions/import.ts`)
1. **`previewImport`** - dry run: process files, fetch existing hashes, split into new vs.
   duplicate vs. collapsed, compute warnings, return every new row keyed by `hash`.
2. **`commitImport`** - upsert accounts → insert `import_batches` row → chunked idempotent
   upsert of transactions (`onConflict: user_id,hash, ignoreDuplicates`) → backfill batch count
   → `revalidatePath` the affected months/years. Rolls back an empty batch if a concurrent
   import won every hash.

### User edits on the preview (the checkbox + income/spend fix feature)
The preview hands the client every new transaction keyed by its `hash`. The client can
**deselect rows** and **override a row's `txn_type`** (fix an income-vs-spend discrepancy),
then `commitImport` receives two extra form fields: `selectedHashes` and `typeOverrides`.
`lib/import/edits.ts::applyEdits` applies them server-side **after re-parsing the files**, so a
client can only *narrow* the set and *flip a direction* - it can never forge an amount, date, or
hash. Because the hash does not depend on `txn_type`, an override cannot change which rows are
duplicates.

---

## 6. Hard contracts (do not break these)

1. **The dedup hash is byte-identical across both importers.**
   `web/lib/import/hash.ts` must match `budget-pipeline/deduplicator.py::compute_hash`:
   `sha256("{date}|{amount:.2f}|{rawDesc}|{account}")`. Diverge and a web import duplicates the
   user's entire CLI history. Guarded by golden vectors in `__tests__/import/hash.test.ts` plus
   a 2-decimal representability assertion. The hash uses the **raw** bank description (before
   scrubbing) and the amount to 2 decimals.

2. **Direction is authoritative; money-in must never become money-out.**
   Parsers derive income/expense from the bank's own sign. Nothing downstream may flip it:
   category rules only apply to a credit if they resolve to `income`; exclude patterns only apply
   to debits; an unmatched credit stays `Income`, never `Misc`/`expense`. Getting this wrong is a
   *double-sized* error in net cash flow. Enforced in `categorizer.ts` (steps 1-3) and
   `run-import.ts::applyExclude`; unrecognized credits surface as an advisory warning
   (`warnings.ts`) rather than being silently re-signed. The user's manual `typeOverrides` on the
   preview are the *only* sanctioned way to flip direction.

3. **The rules are hand-ported, in two places.** `rules.ts` ↔ `config/categories.yaml`, and
   `manifest.ts` ↔ `input/manifest.yaml`. Change one, change the other (tracked in `TECH-DEBT.md`).

4. **`amount > 0` always; sign lives in `txn_type`.** Enforced by a DB CHECK and by the parsers.

5. **`user_id` is set server-side**, never trusted from the client. RLS is the backstop.

---

## 7. Pure logic worth knowing (`lib/finance.ts`, `lib/utils.ts`)

`finance.ts` is where dashboard analytics live (all pure, all tested): `computeRecurring`,
`computeSparklines`, `computeDailyExpenseTotals`, `computeMonthlyCategoryTotals`,
`computeAnomalies`, `computeBenchmarkComparisons` (`BENCHMARK_RANGES`), `computeRecurringMerchants`,
`computeRecurringSplit`, and the Sankey layout (`buildSankeyLayout`, `SankeyLayout`/`Node`/`Link`).
`utils.ts` holds formatting + `calcTrend` + `TXN_TYPE_COLORS`/`TXN_TYPE_LABELS`.

**Convention:** new pure business logic goes in `lib/` with matching tests. UI-coupled or
Supabase-coupled code is deliberately kept out of the tested surface (the testable decision logic
is extracted, e.g. `edits.ts`).

---

## 8. Commands & testing

```bash
# web/
npm run dev            # dev server (http://localhost:3000); prefix env NEXT_PUBLIC_USE_MOCK_DATA=true to run backendless
npm run build          # production build - the real type/compile gate
npm test               # vitest run - keep green
npm run test:coverage  # vitest + v8 coverage (lib/** and components/**, excluding components/ui/**)

# budget-pipeline/ (venv active)
python budget.py --all [--dry-run]
python -m pytest tests/ -v
```

Coverage is scoped to pure logic (`lib/**`, `components/**` minus `ui/`); `app/**` server
actions and `lib/supabase/**` are intentionally out of scope (Supabase-coupled). The
`lib/import/*` and `lib/finance`/`lib/utils` modules sit at ~100% line coverage.

- Keep `npm test` and `npm run build` green. There is **no ESLint config** (see `TECH-DEBT.md`).
- Plain dash `-`, never the em dash. No agent co-author trailers on commits.
- Prefer quality/simplicity/maintainability over saving implementation effort.
- Default branch is `main`; feature work happens on branches (currently `redesign`).
