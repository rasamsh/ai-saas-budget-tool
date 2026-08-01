-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Accounts ────────────────────────────────────────────────────────────────
CREATE TABLE accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  bank       TEXT NOT NULL CHECK (bank IN ('chase', 'amex', 'citi', 'bofa')),
  user_id    UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Account names must be unique per user, not globally
  UNIQUE (user_id, name)
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own accounts" ON accounts
  FOR ALL USING (user_id = auth.uid());

-- ─── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE categories (
  name     TEXT PRIMARY KEY,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('expense', 'income', 'investment', 'debt')),
  color    TEXT NOT NULL DEFAULT '#6b7280'
);

-- Categories are global reference data (same for all users).
-- RLS is enabled so the anon key cannot write; reads are open to everyone.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON categories
  FOR SELECT USING (true);
-- INSERT / UPDATE / DELETE require the service_role key (used only by the pipeline).

-- Seed built-in categories
INSERT INTO categories (name, txn_type, color) VALUES
  ('Groceries',          'expense',    '#22c55e'),
  ('Dining',             'expense',    '#f97316'),
  ('Shopping',           'expense',    '#8b5cf6'),
  ('Subscriptions',      'expense',    '#3b82f6'),
  ('Transportation',     'expense',    '#6366f1'),
  ('Utilities',          'expense',    '#0ea5e9'),
  ('Healthcare',         'expense',    '#ec4899'),
  ('Travel',             'expense',    '#14b8a6'),
  ('Car Insurance',      'expense',    '#64748b'),
  ('Misc',               'expense',    '#6b7280'),
  ('Car Loan',           'debt',       '#f59e0b'),
  ('Taxable Brokerage',  'investment', '#2563eb'),
  ('529 Plan',           'investment', '#7c3aed'),
  ('Income',             'income',     '#16a34a');

-- ─── Import Batches ───────────────────────────────────────────────────────────
CREATE TABLE import_batches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at       TIMESTAMPTZ DEFAULT NOW(),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  file_count        INT NOT NULL,
  transaction_count INT NOT NULL,
  user_id           UUID NOT NULL
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own batches" ON import_batches
  FOR ALL USING (user_id = auth.uid());

-- ─── Transactions ─────────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  merchant        TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  category        TEXT NOT NULL REFERENCES categories(name),
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('expense', 'income', 'investment', 'debt')),
  account_id      UUID NOT NULL REFERENCES accounts(id),
  import_batch_id UUID REFERENCES import_batches(id),
  hash            TEXT NOT NULL,
  user_id         UUID NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Hash deduplication is per user — two users can share identical transactions
  UNIQUE (user_id, hash)
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transactions" ON transactions
  FOR ALL USING (user_id = auth.uid());

-- Performance indexes
CREATE INDEX ON transactions (date);
CREATE INDEX ON transactions (txn_type);
CREATE INDEX ON transactions (category);
CREATE INDEX ON transactions (date, txn_type);
CREATE INDEX ON transactions (account_id);
CREATE INDEX ON transactions (user_id, date DESC);

-- ─── Monthly Summary View ─────────────────────────────────────────────────────
-- security_invoker = true: view runs as the calling user so RLS on transactions
-- is enforced — without it the view owner bypasses RLS and leaks all users' data.
CREATE VIEW monthly_summaries WITH (security_invoker = true) AS
SELECT
  user_id,
  EXTRACT(YEAR  FROM date)::INT AS year,
  EXTRACT(MONTH FROM date)::INT AS month,
  COALESCE(SUM(amount) FILTER (WHERE txn_type = 'income'),     0) AS income,
  COALESCE(SUM(amount) FILTER (WHERE txn_type = 'expense'),    0) AS expenses,
  COALESCE(SUM(amount) FILTER (WHERE txn_type = 'investment'), 0) AS invested,
  COALESCE(SUM(amount) FILTER (WHERE txn_type = 'debt'),       0) AS debt_payments,
  ROUND(
    CASE
      WHEN SUM(amount) FILTER (WHERE txn_type = 'income') = 0 THEN NULL
      ELSE 100.0 * (
        SUM(amount) FILTER (WHERE txn_type = 'income')
        - SUM(amount) FILTER (WHERE txn_type = 'expense')
        - SUM(amount) FILTER (WHERE txn_type = 'debt')
      ) / SUM(amount) FILTER (WHERE txn_type = 'income')
    END
  , 1) AS savings_rate_pct
FROM transactions
GROUP BY user_id, EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
ORDER BY user_id, EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date);

-- ─── Monthly Category Totals View ─────────────────────────────────────────────
CREATE VIEW monthly_category_totals WITH (security_invoker = true) AS
SELECT
  user_id,
  EXTRACT(YEAR  FROM date)::INT AS year,
  EXTRACT(MONTH FROM date)::INT AS month,
  category,
  txn_type,
  COUNT(*)       AS transaction_count,
  SUM(amount)    AS total_amount
FROM transactions
GROUP BY user_id, EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date), category, txn_type;
