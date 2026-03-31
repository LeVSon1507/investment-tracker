ALTER TABLE investments
ADD COLUMN IF NOT EXISTS tracking_type TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS ticker_symbol TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quantity NUMERIC(20, 8) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS purchase_unit_price BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS purchase_date DATE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_investments_tracking_type
  ON investments(user_id, tracking_type);

CREATE INDEX IF NOT EXISTS idx_investments_ticker_symbol
  ON investments(user_id, ticker_symbol);
