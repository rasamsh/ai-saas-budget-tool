# Ledgii — Product Roadmap

> Prioritized by user impact. Features are grouped by where they live in the product.
>
> Implemented and removed from this list: Spending Trend Arrows on KPIs, Recurring Subscriptions Panel, Month-over-Month Sparklines in the Month Grid, Cash Flow Waterfall, Day-of-Month Spending Heatmap, Flag / Notes on Transactions, Recurring vs. One-Time Spend Split, Category Benchmarks, Anomaly Alerts.

---

## Main Dashboard (Year View)

### 1. Budget Targets per Category
Set a monthly cap per category (e.g. $600 Dining, $200 Entertainment) and see a progress bar showing actual vs. budget across the year. Without this, Ledgii tells you what happened but not whether it was acceptable. The single most-requested feature in personal finance apps. *Implementation:* new `category_budgets` table (user_id, category, monthly_limit, effective_from), RLS scoped per user; edit per category in the settings category dialog. Year page shows `monthly_limit × months elapsed` vs. actual.

---

## Month Dashboard

### 2. Category Budget Progress Bars
Feeds from #1. Each category in the donut gets a progress bar: `Dining $480 / $600 · 80%`; color green under 80%, amber 80-100%, red over. Turns a historical view into an actionable one mid-month.

### 3. Pace Indicator — "On Track" / "Over Pace"
Mid-month, compare spend-to-date against the expected pace (budget × days elapsed / days in month). A simple status line: "You've spent 68% of your expense budget with 60% of the month remaining — 8% ahead of pace." *Implementation:* a pure `paceStatus(spendToDate, totalBudget, dayOfMonth, daysInMonth)` (unit-tested); show only for the current month.

---

## Transactions

### 4. Manual Transaction Entry — Low Priority
Cash transactions, Venmo payments, and personal transfers never appear in bank exports. A simple "+ Add transaction" form closes that gap. Without it, cash-heavy users have an incomplete picture. *Implementation:* dialog (reuse the flag-dialog Radix pattern) + a server action (like `app/actions/income.ts`); mark rows as manual (`source: 'manual'` or a dedicated account) so the dedupe pipeline never collides with them. This is the canonical "add an expense in 5 seconds" interaction for the eventual mobile app.

### 5. Split Transactions
A Costco run that's 40% groceries, 30% household, 30% personal care gets lumped into one category. Splitting at the transaction level makes category totals accurate.

---

## Data Import

> The in-app CSV importer shipped (drag-drop on `/settings/imports`, parses → categorizes →
> dedupes → uploads under the user's RLS session; a TS port of the `budget-pipeline/` CLI).
> These are the follow-ups that were deferred from that work.

### Editable import rules per user
Bank-to-account mapping, exclude patterns, override-merchant rules, and the category keyword
rules are currently checked-in modules (`web/lib/import/manifest.ts`, `rules.ts`) duplicated
from the Python pipeline's YAML. Move them to per-user tables (`import_profiles`, editable
categories) so users can manage their own without a code change. Also removes the two-language
duplication tracked in `TECH-DEBT.md`.

### In-app recategorize
Port the CLI's `--recategorize` (re-apply the current category rules to existing transactions
and patch `category`/`txn_type`) into a Settings action, so rule changes can be applied
retroactively from the browser.

### Undo / delete an import batch
The Import Log lists batches but they can't be reverted. Add a delete that cascades the
batch's transactions, for recovering from a bad import.

---

## Net Worth & Goals

### 6. Net Worth Tracker
The biggest gap in Ledgii vs. tools like Personal Capital. Users manually enter account balances (checking, savings, brokerage, mortgage balance, car loan) once a month. Ledgii plots the curve over time. The most motivating chart in personal finance — watching net worth climb month over month.

### 7. Savings Goals
Users define goals: Emergency Fund ($15k target, $8k saved), Vacation ($3k by August), Down Payment ($60k by 2028). Monthly surplus auto-contributes toward goals. Turns an abstract savings rate into something concrete and motivating.

### 8. Debt Payoff Tracker
Track individual debts by name, balance, interest rate, and minimum payment. Ledgii already captures `debt_payments` — extend it to show payoff trajectory. Optionally model avalanche vs. snowball repayment strategies. High emotional value for users carrying student loans or credit card debt.

---

## Insights & Intelligence

### 9. Monthly Insights Card
A narrative summary generated server-side: "Your best savings month this year. Dining spend dropped 22%. You hit your emergency fund goal." Simple text, but it makes users want to open the app each month. This is the positive mirror to the existing (warning-only) anomaly banner. *Implementation:* a pure `computeHighlights()` (unit-tested) over data already computed — best-savings month, category drops, streaks ("3 months under budget in a row") — rendered as a sibling banner.

---

## Delight & Engagement

Small, high-fun-per-effort touches. Guardrail: playful chrome, sober numbers (the pixel font never renders amounts).

### 10. Land on "now"
`web/app/page.tsx` redirects to `/[year]`; redirect to the current month `/[year]/[month]` instead and add a "Today" link in the nav. Users open a budget app asking "how am I doing this month?"

### 11. Celebration moment
When a month's savings rate meets the user's target (or is a yearly best), show a one-time subtle celebration on the month page (uses the `celebrating` mascot variant). Respect `prefers-reduced-motion`.

### 12. Year recap ("Wrapped")
A December/January shareable summary built entirely from existing data: total saved, top merchant, biggest month, longest streak. Low effort, high fun.

### 13. Year/month picker
The nav only links the current year; deep history requires arrow-stepping. Add a small popover picker (Radix popover is already a dependency).

### 14. KPI count-up animation
Animate KPI card values counting up on load (`components/kpi-card.tsx`), respecting `prefers-reduced-motion`.

---

## Build Order (Recommended)

| Priority | Feature | Why First |
|---|---|---|
| 1 | Budget targets + progress bars (#1, #2) | Converts a tracker into an actionable tool |
| 2 | Net worth tracker (#6) | Biggest retention driver — serves long-term motivation |
| 3 | Monthly Insights Card (#9) | Makes the app feel intelligent, low effort now that anomaly/benchmark data is already computed |
