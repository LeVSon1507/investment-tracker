export type GoldPriceRow = {
  groupName: string;
  productName: string;
  buyPrice: number;
  sellPrice: number;
  convertedPrice: number;
};

export type StockQuote = {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: string | null;
  source: string;
};

export type MarketOverview = {
  goldPrices: GoldPriceRow[];
  stockQuotes: StockQuote[];
  updatedAt: string;
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    if (normalized.length === 0) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeFireAntQuote(
  symbol: string,
  payload: unknown,
): StockQuote | null {
  const source = "FireAnt";

  if (Array.isArray(payload) && payload.length > 0) {
    const latest = payload[payload.length - 1] as Record<string, unknown>;
    const price =
      readNumber(latest.matchPrice) ??
      readNumber(latest.price) ??
      readNumber(latest.closePrice) ??
      readNumber(latest.lastPrice);

    if (price === null) return null;

    return {
      symbol,
      price,
      change:
        readNumber(latest.change) ?? readNumber(latest.priceChange) ?? null,
      changePercent:
        readNumber(latest.changePercent) ??
        readNumber(latest.percentChange) ??
        null,
      volume:
        readNumber(latest.totalVolume) ?? readNumber(latest.volume) ?? null,
      timestamp:
        (typeof latest.time === "string" && latest.time) ||
        (typeof latest.tradingDate === "string" && latest.tradingDate) ||
        null,
      source,
    };
  }

  if (payload && typeof payload === "object") {
    const item = payload as Record<string, unknown>;
    const price =
      readNumber(item.matchPrice) ??
      readNumber(item.price) ??
      readNumber(item.closePrice) ??
      readNumber(item.lastPrice);

    if (price === null) return null;

    return {
      symbol,
      price,
      change: readNumber(item.change) ?? readNumber(item.priceChange) ?? null,
      changePercent:
        readNumber(item.changePercent) ??
        readNumber(item.percentChange) ??
        null,
      volume: readNumber(item.totalVolume) ?? readNumber(item.volume) ?? null,
      timestamp:
        (typeof item.time === "string" && item.time) ||
        (typeof item.tradingDate === "string" && item.tradingDate) ||
        null,
      source,
    };
  }

  return null;
}

export function extractStockSymbols(investmentNames: string[]): string[] {
  const symbolSet = new Set<string>();

  for (const investmentName of investmentNames) {
    const matches = investmentName.toUpperCase().match(/\b[A-Z]{3,5}\b/g) ?? [];
    for (const match of matches) {
      symbolSet.add(match);
    }
  }

  return Array.from(symbolSet);
}

export function normalizeTickerSymbol(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function findLiveUnitPrice(
  trackingType: string | null | undefined,
  tickerSymbol: string | null | undefined,
  investmentName: string,
  overview: MarketOverview | null,
): number | null {
  if (!overview) return null;

  if (
    trackingType === "stock" ||
    trackingType === "fund" ||
    trackingType === "crypto"
  ) {
    const normalizedTicker = normalizeTickerSymbol(
      tickerSymbol ?? investmentName,
    );
    if (!normalizedTicker) return null;
    const quote = overview.stockQuotes.find(
      (item) => item.symbol === normalizedTicker,
    );
    return quote?.price ?? null;
  }

  if (trackingType === "gold") {
    const loweredName = investmentName.trim().toLowerCase();
    const normalizedTicker =
      normalizeTickerSymbol(tickerSymbol)?.toLowerCase() ?? null;
    const goldPrice = overview.goldPrices.find((item) => {
      const productName = item.productName.trim().toLowerCase();
      return (
        productName === loweredName ||
        (normalizedTicker !== null && productName === normalizedTicker)
      );
    });

    return goldPrice?.sellPrice ?? null;
  }

  return null;
}
