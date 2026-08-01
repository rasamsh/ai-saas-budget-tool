# Tech Debt & Engineering Plan

> The single home for non-feature engineering work: cleanup, code-quality debt, and the
> architecture/mobile-readiness plan. Product features live in `ROADMAP.md`; codebase
> orientation is in `CLAUDE.md`. Keep items concrete and specific.

## In-app CSV import (`web/lib/import/`, `web/app/actions/import.ts`)

The web import is a hand-port of the Python pipeline in `budget-pipeline/`. That creates
real, ongoing debt:

- **Duplicated rules across two languages.** `web/lib/import/rules.ts` mirrors
  `budget-pipeline/config/categories.yaml`, and `web/lib/import/manifest.ts` mirrors
  `budget-pipeline/input/manifest.yaml`. A change to one must be made in the other by hand.
  There is no automated drift check — only the golden-vector hash test
  (`web/__tests__/import/hash.test.ts`) guards the hashing contract, not the rule sets.
  Consider generating the TS modules from the YAML at build time, or making rules
  per-user data (see the ROADMAP "Data import" follow-ups).
- **Hash parity is load-bearing and only test-guarded.** `web/lib/import/hash.ts` must stay
  byte-identical to `budget-pipeline/deduplicator.py::compute_hash` or every web import
  duplicates the user's CLI history. Protected by golden vectors + a 2-decimal
  representability assertion. If you touch either hasher, re-verify against the other.
- **ACH scrub names are a single global env var** (`IMPORT_ACH_SCRUB_NAMES`), a single-user
  assumption. Should be per-user data.
- **Commit is not atomic.** supabase-js has no multi-statement transaction, so
  `commitImport` does accounts → batch → chunked inserts → count backfill, with orphan-batch
  rollback on failure. It is idempotent (the `UNIQUE(user_id, hash)` constraint makes retries
  safe) but a Postgres RPC would be strictly correct.
- **Unknown categories block the preview** instead of offering to create them. The web app
  can't write the `categories` table under RLS (service-role only, by design), so a rule that
  produces a category missing from the DB fails the preview with a warning. Adding a category
  still requires the pipeline / SQL.

## Visual / design (Hi-Bit refresh, now shipped)

- **No screenshot QA pass was ever done** at 375px and 1280px, light and dark, across login /
  year / month (data + empty) / settings / imports. The refresh shipped by construction +
  `tsc`/tests but was never eyeballed in a browser (no browser in the agent env). Do this pass.
- **Category icons** are still not implemented (an `icon` column, editable in the category
  dialog, rendered in donut legend, chips, table). `lucide-react` is already a dependency.
- **System theme preference is disabled**: `web/app/layout.tsx` has
  `enableSystem={false} defaultTheme="light"`. Dark tokens exist and the toggle works; just
  enable system preference.

## Code quality

- **Swallowed Supabase errors.** Every dashboard/settings query ignores `error` and renders
  "no data" on failure — reads as data loss. Surface an error state. (both dashboard pages,
  settings pages)
- **Settings over-fetches.** `web/app/settings/page.tsx` pulls all transaction rows just to
  count per category/account; use grouped count queries.
- **`as any` casts** in `web/app/[year]/page.tsx` (~lines 94-98) — type the transaction select
  result properly.
- **Search is merchant-only** in `web/components/transaction-table.tsx`; include category and
  notes.
- **Hardcoded chart colors** (`#ef4444`, etc.) scattered across `month-grid.tsx` and chart
  components; centralize as tokens.

## Testing / tooling

- **ESLint is not configured** in `web/` (running `next lint` triggers first-time setup). The
  repo has no lint gate. Either wire up `eslint-config-next` or drop the `npm run lint`
  expectation from the definition of done below.

## Architecture & mobile-readiness

Forward-looking engineering initiatives that keep the codebase healthy and unblock a future
native app. Do the shared-core extraction early, while the surface is still small.

### Extract a shared core package (mobile prerequisite)
A future React Native app can't reuse server components, yet all Supabase queries + aggregation
live inline in `web/app/[year]/page.tsx` (6 queries) and `web/app/[year]/[month]/page.tsx`
(8 queries). Convert the repo into a workspace (npm workspaces / turborepo) and create
`packages/core` with:
- `types.ts` (moved from `web/lib/supabase/types.ts`),
- `finance.ts` (moved from `web/lib/finance.ts` — pure math, no changes),
- `format.ts` (the non-DOM parts of `web/lib/utils.ts`: `formatCurrency`, `formatSavingsRate`,
  `calcTrend`, month names; leave `cn()` in web),
- `queries/` — `getYearDashboardData(supabase, userId, year)` /
  `getMonthDashboardData(supabase, userId, year, month)` that take a `SupabaseClient` and return
  typed, aggregated view models; move the inline page aggregation (YTD sums, prior-year matching,
  top category per month, top merchants, savings rate) into them.

Web pages become thin (create client → call query → render). Move the corresponding tests too.
**Acceptance:** `packages/core` has zero `next`/`react`/DOM imports; the app renders identically;
`npm test` green. Fix the two `as any` casts in `web/app/[year]/page.tsx` while here.

### Mobile-web / PWA polish
Stepping stone to native; also improves the phone web experience today.
- **PWA:** `manifest.json`, icons, theme color, viewport meta — installable on a home screen.
- **Bottom tab bar on small screens** (Year / Month / Settings); keep the top nav on `sm:`+.
- **KPI grid orphan:** the month page's `grid-cols-2 lg:grid-cols-5` renders 2/2/1 on phones and
  orphans the 5th card; use a layout that doesn't (full-width savings card or scroll-snap row).
- **Transaction rows on mobile:** below `sm:`, render card-style rows (merchant + category dot,
  then date + amount) instead of the dense 6-column table (`components/transaction-table.tsx`).
- **Touch targets:** the flag-dialog trigger (and any remaining arrow controls) are below
  44×44px; enlarge hit areas.
- **Category chips:** make the chip row horizontally scrollable below `sm:` instead of wrapping.
- **Charts on touch:** Recharts tooltips are hover-only; add tap-to-pin or a legend fallback on
  donut, annual chart, and heatmap.

### Native app (when the time comes)
Prerequisites: the shared-core extraction above, in-app import (done), manual entry
(`ROADMAP.md` #4), and the touch-UX learnings from the PWA work. Stack: Expo + Expo Router
(mirrors the `app/[year]/[month]` file routing), `@supabase/supabase-js` (first-class RN support;
auth via AsyncStorage), NativeWind (reuses `web/tailwind.config.ts` tokens). Recharts is DOM-only
and won't port — keep shaping chart data in `packages/core` (the `buildSankeyLayout` pattern is
the model) and write thin native renderers with Victory Native or Skia. Mobile reuses everything
in `packages/core`; it reimplements rendering only.

## Definition of done (any change)
1. `npm test` passes from `web/` (and `packages/core` once it exists).
2. New pure logic has unit tests; UI changes verified at 375px and 1280px, light and dark.
3. No new `any` casts and no ignored Supabase errors.
4. `npm run lint` once ESLint is wired up (see Testing / tooling).
