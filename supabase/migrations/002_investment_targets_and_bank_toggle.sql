ALTER TABLE investments
ADD COLUMN IF NOT EXISTS target_amount BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS include_in_total BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_investments_include_in_total
  ON investments(user_id, include_in_total);
