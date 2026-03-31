export type Currency = 'VND' | 'USD';
export type Language = 'vi' | 'en';
export type AssetTrackingType = 'none' | 'stock' | 'gold' | 'fund' | 'crypto';

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
  target_amount: number | null;
  include_in_total: boolean;
  tracking_type: AssetTrackingType;
  ticker_symbol: string | null;
  quantity: number | null;
  purchase_unit_price: number | null;
  purchase_date: string | null;
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
  targetAmount?: number | null;
  includeInTotal?: boolean;
  trackingType?: AssetTrackingType;
  tickerSymbol?: string | null;
  quantity?: number | null;
  purchaseUnitPrice?: number | null;
  purchaseDate?: string | null;
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
  trackingType?: AssetTrackingType;
  tickerSymbol?: string;
  quantity?: number;
  purchaseUnitPrice?: number;
  purchaseDate?: string;
  note?: string;
};

export type ChatAttachment = {
  name: string;
  mimeType: string;
  base64Data: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
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
