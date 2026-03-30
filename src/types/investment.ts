export type Currency = 'VND' | 'USD';
export type Language = 'vi' | 'en';

export type InvestmentCategory = {
  id: string;
  user_id: string;
  category_name: string;
  icon: string;
  color: string;
  target_amount: number | null;
  created_at: string;
};

export type Investment = {
  id: string;
  user_id: string;
  category_id: string | null;
  investment_name: string;
  amount: number;
  note: string | null;
  invested_at: string;
  created_at: string;
  updated_at: string;
  category?: InvestmentCategory;
};

export type InvestmentInput = {
  categoryId: string;
  investmentName: string;
  amount: number;
  note?: string;
  investedAt?: string;
};

export type CategoryInput = {
  categoryName: string;
  icon: string;
  color: string;
  targetAmount?: number | null;
};

export type ParsedInvestmentResult = {
  investmentName: string;
  categoryName: string;
  amount: number;
  note?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsedInvestments?: ParsedInvestmentResult[];
  isConfirmed?: boolean;
  timestamp: Date;
};

export type InvestmentSnapshot = {
  id: string;
  user_id: string;
  total_amount: number;
  category_breakdown: Record<string, number>;
  snapshot_date: string;
  created_at: string;
};

export type UserSettings = {
  salaryDay: number;
  currency: Currency;
  language: Language;
  geminiApiKey: string;
  geminiModel: string;
};

export type InvestmentWithCategory = Investment & {
  category: InvestmentCategory | null;
};
