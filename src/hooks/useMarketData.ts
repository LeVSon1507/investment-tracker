import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMarketOverview } from "../lib/marketApi";
import { extractStockSymbols, type MarketOverview } from "../lib/marketData";

type UseMarketDataReturn = {
  marketOverview: MarketOverview | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useMarketData(investmentNames: string[]): UseMarketDataReturn {
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize to string to prevent loop: investments.map() creates a new array reference
  // on every render, which would otherwise cause symbols → loadMarketOverview → effect to
  // re-run in a cycle each time marketOverview state updates.
  const investmentNamesKey = investmentNames.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const symbols = useMemo(
    () => extractStockSymbols(investmentNames),
    [investmentNamesKey],
  );

  const loadMarketOverview = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const overview = await fetchMarketOverview(symbols);
      setMarketOverview(overview);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown market data error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    setIsLoading(true);
    loadMarketOverview();

    const intervalId = window.setInterval(() => {
      loadMarketOverview();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [loadMarketOverview]);

  return {
    marketOverview,
    isLoading,
    error,
    refetch: loadMarketOverview,
  };
}
