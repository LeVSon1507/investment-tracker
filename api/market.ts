import {
  normalizeFireAntQuote,
  type GoldPriceRow,
  type MarketOverview,
  type StockQuote,
} from "../src/lib/marketData";

type VangTodayPriceItem = {
  name: string;
  buy: number;
  sell: number;
  change_buy: number;
  change_sell: number;
  currency: string;
};

type VangTodayResponse = {
  success: boolean;
  prices: Record<string, VangTodayPriceItem>;
};

const GOLD_TYPE_LABELS: Record<string, string> = {
  SJL1L10: "SJC 9999",
  SJ9999: "Nhẫn SJC",
  DOHNL: "DOJI Hà Nội",
  DOHCML: "DOJI HCM",
  DOJINHTV: "DOJI Nữ Trang",
  BTSJC: "Bảo Tín SJC",
  BT9999NTT: "Bảo Tín 9999",
  PQHNVM: "PNJ Hà Nội",
  PQHN24NTT: "PNJ 24K",
  VNGSJC: "VN Gold SJC",
  VIETTINMSJC: "Viettin SJC",
};

async function fetchGoldPrices(): Promise<MarketOverview["goldPrices"]> {
  const response = await fetch("https://www.vang.today/api/prices", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`vang.today API error: ${response.status}`);
  }

  const payload = (await response.json()) as VangTodayResponse;

  if (
    !payload.success ||
    typeof payload.prices !== "object" ||
    payload.prices === null
  ) {
    throw new Error("vang.today: unexpected response format");
  }

  return Object.entries(payload.prices)
    .filter(
      ([typeCode, item]) => typeCode !== "XAUUSD" && item.currency === "VND",
    )
    .map(
      ([typeCode, item]): GoldPriceRow => ({
        groupName: "Trong nước",
        productName: GOLD_TYPE_LABELS[typeCode] ?? item.name,
        buyPrice: item.buy,
        sellPrice: item.sell,
        convertedPrice: item.sell,
      }),
    );
}

async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return null;

  const primaryResponse = await fetch(
    `https://restv2.fireant.vn/stocks/${normalizedSymbol}/quotes`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    },
  );

  if (primaryResponse.ok) {
    const payload = await primaryResponse.json();
    return normalizeFireAntQuote(normalizedSymbol, payload);
  }

  const fallbackResponse = await fetch(
    `https://restv2.fireant.vn/symbols/${normalizedSymbol}/intraday`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    },
  );

  if (!fallbackResponse.ok) {
    return null;
  }

  const payload = await fallbackResponse.json();
  return normalizeFireAntQuote(normalizedSymbol, payload);
}

async function fetchDragonCapitalQuote(
  symbol: string,
): Promise<StockQuote | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!["DCDS", "DCDE", "DCBF", "DCIP"].includes(normalizedSymbol)) {
    return null;
  }

  const listingResponse = await fetch(
    "https://dautu.dragoncapital.com.vn/tin-tuc",
    {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0",
      },
    },
  );

  if (!listingResponse.ok) {
    return null;
  }

  const listingHtml = await listingResponse.text();
  const articleMatches = Array.from(
    listingHtml.matchAll(
      /href="(https?:\/\/dautu\.dragoncapital\.com\.vn\/tin-tuc\/[^"]+|\/tin-tuc\/[^"]+)"/g,
    ),
  ).map((match) => match[1]);

  const articleUrl = articleMatches.find((href) =>
    href.toUpperCase().includes(normalizedSymbol),
  );
  if (!articleUrl) {
    return null;
  }

  const resolvedUrl = articleUrl.startsWith("http")
    ? articleUrl
    : `https://dautu.dragoncapital.com.vn${articleUrl}`;
  const articleResponse = await fetch(resolvedUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!articleResponse.ok) {
    return null;
  }

  const articleHtml = await articleResponse.text();
  const navMatch = articleHtml.match(/NAV\/CCQ[^0-9]{0,30}([\d.,]+)/i);
  if (!navMatch) {
    return null;
  }

  const parsedPrice = Number(navMatch[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(parsedPrice)) {
    return null;
  }

  return {
    symbol: normalizedSymbol,
    price: parsedPrice,
    change: null,
    changePercent: null,
    volume: null,
    timestamp: new Date().toISOString(),
    source: "Dragon Capital",
  };
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "overview";
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  try {
    if (type === "gold") {
      return Response.json({
        goldPrices: await fetchGoldPrices(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (type === "stocks") {
      const stockQuotes = await Promise.all(
        symbols.map(async (symbol) => {
          const fireAntQuote = await fetchStockQuote(symbol);
          if (fireAntQuote) return fireAntQuote;
          return fetchDragonCapitalQuote(symbol);
        }),
      );
      return Response.json({
        stockQuotes: stockQuotes.filter(Boolean),
        updatedAt: new Date().toISOString(),
      });
    }

    const [goldPrices, stockQuotes] = await Promise.all([
      fetchGoldPrices(),
      Promise.all(
        symbols.map(async (symbol) => {
          const fireAntQuote = await fetchStockQuote(symbol);
          if (fireAntQuote) return fireAntQuote;
          return fetchDragonCapitalQuote(symbol);
        }),
      ),
    ]);

    return Response.json({
      goldPrices,
      stockQuotes: stockQuotes.filter(Boolean) as StockQuote[],
      updatedAt: new Date().toISOString(),
    } satisfies MarketOverview);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown market proxy error",
      },
      { status: 500 },
    );
  }
}
