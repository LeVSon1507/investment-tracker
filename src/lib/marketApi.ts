import type { MarketOverview } from './marketData';

type MarketApiResponse = Partial<MarketOverview> & {
  error?: string;
};

export async function fetchMarketOverview(symbols: string[]): Promise<MarketOverview> {
  const searchParams = new URLSearchParams();
  searchParams.set('type', 'overview');
  if (symbols.length > 0) {
    searchParams.set('symbols', symbols.join(','));
  }

  const response = await fetch(`/api/market?${searchParams.toString()}`);
  const payload = (await response.json()) as MarketApiResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? 'Không thể tải dữ liệu thị trường');
  }

  return {
    goldPrices: payload.goldPrices ?? [],
    stockQuotes: payload.stockQuotes ?? [],
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
  };
}
