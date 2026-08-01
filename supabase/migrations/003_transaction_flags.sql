-- ─── Transaction Flags & Notes ─────────────────────────────────────────────
-- Lets users annotate transactions (e.g. "reimbursable", "one-time") and
-- attach free-text notes. No new RLS policy needed — the existing
-- "Users see own transactions" FOR ALL policy already covers UPDATE.
ALTER TABLE transactions
  ADD COLUMN flag  TEXT CHECK (flag IN ('reimbursable', 'one_time', 'excluded')),
  ADD COLUMN notes TEXT;
