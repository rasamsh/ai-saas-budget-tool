-- Per-user, per-year income so salary changes across years are tracked correctly.
CREATE TABLE user_income (
  user_id       UUID           NOT NULL,
  year          INT            NOT NULL,
  annual_income NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ    DEFAULT NOW(),
  PRIMARY KEY (user_id, year)
);

ALTER TABLE user_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own income" ON user_income
  FOR ALL USING (user_id = auth.uid());
