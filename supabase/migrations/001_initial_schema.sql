-- ============================================
-- InvestTracker - Initial Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Investment Categories (Danh mục đầu tư / "Hũ")
CREATE TABLE investment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_name TEXT NOT NULL,
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#6366f1',
  target_amount BIGINT DEFAULT NULL,  -- Max amount for this jar
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Investments (Khoản đầu tư)
CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES investment_categories(id) ON DELETE SET NULL,
  investment_name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  note TEXT,
  invested_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Investment Snapshots (Lịch sử snapshot)
CREATE TABLE investment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_amount BIGINT NOT NULL,
  category_breakdown JSONB NOT NULL DEFAULT '{}',
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Row Level Security (RLS)
-- Each user can only see their own data
-- ============================================

ALTER TABLE investment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_snapshots ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Users can view own categories"
  ON investment_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON investment_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON investment_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON investment_categories FOR DELETE
  USING (auth.uid() = user_id);

-- Investments policies
CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investments"
  ON investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investments"
  ON investments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investments"
  ON investments FOR DELETE
  USING (auth.uid() = user_id);

-- Snapshots policies
CREATE POLICY "Users can view own snapshots"
  ON investment_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON investment_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Auto-set user_id on insert (triggers)
-- ============================================

CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_category_user_id
  BEFORE INSERT ON investment_categories
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_investment_user_id
  BEFORE INSERT ON investments
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_snapshot_user_id
  BEFORE INSERT ON investment_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_categories_user ON investment_categories(user_id);
CREATE INDEX idx_investments_user ON investments(user_id);
CREATE INDEX idx_investments_category ON investments(category_id);
CREATE INDEX idx_investments_date ON investments(invested_at DESC);
CREATE INDEX idx_snapshots_user_date ON investment_snapshots(user_id, snapshot_date DESC);
